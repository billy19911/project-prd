import { NextResponse } from "next/server";
import { getFeatureStatus } from "@/lib/feature-flags";
import {
  isAccessible,
  type FeatureKey,
} from "@/lib/feature-flags-core";

/**
 * Guard API: pastikan fitur berstatus LIVE sebelum melanjutkan.
 *
 * Mengembalikan `Response` (403) bila fitur belum dirilis, atau `null` bila
 * boleh lanjut. Dipakai di route API agar backend ikut terkunci walau
 * halaman sudah disembunyikan — bukan hanya UI.
 */
export async function guardFeature(
  key: FeatureKey
): Promise<NextResponse | null> {
  const status = await getFeatureStatus(key);
  if (isAccessible(status)) return null;
  return NextResponse.json(
    { error: "Fitur ini belum tersedia.", status },
    { status: 403 }
  );
}
