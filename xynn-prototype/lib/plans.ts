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
      prototypeLimit: p.prototypeLimit,
      features: [...p.features],
      isPopular: p.isPopular,
      sortOrder: p.sortOrder,
    })),
  });
}

export function mapCodeToPlanType(
  code: string
): "FREE" | "STARTER" | "PRO" | "ENTERPRISE" {
  const upper = code.toUpperCase();
  if (upper === "ENTERPRISE") return "ENTERPRISE";
  if (upper === "PRO") return "PRO";
  // `PRO_YEARLY` adalah varian billing (PRO + siklus YEARLY), bukan tier
  // tersendiri — normalisasi ke PRO saat membuat/meng-assign langganan baru.
  if (upper === "PRO_YEARLY") return "PRO";
  if (upper === "STARTER") return "STARTER";
  return "FREE";
}

export function planPrdLimit(code: string): number {
  const upper = code.toUpperCase();
  if (upper === "PRO" || upper === "PRO_YEARLY" || upper === "ENTERPRISE")
    return -1;
  if (upper === "STARTER") return 5;
  return 1;
}

/**
 * Ambil batas kuota (PRD & prototype) dari baris `Plan` di DB.
 *
 * Satu sumber kebenaran: kuota prototype TIDAK di-hardcode per tier, melainkan
 * mengikuti kolom `Plan.prototypeLimit`. Ini mencegah bug "upgrade tapi kuota
 * prototype tetap 0" yang dulu terjadi karena endpoint upgrade hanya mengeset
 * `prdLimit`/`planType` tanpa `prototypeLimit`.
 *
 * Bila baris Plan belum ada (mis. DB baru), jatuh ke nilai default sesuai kode.
 */
export async function resolvePlanQuota(code: string): Promise<{
  planType: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
  prdLimit: number;
  prototypeLimit: number;
}> {
  const planType = mapCodeToPlanType(code);
  const plan = await prisma.plan.findUnique({
    where: { code: planType },
    select: { prdLimit: true, prototypeLimit: true },
  });

  return {
    planType,
    prdLimit: plan?.prdLimit ?? planPrdLimit(planType),
    // Plan.prototypeLimit default schema = 0; samakan fallback-nya.
    prototypeLimit: plan?.prototypeLimit ?? 0,
  };
}
