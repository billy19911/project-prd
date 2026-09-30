import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { canUseCli } from "@/lib/access";

/**
 * Autentikasi bersama untuk seluruh endpoint CLI.
 * Semua endpoint CLI menerima header `x-api-key` berisi token `xynn_live_...`.
 *
 * Mengembalikan salah satu:
 *  - { ok: true, userId, subscription } bila valid & berbayar
 *  - { ok: false, status, error }         bila gagal (beserta kode HTTP)
 *
 * Dipusatkan di sini supaya guard paywall & validasi key konsisten di semua
 * route CLI dan tidak tersebar (mudah lupa di salah satu endpoint).
 */
export async function authenticateCli(
  req: Request
): Promise<
  | { ok: true; userId: string; subscription: unknown }
  | { ok: false; status: number; error: string }
> {
  const url = new URL(req.url);
  const apiKey = req.headers.get("x-api-key") || url.searchParams.get("apiKey");

  if (!apiKey?.startsWith("xynn_live_")) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const apiKeyRecord = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    include: { user: { include: { subscription: true } } },
  });

  if (!apiKeyRecord) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  const sub = apiKeyRecord.user.subscription;

  // Paywall guard: CLI Sync hanya untuk Starter & Pro (PRD §3.4).
  if (!canUseCli(sub)) {
    return {
      ok: false,
      status: 402,
      error: "Payment required. Upgrade to STARTER/PRO to use CLI Sync.",
    };
  }

  // Catat pemakaian terakhir agar UI bisa menampilkan "Dipakai ...".
  await prisma.apiKey
    .update({ where: { id: apiKeyRecord.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { ok: true, userId: apiKeyRecord.userId, subscription: sub };
}
