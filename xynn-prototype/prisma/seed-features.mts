import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import fs from "fs";

/**
 * Seed flag rilis fitur.
 *
 * Default awal: fitur baru berstatus SOON (tampil "Segera Hadir" walau
 * backend/frontend sudah jadi). Admin mengubahnya dari /admin.
 *
 * Idempoten: `upsert` tidak menimpa status yang sudah diubah admin
 * (update: {}), hanya memastikan barisnya ada.
 *
 * Jalankan: npx tsx prisma/seed-features.mts
 */

const DEFAULT_FEATURES = [
  {
    key: "consult",
    label: "Konsultasi AI",
    description: "Konsultan arsitektur & tech stack berbasis AI.",
    status: "SOON" as const,
  },
  {
    key: "chat",
    label: "Chat Prototype",
    description: "Chat untuk menyusun kebutuhan prototype.",
    status: "SOON" as const,
  },
];

function dbUrl() {
  const env = fs.readFileSync(".env", "utf8");
  return env
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="))!
    .slice("DATABASE_URL=".length)
    .replace(/^"|"$/g, "");
}

const pool = new pg.Pool({ connectionString: dbUrl() });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

for (const f of DEFAULT_FEATURES) {
  await prisma.featureFlag.upsert({
    where: { key: f.key },
    // Jangan menimpa status/label yang sudah diubah admin.
    update: {},
    create: {
      key: f.key,
      label: f.label,
      description: f.description,
      status: f.status,
    },
  });
  console.log("seeded feature:", f.key, "→", f.status);
}

console.log("Features seeded:", await prisma.featureFlag.count());
await pool.end();
