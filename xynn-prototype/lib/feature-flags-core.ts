/**
 * Definisi & tipe fitur yang bisa dikunci — MURNI (tanpa Prisma).
 *
 * Dipisah agar bisa diuji tanpa database dan dipakai bersama oleh server
 * (lib/feature-flags.ts) maupun klien (yang hanya butuh daftar key).
 */

export type FeatureStatusValue = "LIVE" | "SOON" | "HIDDEN";

/** Kunci fitur yang dikenal aplikasi. Tambahkan di sini + di FEATURE_DEFS. */
export const FEATURE_KEYS = ["consult", "chat"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(value);
}

export type FeatureState = {
  key: FeatureKey;
  label: string;
  description: string | null;
  status: FeatureStatusValue;
};

export type FeatureDef = {
  key: FeatureKey;
  label: string;
  description: string;
  /** Rute halaman yang harus dijaga. */
  href: string;
  /** Status awal bila belum ada baris di DB. */
  defaultStatus: FeatureStatusValue;
};

/**
 * Katalog fitur. `href` dipakai untuk memetakan pathname → fitur di
 * halaman ComingSoon & navigasi.
 */
export const FEATURE_DEFS: FeatureDef[] = [
  {
    key: "consult",
    label: "Konsultasi AI",
    description: "Konsultan arsitektur & tech stack berbasis AI.",
    href: "/consult",
    defaultStatus: "SOON",
  },
  {
    key: "chat",
    label: "Chat Prototype",
    description: "Chat untuk menyusun kebutuhan prototype.",
    href: "/chat",
    defaultStatus: "SOON",
  },
];

/** Cari definisi fitur dari pathname (mis. "/consult" → def consult). */
export function featureByPath(pathname: string): FeatureDef | undefined {
  return FEATURE_DEFS.find(
    (d) => pathname === d.href || pathname.startsWith(d.href + "/")
  );
}

/** Apakah fitur boleh diakses penuh? Hanya LIVE. */
export function isAccessible(status: FeatureStatusValue): boolean {
  return status === "LIVE";
}

/** Apakah fitur tampil di navigasi? LIVE & SOON tampil (SOON sebagai badge). */
export function isVisibleInNav(status: FeatureStatusValue): boolean {
  return status === "LIVE" || status === "SOON";
}
