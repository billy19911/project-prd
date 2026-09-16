import type { PlanType, SubStatus } from "@prisma/client";

/**
 * Matriks Hak Akses Pengguna (PRD §3.4).
 * Satu sumber kebenaran agar gate di server & client konsisten.
 *
 * PENTING: status "berbayar" hanya berlaku bila langganan AKTIF dan belum
 * kedaluwarsa. planType saja tidak cukup (mencegah kelolosan saat langganan
 * habis/dibatalkan).
 */
export type AccessTier = "free" | "starter" | "pro" | "enterprise";

export interface SubscriptionLike {
  planType: PlanType | string;
  status?: SubStatus | string | null;
  validUntil?: Date | string | null;
  prdLimit?: number;
  prdUsedThisMonth?: number;
}

/** Cek apakah langganan benar-benar aktif (status ACTIVE & belum kedaluwarsa). */
export function isSubscriptionActive(
  sub: SubscriptionLike | null | undefined
): boolean {
  if (!sub) return false;
  if (sub.planType === "FREE") return false;
  if (sub.status !== "ACTIVE") return false;
  if (sub.validUntil) {
    const until =
      sub.validUntil instanceof Date ? sub.validUntil : new Date(sub.validUntil);
    if (Number.isNaN(until.getTime())) return false;
    if (until.getTime() <= Date.now()) return false;
  }
  return true;
}

export function getAccessTier(sub: SubscriptionLike | null | undefined): AccessTier {
  if (!isSubscriptionActive(sub)) return "free";
  const plan = sub?.planType;
  // Enterprise adalah tier tersendiri (di ATAS Pro), bukan alias Pro —
  // supaya gate yang membedakan keduanya (mis. library tema) bisa bekerja.
  // ⚠️ WAJIB dicantumkan di sini: fallback fungsi ini adalah "free",
  // jadi planType yang tidak dikenal akan kehilangan SELURUH akses berbayar.
  if (plan === "ENTERPRISE") return "enterprise";
  if (plan === "PRO" || plan === "PRO_YEARLY") return "pro";
  if (plan === "STARTER") return "starter";
  return "free";
}

export function isPaid(sub: SubscriptionLike | null | undefined): boolean {
  return getAccessTier(sub) !== "free";
}

/** Apakah tier ini Pro ATAU di atasnya (Enterprise). */
export function isProOrAbove(sub: SubscriptionLike | null | undefined): boolean {
  const tier = getAccessTier(sub);
  return tier === "pro" || tier === "enterprise";
}

/** Vault (Browse & Search) penuh hanya untuk Starter & Pro. */
export function canAccessVault(sub: SubscriptionLike | null | undefined): boolean {
  return isPaid(sub);
}

/**
 * Fork hanya untuk PRO ke atas.
 * ⚠️ Ini satu-satunya gate yang membandingkan tier secara LITERAL
 * (`=== "pro"`), sehingga Enterprise TIDAK otomatis ikut terbuka.
 * Gunakan `isProOrAbove()` agar tidak terulang.
 */
export function canFork(sub: SubscriptionLike | null | undefined): boolean {
  return isProOrAbove(sub);
}

/** Copy Specs & Export Markdown untuk Starter & Pro. */
export function canExport(sub: SubscriptionLike | null | undefined): boolean {
  return isPaid(sub);
}

/** CLI Sync untuk Starter & Pro. */
export function canUseCli(sub: SubscriptionLike | null | undefined): boolean {
  return isPaid(sub);
}

/**
 * Generate Full PRD: Free terkunci; Starter 5/bln, Pro unlimited.
 * Wajib berlangganan aktif.
 */
export function canGeneratePrd(sub: SubscriptionLike | null | undefined): boolean {
  if (!isPaid(sub)) return false;
  const limit = sub?.prdLimit ?? 0;
  if (limit < 0) return true; // -1 = unlimited
  return (sub?.prdUsedThisMonth ?? 0) < limit;
}

/**
 * Task Breakdown & Style Guide: fitur eksekusi lanjutan, khusus paket berbayar
 * aktif (Starter & Pro). Free hanya dapat mindmap + preview PRD.
 */
export function canGenerateAdvanced(
  sub: SubscriptionLike | null | undefined
): boolean {
  return isPaid(sub);
}

/** Export/download markdown (PRD, Task, Style) untuk Starter & Pro aktif. */
export function canDownloadMarkdown(
  sub: SubscriptionLike | null | undefined
): boolean {
  return isPaid(sub);
}

/**
 * Prototype Design (canvas + theme editor) — pembeda Starter vs Pro.
 * Digunakan oleh `/api/ai/prototype` dan tab Prototype di project workspace.
 */
export function canUsePrototype(
  sub: SubscriptionLike | null | undefined
): boolean {
  return isProOrAbove(sub);
}

/**
 * Menyimpan tema sendiri (library lintas-project) — pembeda Pro vs Enterprise.
 * Karena Pro TIDAK mendapatkannya, gate ini adalah alasan utama upgrade
 * dari Pro ke Enterprise.
 */
export function canSaveThemes(
  sub: SubscriptionLike | null | undefined
): boolean {
  return getAccessTier(sub) === "enterprise";
}

/**
 * Generate Prototype Design: Pro ke atas DAN masih ada kuota bulan ini.
 * Kuota diambil dari `prototypeLimit` langganan (-1 = unlimited).
 *
 * Dipisah dari `canUsePrototype` (yang hanya soal tier) supaya UI bisa
 * membedakan "paket tidak mendukung" dari "kuota habis" — dua pesan berbeda.
 */
export function canGeneratePrototype(
  sub: (SubscriptionLike & { prototypeLimit?: number; prototypeUsedThisMonth?: number }) | null | undefined
): boolean {
  if (!isProOrAbove(sub)) return false;
  const limit = sub?.prototypeLimit ?? 0;
  if (limit < 0) return true; // -1 = unlimited
  return (sub?.prototypeUsedThisMonth ?? 0) < limit;
}

/** Sisa kuota prototype bulan ini; `null` bila unlimited. */
export function remainingPrototypeQuota(
  sub: (SubscriptionLike & { prototypeLimit?: number; prototypeUsedThisMonth?: number }) | null | undefined
): number | null {
  const limit = sub?.prototypeLimit ?? 0;
  if (limit < 0) return null;
  const used = sub?.prototypeUsedThisMonth ?? 0;
  return Math.max(0, limit - used);
}

/**
 * Status keterbukaan tiap langkah (mindmap → prd → task → style).
 * Prasyarat: langkah sebelumnya harus sudah ada datanya, dan untuk
 * PRD/Task/Style wajib langganan berbayar aktif.
 */
export type StepAvailability = {
  mindmap: boolean;
  prd: boolean;
  tasks: boolean;
  style: boolean;
};

export function computeStepAvailability(opts: {
  sub: SubscriptionLike | null | undefined;
  hasMindmap: boolean;
  hasPrd: boolean;
  hasTasks?: boolean;
  hasStyle?: boolean;
}): StepAvailability {
  const paid = isPaid(opts.sub);
  return {
    mindmap: opts.hasMindmap,
    prd: paid && opts.hasMindmap,
    tasks: paid && opts.hasPrd,
    // Style Guide mensyaratkan Task Breakdown lebih dulu
    // (lihat app/api/ai/styleguide/route.ts). Sebelumnya di sini tertulis
    // `hasPrd`, sehingga helper melaporkan "style terbuka" padahal server
    // menolaknya dengan 400. `!!` diperlukan karena `hasTasks` opsional.
    style: paid && !!opts.hasTasks,
  };
}
