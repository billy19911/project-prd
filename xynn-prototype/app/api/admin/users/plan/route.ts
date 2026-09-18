import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePlanQuota } from "@/lib/plans";
import { computeValidUntil } from "@/lib/billing";
import type { BillingCycle } from "@prisma/client";

function isAdmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "ADMIN";
}

interface Body {
  userId: string;
  code: string; // FREE | STARTER | PRO | ENTERPRISE (PRO_YEARLY dinormalisasi ke PRO)
  billingCycle?: BillingCycle;
  durationDays?: number; // override durasi dalam HARI persis (opsional)
}

/**
 * Admin dapat menaikkan/menurunkan paket user (grant, downgrade, reset).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, code, billingCycle = "MONTHLY", durationDays }: Body = await req.json();

  if (!userId || !code) {
    return NextResponse.json({ error: "userId & code wajib diisi" }, { status: 400 });
  }

  // Kuota (prd & prototype) diambil dari baris Plan di DB — satu sumber
  // kebenaran. Mencegah bug kuota prototype tertinggal 0 saat upgrade.
  const { planType, prdLimit, prototypeLimit } = await resolvePlanQuota(code);

  // FREE = cabut langganan.
  if (planType === "FREE") {
    const updated = await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planType: "FREE",
        status: "INACTIVE",
        prdLimit,
        prototypeLimit,
      },
      update: {
        planType: "FREE",
        status: "INACTIVE",
        prdLimit,
        prototypeLimit,
        prdUsedThisMonth: 0,
        prototypeUsedThisMonth: 0,
        validUntil: null,
        startedAt: null,
      },
    });
    return NextResponse.json({ success: true, subscription: updated });
  }

  const now = new Date();
  // Masa aktif: bila admin memberi `durationDays` eksplisit, pakai itu apa adanya
  // (jumlah hari persis). Bila tidak, hitung berbasis kalender sesuai siklus.
  const validUntil =
    durationDays != null
      ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
      : computeValidUntil(now, billingCycle);

  const updated = await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      planType,
      status: "ACTIVE",
      billingCycle,
      prdLimit,
      prototypeLimit,
      startedAt: now,
      validUntil,
    },
    update: {
      planType,
      status: "ACTIVE",
      billingCycle,
      prdLimit,
      prototypeLimit,
      prdUsedThisMonth: 0,
      startedAt: now,
      validUntil,
    },
  });

  return NextResponse.json({ success: true, subscription: updated });
}
