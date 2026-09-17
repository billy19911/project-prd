import { NextResponse } from "next/server";
import { getFeatureStates } from "@/lib/feature-flags";

/**
 * Endpoint publik: status rilis tiap fitur (key + status + href).
 *
 * Tidak mengembalikan data sensitif — hanya status rilis, dipakai klien
 * untuk memutuskan menampilkan "Segera Hadir" atau mengalihkan akses.
 */
export async function GET() {
  const states = await getFeatureStates();
  return NextResponse.json(Object.values(states));
}
