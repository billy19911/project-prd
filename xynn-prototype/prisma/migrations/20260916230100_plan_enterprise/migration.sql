-- Migrasi: tambah 'ENTERPRISE' ke enum "PlanType"
-- ---------------------------------------------------------------------------
-- Tier ke-4 (Enterprise) diletakkan DI ATAS Pro agar pengguna Pro yang sudah
-- ada tidak kehilangan fitur.
--
-- Sifat migrasi: ADITIF. Nilai enum lama tidak dihapus, sehingga aman.
-- PostgreSQL 17 mendukung ALTER TYPE ... ADD VALUE secara transaksional.
--
-- IF NOT EXISTS membuat migrasi ini idempoten (aman dijalankan ulang).

ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'ENTERPRISE';
