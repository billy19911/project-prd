# Rencana Implementasi — 4 Tier & Prototype Design (opendesign)

**Status:** **Fase 1 & Fase 2 SELESAI & terverifikasi.**

## Progres

| Fase | Status |
| :--- | :--- |
| **Fase 1 — Langganan 4 Tier** | ✅ **Selesai** (44 test lulus, build exit 0, DB up to date) |
| **Fase 2 — Prototype Design** | ✅ **Selesai** (generate nyata 200, HTML 46 rb karakter, 0 aset eksternal) |

### Fase 2 — yang sudah dikerjakan

| Task | Hasil |
| :--- | :--- |
| T2.1 Skema | ✅ `prototypeHtml`/`prototypeJson`/`themeTokensJson` + kolom kuota |
| T2.2 `lib/ai.ts` | ✅ `generatePrototypeWithAI` + `extractHtmlDocument` + `extractScreens` + `buildPrototypePrompt` |
| T2.2b Endpoint | ✅ `/api/ai/prototype` — gate 401/402/429/400/404 |
| T2.3 Canvas | ✅ `components/prototype-canvas.tsx` (iframe sandbox, viewport toggle) |
| T2.3b Titik masuk | ✅ Tab Prototype + sidebar + halaman `/prototype` |
| T2.5 Theme editor | ✅ `components/theme-editor.tsx` (tab Theme; Selection ditunda) |
| T2.4 Chat | ⚠️ Rangka UI saja — belum terhubung AI |
| Verifikasi | ✅ build exit 0 · lint 0 · test 44/44 · generate nyata 200 |

### Bug nyata yang ditemukan selama Fase 2

1. **Drift migrasi ketiga** (`Workspace.techStack`) — riwayat migrasi *nullable*
   vs database *NOT NULL*. Setelah diperbaiki, `migrate dev` **tidak lagi
   melaporkan drift**.
2. **`useSubscription()` tidak mengenal ENTERPRISE** — mode kegagalan senyap
   yang sama, tapi di klien.
3. **Semua PRO dapat kuota prototype 0** — sehingga tidak bisa generate sama
   sekali. Ditemukan lewat pengujian alur nyata, bukan unit test.
4. **`seed-plans.mts` blok `update` tidak menyertakan harga/limit** — plan
   yang sudah ada tidak pernah diperbarui.

---

## ⚠️ Keputusan yang sudah dikunci

- Susunan tier: `FREE → STARTER → PRO → ENTERPRISE` (Enterprise **di atas** Pro).
- Prototype Design diaktifkan di **PRO**; library tema tersimpan di **ENTERPRISE**.
- Harga Enterprise: **Rp 499.000/bln** · Rp 3.999.000/thn (bisa diubah lewat `/admin/plans`).
- Scope opendesign: **penuh** (multi-screen, responsive, theme editor).
- Enterprise memakai tier `"enterprise"` **tersendiri** (bukan alias `"pro"`).

---

## 0. Keadaan saat ini (terverifikasi)

| Yang diperiksa | Keadaan nyata |
| :--- | :--- |
| `lib/plans.ts` → `DEFAULT_PLANS` | ✅ **4 tier**: FREE, STARTER, PRO, ENTERPRISE |
| `prisma/schema.prisma` → `PlanType` | ✅ **5 nilai**: FREE, STARTER, PRO, PRO_YEARLY, ENTERPRISE |
| `lib/access.ts` | ✅ `"free" \| "starter" \| "pro" \| "enterprise"` + 3 gate baru |
| `app/api/ai/prototype/route.ts` | ❌ **tidak ada** (Fase 2) |
| Tab Prototype di project detail | ❌ **tidak ada** (Fase 2) |
| `app/(main)/chat/page.tsx` | ❌ masih `<ComingSoon />` (Fase 2) |
| Komponen canvas | hanya `mindmap-canvas.tsx` (Fase 2) |
| Test | `tests/access.test.mjs` — **44 uji, lulus** |
| Migrasi | **7** (2 baru: backfill AiConfig, plan enterprise) |
| Pola AI | `lib/ai.ts` — 5 fungsi `generate*WithAI`, model default `"OpenCodeCombo"`, biaya dicatat via `recordAiUsage` |

