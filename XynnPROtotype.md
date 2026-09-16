# Product Requirement Document (PRD): XynnPROtotype SaaS

---

## 1. Executive Summary & Objective

**XynnPROtotype** adalah platform SaaS *AI-Driven PRD & Architecture Generator* yang menjembatani fase perancangan ide (*ideation*) dengan fase eksekusi koding di IDE (*VS Code, Cursor, Windsurf*).

* **Visi Produk:** Memangkas waktu *planning* pengembangan aplikasi dari hitungan hari menjadi hitungan menit dengan menghasilkan spesifikasi teknis (PRD) yang *ready-to-code* bagi *developer* maupun AI *coding agent*.
* **Model Bisnis:** Freemium SaaS 4 tier dengan *paywall gate* bertingkat pada tahap eksekusi (Full PRD export, Gudang PRD/Vault, CLI Sync Engine, dan **Prototype Design + Theme Editor**).

> **Catatan revisi (v1.1):** Dokumen ini diperbarui untuk menambahkan Modul Prototype Design (lihat §3.5) dan memperluas struktur langganan dari 3 menjadi 4 tier (lihat §3.6). Semua perubahan bersifat aditif — gate yang sudah ada tidak diturunkan.

---

## 2. Modul Autentikasi (100% Google OAuth Only)

Autentikasi dirancang *zero-friction* tanpa formulir pendaftaran manual, verifikasi SMTP, maupun pengelolaan kata sandi.

* **Unified Entry Point:** Tombol tunggal **"Sign in with Google"** menangani pendaftaran pengguna baru (*sign-up*) sekaligus *login* pengguna lama.
* **Auto-Provisioning Backend:**
  * **Pengguna Baru:** Sistem otomatis membuat *record* pengguna di PostgreSQL, mengalokasikan akun ke *Plan FREE* (kuota 1 PRD), lalu mengarahkan pengguna ke alur pembuatan ide (`/new-project`).
  * **Pengguna Lama:** Mendeteksi email Google yang sudah terdaftar, lalu mengarahkan pengguna langsung ke `/dashboard`.

---

## 3. Modul Fitur & Matriks Akses (Feature Gating)

### 3.1 Wizard AI & Interactive Mindmap Canvas (Free Hook)
* **Form Input Ide:** Form input ide produk -> pemilihan *tech stack* -> 5 pertanyaan penajaman fitur oleh AI (GPT-4o Mini).
* **Interactive Canvas:** AI merender *node* dan *edge* visual *Mindmap PRD* menggunakan React Flow (`@xyflow/react`).
* **Free Limit:** Pengguna *Free* dapat mengedit canvas visual, tetapi fitur eksekusi (Full PRD Markdown, Export, CLI Sync) dikunci oleh *Paywall Gate*.

### 3.2 Gudang PRD (Community Vault Engine)
* **Privasi Opt-In:** Secara *default*, proyek bersifat `Private`. Pengguna dapat mempublikasikannya ke komunitas secara publik (dengan opsi anonim atau atribusi profil).
* **PRO-Only Gate:** Pengguna *Free* hanya melihat halaman *Vault* dalam kondisi ter-blur (*frosted glass*). Pengguna *PRO* mendapatkan akses penuh pencarian, penyalinan teks *specs*, dan *one-click fork/duplication*.

### 3.3 Developer Integration & CLI Sync Engine
* **API Key Generation:** Sistem membuat token berpola `xynn_live_xxxxxxxx` yang langsung di-hash menggunakan SHA-256 sebelum disimpan ke database.
* **CLI Sync Command:** Perintah terminal `xynn connect --workspace <id>` menarik file `PRD.md` dan `.cursorrules` langsung ke folder lokal komputer pengguna.

### 3.4 Matriks Hak Akses Pengguna

