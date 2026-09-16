import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  try {
    const [subscription, workspaceCount] = await withDbRetry(() =>
      Promise.all([
        prisma.subscription.findUnique({ where: { userId } }),
        prisma.workspace.count({ where: { userId } }),
      ])
    );

    const now = new Date();
    const validUntil = subscription?.validUntil ?? null;
    const isActive = subscription?.status === "ACTIVE";
    const daysLeft = validUntil && isActive ? daysBetween(now, validUntil) : null;

    return NextResponse.json({
      planType: subscription?.planType ?? "FREE",
      status: subscription?.status ?? "INACTIVE",
      billingCycle: subscription?.billingCycle ?? "MONTHLY",
      prdLimit: subscription?.prdLimit ?? 1,
      prdUsedThisMonth: subscription?.prdUsedThisMonth ?? 0,
      prototypeLimit: subscription?.prototypeLimit ?? 0,
      prototypeUsedThisMonth: subscription?.prototypeUsedThisMonth ?? 0,
      workspaceCount,
      startedAt: subscription?.startedAt ?? null,
      validUntil,
      daysLeft,
      isActive,
    });
  } catch (error) {
    console.error("[subscription] DB error:", error);
    // Fallback aman agar UI tidak 500 — anggap FREE tanpa data.
    return NextResponse.json({
      planType: "FREE",
      status: "INACTIVE",
      billingCycle: "MONTHLY",
      prdLimit: 1,
      prdUsedThisMonth: 0,
      prototypeLimit: 0,
      prototypeUsedThisMonth: 0,
      workspaceCount: 0,
      startedAt: null,
      validUntil: null,
      daysLeft: null,
      isActive: false,
    });
  }
}
