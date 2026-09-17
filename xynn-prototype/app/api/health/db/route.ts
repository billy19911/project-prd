import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Health check ringan untuk konektivitas database.
 *
 * Dipakai halaman login untuk membedakan "email/akun salah" dari "server
 * sedang tak terjangkau" — karena NextAuth menyamakan keduanya sebagai
 * `CredentialsSignin`. Endpoint ini sengaja tanpa auth dan hanya melakukan
 * query trivial agar murah.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ db: "up" });
  } catch {
    return NextResponse.json({ db: "down" }, { status: 503 });
  }
}