**Catatan penting:** `PRO_YEARLY` adalah **varian siklus billing**, bukan tier.
Ia diperlakukan identik dengan PRO di `getAccessTier()`. Rencana ini **tidak**
mengubah itu.

---

## FASE 1 — Langganan 4 Tier

Tujuan: `ENTERPRISE` menjadi kenyataan di database, gating, dan UI pricing.
Tidak menyentuh opendesign sama sekali. Bisa diverifikasi mandiri.

### T1.1 Skema & migrasi

**File:** `prisma/schema.prisma`
- Tambah `ENTERPRISE` ke `enum PlanType`.

**Perintah:** `npx prisma migrate dev --name plan_enterprise`

> ⚠️ **Ini migrasi enum PostgreSQL.** Menambah nilai enum tidak bisa di-*rollback*
> dengan mudah. Pastikan tidak ada transaksi berjalan saat migrasi dijalankan
> (PostgreSQL < 12 tidak bisa `ADD VALUE` di dalam transaksi).
> Migrasi ini **aditif** — nilai lama tidak dihapus, jadi aman.

**Verifikasi:** `npx prisma migrate status` → up to date; `npx prisma validate` → valid.

### T1.2 Gating

**File:** `lib/access.ts` — **dua titik, keduanya mode kegagalan senyap:**

1. `getAccessTier()` — tambah `ENTERPRISE`. **Wajib**, karena fallback-nya
   `return "free"`; tanpa ini pengguna Enterprise kehilangan **seluruh** akses berbayar.
   ```ts
   if (plan === "PRO" || plan === "PRO_YEARLY" || plan === "ENTERPRISE") return "pro";
   ```
   > Desain: apakah Enterprise memetakan ke `"pro"` (aditif, aman) **atau**
   > dapat tier `"enterprise"` sendiri? **Rekomendasi: tier sendiri**
   > (`"enterprise"`) agar gate Pro-vs-Enterprise bisa dibedakan. Tapi ini
   > berarti **setiap** gate `=== "pro"` harus menyertakan enterprise.
2. `canFork()` — saat ini `getAccessTier(sub) === "pro"` (literal).
   Jika tier baru dibuat, ubah jadi menyertakan enterprise.

- Tambah `AccessTier` nilai `"enterprise"`.
- Gate baru untuk fitur mendatang:
  - `canUsePrototype(sub)` → pro **atau** enterprise
  - `canSaveThemes(sub)` → enterprise saja

**Test:** `tests/access.test.mjs` — tambah `"ENTERPRISE"` ke `PAID_PLAN_TYPES`,
tambah baris `ENTERPRISE` di tabel `expected`, tambah uji gate baru.
> Sudah terbukti: menambah tier tanpa update gate membuat **3 uji gagal**.

### T1.3 Plan seed

**File:** `prisma/seed-plans.mts`
- Tambah objek `ENTERPRISE` (harga 499000/3999000, `prdLimit: -1`, `isPopular: false`, `sortOrder: 3`, fitur sesuai PRD §3.6).
- Seed memakai `upsert` → aman dijalankan ulang.

**File:** `lib/plans.ts`
- `mapCodeToPlanType()` → kenali `"ENTERPRISE"`.
- `planPrdLimit()` → `ENTERPRISE` = `-1`.
- `PlanCode` type → tambah `"ENTERPRISE"`.

### T1.4 UI pricing (4 kartu)

**File:** `components/pricing-plans.tsx`
- `lg:grid-cols-3` → `lg:grid-cols-4`, kurangi padding kartu.
- Kartu Enterprise: tanpa badge "Paling Populer" (tetap di PRO).
- Tandai bahwa Prototype Design mulai di PRO.

**File:** `components/landing-pricing.tsx` — tidak perlu diubah (memakai `PricingPlans`).

### T1.5 Verifikasi Fase 1

- `npm test` lulus (termasuk uji tier baru).
- `npx prisma migrate status` → up to date.
- Jalankan seed; cek `/api/plans` mengembalikan 4 plan.
- Cek `/admin/plans` bisa mengubah harga Enterprise.

**Titik keluar Fase 1:** harga 4 kartu tampil, gating benar, test lulus.

---

## FASE 2 — Prototype Design (opendesign)