| Fitur / Modul | Free Tier | Starter Plan | Pro | Enterprise |
| :--- | :--- | :--- | :--- | :--- |
| **Google OAuth Sign In** | 🟢 Ya | 🟢 Ya | 🟢 Ya | 🟢 Ya |
| **Mindmap Canvas Preview** | 🟢 Ya | 🟢 Ya | 🟢 Ya | 🟢 Ya |
| **Generate Full PRD (.md)** | 🔴 Terkunci (Max 1 Draft) | 🟡 Maks. 5 PRD/bln | 🟢 **Unlimited** | 🟢 **Unlimited** |
| **Gudang PRD (Browse & Search)** | 🔴 Terkunci (Blur Mode) | 🟢 Akses Penuh | 🟢 **Akses Penuh + Fork** | 🟢 **Akses Penuh + Fork** |
| **Copy Specs & Export Markdown** | 🔴 Terkunci | 🟢 Ya | 🟢 Ya | 🟢 Ya |
| **Task Breakdown & Style Guide** | 🔴 Terkunci | 🟢 Ya | 🟢 Ya | 🟢 Ya |
| **Sync ke VS Code via CLI** | 🔴 Terkunci | 🟢 Ya | 🟢 **Priority Sync** | 🟢 **Priority Sync** |
| **Prototype Design (Canvas)** | 🔴 Terkunci | 🔴 Terkunci | 🟢 **Ya** | 🟢 **Ya** |
| **Prototype Multi-Screen + Responsive** | 🔴 — | 🔴 — | 🟢 **Ya** | 🟢 **Ya** |
| **Theme Editor (font, warna, size)** | 🔴 — | 🔴 — | 🟢 **Ya** | 🟢 **Ya** |
| **Simpan Tema Sendiri (Library)** | 🔴 — | 🔴 — | 🔴 — | 🟢 **Ya** |
| **Jumlah Seat** | 1 | 1 | 1 | 3 + tambahan |
| **Kolaborasi Workspace** | 🔴 — | 🔴 — | 🔴 — | 🟢 Ya |
| **Kuota AI / Bulan** | 1 PRD | 5 PRD | Fair Use | Ditingkatkan |

**Pembeda antar tier (satu kalimat):**
- **Free → Starter:** bisa *mengeksekusi* (export, CLI, task, style guide).
- **Starter → Pro:** bisa *melihat design yang jadi* (Prototype Design + editor tema), PRD unlimited, dan bisa Fork dari Gudang.
- **Pro → Enterprise:** bisa *bekerja sebagai tim* (seat, kolaborasi, library tema lintas project, kuota AI lebih tinggi).

### 3.5 Modul Prototype Design & Theme Editor (PRO Gate)

Modul ini menjembatani celah terakhir antara *spec* dan *design*: setelah PRD, Task Breakdown, dan Style Guide jadi, pengguna PRO dapat mengubah ketiganya menjadi prototype HTML yang bisa langsung dilihat — dan mengubah tema design-nya tanpa menulis kode.

* **Pintu Masuk Ganda:**
  1. **Dari Project Workspace** — tab ke-4 (`Prototype`) di halaman `project/[id]`, sejajar dengan Mindmap · PRD · Task · Style.
  2. **Dari Chat** — halaman `/chat`, dengan kanvas pratinjau di sisi kanan. Setiap balasan AI memperbarui kanvas.

* **Output & Render:** AI menghasilkan HTML/CSS/JS mandiri (*self-contained*), dirender di dalam `<iframe sandbox="allow-scripts">` agar CSS-nya terisolasi dari shell aplikasi dan sebaliknya.

* **Cakupan Per Render:**
  - **Multi-screen flow** — mis. Landing → Dashboard → Add → Summary → Settings, dengan navigasi antar screen.
  - **Responsive** — satu render, dua viewport (mobile & desktop) yang dapat di-toggle tanpa re-render.

