import { prisma } from "@/lib/prisma";
import type { BillingCycle } from "@prisma/client";

/**
 * Definisi default plan (dipakai untuk seeding & fallback bila DB kosong).
 * Admin dapat mengubah harga/diskon lewat /admin/plans.
 */
export const DEFAULT_PLANS = [
  {
    code: "FREE",
    name: "Free",
    description: "Coba fitur inti tanpa biaya.",
    priceMonthly: 0,
    priceYearly: 0,
    discountPercent: 0,
    prdLimit: 1,
    prototypeLimit: 0,
    features: [
      "1 PRD Draft",
      "Mindmap Canvas preview",
      "Gudang PRD mode blur",
      "Tanpa CLI Sync",
    ],
    isPopular: false,
    sortOrder: 0,
  },
  {
    code: "STARTER",
    name: "Starter",
    description: "Untuk solo developer & side project.",
    priceMonthly: 99000,
    priceYearly: 799000,
    discountPercent: 0,
    prdLimit: 5,
    prototypeLimit: 0,
    features: [
      "Maks. 5 PRD/bulan",
      "Gudang PRD akses penuh",
      "Copy Specs & Export Markdown",
      "CLI Sync aktif",
      "Task Breakdown",
    ],
    isPopular: false,
    sortOrder: 1,
  },
  {
    code: "PRO",
    name: "Pro",
    description: "Untuk tim & produk yang serius.",
    priceMonthly: 199000,
    priceYearly: 1599000,
    discountPercent: 0,
    prdLimit: -1,
    prototypeLimit: 20,
    features: [
      "Unlimited PRD",
      "Gudang PRD + Fork",
      "Priority CLI Sync",
      "Task Breakdown & Style Guide",
      "Support prioritas",
    ],
    isPopular: true,
    sortOrder: 2,
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    description: "Untuk studio & tim multi-produk.",
    priceMonthly: 499000,
    priceYearly: 3999000,
    discountPercent: 0,
    prdLimit: -1,
    prototypeLimit: -1,
    features: [
      "Semua fitur Pro",
      "3 seat + tambah per seat",
      "Library tema tersimpan lintas project",
      "Kolaborasi workspace",
      "Kuota AI ditingkatkan",
      "Onboarding & support khusus",
    ],
    isPopular: false,
    sortOrder: 3,
  },
] as const;

/** PlanType yang valid, map dari Plan.code produksi. */
export type PlanCode = "FREE" | "STARTER" | "PRO" | "ENTERPRISE";

/** Harga dasar (belum diskon) sesuai siklus billing. */
export function basePrice(
  plan: { priceMonthly: number; priceYearly: number },
  cycle: BillingCycle
): number {
  if (cycle === "YEARLY") return plan.priceYearly;
  if (cycle === "QUARTERLY") return plan.priceMonthly * 3;
  return plan.priceMonthly;
}

/**
 * Harga akhir setelah diskon plan (% admin) dan/atau voucher.
 * Mengembalikan rincian agar UI bisa menampilkan harga ter-coret.
 */
export function computePrice(opts: {
  basePrice: number;
  planDiscountPercent?: number;
  voucher?: { discountPercent?: number | null; discountAmount?: number | null };
}): { subtotal: number; planDiscount: number; voucherDiscount: number; total: number } {
  const subtotal = opts.basePrice;
  const planDiscount = Math.round(
    (subtotal * (opts.planDiscountPercent ?? 0)) / 100
  );

  let running = subtotal - planDiscount;
  let voucherDiscount = 0;

  if (opts.voucher?.discountPercent) {
    voucherDiscount = Math.round((running * opts.voucher.discountPercent) / 100);
    running -= voucherDiscount;
  } else if (opts.voucher?.discountAmount) {
    voucherDiscount = Math.min(running, opts.voucher.discountAmount);
    running -= voucherDiscount;
  }

  return {
    subtotal,
    planDiscount,
    voucherDiscount,
    total: Math.max(0, running),
  };
}

/**
 * Pastikan tabel Plan terisi. Dipanggil lazy dari endpoint publik.
 */
export async function ensurePlansSeeded() {
  const count = await prisma.plan.count();
  if (count > 0) return;

  await prisma.plan.createMany({
    data: DEFAULT_PLANS.map((p) => ({
      code: p.code,
      name: p.name,
      description: p.description,
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      discountPercent: p.discountPercent,
      prdLimit: p.prdLimit,
      features: [...p.features],
      isPopular: p.isPopular,
      sortOrder: p.sortOrder,
    })),
  });
}

export function mapCodeToPlanType(
  code: string
): "FREE" | "STARTER" | "PRO" | "PRO_YEARLY" | "ENTERPRISE" {
  if (code === "ENTERPRISE") return "ENTERPRISE";
  if (code === "PRO_YEARLY") return "PRO_YEARLY";
  if (code === "PRO") return "PRO";
  if (code === "STARTER") return "STARTER";
  return "FREE";
}

export function planPrdLimit(code: string): number {
  if (
    code === "PRO" ||
    code === "PRO_YEARLY" ||
    code === "ENTERPRISE"
  )
    return -1;
  if (code === "STARTER") return 5;
  return 1;
}
