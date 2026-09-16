import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import fs from "fs";

const DEFAULT_PLANS = [
  {
    code: "FREE",
    name: "Free",
    description: "Coba fitur inti tanpa biaya.",
    priceMonthly: 0,
    priceYearly: 0,
    discountPercent: 0,
    prdLimit: 1,
    prototypeLimit: 0,
    features: ["1 PRD Draft", "Mindmap Canvas preview", "Gudang PRD mode blur", "Tanpa CLI Sync"],
    isPopular: false,
    sortOrder: 0,
  },
  {
    code: "STARTER",
    name: "Starter",
    description: "Untuk solo developer & side project.",
    priceMonthly: 99000,
    priceYearly: 799000,
    discountPercent: 0,
    prdLimit: 5,
    prototypeLimit: 0,
    features: [
      "Maks. 5 PRD/bulan",
      "Gudang PRD akses penuh",
      "Copy Specs & Export Markdown",
      "CLI Sync aktif",
      "Task Breakdown",
    ],
    isPopular: false,
    sortOrder: 1,
  },
  {
    code: "PRO",
    name: "Pro",
    description: "Untuk tim & produk yang serius.",
    priceMonthly: 199000,
    priceYearly: 1599000,
    discountPercent: 0,
    prdLimit: -1,
    prototypeLimit: 20,
    features: [
      "Unlimited PRD",
      "Gudang PRD + Fork",
      "Priority CLI Sync",
      "Task Breakdown & Style Guide",
      "Support prioritas",
    ],
    isPopular: true,
    sortOrder: 2,
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    description: "Untuk studio & tim multi-produk.",
    priceMonthly: 499000,
    priceYearly: 3999000,
    discountPercent: 0,
    prdLimit: -1,
    prototypeLimit: -1,
    features: [
      "Semua fitur Pro",
      "3 seat + tambah per seat",
      "Library tema tersimpan lintas project",
      "Kolaborasi workspace",
      "Kuota AI ditingkatkan",
      "Onboarding & support khusus",
    ],
    isPopular: false,
    sortOrder: 3,
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

for (const p of DEFAULT_PLANS) {
  await prisma.plan.upsert({
    where: { code: p.code },
    update: {
      name: p.name,
      description: p.description,
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      discountPercent: p.discountPercent,
      prdLimit: p.prdLimit,
      prototypeLimit: p.prototypeLimit,
      features: [...p.features],
      isPopular: p.isPopular,
      sortOrder: p.sortOrder,
    },
    create: {
      code: p.code,
      name: p.name,
      description: p.description,
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      discountPercent: p.discountPercent,
      prdLimit: p.prdLimit,
      prototypeLimit: p.prototypeLimit,
      features: [...p.features],
      isPopular: p.isPopular,
      sortOrder: p.sortOrder,
    },
  });
  console.log("seeded plan:", p.code);
}

console.log("Plans seeded:", await prisma.plan.count());
await pool.end();
