import { prisma } from "@/lib/prisma";
import { resolvePlanQuota } from "@/lib/plans";
import { computeValidUntil } from "@/lib/billing";
import type { BillingCycle, PlanType } from "@prisma/client";

/**
 * Aktifkan/perbarui langganan untuk sebuah transaksi yang sudah lunas.
 *
 * Satu sumber kebenaran yang dipakai oleh `checkout/confirm`, webhook Midtrans,
 * dan cek-status, sehingga kuota (dari `Plan` DB) & masa aktif (kalender) selalu
 * konsisten di semua jalur.
 */
export async function activateSubscriptionForTransaction(tx: {
  userId: string;
  planType: PlanType | string;
  billingCycle: BillingCycle;
}) {
  const now = new Date();
  const validUntil = computeValidUntil(now, tx.billingCycle);
  const { planType, prdLimit, prototypeLimit } = await resolvePlanQuota(
    tx.planType
  );

  return prisma.subscription.upsert({
    where: { userId: tx.userId },
    create: {
      userId: tx.userId,
      planType,
      status: "ACTIVE",
      billingCycle: tx.billingCycle,
      prdLimit,
      prototypeLimit,
      chatLimit: 0,
      startedAt: now,
      validUntil,
    },
    update: {
      planType,
      status: "ACTIVE",
      billingCycle: tx.billingCycle,
      prdLimit,
      prototypeLimit,
      prdUsedThisMonth: 0,
      startedAt: now,
      validUntil,
    },
  });
}
