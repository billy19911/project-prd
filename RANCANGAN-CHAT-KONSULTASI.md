# Rancangan: Chat Prototype & Konsultasi AI Terintegrasi

> Status: **DRAF untuk review.** Belum ada kode yang diubah.
> Tujuan dokumen: menyepakati konsep, alur, dan perubahan teknis sebelum implementasi.

---

## 1. Latar & masalah saat ini

Setelah menelusuri kode, kondisi kedua fitur saat ini:

| Aspek | Kondisi sekarang |
| :--- | :--- |
| **Chat Prototype** (`/chat`) | Chatbot teks biasa. Persona "product design assistant", tapi **tidak terikat project** (`workspaceId` selalu `null` dari UI), dan **tidak ada aksi** untuk mengubah percakapan → PRD/prototype. Prompt-nya eksplisit "bukan generator HTML". |
| **Konsultasi AI** (`/consult`) | Chatbot teks biasa. Persona "senior software architect". Juga **tidak terikat project**, dan hasilnya hanya teks — **tidak bisa diterapkan** ke PRD/prototype. |
| Keterkaitan ke project | `ChatThread.workspaceId` & `ConsultThread.workspaceId` **nullable** dan **selalu null** dari UI (POST thread dipanggil tanpa body). Akibatnya `projectContext` praktis selalu kosong. |
| Versi PRD | **Tidak ada** riwayat versi untuk `fullPrdMd`/`tasksJson`/`styleGuideMd` (hanya `PrototypeVersion` untuk HTML). |
| Streaming | Tidak ada (semua blocking). |

**Inti keluhan:** kedua fitur belum "menyambung" ke inti produk (PRD & prototype), sehingga terasa seperti chatbot terpisah yang tidak menghasilkan apa-apa.

---

## 2. Konsep baru yang diinginkan

### 2.1 Chat Prototype — "dari ide kosong sampai jadi" (bukan chatbot biasa)

Chat Prototype menjadi **ruang kerja awal** yang menuntun user dari ide mentah → PRD siap pakai.

**Yang dilakukan AI di chat ini:**
1. **Menggali & mempertajam workflow** aplikasi — *bagaimana alurnya berjalan*, siapa aktornya, apa yang terjadi di tiap langkah.
2. **Mengusulkan pertanyaan yang harus ditambah/dikurangi** — mis. "alur ini belum menjawab: apa yang terjadi jika pembayaran gagal?"
3. **Memberi analisa + alasan/hipotesis yang masuk akal** — bukan sekadar bertanya, tapi memberi opini dan *kenapa*.
4. **Menyimpulkan PRD** saat percakapan cukup matang — user review, lalu **Terapkan** → jadi project + `fullPrdMd`.

**Alur ringkas:**
```
/chat  →  mulai ide mentah (belum ada project)
       →  AI menggali workflow, mengusulkan pertanyaan, memberi analisa
       →  (kapan pun) user tekan "Susun PRD"
       →  AI menghasilkan DRAF PRD (12 seksi, gaya yang sama dengan generatePRDWithAI)
       →  user review & edit  →  "Terapkan"
       →  sistem membuat Workspace baru + mengisi fullPrdMd (+ mindmap dari chat)
       →  user diarahkan ke /project/[id] untuk lanjut ke Tasks/Style/Prototype
```

**Keputusan yang sudah disetujui:** mulai dari ide → jadi **project + PRD**. AI menyimpulkan PRD, **user konfirmasi dulu** sebelum disimpan.

### 2.2 Konsultasi AI — "menyambung ke regenerate PRD/prototype"

Konsultasi AI menjadi **penasihat teknis yang bisa memberi aksi perbaikan terarah** — bukan cuma teks.

**Yang dilakukan AI di konsultasi:**
- Menganalisa **alur/workflow & design** project yang sudah ada (konteks PRD + Style Guide + ringkasan prototype).
- Mengusulkan **rekomendasi terarah**, mis.:
  - *"Screen **Dashboard** sebaiknya menampilkan ringkasan X"* → tombol **Regenerate screen ini**.
  - *"PRD bagian **User Flow** kurang lengkap soal Y"* → tombol **Perbaiki PRD**.
- User melihat **ringkasan perubahan** lalu menekan tombol untuk **menerapkan** (regenerate bagian terkait).

**Keputusan yang sudah disetujui:** rekomendasi + tombol regenerate terarah (bukan otomatis). Konsultasi **terikat project** (harus pilih project).

---

## 3. Perbandingan konsep lama vs baru

| Aspek | Lama | **Baru** |
| :--- | :--- | :--- |
| Chat | Chatbot lepas | **Ruang kerja: ide → PRD** |
| Consult | Chatbot lepas | **Penasihat + aksi regenerate** |
| Terikat project | Tidak pernah | Chat: **bisa tanpa project** (dari ide) · Consult: **wajib project** |
| Output konkret | Tidak ada | Chat: **buat project + PRD** · Consult: **regenerate PRD/prototype** |
| Gate paket | Chat: PRO+ · Consult: STARTER+ | **Perlu ditinjau** (lihat §7) |