* **Theme Editor (dua lapis, sengaja dipisah):**
  | Lapis | Cakupan | Alasan |
  | :--- | :--- | :--- |
  | **Theme** *(default)* | Token global: warna, tipografi, bentuk | Semua screen berubah serempak; menjaga konsistensi design system |
  | **Selection** | Satu elemen terpilih saja | Fleksibel, tetapi **menimpa** token — karena itu bukan default |

  Kontrol Theme:
  - **Palet warna** — pilih 1 *seed color*, sistem menurunkan 6 peran: `primary`, `secondary` (analog), `accent` (komplementer), `surface`, `text`, `border` (kontras dijaga WCAG).
  - **Preset tema** — 5 preset siap pakai (Minimal Light, Terminal Dark, Warm Paper, Editorial, Forest).
  - **Import dari Style Guide** — memakai token hasil Style Guide project sebagai titik awal.
  - **Tipografi detail** — font *heading* & *body*, ukuran dasar, skala rasio (1.125–1.414), *line-height*, *letter-spacing*, *font-weight*.
  - **Bentuk & spasi** — radius, jarak antar elemen.
  - **Token Output** — panel yang menampilkan CSS variables yang dihasilkan.

* **Prinsip Teknis:** Panel editor menulis **token**, bukan pixel. Karena itu hasilnya dapat disimpan sebagai tema, dipakai ulang (khusus Enterprise), dan di-export sebagai CSS variables.

* **Prasyarat Data (berurutan):** `Mindmap → PRD → Task → Style Guide → Prototype`. Prototype tidak dapat di-generate jika Style Guide belum ada, karena prompt prototype mengambil konteks dari PRD **dan** Style Guide.

### 3.6 Struktur Langganan (Revisi 4 Tier)

**Sebelum revisi** (3 tier di `DEFAULT_PLANS`): `FREE` → `STARTER` → `PRO`.
Enum `PlanType` di Prisma sebenarnya memiliki 4 nilai (`FREE`, `STARTER`, `PRO`, `PRO_YEARLY`), tetapi `PRO_YEARLY` diperlakukan **identik** dengan `PRO` — ia varian siklus billing, bukan tier tersendiri.

**Setelah revisi** (4 tier):

| Tier | Kode | Harga / Bulan | Harga / Tahun | prdLimit | Posisi |
| :--- | :--- | ---: | ---: | ---: | :--- |
| Free | `FREE` | Rp 0 | Rp 0 | 1 | Titik masuk |
| Starter | `STARTER` | Rp 99.000 | Rp 799.000 | 5 | Eksekusi |
| **Pro** | `PRO` | Rp 199.000 | Rp 1.599.000 | -1 (unlimited) | **Prototype Design mulai di sini** |
| Enterprise | `ENTERPRISE` | Rp 499.000 | Rp 3.999.000 | -1 (unlimited) | Kolaborasi tim |

> Harga Enterprise adalah **usulan** (± 2,5× Pro, dengan asumsi 3 seat + kolaborasi + library tema) dan dapat diubah admin lewat `/admin/plans` tanpa perlu deploy.

**Alasan Enterprise diletakkan di *atas* Pro, bukan menyisipkan tier baru di bawahnya:**
Menambahkan tier baru di bawah Pro akan **menurunkan** Pro — seluruh pengguna Pro yang sudah ada kehilangan fitur secara diam-diam. Enterprise di atas Pro tidak memutus apa pun, dan `prdLimit: -1` milik Pro tetap utuh.

**⚠️ Dampak Implementasi pada `lib/access.ts` (WAJIB dibaca sebelum koding):**

`access.ts` adalah satu sumber kebenaran untuk gate server & client. Menambah tier menyentuh dua titik yang **gagal secara senyap** (tanpa error, tanpa exception):

