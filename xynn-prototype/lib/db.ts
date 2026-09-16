import { resetPrisma } from "@/lib/prisma";

/**
 * Retry untuk error koneksi DB yang bersifat sementara
 * (mis. P1017 ConnectionClosed dari Prisma dev / koneksi idle yang putus).
 *
 * Saat menemui error koneksi, pool yang "teracuni" direset agar percobaan
 * berikutnya memakai koneksi baru — bukan socket yang sudah mati.
 */
const TRANSIENT_CODES = new Set([
  "P1017", // Server has closed the connection
  "P1001", // Can't reach database server
  "P1002", // Database server timed out
  "P2024", // Timed out fetching a new connection from the pool
]);

function isTransient(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  if (code && TRANSIENT_CODES.has(code)) return true;
  const message = (error as { message?: string })?.message ?? "";
  return /ConnectionClosed|Server has closed the connection|Connection terminated|ECONNRESET|ECONNREFUSED|closed the connection/i.test(
    message
  );
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 300
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || i === attempts - 1) throw error;

      // Buang koneksi mati sebelum mencoba lagi.
      try {
        await resetPrisma();
      } catch {
        // abaikan; tetap tunggu lalu retry
      }
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastError;
}
