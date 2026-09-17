import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import fs from "fs";

/**
 * Seed template PRD siap pakai (fitur berbayar).
 *
 * Idempoten: memakai `upsert` pada `slug`, jadi aman dijalankan berulang.
 * Jalankan: npx tsx prisma/seed-templates.mts
 */

const DEFAULT_TEMPLATES = [
  {
    slug: "saas-multi-tenant",
    title: "SaaS Multi-Tenant",
    description:
      "Aplikasi SaaS langganan dengan banyak organisasi, peran anggota, dan billing.",
    category: "saas",
    icon: "Building2",
    idea: "Aplikasi SaaS multi-tenant dengan pendaftaran organisasi, peran anggota (owner/admin/member), langganan bulanan, dashboard analitik, dan integrasi pembayaran.",
    techStack: ["Next.js + Tailwind", "Next.js API Routes", "PostgreSQL", "Vercel"],
    locale: "id",
    sortOrder: 0,
  },
  {
    slug: "ecommerce-store",
    title: "Toko E-commerce",
    description:
      "Katalog produk, keranjang, checkout, dan pelacakan pesanan untuk toko online.",
    category: "ecommerce",
    icon: "ShoppingCart",
    idea: "Toko online dengan katalog produk berkategori, pencarian, keranjang belanja, checkout, pembayaran, dan pelacakan status pesanan untuk pembeli dan admin.",
    techStack: ["Next.js + Tailwind", "Next.js API Routes", "PostgreSQL", "Vercel"],
    locale: "id",
    sortOrder: 1,
  },
  {
    slug: "mobile-app-backend",
    title: "Backend Aplikasi Mobile",
    description:
      "API untuk aplikasi mobile dengan autentikasi, feed, notifikasi, dan upload media.",
    category: "mobile",
    icon: "Smartphone",
    idea: "Backend untuk aplikasi mobile: autentikasi (email & sosial), feed konten, profil pengguna, notifikasi push, dan unggah gambar.",
    techStack: ["Flutter", "NestJS", "PostgreSQL", "AWS"],
    locale: "id",
    sortOrder: 2,
  },
  {
    slug: "internal-dashboard",
    title: "Dashboard Internal",
    description:
      "Panel admin untuk mengelola data, pengguna, dan laporan operasional tim.",
    category: "internal",
    icon: "LayoutDashboard",
    idea: "Dashboard internal untuk tim operasional: manajemen pengguna, tabel data dengan filter & ekspor, laporan ringkas, dan kontrol akses berbasis peran.",
    techStack: ["React + Vite", "Express", "PostgreSQL", "VPS/Docker"],
    locale: "id",
    sortOrder: 3,
  },
  {
    slug: "marketplace",
    title: "Marketplace Penjual-Pembeli",
    description:
      "Platform dua sisi: penjual memasang produk, pembeli bertransaksi, ada escrow.",
    category: "ecommerce",
    icon: "Store",
    idea: "Marketplace dua sisi: penjual mendaftar dan memasang listing, pembeli mencari dan bertransaksi, dengan ulasan, chat penjual-pembeli, dan pencairan dana.",
    techStack: ["Next.js + Tailwind", "Next.js API Routes", "PostgreSQL", "Vercel"],
    locale: "id",
    sortOrder: 4,
  },
  {
    slug: "project-management",
    title: "Manajemen Proyek Tim",
    description:
      "Papan tugas, sprint, komentar, dan pelacakan progres untuk tim kecil.",
    category: "internal",
    icon: "KanbanSquare",
    idea: "Alat manajemen proyek untuk tim kecil: papan kanban, daftar tugas dengan prioritas, sprint, komentar, dan pelacakan progres anggota.",
    techStack: ["Next.js + Tailwind", "Next.js API Routes", "PostgreSQL", "Vercel"],
    locale: "id",
    sortOrder: 5,
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

for (const t of DEFAULT_TEMPLATES) {
  await prisma.template.upsert({
    where: { slug: t.slug },
    update: {
      title: t.title,
      description: t.description,
      category: t.category,
      icon: t.icon,
      idea: t.idea,
      techStack: [...t.techStack],
      locale: t.locale,
      sortOrder: t.sortOrder,
    },
    create: {
      slug: t.slug,
      title: t.title,
      description: t.description,
      category: t.category,
      icon: t.icon,
      idea: t.idea,
      techStack: [...t.techStack],
      locale: t.locale,
      sortOrder: t.sortOrder,
    },
  });
  console.log("seeded template:", t.slug);
}

console.log("Templates seeded:", await prisma.template.count());
await pool.end();