1. **Fallthrough tier.** `getAccessTier()` memetakan `PRO`/`PRO_YEARLY` → `"pro"`, `STARTER` → `"starter"`, dan **semua nilai lain jatuh ke `return "free"`**. Jika `"ENTERPRISE"` tidak ditangani, pengguna Enterprise diperlakukan sebagai **Free** dan kehilangan **seluruh** akses berbayar — bukan sekadar gate tambahannya yang mati. Perbaikan di satu fungsi ini otomatis menyembuhkan semua gate yang memakai `isPaid()`.

2. **Perbandingan tier literal.** `canFork()` menulis `getAccessTier(sub) === "pro"`, yang **tidak** ikut membaik walau poin (1) sudah dibereskan. Saat ini hanya `canFork()` yang begitu, tetapi setiap gate baru yang membandingkan tier secara literal harus menyertakan `|| "enterprise"`.

Keduanya wajib ditutup dengan *test*. Lihat `CHANGELOG.md` untuk detail rekonstruksi dan `README.md` §Gating untuk daftar fungsi gate.

---

## 4. System Architecture & Tech Stack

| Layer | Teknologi | Fungsi / Alasan |
| :--- | :--- | :--- |
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS | Server Components untuk kecepatan SEO & Client Components untuk interaktivitas canvas/dashboard. |
| **UI Components** | shadcn/ui, Lucide Icons, React Icons | Antarmuka bergaya *Dark Slate* modern dan *anti-slop*. |
| **Canvas & Flow** | `@xyflow/react` (React Flow) | Merender diagram *Mindmap PRD* secara interaktif. |
| **Database & ORM** | PostgreSQL + Prisma ORM | Pengelolaan relasi data user, transaksi, workspace, dan API keys. |
| **Authentication** | NextAuth.js / Supabase Auth (Google Provider) | Single-provider Google OAuth 2.0 + Session Tokens. |
| **AI LLM Engine** | Vercel AI SDK (GPT-4o Mini & Claude 3.5 Sonnet) | GPT-4o Mini untuk wizard/kuesioner, Claude 3.5 Sonnet untuk Mindmap JSON & Full PRD. |
| **Payment Gateway** | Midtrans / Xendit Integration | Transaksi QRIS, E-Wallet, & Transfer Bank lokal via konfigurasi terenkripsi. |
| **CLI Tool** | Node.js Executable (`commander` + `axios`) | Menyambungkan PRD dari cloud langsung ke folder proyek lokal. |
| **Prototype Render** | `<iframe sandbox="allow-scripts">` + HTML/CSS/JS mandiri | Mengisolasi output AI agar CSS prototype tidak bocor ke shell aplikasi. |

---

## 5. Skema Database (`schema.prisma`)

> ⚠️ **Status: sebagian direncanakan, bukan yang berjalan.**
> Skema yang **berjalan saat ini** berisi 10 model (`Plan`, `User`,
> `Subscription`, `Workspace`, `ApiKey`, `PaymentConfig`, `Voucher`,
> `Transaction`, `AiConfig`, `AiUsage`) dan 4 enum (`Role`, `PlanType`,
> `SubStatus`, `BillingCycle`) dalam 5 migrasi.
> Entri bertanda **`[DIRENCANAKAN]`** di bawah **belum ada** di
> `prisma/schema.prisma` dan belum punya migrasi. Lihat `CHANGELOG.md`.

