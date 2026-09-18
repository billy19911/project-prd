# Changelog — XynnPrototype

Semua perubahan penting pada proyek ini didokumentasikan di sini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
dan proyek ini menganut [Semantic Versioning](https://semver.org/lang/id/).

---

## ⚠️ Catatan tentang rekonstruksi riwayat ini

Repositori ini **belum memiliki commit git** saat changelog ini disusun
(`master` belum punya commit; seluruh berkas masih *untracked*). Karena itu
kronologi di bawah **direkonstruksi dari sumber bukti yang nyata**, bukan
dari ingatan ataupun karangan:

| Sumber | Yang direkam |
| :--- | :--- |
| `prisma/migrations/*` | Urutan & waktu pembuatan tabel/kolom (timestamp asli) |
| `_login.mjs` … `_stability.mjs` | Urutan pengujian manual (tiap skrip = satu tonggak fitur) |
| `prisma/migrations/*/migration.sql` | Bukti teknis tiap perubahan skema |
| Kode saat ini | Keadaan akhir |

Tanggal bersifat **perkiraan berbasis bukti** dan ditandai `(≈)` bila
disimpulkan dari konteks, bukan dari timestamp eksplisit. Begitu `git log`
tersedia, changelog ini dapat direkonsiliasi dengan commit asli.

**Rentang pengerjaan terekam:** 14 Sep 2026 → 16 Sep 2026 (berdasarkan
timestamp migrasi Prisma).

---

## [v1.8.0] — Integrasi Midtrans Snap (Sandbox) untuk Testing Pembayaran

Menyambungkan alur checkout ke **Midtrans Snap**. Default **Sandbox** (uang
simulasi, bukan uang nyata); Production hanya bila `PaymentConfig.isProduction`
diaktifkan.

### Added — Midtrans Snap

- **Metode pembayaran `midtrans_snap`** (`lib/payments.ts`) — muncul di modal
  checkout sebagai opsi "Midtrans (Snap)". Klik → server membuat transaksi Snap
  → client diarahkan ke `redirect_url` (halaman pembayaran Midtrans).
- **Base URL dinamis** (`midtransSnapBaseUrl`): `app.sandbox.midtrans.com` bila
  `isProduction=false`, `app.midtrans.com` bila `true`. Sebelumnya hard-code ke
  Production.
- **`resolveGatewayConfig`** (`app/api/checkout/route.ts`) mengembalikan
  `{ serverKey, isProduction, clientKey, id }`, sehingga flag Sandbox/Production
  dari `/admin/payments` benar-benar berpengaruh (sebelumnya murni dekoratif).
- **`lib/midtrans.ts`** — helper murni: `midtransSignatureKey`,
  `verifyMidtransSignature` (SHA512, timing-safe), dan `mapMidtransStatus`.
- **`lib/subscription-activate.ts`** — satu helper aktivasi langganan (kuota dari
  `Plan` + masa aktif kalender) yang dipakai webhook & cek-status.

### Added — Webhook Midtrans asli

- `POST /api/webhooks/payment` kini mengenali **dua format**:
  - **Midtrans** (ada `signature_key`): verifikasi
    `SHA512(order_id + status_code + gross_amount + serverKey)`, mapping status
    (`settlement`/`capture`→SUCCESS, `pending`→PENDING, `deny`/`cancel`/`expire`→FAILED).
  - **Custom** lama (`x-payment-signature` HMAC) — tetap didukung untuk kompatibilitas.
- `order_id` yang dikirim ke Midtrans = `Transaction.id`, sehingga webhook dapat
  merekonsiliasi transaksi.
- Payload notifikasi mentah disimpan di `Transaction.gatewayPayload` (jejak audit).

### Added — Cek status saat kembali dari gateway

- **`GET /api/checkout/status?id=<txId>`** — read-only; bila transaksi via
  Midtrans, menanyakan status terkini ke Midtrans Status API, lalu mengaktifkan
  langganan bila lunas. Hanya transaksi milik pemanggil yang bisa dicek (404 bila bukan).
- Modal checkout menyimpan `transactionId` ke `localStorage`; halaman
  `/settings/plan` melakukan *polling* singkat saat dibuka kembali dan
  menyegarkan status begitu pembayaran lunas.

### Changed — Skema `Transaction`

- Kolom baru: **`paymentRef`** (referensi gateway, mis. Snap token) dan
  **`gatewayPayload`** (Json, payload notifikasi terakhir). Migrasi
  `20260918072006_transaction_payment_ref`.

### Added — Uji

- **`tests/midtrans.test.mjs`** (13 uji): rumus signature, verifikasi (termasuk
  panjang beda → false, bukan throw), dan mapping status. Total suite **206 uji**.

---

## [v1.7.0] — Perbaikan Billing: Kuota dari Plan & Masa Aktif Kalender

Perbaikan pada sistem langganan setelah audit smoke test end-to-end. Tiga bug
diperbaiki, dan perhitungan masa aktif dipindah ke basis kalender.

### Fixed — Kuota prototype tidak ter-set saat upgrade

- **`POST /api/admin/users/plan`** & **`POST /api/checkout/confirm`** dulu hanya
  mengeset `planType` + `prdLimit`, **tidak** `prototypeLimit`. Akibatnya user
  PRO/Enterprise yang baru upgrade tetap ditolak **HTTP 429** di
  `/api/ai/prototype` (kuota tetap `0`).
- **`POST /api/webhooks/payment`** bahkan hanya mengeset `prdLimit` hardcode
  (`PRO` → `-1`, selain itu `5`) tanpa `prototypeLimit` sama sekali.
- **Solusi:** helper baru **`resolvePlanQuota(code)`** di `lib/plans.ts` membaca
  `prdLimit` & `prototypeLimit` dari baris **`Plan`** di DB. Ketiga jalur
  aktivasi (checkout/confirm, webhook, admin assign) kini memakainya —
  satu sumber kebenaran.
- **`ensurePlansSeeded()`** kini ikut menyalin `prototypeLimit` saat seeding
  (sebelumnya tertinggal, hasil lazy-seed beda dari `seed-plans.mts`).

### Fixed — Dropdown paket di `/admin/users` tidak lengkap

- Halaman admin kelola user meng-**hardcode** `["FREE","STARTER","PRO","PRO_YEARLY"]`
  — **`ENTERPRISE` hilang**, sementara `PRO_YEARLY` justru bukan baris `Plan` di DB,
  sehingga admin tidak bisa menaikkan user ke Enterprise.
- **Solusi:** dropdown kini mengambil daftar dari **`GET /api/admin/plans`**
  (`Plan` di DB), menampilkan nama paket, dan menyertakan plan aktif user bila
  belum ada di daftar (agar langganan lama tidak hilang dari tampilan).

### Changed — Masa aktif berbasis kalender

- Masa aktif langganan **tidak lagi** memakai fix 30/90/365 hari, melainkan
  penambahan bulan kalender. Helper baru **`lib/billing.ts`**:
  `monthsForCycle()`, `addMonths()`, `computeValidUntil()`.
- `MONTHLY` = +1 bulan, `QUARTERLY` = +3 bulan, `YEARLY` = +12 bulan.
  Penambahan bulan **meng-clamp ke hari terakhir bulan tujuan**:
  `31 Jan + 1 bulan` → **28/29 Feb** (bukan 2/3 Mar); `29 Feb + 12 bulan` →
  **28 Feb**.
- Diterapkan konsisten di `checkout/confirm`, `webhooks/payment`, dan
  `admin/users/plan`. Admin tetap bisa memaksa durasi lewat `durationDays`
  (jumlah hari persis) bila diperlukan.

### Changed — Normalisasi `PRO_YEARLY`

- `mapCodeToPlanType()` di `lib/plans.ts` kini **menormalisasi `PRO_YEARLY`
  → `PRO`** saat membuat/meng-assign langganan baru (varian siklus billing,
  bukan tier tersendiri). `getAccessTier()` tetap memetakan `PRO_YEARLY` → `pro`
  agar langganan lama tetap berfungsi.

### Added — Uji

- **`tests/billing-cycle.test.mjs`** (13 uji): penyesuaian bulan kalender,
  clamp akhir bulan, dan lintas tahun kabisat. Total suite kini **193 uji**.

---

## [v1.6.0] — Konsultasi AI + Sistem Flag Rilis Fitur (17 Sep 2026)

Dua hal: (1) fitur **Konsultasi AI** dibangun penuh (backend + frontend), dan
(2) **sistem flag rilis** agar fitur yang sudah jadi tetap bisa ditampilkan
"Segera Hadir" atau disembunyikan tanpa deploy ulang.

### Added — Konsultasi AI

- **Model `ConsultThread` & `ConsultMessage`** (+ migrasi
  `20260917104105_consult_threads`) — terpisah dari chat prototype.
- **`generateConsultReplyWithAI`** di `lib/ai.ts` + `lib/consult-prompt.ts`
  (konsultan arsitektur: arsitektur, trade-off tech stack, roadmap).
- **API**: `GET/POST/DELETE /api/consult/threads`,
  `GET /api/consult/threads/[id]`, `POST /api/ai/consult`.
- **Halaman `/consult`** — UI konsultasi (mirip chat) + gate berbayar
  (STARTER ke atas). Jenis `consult` ditambahkan ke `recordAiUsage`.

### Added — Sistem Flag Rilis

- **Model `FeatureFlag`** + enum `FeatureStatus` (LIVE/SOON/HIDDEN)
  (+ migrasi `20260917103925_feature_flags`) dan seed `seed-features.mts`.
- **`lib/feature-flags-core.ts`** (murni, bisa diuji) +
  **`lib/feature-flags.ts`** (baca DB, fallback aman ke SOON) +
  **`lib/feature-guard.ts`** (guard API) + **`lib/use-feature.ts`** (hook klien).
- **API:** `GET /api/features` (publik, status rilis),
  `GET/POST /api/admin/features` (kontrol admin).
- **`components/coming-soon-gate.tsx`** — LIVE→fitur penuh, SOON→layar
  "Segera Hadir", HIDDEN→alihkan ke dashboard.
- **`/admin/features`** — ubah status tiap fitur tanpa deploy.

### Changed

- **`/chat`** dan **`/consult`** kini dibungkus `ComingSoonGate`; API-nya
  ikut diblokir (403) selama status bukan LIVE.
- **Landing page** & **sidebar** membaca status dari DB: entri SOON diberi
  badge "Segera", HIDDEN disembunyikan. Sidebar mendapat entri "Konsultasi AI".
- Produk `consult` di `lib/products.ts` kini `active` (kunci berasal dari flag).

### Added (test)

- `tests/feature-flags.test.mjs` (11 uji) & `tests/consult-prompt.test.mjs`
  (9 uji). Total uji: **147 lulus**.

### Status rilis saat ini

- `consult` = **SOON**, `chat` = **SOON** — keduanya jalan penuh di balik layar,
  tampil "Segera Hadir", dan diblokir untuk diakses. Ubah dari `/admin/features`.

---

## [v1.5.0] — Template PRD Siap Pakai (17 Sep 2026)

Meluncurkan produk **Template PRD** yang sebelumnya berstatus "Segera Hadir":
galeri template siap pakai untuk memangkas token saat memulai project.

### Added

- **Model `Template`** (`prisma/schema.prisma` + migrasi
  `20260917102801_templates`): slug, judul, deskripsi, kategori, ikon, ide
  awal, tech stack, locale, status aktif, urutan.
- **Seed `prisma/seed-templates.mts`** — 6 template idempoten (upsert):
  SaaS multi-tenant, toko e-commerce, backend mobile, dashboard internal,
  marketplace, dan manajemen proyek.
- **API `GET /api/templates`** — daftar ringkas untuk galeri; `?slug=` untuk
  satu template lengkap (termasuk `idea`) guna prefill wizard. Gate berbayar
  (402 untuk FREE).
- **Halaman `/templates`** — galeri kartu + filter kategori + tombol
  "Pakai template" yang mengarahkan ke wizard dengan `?template=<slug>`.
- **Prefill wizard** — `/new-project` membaca `?template=` dan mengisi judul,
  ide, locale, serta (bila tepat 4 teknologi) preferensi stack mode manual,
  tanpa menimpa isian yang sudah ada.
- **`lib/template-meta.ts`** — pemetaan nama ikon → komponen + label kategori.
- Entri **sidebar "Template PRD"** dan tautan "Mulai dari template" di
  `/projects`; produk di `lib/products.ts` kini `active`.

### Changed

- **`lib/workspace-access.ts` dipecah**: logika keputusan murni dipindah ke
  `lib/workspace-access-core.ts` agar bisa diuji tanpa database.

### Added (test)

- `tests/workspace-access.test.mjs` — 12 uji aturan akses workspace
  (pemilik pribadi, anggota EDITOR/VIEWER/OWNER, non-anggota, bug lama
  "OWNER org tidak bisa hapus").
- `tests/template-meta.test.mjs` — 5 uji pemetaan ikon & label kategori.
  Total uji: **128 lulus**.

---

## [v1.4.0] — Organisasi Tim & Akses Workspace Berbasis Keanggotaan (17 Sep 2026)

Fitur **kolaborasi tim ENTERPRISE**: satu organisasi bisa berisi beberapa
anggota, dan workspace dapat dimiliki organisasi sehingga seluruh anggotanya
mendapat akses — bukan hanya pembuatnya. Ini meluncurkan butir yang sebelumnya
sengaja ditunda di `RENCANA-IMPLEMENTASI.md` §6.

### Added

- **Skema organisasi** (`prisma/schema.prisma` + migrasi
  `20260917080457_organizations`): model `Organization`, `Membership`
  (unik per `organizationId + userId`), `OrganizationInvite`, enum `OrgRole`
  (OWNER/EDITOR/VIEWER) & `InviteStatus`, serta kolom `Workspace.organizationId`.
- **`lib/workspace-access.ts`** — sumber tunggal aturan akses workspace:
  `getWorkspaceAccess`, `workspaceAccessFilter`, `canCreateWorkspaceInOrg`,
  `hasEnterpriseViaOrg`, `seatUsage`. Menggantikan pola `where: { userId }`
  yang sebelumnya hanya mengizinkan pemilik.
- **API `/api/org`** — buat & daftar tim (+ pemakaian seat); `?lite=1`
  mengembalikan daftar ringkas untuk dropdown pembuatan proyek.
- **API `/api/org/members`** — undang lewat email, ubah peran, keluarkan anggota
  / batalkan undangan. Khusus OWNER.
- **Halaman `/settings/team`** + entri tab di `settings-nav`.
- **Workspace milik organisasi**: `POST /api/workspace` menerima
  `organizationId` (divalidasi `canCreateWorkspaceInOrg`); dropdown "Tim
  (opsional)" di wizard project baru.
- **Auto-accept undangan** saat login (semua provider) untuk email yang Belum
  punya akun sekalipun.

### Changed

- **Cek akses disebar** ke seluruh route AI & workspace (full-prd, mindmap,
  prototype, questions, styleguide, tasks, update, delete, publish, versions,
  restore, chat threads, CLI sync) — kini memakai `getWorkspaceAccess`
  (pemilik pribadi ATAU anggota org sesuai peran), bukan `userId` saja.
- **ENTERPRISE lewat organisasi**: anggota tim mendapat hak ENTERPRISE dari
  langganan pemilik organisasi (`hasEnterpriseViaOrg`).

### Fixed

- **`/settings/team` salah mengunci anggota org.** Gate halaman memakai
  `canSaveThemes` yang hanya membaca langganan **pribadi**, sehingga anggota
  org ENTERPRISE justru melihat layar "khusus ENTERPRISE". Kini gate diambil
  dari server (`/api/org` → 402), konsisten dengan `hasEnterpriseViaOrg`.
- **Seat tim bisa dilampaui.** Penerimaan undangan saat login tidak memeriksa
  batas seat, dan klaim undangan tidak atomik (race dua login). Kini seat
  diperiksa saat menerima, dan undangan diklaim via `updateMany` berguard
  `status: PENDING`.
- **Undangan `ACCEPTED` bisa terbuka kembali.** `upsert` lama menimpa status
  menjadi `PENDING` saat mengundang ulang; kini ditolak sebagai "sudah anggota"
  dan undangan email sendiri tidak dihitung ganda terhadap seat.
- **OWNER org tidak bisa menghapus workspace org.** `DELETE /api/workspace/delete`
  masih menyimpan cek `workspace.userId !== userId` yang redundan; dihapus
  karena `access.canManage` sudah mencakup OWNER org.
- **Body JSON rusak → 500.** Beberapa route memakai `await req.json()` tanpa
  `.catch()`; kini mengembalikan 400.
- **Bisa ada dua OWNER** via `PATCH` anggota; kini promosi OWNER kedua ditolak
  agar satu sumber kebenaran (`Organization.ownerId`).

### Known limitations (keputusan yang diambil)

- **Kuota fitur AI tetap per-pengguna.** Anggota tim memakai kuota & tier dari
  langganan **pribadinya**, bukan langganan organisasi. Biaya AI dibebankan ke
  pengguna yang men-generate (`recordAiUsage(userId, ...)`).
- **Thread chat milik pengguna**, bukan organisasi — kolaborator tidak berbagi
  thread chat meski keduanya mengakses workspace org yang sama.

---

## [v1.3.0] — Perbaikan Celah Fungsional Prototype (16 Sep 2026)

Menutup tiga celah yang ditemukan setelah Fase 2 selesai. Ketiganya adalah
**bug yang merusak pekerjaan pengguna** atau **penjaga biaya AI**.

### Fixed

- **Tema hilang saat Regenerate.** `/api/ai/prototype` tidak membaca maupun
  meneruskan `themeTokensJson` ke AI, sehingga setiap kali menekan
  *Regenerate*, prototype baru dihasilkan dengan **warna default** — seluruh
  penyesuaian tema pengguna terhapus tanpa peringatan. Diperbaiki dengan
  menyertakan tema ke prompt melalui blok **THEME OVERRIDE** yang memaksa AI
  memakai nilai persis (`EXACT values`, `Do NOT invent other colors`).
  Tema disanitasi dulu sebelum masuk prompt karena datanya dari DB.
- **PRO tidak bisa menyimpan tema sama sekali.** Tombol "Simpan tema" memakai
  `disabled={!canSave}` dengan `canSave` = `canSaveThemes` (**ENTERPRISE
  saja**). Akibatnya pengguna PRO tidak dapat menyimpan tema — dan
  `themeTokensJson` tetap kosong di seluruh database (terverifikasi: 0 baris).
  Ini salah memisahkan dua hal: menyimpan tema **untuk project ini** adalah
  hak PRO, sedangkan **library lintas-project** barulah fitur ENTERPRISE.
  Diperbaiki: tombol selalu aktif, `canSaveThemes` hanya menandai bahwa
  library lintas-project butuh ENTERPRISE.
- **Test kosong untuk `canGeneratePrototype` & `remainingPrototypeQuota`.**
  Dua fungsi ini menjaga kuota prototype (PRO 20/bulan) — penjaga biaya AI.
  Sebelumnya tidak ada test sama sekali. Ditambahkan 10 test, termasuk kasus
  `prototypeLimit` tidak ada (harus **terkunci**, bukan dianggap unlimited)
  dan pemakaian melebihi limit (sisa tidak boleh negatif).

### Changed

- **Prompt builder dipindah ke `lib/prototype-prompt.ts`.** `lib/ai.ts`
  mengimpor `@/lib/i18n`, sehingga `node:test` tidak dapat memuatnya (alias
  `@/` tidak terselesaikan). Modul baru ini bebas dependensi — direktif bahasa
  diterima sebagai parameter — sehingga prompt dapat diuji. `lib/ai.ts` tetap
  mengekspor ulang agar pemanggil lama tidak rusak.
- `ThemeEditor`: prop `canSave` → `canSaveLibrary` (lebih jelas maksudnya),
  plus indikator `saving`/`saved` dan pesan yang menjelaskan bedanya.
- `tests/access.test.mjs`: 58 → 68 test. `tests/prompt.test.mjs` baru: 6 test.

### Verification

| Pemeriksaan | Hasil |
| :--- | :--- |
| `npm test` | **74 lulus**, 0 gagal (dari 58) |
| `npm run build` | **Exit 0** |
| `npx eslint` | 0 error |
| Simpan tema sebagai PRO | **200** (tadinya tombol disabled) |
| Tema tersimpan di DB | ✅ nilai tepat (warna, font, size, radius) |
| Sanitasi via API | payload `<script>` → `#000000`/`Geist`, tanpa break-out |
| `themeTokensJson` di DB | dari **0** → **1** baris |

**Catatan proses:** build menangkap dua kesalahan yang aku buat saat
memindahkan prompt — definisi tipe (`PrototypeResult`, `PrototypeScreen`,
`extractHtmlDocument`, `extractScreens`) ikut terhapus, dan `fallbackScreens`
menjadi duplikat. Keduanya lolos dari test tapi gagal di TypeScript.
Pelajaran: **selalu jalankan build**, bukan hanya test.

---

## [v1.2.1] — README dipindah & disinkronkan (16 Sep 2026)

### Changed

- **`README.md` dipindah dari `xynn-prototype/` ke akar repositori.**
  Alasannya: README menjelaskan **seluruh proyek** (termasuk `opendesign/`,
  PRD, dan changelog), bukan hanya aplikasi Next.js. Dipindah dengan
  `git mv` sehingga riwayat file terjaga, dan dua link relatif
  (`../CHANGELOG.md`, `../XynnPROtotype.md`) diperbaiki menjadi `./`.
- **README disinkronkan dengan keadaan nyata.** Dokumen ini ditulis sebelum
  Fase 1 & 2 dikerjakan, sehingga banyak klaim sudah basi. Yang diperbaiki:
  - Prototype Design: dari "*Direncanakan*" → **selesai (PRO ke atas)**.
  - Tier: dari "Saat ini 3 tier" → **4 tier**, lengkap dengan kolom
    `prototypeLimit` per tier.
  - Endpoint: `32` → **33**; `/api/ai/prototype` dari "*Direncanakan*"
    → **berfungsi**, dengan catatan gate 402/429/400.
  - Uji: `38` → **58**, dan menyebut `theme.test.mjs`.
  - Migrasi: `5` → **10**.
  - Struktur proyek: `chat/` kini "rangka UI" (bukan placeholder),
    ditambah `prototype/`; angka komponen/lib/enum dikoreksi.
  - Bagian `computeStepAvailability`: dari "ketidak-konsistenan yang
    diketahui" → **"Diperbaiki"** (memang sudah diperbaiki di kode).
  - Daftar fungsi gate ditambah `isProOrAbove`, `canUsePrototype`,
    `canGeneratePrototype`, `remainingPrototypeQuota`, `canSaveThemes`.

**Catatan:** semua angka di README diverifikasi ulang terhadap kode
(`Get-ChildItem` / `Select-String`), bukan diperkirakan.

---

## [v1.2.0] — Prototype Design / opendesign (16 Sep 2026)

**Fase 2 selesai & terverifikasi end-to-end.** Pengguna PRO kini bisa
men-generate prototype HTML dari PRD + Style Guide, melihatnya di kanvas
(multi-screen, responsive), dan mengubah tema.

### Added

- **Tab `Prototype`** di `project/[id]` — sejajar Mindmap · PRD · Task · Style.
  Terkunci untuk non-PRO (`reason: "pro"` → modal upgrade). Prasyarat:
  Style Guide harus sudah ada.
- **`/api/ai/prototype`** — endpoint generator dengan gate berlapis:
  `401` belum login · `402` paket tidak mendukung · `429` kuota habis ·
  `400` prasyarat belum ada · `404` workspace tidak ditemukan.
- **`generatePrototypeWithAI()`** di `lib/ai.ts`, plus tiga helper yang
  dapat diuji terpisah: `extractHtmlDocument()`, `extractScreens()`,
  `buildPrototypePrompt()`.
- **`components/prototype-canvas.tsx`** — render di `<iframe srcDoc>` dengan
  `sandbox="allow-scripts"` (**tanpa** `allow-same-origin`, sehingga output
  AI tidak dapat mengakses cookie/DOM aplikasi), toggle viewport
  desktop/mobile, mode Preview/Code, unduh HTML.
- **`components/theme-editor.tsx`** — panel tema berbasis token (6 warna,
  font heading/body, ukuran dasar, radius) + `applyThemeToHtml()` yang
  menyuntikkan CSS variables ke prototype.
- **Halaman `/prototype`** — galeri prototype lintas project, dengan banner
  gate PRO dan sisa kuota.
- **`/chat`** — diganti dari `ComingSoon` menjadi rangka split-view
  (chat kiri, kanvas kanan). **Belum terhubung AI** — lihat Known Issues.
- **Entri sidebar** untuk `/prototype` dan `/chat`.
- Kolom baru: `Workspace.prototypeHtml/prototypeJson/themeTokensJson`,
  `Plan.prototypeLimit`, `Subscription.prototypeLimit/prototypeUsedThisMonth`.
- Gate baru: `canGeneratePrototype()`, `remainingPrototypeQuota()`.

### Fixed

- **Drift migrasi ketiga: `Workspace.techStack`.** Riwayat migrasi
  menghasilkan kolom *nullable*, padahal database *NOT NULL* — sisa dari
  pemakaian `db push`. Diperbaiki dengan migrasi `20260916234500_techstack_notnull`.
  **Setelah ini `prisma migrate dev` tidak lagi melaporkan drift** — untuk
  pertama kalinya riwayat migrasi dan database sinkron.
- **`useSubscription()` tidak mengenal tier `ENTERPRISE`.** Logika tier di
  sisi klien (terpisah dari `lib/access.ts`) menjatuhkan planType yang tidak
  dikenal ke `"free"` — mode kegagalan senyap yang sama, tetapi di klien.
  Diperbaiki, dan gate baru (`canUsePrototype`, `canGeneratePrototype`,
  `canSaveThemes`, `prototypeQuotaLeft`) ditambahkan.
- **Semua langganan PRO mendapat kuota prototype 0** (bug ditemukan lewat
  pengujian alur nyata). Kolom baru default `0`, dan langganan yang sudah ada
  tidak ikut terisi — artinya PRO tidak bisa generate sama sekali. Diperbaiki
  dengan migrasi backfill `20260916235500_prototype_quota_backfill`.
- **`seed-plans.mts` blok `update` tidak menyertakan harga & limit.** Akibatnya
  plan yang sudah ada tidak pernah diperbarui (harga, `prdLimit`,
  `prototypeLimit`). Diperbaiki agar `update` menyertakan semua field.

### Fixed

- **Celah injeksi CSS pada Theme Editor.** `applyThemeToHtml` menyisipkan
  `fontHeading`/`fontBody` **tanpa sanitasi** ke dalam tag `<style>`, sehingga
  nilai seperti `x'; }</style><script>alert(1)</script>` dapat keluar dari
  tag tersebut. Dapat dijangkau karena `/api/workspace/update` menyimpan
  `themeTokensJson` tanpa validasi. Diperbaiki di **dua lapis**:
  1. `lib/theme.ts` — semua 10 nilai token disanitasi
     (`safeHex`, `safeFontName`, `safeInt`, `sanitizeThemeTokens`).
  2. `app/api/workspace/update/route.ts` — validasi server sebelum menyimpan.
  Dampak sebenarnya terbatas (payload tereksekusi di dalam iframe
  `sandbox` tanpa `allow-same-origin`, jadi tidak bisa menyentuh cookie/DOM
  aplikasi), tetapi tetap jalur injeksi yang benar untuk ditutup.
- **`safeInt` salah menangani `null`/`""`.** `Number(null)` dan `Number("")`
  bernilai `0`, sehingga nilai kosong terjepit ke batas minimum alih-alih
  memakai fallback (`baseSize` menjadi 8, bukan 16). Ditangani eksplisit.

### Changed

- **Logika tema dipindah dari `components/theme-editor.tsx` ke `lib/theme.ts`.**
  Alasannya: file `.tsx` tidak dapat dimuat `node:test` tanpa transformasi JSX,
  sehingga fungsi murni tidak bisa diuji. Komponen kini hanya mengimpor dan
  mengekspor ulang. **Efek samping: `tests/*.test.mjs` tidak boleh memuat
  anotasi TypeScript** (`: string`, `as unknown`, `import type`) — Node 22
  hanya men-*strip* tipe dari `.ts`, bukan dari `.mjs`.
- `tests/theme.test.mjs` — **14 test baru** (suite total 44 → **58**),
  termasuk 4 kasus serangan break-out `<style>` yang eksplisit.

### Verification (end-to-end, bukan hanya unit test)

| Pemeriksaan | Hasil |
| :--- | :--- |
| `npm test` | **58 lulus**, 0 gagal (naik dari 44) |
| `npm run build` | **Exit 0** (TypeScript lolos) |
| `npx eslint` | 0 error |
| `npx prisma migrate status` | 10 migrasi, **up to date**, tanpa drift |
| Gate non-PRO | **402** dengan pesan tepat |
| Workspace tak dikenal / tanpa id | **404** / **400** |
| Generate nyata (user PRO) | **200** dalam 38,4 dtk · 46.113 karakter HTML |
| Kualitas output | DOCTYPE ✓ · viewport ✓ · 6 penanda screen ✓ · 2 media query ✓ · **0 aset eksternal** ✓ |
| Kuota | naik 0 → 1 dari 20 setelah generate |
| Sanitasi tema (7 payload serangan) | semua ditolak · tepat 1 `</style>` |
| Data pengguna | tetap utuh |

**Dibuktikan test benar-benar melindungi:** mengembalikan interpolasi font ke
bentuk mentah membuat test break-out **gagal**; file lalu dipulihkan
byte-identik (SHA256 cocok) dan 58/58 lulus kembali.

### Known Issues

- **`/chat` belum terhubung AI.** Yang ada baru rangka UI dua kolom + gate PRO.
  Untuk mengaktifkan perlu endpoint percakapan beserta manajemen riwayat.
- **Regenerate masih borong semua screen** (sesuai keputusan). Belum ada
  regenerate per-screen.
- **Tab `Selection` pada theme editor belum ada** — baru tab `Theme`.
  Mengedit per-elemen menimpa token dan menyulitkan konsistensi.
- **Gaya tema diterapkan lewat injeksi CSS variables**, jadi hanya berpengaruh
  bila prototype memakai nama variabel yang sama. Prototype yang di-generate
  AI sudah memakai `--color-*`/`--font-*`, tetapi tidak dijamin untuk semua.
- **`simpan tema` masih per-workspace**, belum library lintas-project
  (fitur ENTERPRISE yang dijanjikan belum dibangun).
- **Biaya AI nyata:** satu generate ≈ 46 ribu karakter output. Kuota PRO
  dibatasi 20/bulan untuk melindungi margin.

---

## [v1.1.0] — Langganan 4 Tier (16 Sep 2026)

**Fase 1 selesai & terverifikasi.** `ENTERPRISE` kini menjadi kenyataan di
database, gating, dan UI pricing. Opendesign (prototype + theme editor)
**belum** dikerjakan — itu Fase 2.

### Added

- **Tier `ENTERPRISE`** — `FREE → STARTER → PRO → ENTERPRISE`.
  Enterprise diletakkan **di atas** Pro agar pengguna Pro yang sudah ada
  tidak kehilangan fitur. Harga: Rp 499.000/bln · Rp 3.999.000/thn,
  `prdLimit: -1`. Dapat diubah admin lewat `/admin/plans` tanpa deploy.
- **Gate baru** di `lib/access.ts`:
  - `isProOrAbove()` — Pro atau di atasnya (menghindari perbandingan tier literal).
  - `canUsePrototype()` — pembeda Starter vs Pro (dipakai Fase 2).
  - `canSaveThemes()` — pembeda Pro vs Enterprise (library tema).
- **Migrasi** `20260916230100_plan_enterprise` — `ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'ENTERPRISE'`.

### Fixed

- **Tabel `AiConfig` tidak pernah ada di migrasi mana pun.** Tabel itu ada di
  database (dibuat lewat `prisma db push`) dan dipakai oleh `/admin/ai-config`
  serta seluruh endpoint AI, tetapi tidak tercatat di migrasi. Akibatnya
  database baru hasil `prisma migrate deploy` **tidak akan punya tabel ini**
  dan aplikasi akan gagal saat `prisma.aiConfig.findFirst()`.
  Ditambahkan migrasi `20260916230000_aiconfig_backfill` yang **idempoten**
  (`CREATE TABLE IF NOT EXISTS`) sehingga aman untuk database yang sudah
  berisi data — tidak perlu `migrate reset`.
- **`prisma7.config.ts` tidak mendefinisikan `shadowDatabaseUrl`.** Karena
  Prisma 7 (mode config-file) mengabaikan `SHADOW_DATABASE_URL` di `.env`,
  `prisma migrate dev` **selalu gagal** dengan P3006 (`type "Role" already
  exists`) — Prisma mencoba memakai database kerja sebagai basis replay
  migrasi. Ini kemungkinan besar penyebab drift `AiConfig` di atas.
  Ditambahkan `shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"]`.
- **`computeStepAvailability()` tidak konsisten dengan server.** Helper
  menghitung `style: paid && hasPrd`, padahal `styleGuide/route.ts`
  mensyaratkan `tasksJson`. Diperbaiki menjadi `paid && !!opts.hasTasks`.
  (Bug ini ditemukan saat menulis test, bukan dari laporan pengguna.)

### Changed

- `lib/plans.ts` — `DEFAULT_PLANS` + `PlanCode` + `mapCodeToPlanType()` +
  `planPrdLimit()` menyertakan `ENTERPRISE`.
- `prisma/seed-plans.mts` — menambahkan plan Enterprise (seed idempoten via `upsert`).
- `components/pricing-plans.tsx` — grid `lg:grid-cols-3` → **`lg:grid-cols-4`**,
  padding & ukuran harga disesuaikan, ditambah label "Prototype Design mulai
  di sini" (PRO) dan "Library tema tersimpan" (Enterprise).
- `tests/access.test.mjs` — **38 → 44 test**. Ditambah uji untuk `isProOrAbove`,
  `canUsePrototype`, `canSaveThemes`, tier `ENTERPRISE` di tabel kebenaran,
  dan perilaku `computeStepAvailability` yang sudah diperbaiki.

### Verification

| Pemeriksaan | Hasil |
| :--- | :--- |
| `npm test` | 44 lulus, 0 gagal |
| `npx prisma validate` | valid |
| `npx prisma migrate status` | 7 migrasi, **Database schema is up to date!** |
| `npm run build` | **Exit 0** (TypeScript lolos) |
| `npx eslint lib/ components/ tests/` | 0 error |
| Data pengguna | utuh: 22 user · 17 workspace · 22 subscription · 21 transaksi |

**Dibuktikan test benar-benar melindungi:** menghapus penanganan `ENTERPRISE`
dari `getAccessTier()` membuat **7 test gagal**, termasuk
`tidak ada planType berbayar yang bocor menjadi tier free` (mode kegagalan 1)
dan `PRO_YEARLY dan ENTERPRISE boleh fork` (mode kegagalan 2).

### Known Issues

- **Opendesign belum dikerjakan.** Tab Prototype, `/api/ai/prototype`,
  canvas, theme editor, dan `/chat` masih belum ada. Rencana: Fase 2 di
  `RENCANA-IMPLEMENTASI.md`.
- **Enterprise diberi tier `"enterprise"` tersendiri** (bukan dipetakan ke
  `"pro"`), agar gate Pro-vs-Enterprise bisa dibedakan. Konsekuensinya:
  setiap gate baru **wajib** menyertakan enterprise, atau gunakan
  `isProOrAbove()`.
- **`.env` berisi rahasia asli** (API key AI, Google client secret,
  `ENCRYPTION_KEY`). Pastikan tidak ikut ter-commit.

---

## [v1.0.1] — Perbaikan Skema & Pengujian Gate (16 Sep 2026)

Perbaikan nyata pada **kode aplikasi** (bukan hanya dokumen), menutup
temuan dari verifikasi dokumen.

### Fixed

- **Drift skema ↔ migrasi pada `AiUsage`.** `prisma/schema.prisma` tidak
  mencatat `@@index` apa pun untuk `AiUsage`, padahal migrasi
  `20260915225100_ai_usage` sudah membuat dua index
  (`AiUsage_createdAt_idx`, `AiUsage_kind_idx`). Ditambahkan
  `@@index([createdAt])` dan `@@index([kind])` sehingga schema kembali
  menjadi sumber kebenaran yang akurat.
  *Konsekuensi bila dibiarkan:* `prisma migrate dev` berikutnya akan
  mengusulkan penghapusan index tersebut dari database.
  Diverifikasi dengan `npx prisma validate` (valid) dan
  `npx prisma migrate status` (**"Database schema is up to date!"**).
- **Baris kosong sisa edit di blok `datasource db`.** Sisa dari penghapusan
  `url = env("DATABASE_URL")` (Prisma 7 meresolusi URL lewat
  `prisma7.config.ts`). Tidak mengubah perilaku; dirapikan.

### Added

- **`tests/access.test.mjs`** — 38 uji untuk `lib/access.ts` memakai
  `node:test` bawaan Node 22 (**tanpa dependency baru**), dijalankan lewat
  `npm test`. Menguji aktivasi langganan, pemetaan tier, kuota PRD, dan
  rantai prasyarat.
- Fokus utama suite ini adalah **menutup dua mode kegagalan senyap** saat
  menambah tier baru (lihat `[Unreleased]` di bawah). Bila sebuah planType
  berbayar didaftarkan di `PAID_PLAN_TYPES` tanpa memperbarui
  `getAccessTier()` atau `canFork()`, uji akan gagal dan menunjuk tepat ke
  gate yang belum diperbarui.
  *Dibuktikan dengan simulasi:* menambahkan `ENTERPRISE` secara sengaja
  membuat **3 uji gagal** (fallthrough tier, inkonsistensi `canFork` vs
  `canExport`, dan tabel kebenaran lintas planType).
- **`npm test`** ditambahkan ke `package.json`
  (`node --experimental-strip-types --test tests/*.test.mjs`).
  `lib/access.ts` hanya memakai `import type`, sehingga dapat dimuat
  langsung tanpa langkah build.

### Known Issues

- **`computeStepAvailability()` tidak konsisten dengan server.**
  `styleGuide/route.ts` mensyaratkan `tasksJson`, tetapi helper menghitung
  `style: paid && hasPrd` — mengabaikan `hasTasks`. Belum berbahaya karena
  fungsi ini belum dipanggil di UI mana pun. Perilaku saat ini dikunci oleh
  uji terdokumentasi agar tidak berubah diam-diam. Perbaikan yang benar:
  `style: paid && opts.hasTasks`.

---

## [Unreleased] — Fitur Prototype Design & Langganan 4 Tier

**Status:** *Didesain & diperencanakan. Belum diimplementasikan.*

Fase ini menghasilkan **artefak desain** (mockup HTML) dan **revisi PRD**.
Kode aplikasi belum diubah — tidak ada migrasi Prisma baru, tidak ada
endpoint baru. Implementasi menyusul.

### Added (Design)

- `opendesign/design-systems/xynnprototype/` — design system yang
  **di-import dari codebase nyata** (`app/globals.css`), bukan dikarang.
  Seluruh token warna (12), radius, dan tipografi dicocokkan satu per satu
  dengan sumbernya.
- `opendesign/mockups/prototype-canvas/prototype-canvas.html` — mockup
  Prototype Canvas dengan state `Locked · Empty · Generating · Ready`,
  toggle viewport `Desktop · Mobile`, mode `Preview · Code`.
- `opendesign/mockups/prototype-canvas/entry-points.html` — mockup dua
  pintu masuk: tab di project workspace, dan halaman chat *split-view*.
- `opendesign/mockups/pricing/pricing-4-tier.html` — mockup halaman
  langganan 4 tier + matriks fitur 14 baris + pratinjau gate per tier.
- Panel **Theme Editor** pada mockup canvas: preset tema, *seed color* →
  palet otomatis (6 peran), tipografi detail (font, skala, line-height,
  tracking), bentuk & spasi, dan panel token output.

### Added (Fitur — direncanakan)

- **Modul Prototype Design** (PRO gate): generate HTML/CSS/JS mandiri dari
  PRD + Style Guide, dirender di `<iframe sandbox="allow-scripts">`,
  mendukung multi-screen flow dan tampilan responsive (mobile & desktop).
- **Theme Editor** dua lapis: tab `Theme` (token global, default) dan tab
  `Selection` (per-elemen, menimpa token).
- **Pintu masuk ganda:** tab `Prototype` ke-4 di `project/[id]`, dan
  halaman `/chat` (sebelumnya masih placeholder `ComingSoon`).

### Changed

- **PRD direvisi ke v1.1** (`XynnPROtotype.md`):
  - Matriks hak akses diperluas dari 3 → **4 kolom tier**.
  - Ditambahkan §3.5 (Modul Prototype Design & Theme Editor).
  - Ditambahkan §3.6 (Struktur Langganan 4 Tier + peringatan implementasi).
  - Dijabarkan KPI baru: Prototype Design Adoption, Theme Editor
    Engagement, Enterprise Upgrade Trigger.
  - Skema `Workspace` ditambah `prototypeHtml`, `prototypeJson`,
    `themeTokensJson`. Enum `PlanType` ditambah `ENTERPRISE`.
- **Struktur langganan:** 3 tier → **4 tier** (`FREE → STARTER → PRO →
  ENTERPRISE`). Enterprise diletakkan **di atas** PRO agar pengguna PRO
  yang sudah ada tidak kehilangan fitur.
- `README.md` ditulis ulang dari boilerplate `create-next-app` menjadi
  dokumentasi proyek yang lengkap.

### Fixed (selama proses desain)

Dua kesalahan faktual ditemukan & diperbaiki pada catatan mockup pricing
oleh proses verifikasi independen (detail di bawah). Keduanya **kesalahan
dalam dokumentasi desain**, bukan pada kode aplikasi:

- Klaim arah kegagalan tier Enterprise ditulis **terbalik** — semula
  menyatakan pengguna Enterprise "tetap dapat semua", padahal
  `getAccessTier()` menjatuhkan tipe yang tidak dikenal ke `"free"`
  sehingga mereka kehilangan seluruh akses berbayar.
- Klaim cakupan pola `=== "pro"` ditulis **terlalu luas** — semula
  menyebut pola itu "berulang di `canAccessVault`, `canExport`", padahal
  `canFork()` adalah **satu-satunya** gate dengan perbandingan tier
  literal; fungsi lain memakai `isPaid()`.

### Known Issues / Belum Diputuskan

- **`pricing-plans.tsx` masih `lg:grid-cols-3`.** Dengan 4 kartu hasilnya
  3 + 1 (tidak rapi). Perlu `lg:grid-cols-4` dengan padding dikurangi.
- **Harga Enterprise masih usulan** (Rp 499.000/bln) — bukan angka final.
- **`PRO_YEARLY` belum dipetakan** ke varian billing Enterprise. Bila
  Enterprise perlu siklus tahunan bertipe sendiri, `PlanType` enum dan
  `mapCodeToPlanType()` ikut berubah.
- **Sumber masukan prompt prototype belum ditetapkan** — apakah endpoint
  menerima `workspaceId` (server membaca PRD + Style Guide dari DB) atau
  menerima konteks langsung dari riwayat chat.
- **Regenerate per-screen belum dirancang.** Saat ini modelnya
  "generate 5 screen sekaligus"; regenerate sebagian belum ada.
- **Versioning prototype belum dirancang** — penting begitu chat dipakai
  untuk revisi berulang.
- **Biaya AI belum diperhitungkan.** HTML penuh jauh lebih mahal daripada
  Markdown. Setiap regenerate adalah panggilan AI penuh; ini menyentuh
  margin PRO dan harus diputuskan sebelum implementasi.
- **Model AI untuk prototype belum dipilih.**
- **Enterprise: self-serve atau "Hubungi kami"?** Belum diputuskan.

---

## [v1.0.0] — Selesai (14–16 Sep 2026)

Fase pengerjaan aplikasi dari nol hingga berfungsi. Kronologi disusun
dari timestamp migrasi Prisma dan urutan skrip pengujian.

### 🗓️ 14 Sep 2026, 20:03 — Fondasi & Autentikasi

Migrasi: `20260914200338_init`

Fase paling besar — seluruh inti aplikasi diletakkan sekaligus.

**Added**
- Skema database awal: 7 tabel (`User`, `Subscription`, `Workspace`,
  `ApiKey`, `PaymentConfig`, `Voucher`, `Transaction`) + 4 enum
  (`Role`, `PlanType`, `SubStatus`, `BillingCycle`).
- Autentikasi **Google OAuth saja** (zero-friction, tanpa formulir
  pendaftaran manual, tanpa verifikasi SMTP, tanpa kata sandi).
- *Auto-provisioning*: pengguna baru otomatis dibuatkan record +
  dialokasikan ke plan FREE, lalu diarahkan ke `/new-project`.
  Pengguna lama langsung ke `/dashboard`.
- Relasi *forking* pada `Workspace` (`forkedFromId` → `Workspace`),
  termasuk `viewsCount` dan `forksCount` untuk mesin komunitas.
- `PaymentConfig` dengan `serverKeyEncrypted` (AES-256-GCM, lihat §8 PRD).
- Cryptographic API key: token `xynn_live_xxxxxxxx` di-hash SHA-256
  sebelum disimpan — nilai asli hanya dikirim sekali ke pengguna.

**Test evidence:** `_login.mjs`, `_postlogin.mjs`
- Anonim di `/login` → 200 (menampilkan form).
- Admin & user yang sudah login di `/login` → redirect ke `/post-login`.
- Alur `ADMIN`: `/login` → `/post-login` → `/admin`.
- Alur intended: user dengan `callbackUrl` diarahkan ke tujuan semula.

### 🗓️ 15 Sep 2026, 22:42 — Tech Stack Fleksibel

Migrasi: `20260915224254_techstack_json`

**Changed**
- `Workspace.techStack` diubah menjadi `Json` agar dapat menampung array
  stack yang bebas bentuk (ai-suggested maupun manual).

**Test evidence:** `_tech.mjs`
- Memanggil `/api/ai/techstack` dengan `{title, description, locale}` dan
  mencatat respons rekomendasi stack.
- Catatan: skrip ini **hanya menguji jalur AI**. Mode `ai` vs `manual`
  adalah fitur sisi-klien di wizard (`new-project/page.tsx`), bukan cabang
  di dalam endpoint — endpoint `techstack/route.ts` hanya punya satu jalur.
- Catatan lain: endpoint ini **belum** dipaywall (hanya cek sesi), berbeda
  dari `tasks`/`styleguide`/`full-prd` yang mengembalikan 402 untuk Free.

### 🗓️ 15 Sep 2026, 22:51 — Pelacakan Biaya AI

Migrasi: `20260915225100_ai_usage`

**Added**
- Tabel `AiUsage` + index `createdAt` dan `kind`.
- Fondasi untuk memantau *token burn rate* dan margin AI — prasyarat
  widget **AI Cost & Margin Health** di dashboard admin.

### 🗓️ 15 Sep 2026, 23:54 — Plan, Task Breakdown & Style Guide

Migrasi: `20260915235457_plan_and_workspace_ext`

**Added**
- Tabel `Plan` — plan kini dapat diatur admin (harga, diskon, fitur,
  `sortOrder`, `isPopular`) lewat `/admin/plans` **tanpa deploy**.
- `Workspace.tasksJson` — Task Breakdown per fase (`phase`, `title`,
  `description`, `priority`).
- `Workspace.styleGuideMd` — Style Guide (design system) hasil AI.
- `Workspace.techPreferences` — preferensi stack terstruktur
  (frontend/backend/database/deployment + `reasoning`).
- `Subscription.billingCycle` dan `Subscription.startedAt`.

**Changed**
- `lib/plans.ts`: `DEFAULT_PLANS` (3 plan) + seeding *lazy* via
  `ensurePlansSeeded()`.
- `lib/access.ts` ditetapkan sebagai **satu sumber kebenaran** untuk gate
  server & client.

**Test evidence:** `_gate.mjs`, `_tabs.mjs`
- `_gate.mjs`: memverifikasi gate lewat **endpoint HTTP** (bukan memanggil
  fungsi TS secara langsung) — FREE menerima **402** pada endpoint
  berbayar; STARTER lolos. Membuktikan efek `canGeneratePrd`,
  `canGenerateAdvanced`, dan gerbang paywall lainnya di lapisan API.
- `_tabs.mjs`: urutan tab di `project/[id]` diverifikasi —
  `Mindmap > PRD > Task > Style`.

**Catatan urutan dependensi (penting):**
`styleguide/route.ts` mensyaratkan `tasksJson` sudah ada
("Generate Task Breakdown terlebih dahulu"), dan `tasksJson` mensyaratkan
`fullPrdMd`. Ini menetapkan rantai **Mindmap → PRD → Task → Style** yang
kelak menjadi prasyarat tab Prototype.

### 🗓️ 15 Sep 2026, ~23:5x — Interactive Mindmap Canvas

**Added**
- `components/mindmap-canvas.tsx` — kanvas React Flow (`@xyflow/react`)
  dengan `Background`, `Controls`, dan `MiniMap`.
- Node dirender dengan gaya konsisten: `--surface-2` fill,
  `--border-strong` stroke, radius 10px, teks 12px/500.
- Edge `smoothstep` + `MarkerType.ArrowClosed`; edge dari root diberi
  animasi.
- Mode `editable` (drag node, lapor perubahan posisi ke parent) dan mode
  *read-only* (pergerakan diblokir, select/hover tetap diizinkan).

**Test evidence:** `_canvas.mjs`
- Generate mindmap dari deskripsi ide; hitung jumlah node.
- Halaman `project/[id]` mengembalikan HTTP 200 (uji status halaman, bukan
  asersi bahwa kanvas benar-benar ter-render).

### 🗓️ 15–16 Sep 2026 — Pembayaran Lokal

**Added**
- `PaymentConfig` multi-gateway: **Midtrans** & **Xendit**, dengan
  `isActive` / `isProduction` per gateway.
- Alur checkout → instruksi bayar (QRIS, E-Wallet, Transfer Bank) →
  konfirmasi → langganan aktif.
- **Webhook idempotency**: status transaksi diperiksa sebelum memperbarui
  langganan, mencegah eksekusi ulang dari panggilan duplikat gateway.

**Security**
- `serverKeyEncrypted` dienkripsi di level database dengan AES-256-GCM
  memakai master key dari environment (`ENCRYPTION_KEY`).

**Test evidence:** `_pay.mjs`
- Alur penuh: checkout QRIS → verifikasi langganan **masih** FREE sebelum
  konfirmasi → konfirmasi → langganan menjadi PRO aktif.
- Idempotency: mengonfirmasi ulang tidak menggandakan transaksi.
- Verifikasi `daysLeft` pada `/api/user/subscription`.

### 🗓️ 16 Sep 2026 — Command Center Admin

**Added**
- Layout admin dengan RBAC (`ADMIN` via env `ADMIN_EMAILS`), termasuk
  halaman penolakan akses yang informatif.
- `/admin` — AI Cost & Margin Health (token burn rate & profit ring).
- `/admin/ai-config` — **Live System Prompt Sandbox** (editor
  *split-screen* untuk menguji perubahan prompt tanpa redeploy) dan
  pemilihan model per tahap (`prdModel`).
- `/admin/plans` — pengaturan paket & harga.
- `/admin/payments` — konfigurasi gateway dinamis.
- `/admin/users` — manajemen pengguna & perubahan plan.
- `/admin/vouchers` — manajemen voucher (persen/nominal, `maxUses`).
- `CommandPalette` (⌘K) — navigasi cepat.

**Test evidence:** `_adm.mjs`, `_adm2.mjs`
- Login via kredensial; verifikasi `role` dari `/api/auth/session`.
- Akses halaman `/admin` dan `/admin/plans` dengan sesi admin.

### 🗓️ 16 Sep 2026, 00:15 — Lokalisasi ID/EN

Migrasi: `20260916001551_workspace_locale`

**Added**
- `Workspace.locale` (default `'id'`) — agar artefak yang di-generate AI
  (PRD, Task, Style Guide) mengikuti bahasa yang dipilih di wizard.
- Pemilih bahasa di langkah pertama wizard, dengan contoh ide yang ikut
  berubah per bahasa.

### 🗓️ 16 Sep 2026 — Hardening & Stabilitas

**Added**
- **Server guard**: endpoint berat mengembalikan **HTTP 402 Payment
  Required** secara otomatis bila dipanggil akun Free.
- Konten ter-gate ditampilkan *blur* + overlay unlock (Gudang PRD,
  pratinjau prototype) alih-alih error mentah.
- Multi-layer export: PRD, Task, Style Guide (masing-masing `.md`) +
  bundel "Unduh Semua".
- CLI Sync (`bin/cli.js`, bin `xynn`): perintah `xynn connect
  --workspace <id>` menarik `PRD.md` dan `.cursorrules` ke folder lokal.
- `lib/i18n.ts` — terjemahan terpusat ID/EN.
- `components/table-of-contents.tsx` — TOC *floating* dengan ekstraksi
  heading dari Markdown.
- `components/task-checklist.tsx` — checklist tugas interaktif.
- `components/markdown-renderer.tsx` + `components/mermaid.tsx` —
  render PRD dengan diagram Mermaid dan badge stack.

**Test evidence:** `_stability.mjs`
- Uji beban berulang pada `/api/user/subscription` dan `/api/workspace`;
  hitung `ok` vs `fail` untuk mendeteksi ketidakstabilan.

**Improved**
- `components/ui/*` — primitif UI konsisten (Button, Badge, Card, Input,
  EmptyState, Skeleton, StepIndicator, PageHeader, Logo).
- Design system *anti-slop* di `app/globals.css`: palet *Dark Slate*,
  satu accent (`#4f7cff`), Geist Sans/Mono, radius 14px, latar *dotted
  grid*, dan animasi `xynn-rise` untuk transisi antar langkah.

---

## Ringkasan Angka (keadaan saat ini)

| Metrik | Jumlah |
| :--- | ---: |
| Halaman (`page.tsx`) | 26 |
| Endpoint API (`route.ts`) | 49 |
| Komponen React (`components/**/*.tsx`) | 30 |
| Modul library (`lib/*.ts`) | 31 |
| Model Prisma | 21 |
| Enum Prisma | 7 |
| Migrasi database | 18 |
| Tier langganan (saat ini) | **4** (Free · Starter · Pro · Enterprise) |

---

## Catatan Pemeliharaan

1. **Changelog ini belum terhubung ke commit.** Setelah `git init` +
   commit pertama, disarankan menambah hook yang menyarankan pembaruan
   changelog pada setiap perubahan fitur.
2. **Bagian `[Unreleased]` mencerminkan desain, bukan kode.** Jangan
   menandai Prototype Design "selesai" sampai endpoint, migrasi, dan
   komponennya benar-benar ada.
3. **Dua kesalahan yang ditemukan saat mendesain** (arah kegagalan
   Enterprise & cakupan pola `=== "pro"`) dicatat sebagai pelajaran:
   menambah tier memiliki **dua mode kegagalan senyap** yang wajib
   ditutup dengan test. Rincian di PRD §3.6.
