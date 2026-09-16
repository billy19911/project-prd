-- Migrasi backfill: tabel "AiConfig"
-- ---------------------------------------------------------------------------
-- Tabel ini sudah ada di database produksi (dibuat lewat `prisma db push`),
-- tetapi TIDAK PERNAH tercatat di migrasi mana pun. Akibatnya database baru
-- yang dibangun dengan `prisma migrate deploy` tidak akan punya tabel ini,
-- dan `/admin/ai-config` + seluruh endpoint AI akan gagal saat memanggil
-- `prisma.aiConfig.findFirst()`.
--
-- Migrasi ini ditulis IDEMPOTEN agar aman baik untuk:
--   (a) database yang sudah punya tabel  -> tidak melakukan apa-apa
--   (b) database baru                    -> membuat tabel
-- Sehingga database produksi yang sedang berisi data tidak perlu di-reset.
--
-- Default kolom disamakan dengan `schema.prisma`
-- (`OpenCodeCombo`), bukan default lama di database (`gpt-4o-mini` dkk).

CREATE TABLE IF NOT EXISTS "AiConfig" (
    "id" TEXT NOT NULL,
    "mindmapModel" TEXT NOT NULL DEFAULT 'OpenCodeCombo',
    "prdModel" TEXT NOT NULL DEFAULT 'OpenCodeCombo',
    "systemPrompt" TEXT NOT NULL DEFAULT 'You are an expert product architect.',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConfig_pkey" PRIMARY KEY ("id")
);

-- Selaraskan default kolom pada database yang tabelnya sudah ada,
-- agar cocok dengan schema.prisma.
ALTER TABLE "AiConfig" ALTER COLUMN "mindmapModel" SET DEFAULT 'OpenCodeCombo';
ALTER TABLE "AiConfig" ALTER COLUMN "prdModel" SET DEFAULT 'OpenCodeCombo';
ALTER TABLE "AiConfig" ALTER COLUMN "systemPrompt" SET DEFAULT 'You are an expert product architect.';