```prisma
datasource db {
  provider = "postgresql"
  // `url` tidak ditulis di sini — Prisma 7 meresolusinya lewat
  // prisma7.config.ts (datasource.url → process.env.DATABASE_URL).
}

generator client {
  provider = "prisma-client-js"
}

model Plan {
  id              String   @id @default(uuid())
  code            String   @unique   // 'FREE' | 'STARTER' | 'PRO' (map ke PlanType)
  name            String
  description     String?
  priceMonthly    Int      @default(0)   // IDR
  priceYearly     Int      @default(0)   // IDR
  discountPercent Int      @default(0)   // diskon tambahan dari admin
  prdLimit        Int      @default(1)   // -1 = unlimited
  features        String[] @default([])
  isActive        Boolean  @default(true)
  isPopular       Boolean  @default(false)
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum Role {
  USER
  ADMIN
}

enum PlanType {
  FREE
  STARTER
  PRO
  PRO_YEARLY
  ENTERPRISE        // [DIRENCANAKAN] tier kolaborasi — belum ada di schema
}

enum SubStatus {
  INACTIVE
  ACTIVE
  CANCELLED
}

enum BillingCycle {
  MONTHLY
  QUARTERLY
  YEARLY
}

model User {
  id            String         @id @default(uuid())
  email         String         @unique
  name          String?
  avatarUrl     String?
  role          Role           @default(USER)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  
  subscription  Subscription?
  workspaces    Workspace[]
  apiKeys       ApiKey[]
  transactions  Transaction[]
}

model Subscription {
  id                  String       @id @default(uuid())
  userId              String       @unique
  user                User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  planType            PlanType     @default(FREE)
  status              SubStatus    @default(INACTIVE)
  billingCycle        BillingCycle @default(MONTHLY)
  prdLimit            Int          @default(1)      // -1 = Unlimited
  chatLimit           Int          @default(0)      // -1 = Unlimited
  prdUsedThisMonth    Int          @default(0)
  chatUsedThisMonth   Int          @default(0)
  startedAt           DateTime?
  validUntil          DateTime?
  updatedAt           DateTime     @updatedAt
}

model Workspace {
  id                  String       @id @default(uuid())
  userId              String
  user                User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  title               String
  description         String?
  locale              String       @default("id")  // 'id' | 'en' — bahasa output AI
  techStack           Json         // Array: ["Next.js", "Supabase", "Tailwind"]
  techPreferences     Json?        // { mode: 'ai'|'manual', frontend, backend, database, deployment }
  mindmapJson         Json         // Node & Edge data React Flow
  fullPrdMd           String?
  tasksJson           Json?        // Task Breakdown per fase
  styleGuideMd        String?

  // Prototype Design & Theme Editor [DIRENCANAKAN — belum ada di schema]
  prototypeHtml       String?      // HTML/CSS/JS mandiri (render di iframe)
  prototypeJson       Json?        // Struktur screen + versi untuk navigator multi-screen
  themeTokensJson     Json?        // Token tema tersimpan (warna, tipografi, bentuk)
  
  // Privacy & Community Vault Engine
  isPublic            Boolean      @default(false)
  isAnonymous         Boolean      @default(false)
  shareSlug           String?      @unique
  category            String?      // e.g. "E-Commerce", "SaaS", "Mobile App"
  
  // Forking Relational Data
  forkedFromId        String?
  originalWorkspace   Workspace?   @relation("WorkspaceForks", fields: [forkedFromId], references: [id], onDelete: SetNull)
  forks               Workspace[]  @relation("WorkspaceForks")
  viewsCount          Int          @default(0)
  forksCount          Int          @default(0)

  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt
}

model ApiKey {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String    // e.g. "Laptop Kantor"
  keyHash     String    @unique // SHA-256 Hash
  lastUsedAt  DateTime?
  createdAt   DateTime  @default(now())
}

model PaymentConfig {
  id                  String   @id @default(uuid())
  provider            String   // 'midtrans' | 'xendit'
  isActive            Boolean  @default(false)
  isProduction        Boolean  @default(false)
  merchantId          String?
  clientKey           String
  serverKeyEncrypted  String   @db.Text
  webhookSecret       String?
  updatedAt           DateTime @updatedAt
}

model Voucher {
  id              String    @id @default(uuid())
  code            String    @unique
  discountPercent Int?
  discountAmount  Int?
  validUntil      DateTime?
  maxUses         Int       @default(100)
  usedCount       Int       @default(0)
  createdAt       DateTime  @default(now())
}

model Transaction {
  id               String       @id @default(uuid())
  userId           String
  user             User         @relation(fields: [userId], references: [id])
  amount           Int
  planType         PlanType
  billingCycle     BillingCycle
  status           String       // 'PENDING', 'SUCCESS', 'FAILED'
  paymentGatewayId String?
  createdAt        DateTime     @default(now())
}

model AiConfig {
  id            String   @id @default(uuid())
  mindmapModel  String   @default("OpenCodeCombo")
  prdModel      String   @default("OpenCodeCombo")
  systemPrompt  String   @default("You are an expert product architect.")
  updatedAt     DateTime @updatedAt
}

model AiUsage {
  id               String   @id @default(uuid())
  userId           String?
  kind             String   // 'mindmap' | 'prd' | 'questions'
  model            String
  promptTokens     Int      @default(0)
  completionTokens Int      @default(0)
  totalTokens      Int      @default(0)
  costUsd          Float    @default(0)
  createdAt        DateTime @default(now())

  @@index([createdAt])
  @@index([kind])
}
```

