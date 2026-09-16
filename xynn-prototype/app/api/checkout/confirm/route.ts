import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planPrdLimit } from "@/lib/plans";
import { NextResponse } from "next/server";
import type { BillingCycle } from "@prisma/client";

interface SessionUser {
  id: string;
}

function durationForCycle(cycle: BillingCycle): number {
  if (cycle === "YEARLY") return 365;
  if (cycle === "QUARTERLY") return 90;
  return 30;
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
  const validUntil = new Date(
    now.getTime() + durationForCycle(transaction.billingCycle) * 24 * 60 * 60 * 1000
  );
  const prdLimit = planPrdLimit(transaction.planType);

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: "SUCCESS" },
    }),
    prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planType: transaction.planType,
        status: "ACTIVE",
        billingCycle: transaction.billingCycle,
        prdLimit,
        startedAt: now,
        validUntil,
      },
      update: {
        planType: transaction.planType,
        status: "ACTIVE",
        billingCycle: transaction.billingCycle,
        prdLimit,
        prdUsedThisMonth: 0,
        startedAt: now,
        validUntil,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    planType: transaction.planType,
    validUntil,
  });
}
