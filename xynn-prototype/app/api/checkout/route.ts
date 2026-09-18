import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret, isEncrypted } from "@/lib/crypto";
import { basePrice, computePrice, mapCodeToPlanType } from "@/lib/plans";
import {
  buildInstruction,
  isGatewayMethod,
  midtransSnapBaseUrl,
  type PaymentMethodId,
} from "@/lib/payments";
import { NextResponse } from "next/server";
import type { BillingCycle } from "@prisma/client";

interface SessionUser {
  id: string;
}

interface CheckoutRequest {
  planCode: string; // 'STARTER' | 'PRO'
  billingCycle: BillingCycle;
  voucherCode?: string;
  method?: PaymentMethodId;
}

type GatewayConfig = {
  id: string | null;
  provider: string;
  isProduction: boolean;
  clientKey: string | null;
  serverKey: string | null;
};

/**
 * Ambil konfigurasi gateway aktif dari DB (serverKey terenkripsi AES-256-GCM,
 * di-decrypt di sini) — termasuk flag `isProduction` yang menentukan Sandbox vs
 * Production. Fallback ke environment variable bila belum dikonfigurasi di DB.
 */
async function resolveGatewayConfig(provider: string): Promise<GatewayConfig> {
  const config = await prisma.paymentConfig.findFirst({
    where: { provider, isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  let serverKey: string | null = null;
  if (config?.serverKeyEncrypted && isEncrypted(config.serverKeyEncrypted)) {
    try {
      serverKey = decryptSecret(config.serverKeyEncrypted);
    } catch {
      // jatuh ke env fallback di bawah
    }
  }

  if (!serverKey) {
    serverKey =
      provider === "midtrans"
        ? process.env.MIDTRANS_SERVER_KEY ?? null
        : process.env.XENDIT_SECRET_KEY ?? null;
  }

  return {
    id: config?.id ?? null,
    provider,
    // Default NON-production (sandbox) bila tak ada config eksplisit.
    isProduction: config?.isProduction ?? false,
    clientKey: config?.clientKey ?? null,
    serverKey,
  };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const { planCode, billingCycle = "MONTHLY", voucherCode, method }: CheckoutRequest =
    await req.json();

  if (!planCode || planCode === "FREE") {
    return NextResponse.json({ error: "Plan tidak valid" }, { status: 400 });
  }

  const plan = await prisma.plan.findUnique({ where: { code: planCode.toUpperCase() } });
  if (!plan || !plan.isActive) {
    return NextResponse.json({ error: "Plan tidak tersedia" }, { status: 400 });
  }

  const subtotal = basePrice(plan, billingCycle);

  // Voucher (opsional).
  let voucher: { discountPercent: number | null; discountAmount: number | null } | null = null;
  let appliedVoucher: string | null = null;
  if (voucherCode?.trim()) {
    const v = await prisma.voucher.findUnique({
      where: { code: voucherCode.trim().toUpperCase() },
    });
    if (!v) return NextResponse.json({ error: "Voucher tidak ditemukan" }, { status: 400 });
    if (v.validUntil && v.validUntil < new Date())
      return NextResponse.json({ error: "Voucher sudah kedaluwarsa" }, { status: 400 });
    if (v.usedCount >= v.maxUses)
      return NextResponse.json({ error: "Voucher sudah habis" }, { status: 400 });
    voucher = { discountPercent: v.discountPercent, discountAmount: v.discountAmount };
    appliedVoucher = v.code;
  }

  const pricing = computePrice({
    basePrice: subtotal,
    planDiscountPercent: plan.discountPercent,
    voucher: voucher ?? undefined,
  });

  const planType = mapCodeToPlanType(planCode.toUpperCase());

  const transaction = await prisma.transaction.create({
    data: {
      userId: user.id,
      amount: pricing.total,
      planType,
      billingCycle,
      status: "PENDING",
    },
  });

  if (appliedVoucher) {
    await prisma.voucher.update({
      where: { code: appliedVoucher },
      data: { usedCount: { increment: 1 } },
    });
  }

  const paymentMode = process.env.PAYMENT_MODE || "dummy";

  // --- Gateway (Midtrans/Xendit) bila dipilih & terkonfigurasi ---
  if (isGatewayMethod(method ?? "qris")) {
    // `midtrans_snap` selalu midtrans; `gateway` warisan mengikuti PAYMENT_MODE.
    const provider =
      method === "midtrans_snap"
        ? "midtrans"
        : paymentMode === "xendit"
          ? "xendit"
          : "midtrans";
    const gateway = await resolveGatewayConfig(provider);

    if (gateway.serverKey) {
      const authString = Buffer.from(`${gateway.serverKey}:`).toString("base64");
      try {
        if (provider === "midtrans") {
          // Base URL Sandbox vs Production mengikuti PaymentConfig.isProduction.
          const snapUrl = `${midtransSnapBaseUrl(gateway.isProduction)}/transactions`;
          const res = await fetch(snapUrl, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Basic ${authString}`,
            },
            body: JSON.stringify({
              transaction_details: {
                order_id: transaction.id,
                gross_amount: pricing.total,
              },
              item_details: [
                {
                  id: planType,
                  name: `Langganan ${plan.code} (${billingCycle})`,
                  price: pricing.total,
                  quantity: 1,
                },
              ],
              customer_details: {
                email: session.user?.email,
                first_name: session.user?.name ?? undefined,
              },
              credit_card: { secure: true },
            }),
          });
          const data = (await res.json()) as {
            redirect_url?: string;
            token?: string;
            error_messages?: string[];
          };
          if (data.redirect_url) {
            // Simpan jejak gateway agar webhook bisa merekonsiliasi transaksi.
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                paymentGatewayId: gateway.id ?? provider,
                paymentRef: data.token ?? null,
              },
            });
            return NextResponse.json({
              transactionId: transaction.id,
              pricing,
              paymentUrl: data.redirect_url,
              mode: "gateway",
              provider: "midtrans",
              sandbox: !gateway.isProduction,
            });
          }
          // Midtrans menolak (mis. kredensial salah / nominal invalid).
          console.warn(
            `[checkout] Midtrans Snap gagal: ${JSON.stringify(data.error_messages ?? data)}`
          );
        } else {
          const res = await fetch("https://api.xendit.co/v2/invoices", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Basic ${authString}`,
            },
            body: JSON.stringify({
              external_id: transaction.id,
              amount: pricing.total,
              customer: { email: session.user?.email, given_names: session.user?.name },
            }),
          });
          const data = (await res.json()) as { invoice_url?: string; id?: string };
          if (data.invoice_url) {
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { paymentGatewayId: gateway.id ?? provider },
            });
            return NextResponse.json({
              transactionId: transaction.id,
              pricing,
              paymentUrl: data.invoice_url,
              mode: "gateway",
              provider: "xendit",
            });
          }
        }
      } catch (e) {
        console.warn(`[checkout] Panggilan gateway gagal: ${(e as Error).message}`);
        // jatuh ke instruksi manual di bawah
      }
    } else {
      // Gateway diminta tapi belum dikonfigurasi — beri pesan jelas.
      const chosen = method === "midtrans_snap" ? "qris" : (method as PaymentMethodId);
      const instruction = buildInstruction(
        chosen,
        pricing.total,
        transaction.id.slice(0, 8).toUpperCase()
      );
      return NextResponse.json({
        transactionId: transaction.id,
        pricing,
        mode: "instruction",
        instruction,
        paid: false,
        warning:
          "Gateway belum dikonfigurasi admin. Gunakan instruksi pembayaran manual berikut.",
      });
    }
  }

  // --- Pembayaran manual (VA/QRIS/E-wallet) → kembalikan instruksi ---
  const chosen = method && !isGatewayMethod(method) ? method : "qris";
  const instruction = buildInstruction(
    chosen,
    pricing.total,
    transaction.id.slice(0, 8).toUpperCase()
  );

  return NextResponse.json({
    transactionId: transaction.id,
    pricing,
    mode: "instruction",
    instruction,
    // Penanda bahwa pembayaran belum lunas.
    paid: false,
  });
}