---

## 6. Arsitektur Folder Next.js App Router

app/
├── (auth)/
│   └── login/page.tsx                  # Single Button Google OAuth
├── (main)/
│   ├── dashboard/page.tsx              # Main Workspace List
│   ├── new-project/
│   │   ├── page.tsx                    # Step 1: Input Ide & Stack
│   │   ├── questionnaire/page.tsx      # Step 2: 5 Pertanyaan AI
│   │   └── canvas/page.tsx             # Step 3: Mindmap Canvas (Free Hook)
│   ├── vault/
│   │   ├── page.tsx                    # Gudang PRD (Gated View: Blur Mode if Free)
│   │   └── [slug]/page.tsx             # Detail Public PRD View
│   ├── project/[id]/
│   │   ├── page.tsx                    # Full PRD Workspace (PRO Guarded) + tab Prototype
│   │   └── execute/page.tsx            # Export & Sync Trigger Page
│   ├── chat/page.tsx                   # Chat Prototype (split: chat kiri, kanvas kanan)
│   └── settings/
│       ├── page.tsx                    # Settings Navigation
│       ├── plan/page.tsx               # Status Billing & Usage
│       ├── profile/page.tsx            # Profile Info
│       └── developer/page.tsx          # API Keys & CLI Instructions
├── (public)/
│   └── prd/[shareSlug]/page.tsx        # Public PRD Developer Hub (Anti-Slop Layout)
├── (admin)/                            # Protected Layout (RBAC: ADMIN)
│   └── admin/
│       ├── page.tsx                    # AI Margin & Cost Health Analytics
│       ├── ai-config/page.tsx          # System Prompt Editor & Sandbox
│       ├── payments/page.tsx           # Dynamic Gateway Config (Midtrans/Xendit)
│       ├── users/page.tsx              # Actionable User Command Center
│       └── vouchers/page.tsx           # Voucher Management
└── api/
    ├── auth/[...nextauth]/route.ts     # Google OAuth Provider Callback & Auto-Provisioning
    ├── ai/
    │   ├── mindmap/route.ts            # Public/Free JSON Mindmap Generator
    │   ├── questions/route.ts          # 5 Pertanyaan Penajaman (GPT-4o Mini)
    │   ├── techstack/route.ts          # Rekomendasi Tech Stack
    │   ├── tasks/route.ts              # Task Breakdown Generator
    │   ├── styleguide/route.ts         # Style Guide Generator
    │   ├── full-prd/route.ts           # Protected Generator (HTTP 402 Paywall Guard)
    │   └── prototype/route.ts          # [DIRENCANAKAN] HTML Prototype Generator (PRO Only)
    ├── vault/
    │   ├── search/route.ts             # Search Database (PRO Only)
    │   └── fork/route.ts               # Clone PRD to Workspace
    ├── checkout/route.ts               # Generate Snap Payment Token
    ├── webhooks/payment/route.ts       # Signature Verification & Auto-Activation
    ├── cli/
    │   ├── auth/route.ts               # Validate API Key SHA-256 Hash (`xynn_live_...`)
    │   └── sync/route.ts               # Serve Workspace Markdown & .cursorrules
    └── admin/                          # Secure Admin Actions


