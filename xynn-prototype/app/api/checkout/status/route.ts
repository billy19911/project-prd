import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret, isEncrypted } from "@/lib/crypto";
import { midtransApiBaseUrl } from "@/lib/payments";
import { mapMidtransStatus } from "@/lib/midtrans";
import { activateSubscriptionForTransaction } from "@/lib/subscription-activate";
import { NextResponse } from "next/server";

interface SessionUser {
  id: string;
}

/**
 * Cek status satu transaksi (read-only dari sisi client).
 *
 * Dipakai halaman Settings → Plan SETELAH user kembali dari halaman Snap
 * Midtrans: client memanggil endpoint ini memakai `transactionId` yang disimpan,
 * dan endpoint akan menanyakan status terkini ke Midtrans (bila `order_id`
 * transaksi ini memang dibuat via gateway). Bila sudah lunas, langganan
 * diaktifkan (idempotent) — sehingga user tidak perlu menunggu webhook yang
 * memerlukan URL publik.
 *
 * Tidak membocorkan data transaksi milik user lain: hanya transaksi milik
 * pemanggil yang bisa dicek.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as SessionUser).id;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });

  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction || transaction.userId !== userId) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  }

  // Sudah lunas → tidak perlu tanya gateway lagi.
  if (transaction.status === "SUCCESS") {
    return NextResponse.json({ status: "SUCCESS", planType: transaction.planType });
  }

  // Bila transaksi ini dibuat lewat Midtrans, tanyakan status terkini ke Midtrans.
  const config = await prisma.paymentConfig.findFirst({
    where: { provider: "midtrans", isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  let serverKey: string | null = null;
  if (config?.serverKeyEncrypted && isEncrypted(config.serverKeyEncrypted)) {
    try {
      serverKey = decryptSecret(config.serverKeyEncrypted);
    } catch {
      /* fall through */
    }
  }
  serverKey = serverKey ?? process.env.MIDTRANS_SERVER_KEY ?? null;

  if (serverKey) {
    try {
      const base = midtransApiBaseUrl(config?.isProduction ?? false);
      const authString = Buffer.from(`${serverKey}:`).toString("base64");
      const res = await fetch(`${base}/${transaction.id}/status`, {
        headers: { Accept: "application/json", Authorization: `Basic ${authString}` },
        // Jangan menggantung lama bila Midtrans tidak merespons.
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          transaction_status?: string;
          fraud_status?: string;
        };
        const outcome = mapMidtransStatus(
          data.transaction_status ?? "",
          data.fraud_status
        );

        if (outcome === "SUCCESS") {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: "SUCCESS", paymentGatewayId: transaction.paymentGatewayId ?? "midtrans" },
          });
          await activateSubscriptionForTransaction({
            userId: transaction.userId,
            planType: transaction.planType,
            billingCycle: transaction.billingCycle,
          });
          return NextResponse.json({ status: "SUCCESS", planType: transaction.planType });
        }
        if (outcome === "FAILED") {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: "FAILED" },
          });
          return NextResponse.json({ status: "FAILED" });
        }
        return NextResponse.json({ status: "PENDING" });
      }
    } catch (e) {
      console.warn("[checkout/status] Gagal cek status Midtrans:", (e as Error).message);
    }
  }

  return NextResponse.json({ status: "PENDING" });
}