Tujuan: pengguna PRO bisa generate prototype HTML dari PRD + Style Guide,
melihatnya di canvas (multi-screen + responsive), dan mengubah tema.

### T2.1 Skema

**File:** `prisma/schema.prisma` → `model Workspace`
```prisma
prototypeHtml   String?
prototypeJson   Json?     // daftar screen + versi
themeTokensJson Json?     // token tema tersimpan
```
**Perintah:** `npx prisma migrate dev --name workspace_prototype`

### T2.2 Prasyarat generator

Prototype butuh konteks dari PRD **dan** Style Guide. Maka polanya:

**File:** `app/api/ai/prototype/route.ts` (baru)
- Tiru struktur `app/api/ai/styleguide/route.ts` (baca file itu).
- Cek sesi (401) → cek gate `canUsePrototype` (402) → baca workspace.
- Tolak bila `styleGuideMd` belum ada (400), seperti styleguide menolak bila `tasksJson` kosong.
- Panggil fungsi AI baru, simpan `prototypeHtml` + `prototypeJson`.
- Catat biaya via `recordAiUsage`.

**File:** `lib/ai.ts` → tambah `generatePrototypeWithAI()`
- Tiru pola `generateStyleGuideWithAI()`.
- **Ini panggilan termahal di aplikasi** (output HTML penuh, multi-screen).
- Prompt harus memaksa: HTML mandiri, CSS inline/di dalam file, tanpa aset eksternal, sadar breakpoint.

### T2.3 Render & UI

**File:** `components/prototype-canvas.tsx` (baru)
- `<iframe sandbox="allow-scripts">` + `srcDoc` — bukan `src`.
  > **Kritis:** `sandbox` tanpa `allow-same-origin` agar output AI tidak bisa
  > mengakses cookie/DOM aplikasi. Ini batas keamanan, bukan detail.
- Toggle viewport desktop/mobile (ubah lebar iframe, bukan re-render).
- Mode Preview / Code.

**File:** `app/(main)/project/[id]/page.tsx`
- Tambah `"prototype"` ke `type Tab` dan ke array `tabs`.
- `locked: !canUsePrototype(sub)`, `reason: "paid"`.
- Ikuti pola tab yang sudah ada (locked → `upgrade.open()`).

**T2.3b Titik masuk "card" — PERLU KEPUTUSAN**

Ditemukan saat memverifikasi: `components/sidebar.tsx` hanya memuat 4 entri
(`Dashboard`, `Bikin Project`, `Gudang PRD`, `Settings`). Halaman
`/chat` dan `/templates` **ada tapi tidak terdaftar di sidebar**, jadi kedua
halaman itu saat ini tidak bisa dijangkau dari navigasi.

Artinya "card baru untuk opendesign" bisa berarti dua hal berbeda:

| Opsi | Bentuk | Dampak |
| :--- | :--- | :--- |
| **A. Entri sidebar** | Tambah `{ href: "/prototype", label: "Prototype", icon }` ke `nav` | Halaman baru `/prototype` (galeri prototype lintas project). Sederhana, konsisten |
| **B. Card di dashboard** | Kartu di `dashboard/page.tsx` yang menautkan ke alat prototype | Terlihat menonjol; cocok kalau prototype bukan "halaman" melainkan "alat" |
| **C. Dua-duanya** | Entri sidebar **dan** card di dashboard | Paling terlihat, tapi menambah dua tempat untuk dirawat |

> **Rekomendasi: A dulu.** Alasannya: dashboard saat ini adalah daftar
> workspace, bukan hub alat — menambah card di sana mengubah peran halaman itu.
> Sidebar adalah tempat navigasi yang memang sudah ada.

**Utang navigasi yang ikut ketahuan:** `/chat` dan `/templates` tidak ada di
sidebar. Bila chat menjadi pintu masuk resmi prototype (T2.4), ia **harus**
ditambahkan ke `nav` — kalau tidak, fiturnya tidak bisa ditemukan.

### T2.4 Chat (pintu masuk kedua)

**File:** `app/(main)/chat/page.tsx` — ganti `ComingSoon` jadi split-view
(chat kiri, canvas kanan). **Ini bagian terbesar dan paling tidak terdefinisi**
— perlu keputusan tambahan (lihat §3).

