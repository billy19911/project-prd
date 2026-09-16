import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapCodeToPlanType, planPrdLimit } from "@/lib/plans";
import type { BillingCycle } from "@prisma/client";

function isAdmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "ADMIN";
}

interface Body {
  userId: string;
  code: string; // FREE | STARTER | PRO | PRO_YEARLY
  billingCycle?: BillingCycle;
  durationDays?: number; // override durasi; default 30 bln / 365 thn
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

  const planType = mapCodeToPlanType(code.toUpperCase());
  const prdLimit = planPrdLimit(code.toUpperCase());

  // FREE = cabut langganan.
  if (planType === "FREE") {
    const updated = await prisma.subscription.upsert({
      where: { userId },
      create: { userId, planType: "FREE", status: "INACTIVE", prdLimit: 1 },
      update: {
        planType: "FREE",
        status: "INACTIVE",
        prdLimit: 1,
        prdUsedThisMonth: 0,
        validUntil: null,
        startedAt: null,
      },
    });
    return NextResponse.json({ success: true, subscription: updated });
  }

  const days =
    durationDays ?? (billingCycle === "YEARLY" ? 365 : billingCycle === "QUARTERLY" ? 90 : 30);

  const now = new Date();
  const validUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const updated = await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      planType,
      status: "ACTIVE",
      billingCycle,
      prdLimit,
      startedAt: now,
      validUntil,
    },
    update: {
      planType,
      status: "ACTIVE",
      billingCycle,
      prdLimit,
      prdUsedThisMonth: 0,
      startedAt: now,
      validUntil,
    },
  });

  return NextResponse.json({ success: true, subscription: updated });
}