---

## 7. Desain Antarmuka Anti-Slop
A. Halaman Public PRD (/prd/[shareSlug])
- Layout 3 Kolom: Floating Table of Contents (TOC) di kiri, Konten Utama PRD di tengah, Action Panel (Copy Prompt, Download Markdown, Fork) di kanan.

- Dual-View Mode: Toggle antara Visual Mode (untuk dibaca manusia dengan diagram Mermaid & badge stack) dan Prompt Mode (teks markdown raw siap di-paste ke Cursor/Claude).

- Interactive Task Checklist: Daftar tugas yang disajikan menggunakan komponen checkbox interaktif.   


B. Dashboard Admin (/admin)
- Design System: Palette Dark Slate/Zinc (#090d16), garis pembatas tipis (border-slate-800/80), serta font monospace untuk teks teknis.

- AI Cost & Margin Health: Widget metrik menampilkan pendapatan SaaS dikurangi total biaya API AI (Token Burn Rate & Profit Ring).

- Live System Prompt Sandbox: Editor split-screen untuk menguji perubahan System Prompt secara real-time tanpa perlu re-deploy aplikasi.

- Command Palette (Cmd + K): Navigasi cepat untuk mencari user, membuka konfig gateway, atau mengubah status voucher.


---

## 8. Keamanan & Non-Functional Requirements

- Server Guard Protection: Endpoint eksekusi PRD berat dan CLI Sync mengembalikan respons HTTP 402 Payment Required secara otomatis jika dipanggil oleh akun Free.

- Kriptografi API Key: Key xynn_live_xxxx dikirim sekali saja ke user. Database hanya menyimpan nilai SHA-256 Hash.

- AES-256-GCM Encryption: Field serverKeyEncrypted milik Payment Gateway dienkripsi di level database menggunakan master key environment server.

- Webhook Idempotency: Memeriksa status transaksi     sebelum memperbarui status langganan pengguna guna mencegah eksekusi ulang dari panggilan duplikat payment gateway.

---

## 9. Success Metrics (KPIs)
- Free-to-Paid Conversion Rate: Target > 4% pengguna Free melakukan upgrade ke PRO setelah melihat Mindmap Canvas.
- **Prototype Design Adoption Rate:** Target > 60% pengguna PRO (yang sudah punya PRD + Style Guide) melakukan minimal 1× generate Prototype.
- **Theme Editor Engagement:** Target > 35% pengguna PRO yang membuka Prototype melakukan minimal 1× penyesuaian tema (ganti preset / seed color / font).
- **Enterprise Upgrade Trigger:** Library tema tersimpan menjadi alasan utama upgrade dari PRO → Enterprise (diukur lewat survei + analitik gate).
- Vault Engagement Rate: Minimum 30% pengguna PRO melakukan forking PRD dari Gudang Ide.
- CLI Active Connections: Retensi harian pengguna developer yang menyambungkan workspace ke VS Code via CLI terminal (xynn connect).

---

**Skrip Inisialisasi Proyek Cepat (Bash Setup Script)**

Jalankan perintah berikut di terminal untuk langsung menginisialisasi folder Next.js & Prisma Schema sesuai spesifikasi PRD di atas:

```bash
# 1. Inisialisasi Project Next.js 16
npx create-next-app@latest xynn-prototype --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"

cd xynn-prototype

# 2. Install Dependency Utama
npm install @prisma/client @xyflow/react ai next-auth react-icons lucide-react clsx tailwind-merge
npm install -D prisma

# 3. Inisialisasi Prisma ORM
npx prisma init
```