import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensurePlansSeeded } from "@/lib/plans";

/**
 * Endpoint publik: daftar plan aktif untuk landing & halaman pricing.
 */
export async function GET() {
  await ensurePlansSeeded();

  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      code: true,
      name: true,
      description: true,
      priceMonthly: true,
      priceYearly: true,
      discountPercent: true,
      prdLimit: true,
      features: true,
      isPopular: true,
    },
  });

  return NextResponse.json(plans);
}
