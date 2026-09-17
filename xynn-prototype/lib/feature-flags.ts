import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

/**
 * Sistem flag rilis fitur.
 *
 * Tujuan: fitur bisa DIBANGUN PENUH (backend + frontend jalan) tapi masih
 * ditampilkan "Segera Hadir" atau disembunyikan — tanpa perlu deploy ulang.
 * Status disimpan di tabel `FeatureFlag` dan diubah dari `/admin`.
 *
 * Ada DUA lapis:
 *  - `lib/feature-flags-core.ts` — definisi & default (murni, bisa diuji).
 *  - file ini — pembacaan dari DB dengan fallback aman.
 */

export {
  FEATURE_KEYS,
  FEATURE_DEFS,
  isFeatureKey,
  type FeatureKey,
  type FeatureStatusValue,
  type FeatureState,
} from "@/lib/feature-flags-core";

import {
  FEATURE_DEFS,
  isFeatureKey,
  type FeatureKey,
  type FeatureStatusValue,
  type FeatureState,
} from "@/lib/feature-flags-core";

/**
 * Ambil status SEMUA fitur yang dikenal. Bila DB tidak bisa diakses, jatuh
 * ke default (SOON) agar fitur yang belum stabil tidak tiba-tiba terbuka.
 */
export async function getFeatureStates(): Promise<Record<FeatureKey, FeatureState>> {
  const result = {} as Record<FeatureKey, FeatureState>;

  // Mulai dari default.
  for (const def of FEATURE_DEFS) {
    result[def.key] = {
      key: def.key,
      label: def.label,
      description: def.description,
      status: def.defaultStatus,
    };
  }

  try {
    const rows = await withDbRetry(() =>
      prisma.featureFlag.findMany({
        select: { key: true, label: true, description: true, status: true },
      })
    );
    for (const row of rows) {
      if (!isFeatureKey(row.key)) continue;
      result[row.key] = {
        key: row.key,
        label: row.label,
        description: row.description,
        status: row.status as FeatureStatusValue,
      };
    }
  } catch (error) {
    const code = (error as { code?: string })?.code ?? "unknown";
    console.warn(`[feature-flags] DB unavailable (${code}); memakai default.`);
  }

  return result;
}

/** Status satu fitur. Fitur tak dikenal → "SOON" (aman). */
export async function getFeatureStatus(key: string): Promise<FeatureStatusValue> {
  if (!isFeatureKey(key)) return "SOON";
  const states = await getFeatureStates();
  return states[key].status;
}

/** Apakah fitur berstatus LIVE (boleh dipakai & tampil). */
export async function isFeatureLive(key: FeatureKey): Promise<boolean> {
  return (await getFeatureStatus(key)) === "LIVE";
}

/**
 * Pastikan semua fitur yang dikenal punya baris di DB (tanpa menimpa status
 * yang sudah diubah admin). Dipanggil dari endpoint admin.
 */
export async function ensureFeatureFlagsSeeded(): Promise<void> {
  for (const def of FEATURE_DEFS) {
    await withDbRetry(() =>
      prisma.featureFlag.upsert({
        where: { key: def.key },
        // Jangan menimpa status/label yang sudah diubah admin.
        update: {},
        create: {
          key: def.key,
          label: def.label,
          description: def.description,
          status: def.defaultStatus,
        },
      })
    );
  }
}
