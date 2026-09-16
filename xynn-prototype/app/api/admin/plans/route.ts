import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensurePlansSeeded } from "@/lib/plans";
import { withDbRetry } from "@/lib/db";

function isAdmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "ADMIN";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await withDbRetry(() => ensurePlansSeeded());
    const plans = await withDbRetry(() =>
      prisma.plan.findMany({ orderBy: { sortOrder: "asc" } })
    );
    return NextResponse.json(plans);
  } catch (error) {
    const code = (error as { code?: string })?.code ?? "unknown";
    console.warn(`[admin/plans] DB unavailable (${code}); returning empty list.`);
    return NextResponse.json([]);
  }
}

interface PlanPayload {
  id?: string;
  code?: string;
  name?: string;
  description?: string;
  priceMonthly?: number;
  priceYearly?: number;
  discountPercent?: number;
  prdLimit?: number;
  features?: string[];
  isActive?: boolean;
  isPopular?: boolean;
  sortOrder?: number;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: PlanPayload = await req.json();

  if (!body.code || !body.name) {
    return NextResponse.json({ error: "code & name wajib diisi" }, { status: 400 });
  }

  const data = {
    code: body.code.toUpperCase(),
    name: body.name,
    description: body.description ?? null,
    priceMonthly: Number(body.priceMonthly ?? 0),
    priceYearly: Number(body.priceYearly ?? 0),
    discountPercent: Math.min(100, Math.max(0, Number(body.discountPercent ?? 0))),
    prdLimit: Number(body.prdLimit ?? 1),
    features: Array.isArray(body.features) ? body.features : [],
    isActive: body.isActive ?? true,
    isPopular: body.isPopular ?? false,
    sortOrder: Number(body.sortOrder ?? 0),
  };

  const existing = await prisma.plan.findUnique({ where: { code: data.code } });
  const saved = existing
    ? await prisma.plan.update({ where: { code: data.code }, data })
    : await prisma.plan.create({ data });

  return NextResponse.json(saved);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });

  await prisma.plan.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
