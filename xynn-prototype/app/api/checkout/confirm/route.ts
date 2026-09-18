import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePlanQuota } from "@/lib/plans";
import { computeValidUntil } from "@/lib/billing";
import { NextResponse } from "next/server";

interface SessionUser {
  id: string;
}

/**
 * Konfirmasi/verifikasi pembayaran.
 * - Idempotent: transaksi SUCCESS tidak diproses ulang.
 * - Mengaktifkan langganan sesuai paket & siklus transaksi.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as SessionUser).id;
  const { transactionId } = await req.json();

  if (!transactionId) {
    return NextResponse.json({ error: "transactionId wajib diisi" }, { status: 400 });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction || transaction.userId !== userId) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  }

  // Idempotency: sudah lunas → kembalikan sukses tanpa efek samping.
  if (transaction.status === "SUCCESS") {
    return NextResponse.json({ success: true, alreadyPaid: true });
  }

  const now = new Date();
  // Masa aktif dihitung berbasis kalender (bukan fix 30/90/365 hari).
  const validUntil = computeValidUntil(now, transaction.billingCycle);

  // Kuota (prd & prototype) diambil dari baris Plan di DB agar konsisten dengan
  // apa yang ditampilkan/dijanjikan paket — bukan nilai hardcode.
  const { planType, prdLimit, prototypeLimit } = await resolvePlanQuota(
    transaction.planType
  );

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: "SUCCESS" },
    }),
    prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planType,
        status: "ACTIVE",
        billingCycle: transaction.billingCycle,
        prdLimit,
        prototypeLimit,
        startedAt: now,
        validUntil,
      },
      update: {
        planType,
        status: "ACTIVE",
        billingCycle: transaction.billingCycle,
        prdLimit,
        prototypeLimit,
        prdUsedThisMonth: 0,
        startedAt: now,
        validUntil,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    planType,
    validUntil,
  });
}