---

## 4. Rancangan Teknis — Chat Prototype

### 4.1 Alur data

```
User buka /chat (bisa dari sidebar, tanpa pilih project)
   │
   ├─ ChatThread dibuat (workspaceId tetap null → ini thread "belum jadi")
   │
   ├─ Percakapan berjalan (AI mempertajam workflow)
   │     prompt system khusus: kerja sama seperti analyst produk
   │
   ├─ User tekan [Susun PRD]
   │     POST /api/chat/threads/[id]/draft-prd
   │        → AI membaca SELURUH transkrip + hasil analisa
   │        → menghasilkan draft PRD (12 seksi)
   │        → dikembalikan ke UI (TIDAK langsung disimpan)
   │
   ├─ UI tampilkan PRD di panel/editor (user bisa edit)
   │
   └─ User tekan [Terapkan]
         POST /api/chat/threads/[id]/apply
            → buat Workspace baru (title dari judul thread, description dari ringkasan)
            → isi fullPrdMd = draft yang disetujui
            → generate mindmap ringkas (opsional, dari transkrip) → mindmapJson
            → set thread.workspaceId = workspace baru (menautkan)
            → return { workspaceId }
         → redirect ke /project/[newId]
```

### 4.2 Perubahan prompt (konsep)

`lib/chat-prompt.ts` → system prompt baru (konsep, bukan kode final):

> Kamu adalah analis produk Xynn. Tugasmu menuntun user dari **ide mentah** menjadi **PRD yang tajam**, lewat percakapan.
> Di setiap balasan:
> 1. **Ringkas** apa yang sudah jelas.
> 2. **Pertajam workflow** — tanyakan alur yang belum terjawab (happy path, error path, peran pengguna).
> 3. **Usulkan pertanyaan yang perlu ditambah/dihapus** — sebutkan alasannya.
> 4. **Beri analisa + hipotesis** yang masuk akal (mis. "sebaiknya X karena Y").
> Jangan menulis HTML. Jangan bertele-tele. Jika user minta berhenti menggali, tawarkan "Susun PRD".

Perubahan tambahan:
- Saat thread sudah punya `workspaceId` → chat berubah mode menjadi "mempertajam PRD project ini" (bisa mengusulkan update `fullPrdMd`).

### 4.3 Endpoint baru

| Endpoint | Fungsi | Gate |
| :--- | :--- | :--- |
| `POST /api/chat/threads/[id]/draft-prd` | Hasilkan draft PRD dari transkrip (tidak simpan) | login + fitur `chat` |
| `POST /api/chat/threads/[id]/apply` | Buat Workspace + isi PRD dari draft yang disetujui | login + fitur `chat` |

Modifikasi:
- `POST /api/chat/threads` — **sudah** menerima `{workspaceId?}`; tidak berubah.
- `app/api/ai/chat/route.ts` — tambahkan flag di response, mis. `readyForPrd` (heuristik sederhana: jumlah pesan ≥ N), agar UI bisa menampilkan tombol "Susun PRD".

### 4.4 Perubahan UI (`app/(main)/chat/page.tsx`)

- Tambah **tombol "Susun PRD"** (muncul setelah percakapan cukup, atau selalu tersedia).
- Panel/editor **draft PRD** (markdown) dengan tombol **Terapkan** & **Edit**.
- Setelah Terapkan → redirect ke `/project/[id]`.
- (Opsional) Indikator "titik kritis" workflow yang sudah/belum dibahas.

### 4.5 Fungsi AI baru di `lib/ai.ts`

```ts
// Konsep signature (belum final)
generatePrdFromChat(
  history: { role, content }[],
  opts: { title?, techStack?, model?, systemPrompt?, locale? }
): Promise<{ prd: string; usage: UsageInfo | null }>
```

Prompt-nya sama 12 seksi seperti `generatePRDWithAI`, tetapi **sumbernya transkrip percakapan** + hasil analisa workflow (bukan mindmap).

---

## 5. Rancangan Teknis — Konsultasi AI

### 5.1 Alur data

```
/consult  →  WAJIB pilih project (dropdown project milik user)
   │
   ├─ ChatThread/ConsultThread dibuat dengan workspaceId = project terpilih
   │
   ├─ Percakapan (AI menganalisa PRD + Style Guide + ringkasan screen prototype)
   │     AI diminta menyertakan "rekomendasi aksi" terstruktur saat relevan
   │
   ├─ Jika AI mengusulkan aksi:
   │     UI menampilkan CHIP/TOMBOL, mis.:
   │        [Perbaiki PRD bagian User Flow]
   │        [Regenerate screen Dashboard]
   │
   └─ User klik tombol → endpoint regenerate terarah
         · Perbaiki PRD → update fullPrdMd (via AI, fokus section tertentu)
         · Regenerate screen → panggil /api/ai/prototype {screenLabel}
```

### 5.2 Bagaimana "rekomendasi aksi" dikodekan

