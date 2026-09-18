import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSecret, isEncrypted } from "@/lib/crypto";
import { activateSubscriptionForTransaction } from "@/lib/subscription-activate";
import { mapMidtransStatus, verifyMidtransSignature } from "@/lib/midtrans";
import crypto from "crypto";

/**
 * Webhook pembayaran.
 *
 * Mendukung DUA format:
 *
 *  1. **Midtrans asli** (Sandbox & Production) — notifikasi HTTP POST dengan body
 *     `{ order_id, status_code, gross_amount, signature_key, transaction_status,
 *       fraud_status, ... }`. Verifikasi:
 *     `signature_key == SHA512(order_id + status_code + gross_amount + serverKey)`.
 *
 *  2. **Custom** (format lama, mis. simulasi) — header `x-payment-signature`
 *     berisi `HMAC-SHA256(body, webhookSecret)` dan body `{ transactionId, status }`.
 *
 * Saat sukses, langganan diaktifkan memakai kuota dari `Plan` DB + masa aktif
 * kalender (`computeValidUntil`) — sama seperti `checkout/confirm` & assign admin.
 */

/** Ambil serverKey midtrans aktif dari DB (terenkripsi) atau env fallback. */
async function midtransServerKey(): Promise<string | null> {
  const config = await prisma.paymentConfig.findFirst({
    where: { provider: "midtrans", isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (config?.serverKeyEncrypted && isEncrypted(config.serverKeyEncrypted)) {
    try {
      return decryptSecret(config.serverKeyEncrypted);
    } catch {
      /* fall through */
    }
  }
  return process.env.MIDTRANS_SERVER_KEY ?? null;
}

export async function POST(req: Request) {
  const body = await req.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Body bukan JSON" }, { status: 400 });
  }

  // ---------- Deteksi format: Midtrans (ada signature_key) vs custom ----------
  if (typeof payload.signature_key === "string") {
    return handleMidtrans(payload as unknown as MidtransNotification);
  }

  return handleCustom(req, body, payload as { transactionId?: string; status?: string });
}

interface MidtransNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
}

async function handleMidtrans(payload: MidtransNotification) {
  try {
    return await handleMidtransInner(payload);
  } catch (e) {
    // Jangan bocorkan detail internal ke pemanggil; catat di server saja.
    console.error("[webhook/midtrans] error:", (e as Error).message);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}

async function handleMidtransInner(payload: MidtransNotification) {
  const serverKey = await midtransServerKey();
  if (!serverKey) {
    return NextResponse.json(
      { error: "Midtrans server key belum dikonfigurasi" },
      { status: 500 }
    );
  }

  const valid = verifyMidtransSignature({
    orderId: payload.order_id,
    statusCode: payload.status_code,
    grossAmount: payload.gross_amount,
    serverKey,
    signatureKey: payload.signature_key,
  });
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // `order_id` yang kita kirim saat checkout = Transaction.id.
  const transaction = await prisma.transaction.findUnique({
    where: { id: payload.order_id },
  });
  if (!transaction) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  }

  const outcome = mapMidtransStatus(
    payload.transaction_status,
    payload.fraud_status
  );

  // Simpan payload mentah untuk audit + status.
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status:
        transaction.status === "SUCCESS" ? "SUCCESS" : outcome,
      gatewayPayload: payload as unknown as object,
      paymentGatewayId: transaction.paymentGatewayId ?? "midtrans",
    },
  });

  // Idempotency: hanya aktifkan sekali.
  if (outcome === "SUCCESS" && transaction.status !== "SUCCESS") {
    await activateSubscriptionForTransaction(transaction);
  }

  return NextResponse.json({ success: true, status: outcome });
}

async function handleCustom(
  req: Request,
  rawBody: string,
  payload: { transactionId?: string; status?: string }
) {
  const signature = req.headers.get("x-payment-signature") || "";

  const gateway = await prisma.paymentConfig.findFirst({
    where: { isActive: true },
  });
  if (!gateway?.webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not set" }, { status: 500 });
  }

  const expected = crypto
    .createHmac("sha256", gateway.webhookSecret)
    .update(rawBody)
    .digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { transactionId, status } = payload;
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });
  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (transaction.status === "SUCCESS") {
    return NextResponse.json({ message: "Already processed" });
  }

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: status === "SUCCESS" ? "SUCCESS" : "FAILED" },
  });

  if (status === "SUCCESS") {
    await activateSubscriptionForTransaction(transaction);
  }

  return NextResponse.json({ success: true });
}
