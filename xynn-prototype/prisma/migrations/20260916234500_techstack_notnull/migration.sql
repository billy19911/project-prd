-- Migrasi: selaraskan Workspace.techStack menjadi NOT NULL
-- ---------------------------------------------------------------------------
-- `schema.prisma` mendefinisikan `techStack Json` (WAJIB). Database juga
-- sudah NOT NULL. Tetapi riwayat migrasi tidak pernah menyetel NOT NULL:
-- migrasi `init` membuat kolom `TEXT[]` (nullable), dan migrasi
-- `techstack_json` hanya mengubah tipe + default. Akibatnya replay migrasi
-- menghasilkan kolom NULLABLE, yang berbeda dari kenyataan -> drift.
--
-- Migrasi ini menutup celah tersebut agar database baru (hasil
-- `prisma migrate deploy`) menghasilkan skema yang identik.
--
-- Idempoten: `SET NOT NULL` aman dijalankan ulang. `DROP DEFAULT` juga aman
-- walau tidak ada default (tidak error di PostgreSQL).
--
-- CATATAN: `SET NOT NULL` akan GAGAL bila masih ada baris NULL. Sudah
-- diverifikasi 0 baris NULL pada database saat ini. Pada database lain yang
-- mungkin punya NULL, jalankan lebih dulu:
--   UPDATE "Workspace" SET "techStack" = '[]'::jsonb WHERE "techStack" IS NULL;

UPDATE "Workspace" SET "techStack" = '[]'::jsonb WHERE "techStack" IS NULL;

ALTER TABLE "Workspace" ALTER COLUMN "techStack" DROP DEFAULT;
ALTER TABLE "Workspace" ALTER COLUMN "techStack" SET NOT NULL;