### T2.5 Theme editor (scope terbesar)

Panel dua tab: `Theme` (token global) + `Selection` (per-elemen) sesuai mockup.
- Token disimpan di `themeTokensJson`.
- Library tema lintas-project = fitur ENTERPRISE → butuh model baru
  (`SavedTheme`) dan halaman pengelolaan.

> Ini bagian yang paling mahal & paling berisiko. Lihat §4.

---

## 3. Keputusan yang MASIH dibutuhkan sebelum Fase 2

Rencana tidak bisa dikunci penuh tanpa ini:

| # | Pertanyaan | Mengapa penting |
| :--- | :--- | :--- |
| 1 | **Model AI untuk prototype?** `lib/ai.ts` default `"OpenCodeCombo"`. HTML penuh butuh model kuat. | Menentukan biaya & kualitas |
| 2 | **Sumber input:** `workspaceId` (baca dari DB) atau konteks dari chat? | Mengubah bentuk endpoint |
| 3 | **Regenerate per-screen** atau borong 5 screen? | Mengubah prompt & struktur data |
| 4 | **Versioning:** simpan riwayat prototype? | Menentukan skema |
| 5 | **Batas biaya:** karena HTML mahal, berapa kali boleh generate per bulan? | Menyentuh margin PRO |
| 6 | **"Card baru" itu entri sidebar, card dashboard, atau dua-duanya?** Lihat T2.3b. | Mengubah file yang disentuh |
| 7 | **Halaman `/prototype` tersendiri, atau cukup tab di dalam project?** | Menentukan apakah perlu route baru |

**Rekomendasi alur:** kerjakan Fase 1 sampai selesai & terverifikasi **dulu**.
Lalu jawab pertanyaan di atas, baru Fase 2 dimulai. Alasannya: opendesign
bergantung pada gating yang benar, dan gating itu tidak bisa diuji sebelum
tier-nya ada.

---

## 4. Risiko

| Risiko | Dampak | Mitigasi |
| :--- | :--- | :--- |
| **Migrasi enum PostgreSQL** | Tidak bisa rollback mudah | Migrasi aditif; backup DB dulu |
| **Fallback `return "free"`** | Pengguna Enterprise kehilangan akses | Test sudah menangkap; jalankan `npm test` |
| **`canFork` literal** | Enterprise kehilangan Fork | Sudah ditangani di T1.2 |
| **Output AI berupa HTML** | XSS / kebocoran sesi | `sandbox` tanpa `allow-same-origin` |
| **Biaya AI HTML** | Margin PRO tergerus | Batasi kuota generate; catat via `recordAiUsage` |
| **Theme editor besar** | Rencana bisa membengkak | Kerjakan setelah core prototype terbukti |
| **`computeStepAvailability` tidak konsisten** | Sudah tercatat, belum berbahaya | Perbaiki saat menyentuh tab (T2.3) |

---

## 5. Urutan yang disarankan

```
FASE 1 (dapat diverifikasi mandiri)
  T1.1 migrasi enum
  T1.2 access.ts + test          ← jalankan npm test
  T1.3 seed + plans.ts
  T1.4 UI 4 kartu
  ✔ titik keluar: 4 tier berfungsi

FASE 2 (butuh keputusan §3)
  T2.1 skema prototype
  T2.2 endpoint + lib/ai
  T2.3 canvas + tab              ← MVP "terlihat hasil" tercapai di sini
  T2.4 chat
  T2.5 theme editor + library tema (ENTERPRISE)
```

Setiap task: kerjakan → jalankan `npm test` → verifikasi → **lapor apa adanya**
(termasuk yang belum jadi).

---

## 6. Yang TIDAK termasuk rencana ini

- Tidak mengubah `PRO_YEARLY` menjadi tier tersendiri.
- Tidak menyentuh pembayaran (Midtrans/Xendit) — tier baru otomatis memakai alur
  checkout yang sudah ada karena harga ada di tabel `Plan`.
- Tidak merancang Enterprise multi-seat/kolaborasi (butuh model & UI baru).
  Rencana ini hanya membuat **tiernya ada dan benar**; fitur kolaborasi
  menyusul sebagai fase terpisah.