Dua opsi (perlu dipilih — lihat §7):
- **A. Block terstruktur di teks balasan** — AI diminta mengeluarkan blok khusus, mis.:
  ```
  [[ACTION:regenerate-screen: Dashboard | Ringkasan dashboard belum ada]]
  [[ACTION:fix-prd-section: User Flow | perlu tambah alur gagal bayar]]
  ```
  UI mem-parse & menampilkan tombol. Sederhana, tanpa schema baru.
- **B. Field JSON terpisah** di `ConsultMessage` (`actions Json?`) — lebih rapi, perlu migrasi + parsing array di sisi AI (2 panggilan: jawab + ekstrak aksi).

### 5.3 Endpoint baru

| Endpoint | Fungsi | Gate |
| :--- | :--- | :--- |
| `POST /api/consult/threads/[id]/apply` | Jalankan aksi terarah (regenerate PRD section / screen) | login + fitur `consult` + paket |

Endpoint ini memakai ulang `regenerateSingleScreenWithAI` (prototype) & fungsi PRD (baru) untuk section.

### 5.4 Perubahan UI (`app/(main)/consult/page.tsx`)

- **Dropdown pilih project** (wajib sebelum chat; ambil dari `GET /api/workspace`).
- Tampilkan **chip aksi** di bawah balasan yang relevan.
- Setelah aksi dijalankan → tampilkan hasil di panel (atau tautan ke project).

---

## 6. Perubahan database (usulan)

| Model | Perubahan | Alasan |
| :--- | :--- | :--- |
| `ConsultThread` | tetap (`workspaceId` dipakai, tidak nullable untuk consult) | Konsultasi wajib project |
| `ChatThread` | tetap (`workspaceId` null = "belum jadi") | Chat dari ide |
| `Workspace` | **manual edit** `title`/`description` saat apply | data dari chat |
| **`PrdVersion`** (BARU, opsional) | `id, workspaceId, fullPrdMd, note, createdAt` | Riwayat versi PRD (belum ada; hanya prototype punya). Perlu bila konsultasi mengubah PRD agar bisa dibatalkan. |
| `ConsultMessage` | (opsi B) `actions Json?` | Menyimpan rekomendasi aksi terstruktur |

> Catatan: `PrdVersion` mengikuti pola `PrototypeVersion`. Bila tidak ingin menambah tabel, versi PRD bisa dilewati dulu (PRD immutable per-perubahan).

---

## 7. Keputusan (FINAL — sudah disetujui)

1. **Gate paket Chat Prototype = PRO+** (tidak turun ke FREE). Konsultasi tetap STARTER+.
2. **Aksi konsultasi = blok teks `[[ACTION:...]]`** (opsi A), diparse di UI. Tidak ada field JSON baru di `ConsultMessage`.
3. **`PrdVersion` dibuat** (riwayat versi PRD, pola sama seperti `PrototypeVersion`).
4. **Mindmap dari chat: ya** — digenerate otomatis saat "Terapkan" (ringkas, dari transkrip).
5. **Streaming: ya, sekarang** — balasan chat/PRD muncul bertahap (SSE).
6. **`techStack` dari chat: ya** — AI mengusulkan di dalam PRD; user bisa ubah di project.

---

## 8. Urutan implementasi yang diusulkan (setelah sepakat)

**Fase 1 — Chat Prototype jadi "ide → PRD"**
1. Prompt system baru (`lib/chat-prompt.ts`) + fungsi `generatePrdFromChat` (`lib/ai.ts`).
2. Endpoint `draft-prd` + `apply`.
3. UI: tombol "Susun PRD", panel review, "Terapkan" → redirect ke project.

**Fase 2 — Konsultasi terikat project + aksi**
4. Dropdown project di `/consult` + POST thread dengan `workspaceId`.
5. Konvensi "aksi" + parsing di UI + tombol.
6. Endpoint `apply` (regenerate screen / perbaiki PRD section).

**Fase 3 — Pengerasan**
7. (Opsional) `PrdVersion` + UI riwayat.
8. (Opsional) Streaming chat.
9. Uji + dokumentasi (README, CHANGELOG).

---

## 9. Risiko & catatan

- **Biaya token**: `draft-prd` membaca transkrip panjang → perlu batas (mis. 20 pesan terakhir, dipotong).
- **Non-streaming** membuat chat terasa "diam" saat AI menyusun PRD panjang → pertimbangkan indikator loading jelas.
- **`ChatThread.workspaceId` null** sudah didukung skema; mengubah alur tidak butuh migrasi untuk chat.
- **Konsultasi mengubah PRD** tanpa versi = berisiko tak bisa dibatalkan → pertimbangkan `PrdVersion`.
- Prompt admin (`AiConfig.systemPrompt`) tetap digabung di depan prompt bawaan — jaga agar tidak menabrak persona baru.

---

## 10. Ringkasan keputusan yang sudah disetujui

- ✅ Chat Prototype: **mulai dari ide → jadi project + PRD**.
- ✅ PRD disimpulkan AI, **user konfirmasi** sebelum disimpan.
- ✅ Konsultasi: **rekomendasi + tombol regenerate terarah**.
- ✅ **Rancang dulu**, belum coding.

**Menunggu jawaban Anda untuk §7 sebelum implementasi.**
