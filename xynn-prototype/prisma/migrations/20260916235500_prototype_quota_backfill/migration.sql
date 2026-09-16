-- Migrasi: backfill kuota Prototype
-- ---------------------------------------------------------------------------
-- Kolom `prototypeLimit` ditambahkan dengan DEFAULT 0 oleh migrasi
-- `20260916233000_prototype_design`. Akibatnya SEMUA langganan yang sudah ada
-- (termasuk PRO) mendapat kuota 0 — artinya mereka tidak bisa generate
-- prototype sama sekali, padahal fitur itu seharusnya sudah termasuk di PRO.
--
-- Migrasi ini mengisi kuota sesuai `Plan.prototypeLimit`, lalu menyelaraskan
-- pemeriksaan kuota untuk paket berbayar yang belum punya baris Plan
-- (mis. dibuat manual) berdasarkan `planType`.
--
-- Idempoten: hanya menyentuh baris yang masih 0 dan hanya untuk tier yang
-- memang berhak, sehingga aman dijalankan ulang.

-- 1) Ikut nilai Plan bila ada.
UPDATE "Subscription" s
SET "prototypeLimit" = p."prototypeLimit"
FROM "Plan" p
WHERE p."code" = s."planType"::text
  AND s."prototypeLimit" = 0
  AND p."prototypeLimit" <> 0;

-- 2) Fallback berdasarkan planType untuk langganan yang belum tercakup.
UPDATE "Subscription"
SET "prototypeLimit" = CASE
  WHEN "planType" = 'ENTERPRISE' THEN -1
  WHEN "planType" IN ('PRO', 'PRO_YEARLY') THEN 20
  ELSE 0
END
WHERE "prototypeLimit" = 0
  AND "planType" IN ('PRO', 'PRO_YEARLY', 'ENTERPRISE');
