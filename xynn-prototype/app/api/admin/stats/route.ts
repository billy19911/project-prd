import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";
import { NextResponse } from "next/server";

// Asumsi kurs untuk konversi biaya AI (USD) → IDR.
const USD_TO_IDR = Number(process.env.USD_TO_IDR || 16000);

const EMPTY_STATS = {
  totalRevenue: 0,
  aiCost: 0,
  profit: 0,
  margin: 0,
  aiCostMonth: 0,
  tokensThisMonth: 0,
  totalTokens: 0,
  costByKind: {} as Record<string, number>,
  activeUsers: 0,
  totalUsers: 0,
  proUsers: 0,
  starterUsers: 0,
  freeUsers: 0,
  totalWorkspaces: 0,
  publicWorkspaces: 0,
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let transactions, users, workspaces, usageAll, usageMonth;
  try {
    // Dijalankan berurutan (bukan Promise.all) agar tidak membuka banyak
    // koneksi sekaligus — mengurangi peluang ConnectionClosed pada pool kecil.
    transactions = await withDbRetry(() =>
      prisma.transaction.findMany({ where: { status: "SUCCESS" } })
    );
    users = await withDbRetry(() =>
      prisma.user.findMany({ include: { subscription: true } })
    );
    workspaces = await withDbRetry(() => prisma.workspace.findMany());
    usageAll = await withDbRetry(() => prisma.aiUsage.findMany());
    usageMonth = await withDbRetry(() =>
      prisma.aiUsage.findMany({ where: { createdAt: { gte: startOfMonth } } })
    );
  } catch (error) {
    const code = (error as { code?: string })?.code ?? "unknown";
    console.warn(`[admin/stats] DB unavailable (${code}); returning empty stats.`);
    return NextResponse.json(EMPTY_STATS);
  }

  const totalRevenue = transactions.reduce((acc, t) => acc + t.amount, 0);

  // Token Burn Rate & AI cost dari data nyata (PRD §7B).
  const totalTokens = usageAll.reduce((acc, u) => acc + u.totalTokens, 0);
  const tokensThisMonth = usageMonth.reduce((acc, u) => acc + u.totalTokens, 0);
  const aiCostUsd = usageAll.reduce((acc, u) => acc + u.costUsd, 0);
  const aiCostUsdMonth = usageMonth.reduce((acc, u) => acc + u.costUsd, 0);
  const aiCost = Math.round(aiCostUsd * USD_TO_IDR);
  const aiCostMonth = Math.round(aiCostUsdMonth * USD_TO_IDR);

  const profit = totalRevenue - aiCost;
  const margin = totalRevenue > 0 ? profit / totalRevenue : 0;

  const proUsers = users.filter(
    (u) => u.subscription?.planType === "PRO" || u.subscription?.planType === "PRO_YEARLY"
  ).length;
  const starterUsers = users.filter((u) => u.subscription?.planType === "STARTER").length;
  const freeUsers = users.length - proUsers - starterUsers;
  const activeUsers = users.filter((u) => u.subscription?.status === "ACTIVE").length;

  const publicWorkspaces = workspaces.filter((w) => w.isPublic).length;

  // Breakdown biaya per jenis generate.
  const costByKind = usageAll.reduce<Record<string, number>>((acc, u) => {
    acc[u.kind] = (acc[u.kind] ?? 0) + u.costUsd;
    return acc;
  }, {});

  return NextResponse.json({
    totalRevenue,
    aiCost,
    profit,
    margin,
    aiCostMonth,
    tokensThisMonth,
    totalTokens,
    costByKind: Object.fromEntries(
      Object.entries(costByKind).map(([k, v]) => [k, Math.round(v * USD_TO_IDR)])
    ),
    activeUsers,
    totalUsers: users.length,
    proUsers,
    starterUsers,
    freeUsers,
    totalWorkspaces: workspaces.length,
    publicWorkspaces,
  });
}
