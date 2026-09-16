-- Migrasi: Prototype Design (T2.1)
-- ---------------------------------------------------------------------------
-- 1. Menyelaraskan `Workspace.techStack` dengan schema.prisma.
--    Migrasi `20260915224254_techstack_json` menyetel DEFAULT '[]'::jsonb,
--    tetapi `schema.prisma` mendefinisikan `techStack Json` (WAJIB, tanpa
--    default) dan database produksi memang tanpa default. Default itu hanya
--    ada di riwayat migrasi, tidak di kenyataan — inilah penyebab Prisma
--    melaporkan drift. Dihapus agar keduanya sinkron.
--
-- 2. Menambahkan kolom untuk fitur Prototype Design:
--      Workspace.prototypeHtml / prototypeJson / themeTokensJson
--      Plan.prototypeLimit            (kuota per paket, -1 = unlimited)
--      Subscription.prototypeLimit / prototypeUsedThisMonth
--
-- Semua pernyataan IDEMPOTEN (IF NOT EXISTS / DROP DEFAULT) sehingga aman
-- untuk database yang sudah berisi data. Tidak perlu `migrate reset`.

-- 1) Selaraskan techStack
ALTER TABLE "Workspace" ALTER COLUMN "techStack" DROP DEFAULT;

-- 2) Kolom Prototype pada Workspace
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "prototypeHtml" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "prototypeJson" JSONB;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "themeTokensJson" JSONB;

-- 3) Kuota prototype pada Plan
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "prototypeLimit" INTEGER NOT NULL DEFAULT 0;

-- 4) Kuota & pemakaian prototype pada Subscription
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "prototypeLimit" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "prototypeUsedThisMonth" INTEGER NOT NULL DEFAULT 0;
