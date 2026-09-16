import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
};

const datasourceUrl = process.env.DATABASE_URL!;

function createPool(): pg.Pool {
  const pool = new pg.Pool({
    connectionString: datasourceUrl,
    keepAlive: true,
    max: 10,
    // Buang koneksi idle lebih cepat agar tidak memakai socket yang sudah
    // ditutup server (penyebab P1017 ConnectionClosed).
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });

  // Jangan biarkan error pada koneksi idle menjatuhkan proses.
  pool.on("error", () => {
    // diamkan; pool membuat koneksi baru saat dibutuhkan.
  });

  return pool;
}

function createPrisma(): PrismaClient {
  const pool = createPool();
  globalForPrisma.pgPool = pool;
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });
  globalForPrisma.prisma = client;
  return client;
}

function getClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  const pool = globalForPrisma.pgPool;
  if (existing && pool && !pool.ended) return existing;
  return createPrisma();
}

/**
 * Buang pool lama yang "teracuni" koneksi mati lalu buat client baru.
 * Dipakai oleh withDbRetry saat menemui error koneksi sementara.
 */
export async function resetPrisma(): Promise<void> {
  const old = globalForPrisma.pgPool;
  globalForPrisma.prisma = undefined;
  globalForPrisma.pgPool = undefined;
  if (old && !old.ended) {
    try {
      await old.end();
    } catch {
      // abaikan
    }
  }
  createPrisma();
}

/**
 * Proxy yang selalu meneruskan ke Prisma client aktif. Dengan begitu
 * `resetPrisma()` bisa mengganti instance di baliknya tanpa mengubah
 * referensi `prisma` yang di-import modul lain.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
