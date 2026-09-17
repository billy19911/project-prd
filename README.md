# XynnPrototype

> Platform SaaS **AI-Driven PRD & Architecture Generator** — menjembatani fase *ideation* dengan fase eksekusi koding di IDE (VS Code, Cursor, Windsurf).

XynnPrototype memangkas waktu *planning* aplikasi dari hitungan hari menjadi hitungan menit. Anda menuliskan sebuah ide, dan sistem menghasilkan **spesifikasi teknis yang siap dikoding** - Mindmap, PRD lengkap, Task Breakdown, Style Guide, dan **Prototype Design** (HTML multi-screen yang bisa dilihat & diubah temanya) - lalu menyinkronkannya langsung ke folder proyek lokal lewat CLI.

---

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Alur Pengguna](#alur-pengguna)
- [Tech Stack](#tech-stack)
- [Struktur Proyek](#struktur-proyek)
- [Memulai (Setup Lokal)](#memulai-setup-lokal)
- [Variabel Environment](#variabel-environment)
- [Database & Migrasi](#database--migrasi)
- [Gating & Hak Akses](#gating--hak-akses)
- [Tier Langganan](#tier-langganan)
- [Referensi API](#referensi-api)
- [CLI Sync Engine](#cli-sync-engine)
- [Admin Panel](#admin-panel)
- [Design System](#design-system)
- [Artefak Desain (opendesign)](#artefak-desain-opendesign)
- [Troubleshooting](#troubleshooting)
- [Konvensi Pengembangan](#konvensi-pengembangan)
- [Lisensi & Status](#lisensi--status)

---

## Fitur Utama

| Modul | Deskripsi |
| :--- | :--- |
| **Autentikasi** | Google OAuth saja — tanpa formulir, tanpa verifikasi email, tanpa kata sandi. *Auto-provisioning* saat pertama masuk. |
| **Wizard AI** | Input ide → pilih tech stack (AI atau manual) → 5 pertanyaan penajaman → Mindmap → PRD → Task → Style Guide. |
| **Mindmap Canvas** | Diagram interaktif (React Flow) yang dapat diedit; berfungsi sebagai *free hook*. |
| **Full PRD** | Dokumen Markdown lengkap, siap dipaste ke AI *coding agent*. |
| **Task Breakdown** | Tugas terstruktur per fase dengan prioritas (`high`/`medium`/`low`) dan checklist interaktif. |
| **Style Guide** | Design system (token warna, tipografi) yang konsisten dengan Task Breakdown. |
| **Gudang PRD (Vault)** | Jelajahi PRD publik komunitas; *opt-in* privasi; mode *blur* untuk Free; fork untuk Pro. |
| **CLI Sync** | Tarik `PRD.md` + `.cursorrules` langsung ke folder proyek lokal. |
| **Prototype Design** | Generate HTML/CSS/JS multi-screen dari PRD + Style Guide, dengan Theme Editor. **PRO ke atas**, kuota 20/bulan. |
| **Admin Panel** | AI cost analytics, system prompt sandbox, manajemen plan/payment/user/voucher. |

---

## Alur Pengguna

```
                    ┌─────────────────────────────────────────┐
   Google OAuth ───▶│  Baru?  → buat record + plan FREE       │
                    │  Lama?  → langsung /dashboard           │
                    └──────────────────┬──────────────────────┘
                                       ▼
    ┌──────────────────────── WIZARD (5 langkah) ────────────────────────┐
    │                                                                    │
    │  1. Ide + Judul + Bahasa    2. Tech Stack       3. 5 Pertanyaan    │
    │     └─ buat Workspace          └─ AI / manual      └─ opsional     │
    │                                                                    │
    │  4. Mindmap Canvas  ──▶  5. Output: PRD → Task → Style Guide       │
    │     (free hook)           (paywall gate di sini)                   │
    └────────────────────────────────┬───────────────────────────────────┘
                                     ▼
              ┌──────────────────────────────────────────┐
              |  6. Prototype Design  (sudah ada)        |
              │     (PRO gate) — canvas + theme editor   │
              └──────────────────┬───────────────────────┘
                                 ▼
              ┌──────────────────────────────────────────┐
              │  Export / CLI Sync → folder lokal        │
              │  xynn connect --workspace <id>           │
              └──────────────────────────────────────────┘
```

**Prasyarat berurutan (di-enforce di server):**

```
Mindmap  ->  PRD  ->  Task Breakdown  ->  Style Guide  ->  Prototype
```

`/api/ai/styleguide` menolak bila `tasksJson` belum ada; `/api/ai/tasks` menolak bila `fullPrdMd` belum ada.

---

## Tech Stack

| Layer | Teknologi |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router), React 19 |
| **Styling** | Tailwind CSS 4, design system kustom (*Dark Slate*) |
| **UI Primitives** | Komponen internal (`components/ui/*`), Lucide Icons, React Icons |
| **Canvas** | `@xyflow/react` (React Flow) |
| **Database** | PostgreSQL + Prisma ORM 7 (`@prisma/adapter-pg`) |
| **Auth** | NextAuth 4 + `@auth/prisma-adapter`, Google Provider |
| **AI** | Vercel AI SDK 7 (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`) |
| **Markdown** | `react-markdown` + `remark-gfm` + `mermaid` |
| **Payment** | Midtrans / Xendit (QRIS, E-Wallet, Transfer Bank) |
| **CLI** | Node.js + `commander` + `axios` |
| **Notifikasi** | `sonner` (toast) |
| **Utility** | `clsx` + `tailwind-merge` (`cn`), `bcryptjs`, `dotenv` |

---

## Struktur Proyek

```
project-prd/                      # akar repositori
├── README.md                     # ← dokumen yang sedang Anda baca
├── XynnPROtotype.md              # PRD (Product Requirement Document)
├── CHANGELOG.md                  # Riwayat perubahan
├── RENCANA-IMPLEMENTASI.md       # Rencana & progres kerja
├── _*.mjs                        # Skrip uji manual (login, gate, pay, dll.)
├── opendesign/                   # Artefak desain (mockup HTML + design system)
│   ├── index.html                # Hub semua artefak
│   ├── manifest.json             # Daftar berkas (auto-generated)
│   ├── design-systems/
│   │   └── xynnprototype/
│   └── mockups/
│       ├── pricing/
│       └── prototype-canvas/
└── xynn-prototype/               # Aplikasi Next.js
    ├── app/
    │   ├── (auth)/login/         # Single-button Google OAuth
    │   ├── (main)/               # Area terautentikasi
    │   │   ├── dashboard/        # Daftar workspace
    │   │   ├── projects/         # Buat project baru
    │   │   ├── new-project/      # Wizard 5 langkah
    │   │   ├── project/[id]/     # Workspace + tab (Mindmap·PRD·Task·Style·Prototype)
    │   │   ├── prototype/        # Galeri prototype lintas project
    │   │   ├── templates/        # Galeri template PRD siap pakai
    │   │   ├── chat/             # Chat Prototype (AI) — dikunci via flag
    │   │   ├── consult/          # Konsultasi AI (arsitektur) — dikunci via flag
    │   │   ├── vault/            # Gudang PRD
    │   │   └── settings/         # plan · team · profile · developer
    │   ├── (public)/prd/[shareSlug]/  # Halaman PRD publik 3 kolom
    │   ├── (admin)/admin/        # Dashboard admin (RBAC)
    │   ├── api/                  # 47 endpoint (lihat Referensi API)
    │   └── post-login/           # Router setelah login (berdasar role)
    ├── bin/cli.js                # CLI executable (`xynn`)
    ├── components/               # 29 komponen
    │   └── ui/                   # Primitif: Button, Badge, Card, Input, dll.
    ├── lib/                      # 25 modul logika inti
    ├── prisma/
    │   ├── schema.prisma         # 21 model, 7 enum
    │   ├── migrations/           # 17 migrasi
    │   ├── seed-plans.mts        # Seeding plan (4 tier)
    │   ├── seed-templates.mts    # Seeding template PRD
    │   └── seed-features.mts     # Seeding flag rilis fitur
    ├── tests/
    │   ├── access.test.mjs       # Uji gate hak akses & kuota
    │   ├── theme.test.mjs        # Uji sanitasi token tema
    │   ├── workspace-access.test.mjs  # Uji akses workspace org
    │   ├── feature-flags.test.mjs     # Uji logika flag rilis fitur
    │   ├── consult-prompt.test.mjs    # Uji prompt konsultasi
    │   ├── chat-prompt.test.mjs       # Uji prompt chat
    │   └── prompt.test.mjs       # Uji prompt generator prototype
    └── types/next-auth.d.ts      # Augmentasi tipe sesi
```

---

## Memulai (Setup Lokal)

### 1. Prasyarat

- **Node.js** 20+
- **PostgreSQL** 14+ (berjalan & dapat diakses)
- **Google OAuth credentials** — [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- **API key AI** — OpenAI dan/atau Anthropic

### 2. Instalasi

```bash
git clone <repo-url>
cd xynn-prototype
npm install
```

### 3. Konfigurasi environment

```bash
cp .env.example .env
```

Lalu isi nilainya — lihat [Variabel Environment](#variabel-environment).

Untuk `ENCRYPTION_KEY` (kunci master AES-256-GCM):

```bash
openssl rand -hex 32
```

### 4. Siapkan database

```bash
npx prisma migrate deploy     # terapkan 17 migrasi
npx prisma generate           # buat Prisma Client
node --experimental-strip-types prisma/seed-plans.mts   # isi tabel Plan
```

> **Catatan seeding:** proyek ini **belum** mengonfigurasi perintah
> `prisma db seed` (tidak ada `migrations.seed` di `prisma7.config.ts`
> maupun blok `prisma` di `package.json`). Karena itu `seed-plans.mts`
> dijalankan langsung seperti di atas.
>
> Alternatif: aplikasi melakukan seeding *lazy* lewat `ensurePlansSeeded()`
> saat `/api/plans` dipanggil pertama kali. Seeding eksplisit tetap
> disarankan agar hasilnya dapat diprediksi.

### 5. Konfigurasi Google OAuth

Di Google Cloud Console, buat *OAuth 2.0 Client ID* (tipe **Web application**)
dan daftarkan redirect URI:

```
http://localhost:3000/api/auth/callback/google
```

Salin **Client ID** dan **Client Secret** ke `.env`.

### 6. Jalankan

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

### 7. Jadikan diri Anda admin

Tambahkan email Google Anda ke `ADMIN_EMAILS` di `.env` (pisahkan dengan
koma untuk beberapa admin), lalu **login ulang**. Akses `/admin`.

### Skrip tersedia

| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Development server (hot reload) |
| `npm run build` | Build produksi |
| `npm run start` | Jalankan hasil build |
| `npm run lint` | ESLint |
| `npm test` | Jalankan uji gate hak akses (`lib/access.ts`) |
| `npm run cli -- connect ...` | Jalankan CLI lokal |
| `npx prisma studio` | GUI database |

### Pengujian

`npm test` menjalankan 74 uji (`access` · `theme` · `prompt`) memakai **`node:test` bawaan
Node** (tanpa dependency tambahan). Cakupannya:

- Aktivasi langganan (status, kedaluwarsa, tanggal tidak valid).
- Pemetaan tier, termasuk bahwa `PRO_YEARLY` diperlakukan sama dengan `PRO`.
- Kuota PRD (`prdLimit` −1 = unlimited, batas tercapai, `undefined` = terkunci).
- Rantai prasyarat `computeStepAvailability`.

Yang terpenting: uji ini **menutup dua mode kegagalan senyap** saat menambah
tier baru. Bila Anda menambahkan planType berbayar ke `PAID_PLAN_TYPES` di
`tests/access.test.mjs` tanpa memperbarui `getAccessTier()` atau `canFork()`,
beberapa uji akan **gagal dan menunjuk tepat** ke gate yang belum diperbarui.
Lihat [Gating](#gating--hak-akses).

---

## Variabel Environment

| Variabel | Wajib | Keterangan |
| :--- | :---: | :--- |
| `DATABASE_URL` | ✅ | Koneksi PostgreSQL. |
| `SHADOW_DATABASE_URL` | ⬜ | Hanya untuk `prisma migrate dev`. |
| `NEXTAUTH_URL` | ✅ | Base URL aplikasi (`http://localhost:3000`). |
| `NEXTAUTH_SECRET` | ✅ | Rahasia sesi. Generate: `openssl rand -base64 32`. |
| `GOOGLE_CLIENT_ID` | ✅ | OAuth Client ID. |
| `GOOGLE_CLIENT_SECRET` | ✅ | OAuth Client Secret. |
| `ADMIN_EMAILS` | ✅ | Email yang otomatis jadi `ADMIN` (pisah koma). |
| `OPENAI_API_KEY` | ✅* | Untuk wizard & kuesioner. |
| `ANTHROPIC_API_KEY` | ✅* | Untuk mindmap JSON & Full PRD. |
| `ENCRYPTION_KEY` | ✅ | Kunci master AES-256-GCM untuk `PaymentConfig.serverKeyEncrypted`. |
| `MIDTRANS_SERVER_KEY` | ⬜ | Opsional untuk testing (default dari database). |
| `MIDTRANS_CLIENT_KEY` | ⬜ | Opsional. |
| `XENDIT_SECRET_KEY` | ⬜ | Opsional. |
| `PAYMENT_MODE` | ⬜ | Mode pembayaran. `.env.example` memakai `"dummy"` untuk pengujian. |
| `XYNN_API_KEY` | ⬜ | Dipakai CLI (`--api-key`). |
| `XYNN_SERVER_URL` | ⬜ | Server CLI (default `http://localhost:3000`). |

`*` Minimal satu penyedia AI harus dikonfigurasi. Konfigurasi gateway
pembayaran dapat diatur lewat `/admin/payments` sehingga tidak wajib di `.env`.

> ⚠️ **Keamanan:** `.env` berisi rahasia. Jangan pernah di-commit.
> `ENCRYPTION_KEY` bersifat **irreversible** — bila hilang, seluruh
> `serverKeyEncrypted` di database tidak dapat didekripsi.

---

## Database & Migrasi

### Model (10)

| Model | Fungsi |
| :--- | :--- |
| `User` | Akun pengguna + `role` (`USER`/`ADMIN`). |
| `Subscription` | Plan, status, kuota (`prdLimit`, `prdUsedThisMonth`), `billingCycle`, `validUntil`. |
| `Workspace` | Inti proyek: `mindmapJson`, `fullPrdMd`, `tasksJson`, `styleGuideMd`, tech stack, privasi & data fork. |
| `ApiKey` | Token CLI (`keyHash` SHA-256, `lastUsedAt`). |
| `Plan` | Definisi paket yang bisa diubah admin (harga, fitur, `isPopular`, `sortOrder`). |
| `PaymentConfig` | Konfigurasi gateway (Midtrans/Xendit) + `serverKeyEncrypted`. |
| `Voucher` | Kode diskon (persen/nominal, `maxUses`, `usedCount`). |
| `Transaction` | Riwayat pembayaran + `paymentGatewayId`. |
| `AiConfig` | System prompt & pemilihan model per tahap. |
| `AiUsage` | Pelacakan konsumsi token AI (dasar analitik margin). Terindeks pada `createdAt` & `kind`. |

### Enum (4)

`Role` · `PlanType` (`FREE`,`STARTER`,`PRO`,`PRO_YEARLY`) · `SubStatus` (`INACTIVE`,`ACTIVE`,`CANCELLED`) · `BillingCycle` (`MONTHLY`,`QUARTERLY`,`YEARLY`)

### Riwayat migrasi

| Migrasi | Isi |
| :--- | :--- |
| `20260914200338_init` | 7 tabel awal + 4 enum + relasi (`User`, `Subscription`, `Workspace`, `ApiKey`, `PaymentConfig`, `Voucher`, `Transaction`). |
| `20260915224254_techstack_json` | `Workspace.techStack` → `Json`. |
| `20260915225100_ai_usage` | Tabel `AiUsage` + 2 index. |
| `20260915235457_plan_and_workspace_ext` | Tabel `Plan`; `tasksJson`, `styleGuideMd`, `techPreferences`, `billingCycle`, `startedAt`. |
| `20260916001551_workspace_locale` | `Workspace.locale` (default `'id'`). |

### Perintah umum

```bash
npx prisma migrate dev --name <nama>   # buat migrasi baru (dev)
npx prisma migrate deploy              # terapkan migrasi (produksi)
npx prisma generate                    # regenerate client
npx prisma studio                      # GUI database
npx prisma migrate status              # cek status migrasi
```

---

## Gating & Hak Akses

**Seluruh logika gate terpusat di `lib/access.ts`** — satu sumber
kebenaran agar pengecekan di server dan client tidak pernah berbeda.

### Aturan penting

`status "berbayar"` hanya berlaku bila langganan **AKTIF** *dan*
**belum kedaluwarsa** (`isSubscriptionActive()`). `planType` saja **tidak
cukup** — ini mencegah kelolosan saat langganan sudah habis atau
dibatalkan.

### Fungsi gate

| Fungsi | Berlaku untuk |
| :--- | :--- |
| `isSubscriptionActive()` | Status aktif & belum kedaluwarsa. |
| `getAccessTier()` | `"free"` \| `"starter"` \| `"pro"` \| `"enterprise"`. |
| `isPaid()` | Semua tier berbayar. |
| `isProOrAbove()` | **Pro atau Enterprise** — dipakai agar tidak perlu perbandingan tier literal. |
| `canAccessVault()` | Starter ke atas. |
| `canFork()` | Pro ke atas (memakai `isProOrAbove()`). |
| `canExport()` | Starter ke atas. |
| `canUseCli()` | Starter ke atas. |
| `canGeneratePrd()` | Berbayar + cek kuota (`prdLimit`, `-1` = unlimited). |
| `canGenerateAdvanced()` | Starter ke atas (Task & Style Guide). |
| `canDownloadMarkdown()` | Starter ke atas. |
| `canUsePrototype()` | **Pro ke atas** — paket mendukung Prototype Design. |
| `canGeneratePrototype()` | Pro ke atas **dan** kuota bulan ini masih ada. |
| `remainingPrototypeQuota()` | Sisa kuota prototype; `null` = unlimited. |
| `canSaveThemes()` | **Enterprise saja** — library tema tersimpan. |
| `computeStepAvailability()` | Menghitung keterbukaan `mindmap`/`prd`/`tasks`/`style`. |

> **Dua gate prototype berbeda peran:** `canUsePrototype()` menjawab
> "*apakah paketnya mendukung*", sedangkan `canGeneratePrototype()` menjawab
> "*apakah masih boleh generate sekarang*" (memperhitungkan kuota). Server
> memakai keduanya untuk membedakan **402** (paket tidak mendukung) dari
> **429** (kuota habis) — dua pesan yang berbeda bagi pengguna.

### Perilaku di server

Endpoint berat mengembalikan **HTTP 402 Payment Required** (bukan 403)
saat dipanggil akun Free — konsisten di seluruh API dan ditangkap UI
untuk memunculkan modal upgrade.

### ⚠️ Menambah tier baru — dua mode kegagalan SENYAP

Bila menambahkan tier (mis. `ENTERPRISE`), ada dua cara rusak yang
**tidak memunculkan error apa pun**:

1. **Fallthrough tier.** `getAccessTier()` memetakan `PRO`/`PRO_YEARLY` →
   `"pro"` dan `STARTER` → `"starter"`; **semua nilai lain jatuh ke
   `return "free"`**. Lupa menangani tier baru ⇒ penggunanya diperlakukan
   sebagai **Free** dan kehilangan **seluruh** akses berbayar.
2. **Perbandingan tier literal.** `canFork()` menulis
   `=== "pro"`, sehingga **tidak** ikut membaik walau poin (1)
   dibereskan. Setiap gate baru dengan pola serupa harus menyertakan
   tier baru secara eksplisit.

Keduanya **wajib ditutup dengan test** — dan sekarang sudah, di
`tests/access.test.mjs` (jalankan `npm test`). Lihat PRD §3.6.

### ✅ Diperbaiki: `computeStepAvailability`

Dahulu helper ini menghitung `style: paid && hasPrd`, padahal
`styleGuide/route.ts` **mensyaratkan** `tasksJson` lebih dulu. Akibatnya
helper melaporkan langkah `style` **terbuka** padahal server menolaknya
dengan 400.

Sudah diperbaiki menjadi `style: paid && !!opts.hasTasks` (dengan `!!`
karena `hasTasks` opsional — tanpa itu TypeScript menolak `boolean | undefined`).
Dikunci oleh uji `"style mengikuti hasTasks (sesuai syarat server)"`.

---

## Tier Langganan

**Saat ini 4 tier** (`lib/plans.ts` + tabel `Plan` di database):

| Tier | Bulan | Tahun | `prdLimit` | `prototypeLimit` |
| :--- | ---: | ---: | ---: | ---: |
| Free | Rp 0 | Rp 0 | 1 | 0 |
| Starter | Rp 99.000 | Rp 799.000 | 5 | 0 |
| **Pro** | Rp 199.000 | Rp 1.599.000 | −1 (unlimited) | **20/bulan** |
| **Enterprise** | Rp 499.000 | Rp 3.999.000 | −1 (unlimited) | −1 (unlimited) |

**Pembeda antar tier:**
- **Free → Starter:** bisa *mengeksekusi* (export, CLI, Task, Style Guide).
- **Starter → Pro:** bisa *melihat design yang jadi* — Prototype Design + Theme Editor, PRD unlimited, Fork dari Gudang.
- **Pro → Enterprise:** bisa *bekerja sebagai tim* — library tema tersimpan, 3 seat, kolaborasi, kuota AI lebih tinggi.

> `PRO_YEARLY` adalah varian **siklus billing**, bukan tier tersendiri — ia
> diperlakukan identik dengan `PRO` di `lib/access.ts`.
>
> Enterprise diletakkan **di atas** Pro agar pengguna Pro yang sudah ada tidak
> kehilangan fitur. Harga & kuota diatur admin lewat `/admin/plans` tanpa
> perlu deploy. Rincian lengkap di PRD §3.6.
>
> ⚠️ **Menambah tier menyentuh `lib/access.ts`** — ada dua mode kegagalan
> senyap (fallthrough tier & perbandingan tier literal). Lihat
> [Gating & Hak Akses](#gating--hak-akses).

---

## Referensi API

47 endpoint di bawah `app/api/`. Endpoint terproteksi memakai sesi
NextAuth (401 bila anonim); **gate berbayar** mengembalikan **402** —
kecuali `questions` dan `techstack` yang sengaja hanya memeriksa sesi
(lihat catatan di tabel di bawah).

### Autentikasi

| Endpoint | Fungsi |
| :--- | :--- |
| `POST /api/auth/[...nextauth]` | Google OAuth callback + auto-provisioning. |

### AI (generator)

| Endpoint | Gate | Fungsi |
| :--- | :--- | :--- |
| `POST /api/ai/mindmap` | Login saja | Generate JSON mindmap (node & edge). |
| `GET /api/ai/questions` | Login saja | 5 pertanyaan penajaman. ⚠️ **Tanpa paywall** — hanya cek sesi. |
| `POST /api/ai/techstack` | Login saja | Rekomendasi tech stack. ⚠️ **Tanpa paywall** — hanya cek sesi. |
| `POST /api/ai/tasks` | Berbayar | Task Breakdown (butuh `fullPrdMd`). **402** bila Free. |
| `POST /api/ai/styleguide` | Berbayar | Style Guide (butuh `tasksJson`). **402** bila Free. |
| `POST /api/ai/full-prd` | Berbayar | PRD lengkap. **402** bila Free. |
| `POST /api/ai/prototype` | **Pro** | Prototype HTML dari PRD + Style Guide. **402** non-Pro · **429** kuota habis · **400** prasyarat belum ada. |
| `POST /api/ai/chat` | **Pro** + flag `chat` | Balasan Chat Prototype. **403** bila fitur belum LIVE. |
| `POST /api/ai/consult` | Berbayar + flag `consult` | Balasan Konsultasi AI (arsitektur). **403** bila fitur belum LIVE. |

> **Prasyarat `prototype`:** workspace harus sudah punya `fullPrdMd` **dan**
> `styleGuideMd`. Kuota terpisah dari PRD: PRO 20/bulan, ENTERPRISE unlimited
> (`Plan.prototypeLimit`, `-1` = unlimited).

> ⚠️ **Catatan gate:** `questions` dan `techstack` **belum** dipaywall — keduanya
> hanya memeriksa sesi (401) dan validasi input (400), tanpa `402`
> (`questions` juga mengembalikan 404 bila workspace tidak ditemukan).
> Ini disengaja untuk alur onboarding, tetapi berarti keduanya dapat dipanggil
> akun Free. Bila nanti perlu digate, gunakan `canGenerateAdvanced()` dari
> `lib/access.ts`.

### Workspace

| Endpoint | Fungsi |
| :--- | :--- |
| `GET/POST /api/workspace` | Daftar / buat workspace. |
| `POST /api/workspace/update` | Ubah judul, deskripsi, kategori, tech stack. |
| `POST /api/workspace/publish` | Publish/unpublish ke Gudang PRD. |
| `DELETE /api/workspace/delete` | Hapus workspace. |

### Vault & Publik

| Endpoint | Gate | Fungsi |
| :--- | :--- | :--- |
| `GET /api/vault/search` | Berbayar | Cari PRD publik. **402** + blur untuk Free. |
| `POST /api/vault/fork` | **Pro** | Duplikasi PRD ke workspace sendiri. |
| `GET /api/public/prd` | Publik | Data PRD publik berdasarkan slug. |

### Template PRD

| Endpoint | Gate | Fungsi |
| :--- | :--- | :--- |
| `GET /api/templates` | Berbayar | Daftar template ringkas. **402** bila Free. |
| `GET /api/templates?slug=<slug>` | Berbayar | Satu template lengkap (prefill wizard). |

### Chat & Konsultasi AI

| Endpoint | Gate | Fungsi |
| :--- | :--- | :--- |
| `GET/POST/DELETE /api/chat/threads` | **Pro** + flag `chat` | Daftar/buat/hapus thread chat. |
| `GET /api/chat/threads/[id]` | **Pro** + flag `chat` | Satu thread + pesannya. |
| `GET/POST/DELETE /api/consult/threads` | Berbayar + flag `consult` | Daftar/buat/hapus thread konsultasi. |
| `GET /api/consult/threads/[id]` | Berbayar + flag `consult` | Satu thread konsultasi + pesannya. |

### Organisasi Tim (ENTERPRISE)

| Endpoint | Fungsi |
| :--- | :--- |
| `GET/POST /api/org` | Daftar / buat organisasi (+ seat). `?lite=1` ringkas. |
| `POST/PATCH/DELETE /api/org/members` | Undang / ubah peran / keluarkan anggota (OWNER saja). |

### Prototype & Tema

| Endpoint | Fungsi |
| :--- | :--- |
| `GET /api/workspace/versions` | Riwayat versi prototype. |
| `POST /api/workspace/versions/restore` | Pulihkan versi prototype. |
| `GET/POST/PATCH/DELETE /api/themes` | Library tema tersimpan (ENTERPRISE). |

### Flag Rilis Fitur

| Endpoint | Gate | Fungsi |
| :--- | :--- | :--- |
| `GET /api/features` | Publik | Status rilis tiap fitur (LIVE/SOON/HIDDEN). |
| `GET/POST /api/admin/features` | `ADMIN` | Lihat / ubah status fitur. |

### Pengguna & Pembayaran

| Endpoint | Fungsi |
| :--- | :--- |
| `GET /api/user/subscription` | Status langganan + `daysLeft`. |
| `PATCH /api/user/profile` | Ubah profil pengguna. |
| `GET /api/user/transactions` | Riwayat transaksi. |
| `GET /api/plans` | Daftar plan (seeding *lazy*). |
| `POST /api/checkout` | Buat token/instruksi pembayaran. |
| `POST /api/checkout/confirm` | Konfirmasi pembayaran. |
| `POST /api/webhooks/payment` | Webhook gateway + **idempotency**. |

### CLI

| Endpoint | Fungsi |
| :--- | :--- |
| `POST /api/cli/auth` | Validasi API key (SHA-256). |
| `GET /api/cli/sync` | Kirim `PRD.md` + `.cursorrules`. |
| `GET/POST /api/developer/keys` | Kelola API key. |

### Admin (RBAC: `ADMIN`)

| Endpoint | Fungsi |
| :--- | :--- |
| `GET /api/admin/stats` | Metrik AI cost & margin. |
| `GET/POST /api/admin/ai-config` | System prompt & model. |
| `POST /api/admin/ai-config/test` | Uji prompt di sandbox. |
| `GET/POST /api/admin/plans` | Manajemen paket & harga. |
| `GET/POST /api/admin/payment-gateways` | Konfigurasi gateway. |
| `GET /api/admin/users`, `POST /api/admin/users/plan` | Manajemen pengguna & plan. |
| `GET/POST /api/admin/vouchers` | Manajemen voucher. |

---

## CLI Sync Engine

Menarik PRD dan aturan AI langsung ke folder proyek lokal.

### Instalasi

```bash
npm link            # daftarkan binary `xynn` secara lokal
# atau, dari dalam repo:
npm run cli -- connect --workspace <id>
```

### Membuat API key

Buka `/settings/developer`, buat key bertipe `xynn_live_xxxxxxxx`.

> 🔐 Nilai key **hanya ditampilkan sekali**. Database hanya menyimpan
> hash SHA-256-nya — bila hilang, buat key baru.

### Perintah

```bash
xynn connect --workspace <id>
```

Opsi:

| Opsi | Keterangan |
| :--- | :--- |
| `--workspace <id>` | **(wajib)** ID workspace Xynn. |
| `--api-key <key>` | API key (atau env `XYNN_API_KEY`). |
| `--server <url>` | Server tujuan (default `XYNN_SERVER_URL` atau `http://localhost:3000`). |

### Hasil

Dua berkas ditulis ke **direktori kerja saat ini**:

- **`PRD.md`** — dokumen PRD lengkap.
- **`.cursorrules`** — aturan untuk AI *coding agent* (Cursor/Windsurf).

```
$ xynn connect --workspace ws_8f21 --api-key xynn_live_xxxxxxxx
PRD.md dan .cursorrules tersimpan di /path/ke/proyek-anda
```

---

## Admin Panel

Akses `/admin` dengan akun yang emailnya terdaftar di `ADMIN_EMAILS`.

| Halaman | Fungsi |
| :--- | :--- |
| `/admin` | **AI Cost & Margin Health** — pendapatan dikurangi biaya API, token burn rate, profit ring. |
| `/admin/ai-config` | **Live System Prompt Sandbox** — editor *split-screen* untuk menguji perubahan prompt secara real-time tanpa redeploy. |
| `/admin/plans` | Paket, harga, diskon, fitur, `isPopular`, urutan. |
| `/admin/payments` | Konfigurasi gateway dinamis (Midtrans/Xendit) + mode sandbox/production. |
| `/admin/users` | Cari pengguna, lihat langganan, ubah plan. |
| `/admin/vouchers` | Buat & kelola kode voucher. |

**Command Palette:** tekan **⌘K** / **Ctrl+K** untuk navigasi cepat (cari
pengguna, buka konfig gateway, ubah status voucher).

Bila akun tidak memiliki hak admin, aplikasi menampilkan halaman penolakan
yang menjelaskan cara menambahkan email ke `ADMIN_EMAILS`.

---

## Design System

Sistem design *anti-slop* terdefinisi di `app/globals.css` dan dipakai
konsisten di seluruh aplikasi.

### Palet (Dark Slate)

| Token | Nilai | Fungsi |
| :--- | :--- | :--- |
| `--background` | `#080b12` | Kanvas aplikasi |
| `--surface` | `#0d1220` | Kartu |
| `--surface-2` | `#111827` | Panel bersarang, input |
| `--border` | `#1e293b` | Garis default |
| `--border-strong` | `#2b3a52` | Penekanan, tombol sekunder |
| `--foreground` | `#e5e9f0` | Teks utama |
| `--muted` | `#8b97ab` | Teks sekunder |
| `--accent` | `#4f7cff` | **Satu-satunya accent** |
| `--success` / `--warning` / `--danger` | `#22c55e` / `#eab308` / `#ef4444` | Status saja |

### Aturan

- **Satu accent.** `#4f7cff`. Status color tidak dekoratif.
- **Tanpa gradient** pada permukaan produk.
- **Elevasi via `backdrop-blur`** + fill lebih terang, bukan drop shadow.
- **Tiga tingkat permukaan** dipisah garis 1px.
- **Chip monospace** untuk apa pun yang akan di-copy developer.
- **Ring spinner** untuk loading (bukan skeleton shimmer).
- **Konten ter-gate:** `blur` + overlay unlock — bukan pesan error.
- Tipografi: Geist Sans (UI), Geist Mono (teknis). Radius kartu 14px.

Token yang sama tersedia sebagai design system portabel di
`opendesign/design-systems/xynnprototype/`.

---

## Artefak Desain (opendesign)

Mockup HTML untuk fitur yang sedang dirancang, dengan preview server.

```bash
# Dari akar repo — serve seluruh folder opendesign
npx serve -l 8289 .
# Buka http://localhost:8289/opendesign/
```

| Berkas | Isi |
| :--- | :--- |
| `design-systems/xynnprototype/` | Token design system (di-import dari codebase) + `SKILL.md`. |
| `mockups/prototype-canvas/prototype-canvas.html` | Canvas prototype: state locked/empty/generating/ready, viewport toggle, **Theme Editor**. |
| `mockups/prototype-canvas/entry-points.html` | Dua pintu masuk: tab project & chat split-view. |
| `mockups/pricing/pricing-4-tier.html` | Halaman langganan 4 tier + matriks fitur + pratinjau gate. |
| `index.html` | Hub semua artefak (membaca `manifest.json`). |

> Artefak ini adalah **mockup, bukan kode produksi**. Interaksi seperti
> toggle dan slider berfungsi, tetapi kanvas belum merender prototype AI
> sungguhan.

---

## Troubleshooting

| Gejala | Sebab & Solusi |
| :--- | :--- |
| **"Plan tidak ditemukan"** saat buka pricing | Tabel `Plan` kosong. Jalankan `node --experimental-strip-types prisma/seed-plans.mts`, atau panggil `/api/plans` (seeding *lazy*). **Catatan:** `npx prisma db seed` **belum dikonfigurasi** di proyek ini. |
| **Redirect loop saat login** | `NEXTAUTH_URL` tidak sesuai URL yang diakses, atau redirect URI Google belum didaftarkan. |
| **`/admin` menolak akses** | Email tidak ada di `ADMIN_EMAILS`. Tambahkan, lalu **login ulang** (role dibaca saat sesi dibuat). |
| **HTTP 402 padahal sudah bayar** | Cek `status` langganan `ACTIVE` **dan** `validUntil` belum lewat. Confirming ulang lewat `/api/checkout/confirm` tidak akan menggandakan transaksi (idempotent). |
| **Payment gateway error** | Konfigurasi lewat `/admin/payments`; pastikan `ENCRYPTION_KEY` sama dengan saat `serverKeyEncrypted` disimpan — jika berubah, key tidak dapat didekripsi. |
| **CLI: "API key wajib diisi"** | Berikan lewat `--api-key` atau set `XYNN_API_KEY`. |
| **CLI: sync gagal (401/403)** | API key tidak valid/terhapus, atau plan tidak mengizinkan CLI Sync (butuh Starter+). |
| **Vault ter-blur terus** | Free tier. Mode ini disengaja — upgrade untuk akses penuh. |
| **Prisma error setelah ubah schema** | `npx prisma migrate dev` lalu `npx prisma generate`. Restart dev server. |
| **Style Guide gagal dengan "Generate Task Breakdown terlebih dahulu"** | Urutan prasyarat belum terpenuhi. Generate PRD → Task → baru Style Guide. |

### Ganti tier user untuk pengujian

```bash
npx prisma studio
# Edit Subscription: planType, status=ACTIVE, validUntil ke masa depan
```

---

## Konvensi Pengembangan

### Komponen UI

Gunakan primitif dari `components/ui/*` alih-alih menulis gaya ad-hoc:

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
```

`cn()` dari `lib/utils.ts` untuk menggabungkan class.

### Menambah endpoint berbayar

```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canGenerateAdvanced } from "@/lib/access";

const session = await getServerSession(authOptions);
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const sub = await prisma.subscription.findUnique({ where: { userId } });
if (!canGenerateAdvanced(sub)) {
  return NextResponse.json({ error: "…" }, { status: 402 });
}
```

### Menambah gate baru

1. Tambahkan fungsi di **`lib/access.ts`** (jangan gate ad-hoc di route).
2. Pakai `getAccessTier()` / `isPaid()` — hindari perbandingan tier literal,
   dan bila terpaksa, **sertakan semua tier berbayar** (lihat peringatan
   di [Gating](#gating--hak-akses)).
3. Tangani **400** di UI sebagai modal upgrade, bukan pesan error mentah.
4. Catat konsumsi AI lewat `recordAiUsage()` dari `lib/ai-usage.ts`.

### Bahasa

Teks UI memakai `lib/i18n.ts` (ID/EN). `Workspace.locale` menentukan
bahasa artefak yang dihasilkan AI.

### Sebelum commit

```bash
npm run lint
npm run build      # memastikan tidak ada type error
```

Perbarui `CHANGELOG.md` bila menambah fitur.

---

## Lisensi & Status

Proyek privat (`"private": true`), versi `0.1.0`.

**Status fitur:**

| Fitur | Status |
| :--- | :--- |
| Auth Google OAuth | ✅ Selesai |
| Wizard (Mindmap → PRD → Task → Style) | ✅ Selesai |
| Gudang PRD + Fork | ✅ Selesai |
| Pembayaran (Midtrans/Xendit) | ✅ Selesai |
| Admin Panel | ✅ Selesai |
| CLI Sync | ✅ Selesai |
| **Prototype Design + Theme Editor** | Selesai (PRO ke atas) |
| **Langganan 4 tier (Enterprise)** | Selesai |
| **Organisasi Tim + akses workspace** | Selesai (ENTERPRISE) |
| **Template PRD siap pakai** | Selesai (berbayar) |
| **Konsultasi AI (`/consult`)** | Selesai — dikunci (Segera Hadir, lihat Flag Rilis) |
| Chat Prototype (`/chat`) | Selesai — terkunci AI, dikunci (Segera Hadir) |
| **Flag rilis fitur (`/admin/features`)** | Selesai (LIVE/SOON/HIDDEN di DB) |

> **Catatan — Flag Rilis Fitur.** Fitur bisa dibangun penuh tapi tetap
> ditampilkan "Segera Hadir" (SOON) atau disembunyikan (HIDDEN) tanpa deploy,
> diatur dari `/admin/features`. Saat bukan LIVE, halaman menampilkan layar
> "Segera Hadir" dan **API-nya diblokir (403)**. Status awal: `consult` &
> `chat` = SOON.

Lihat [`CHANGELOG.md`](./CHANGELOG.md) untuk riwayat lengkap dan
[`XynnPROtotype.md`](./XynnPROtotype.md) untuk spesifikasi produk.
