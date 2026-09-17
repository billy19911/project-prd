/**
 * Prompt builder untuk generator Prototype.
 *
 * Dipisah dari `lib/ai.ts` supaya dapat diuji `node:test` tanpa resolusi
 * alias `@/lib/*`. Modul ini SENGAJA tidak mengimpor apa pun — semua
 * dependensi (direktif bahasa) diterima sebagai parameter.
 */

export type ThemeTokensForPrompt = {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  text: string;
  border: string;
  fontHeading: string;
  fontBody: string;
  baseSize: number;
  radius: number;
};

/**
 * Blok instruksi agar AI memakai tema tersimpan, bukan mengarang warna baru.
 *
 * Penting: tanpa blok ini, menekan "Regenerate" akan menghasilkan warna
 * default dan menghapus penyesuaian pengguna tanpa peringatan.
 */
export function buildThemeOverrideBlock(t: ThemeTokensForPrompt): string {
  return [
    ``,
    `   >>> THEME OVERRIDE (WAJIB, tidak bisa ditawar) <<<`,
    `   The user has ALREADY customized the theme in the Theme Editor.`,
    `   You MUST use these EXACT values for :root. Do NOT invent other colors.`,
    `     --color-primary:   ${t.primary}`,
    `     --color-secondary: ${t.secondary}`,
    `     --color-accent:    ${t.accent}`,
    `     --color-surface:   ${t.surface}`,
    `     --color-text:      ${t.text}`,
    `     --color-border:    ${t.border}`,
    `     --font-heading:    '${t.fontHeading}'`,
    `     --font-body:       '${t.fontBody}'`,
    `     --size-base:       ${t.baseSize}px`,
    `     --radius:          ${t.radius}px`,
    `   Derive tints/shades from these (e.g. hover = darker primary), but the`,
    `   base tokens above must match exactly.`,
  ].join("\n");
}

/**
 * Bangun prompt generator prototype.
 *
 * @param languageDirective Direktif bahasa (dari `lib/i18n`), diteruskan
 *   sebagai parameter agar modul ini bebas dependensi.
 */
export function buildPrototypePrompt(
  opts: {
    title: string;
    prdMarkdown: string;
    styleGuideMarkdown: string;
    techStack: string[];
    locale: string;
    /** Tema tersimpan — WAJIB dihormati agar regenerate tidak menghapus
     *  penyesuaian warna/font pengguna. */
    theme?: ThemeTokensForPrompt | null;
  },
  languageDirective: string
): string {
  return [
    `You are a senior product designer. Build a CLICKABLE HTML PROTOTYPE from the PRD and Style Guide below.`,
    ``,
    `Project: ${opts.title}`,
    `Tech Stack: ${opts.techStack.join(", ") || "not specified"}`,
    ``,
    `=== PRD ===`,
    opts.prdMarkdown.slice(0, 9000),
    ``,
    `=== STYLE GUIDE (WAJIB diikuti: warna, tipografi, radius, spacing) ===`,
    opts.styleGuideMarkdown.slice(0, 6000),
    ``,
    `HARD REQUIREMENTS:`,
    `0. CONSISTENCY: the prototype MUST look like it belongs to the SAME product as the PRD & Style Guide above — same colors, same typography, same tone. Do NOT invent a new visual identity.`,
    `1. Output ONE self-contained HTML file. All CSS inside a <style> tag. All JS inside a <script> tag.`,
    `2. NO external resources: no CDN, no <img src="http...">, no external fonts, no imports. Use system font stack fallbacks.`,
    `3. Render 5 screens, each clearly separated. Before each screen write a marker comment exactly like:`,
    `   <!-- screen: Landing -->`,
    `   (adjust the label to the screen's real purpose; use the output language)`,
    `4. Only ONE screen visible at a time. Use a simple JS router: clicking nav/buttons switches the visible screen. Keep ONE persistent top nav (logo + menu) across all screens so the mockup feels like one app.`,
    `5. MUST be responsive: mobile-first CSS with a breakpoint around 768px. Use CSS grid/flex.`,
    `6. Declare EVERY color/typography/radius token as CSS variables in :root, TAKEN FROM the Style Guide (hex values, font names, radius). Every component must reference these variables — no hardcoded colors.`,
    opts.theme ? buildThemeOverrideBlock(opts.theme) : ``,
    `7. Use realistic placeholder blocks for images/charts — a dashed box with a monospace caption. Do NOT draw complex SVG.`,
    `8. No emoji as icons. No gradients unless the Style Guide specifies them.`,
    `9. Indonesian/English copy that matches the PRD's domain. Real, meaningful text — not lorem ipsum.`,
    `10. The downloaded file must look IDENTICAL to the preview — no server-only assets, no runtime fetches.`,
    ``,
    languageDirective,
    `Output ONLY the HTML document. Start with <!DOCTYPE html>. No explanation before or after.`,
  ].join("\n");
}

/** Penanda screen yang dipakai protokol kita. */
const SCREEN_MARKER = /<!--\s*screen:\s*([^>]+?)\s*-->/gi;

/**
 * Cadangan bila AI TIDAK menulis penanda `<!-- screen: -->`.
 *
 * Ini penting: pada pengujian nyata, model kadang mengembalikan dokumen utuh
 * TANPA penanda (terbukti 0 penanda pada HTML tersimpan). Tanpa cadangan ini,
 * daftar screen kosong dan fitur regenerate-per-screen tidak bisa dipakai
 * sama sekali.
 *
 * Heuristik: cari elemen dengan `id`/`class` yang mengandung kata khas screen
 * (screen, page, view, step, tab, section) diikuti nama.
 */
const SCREEN_ATTR =
  /<[a-z][^>]*\s(?:id|class)\s*=\s*["']([^"']*(?:screen|page|view|step)[^"']*)["']/gi;

const SCREEN_WORD_HINTS = [
  "landing",
  "home",
  "dashboard",
  "login",
  "auth",
  "signin",
  "signup",
  "register",
  "chat",
  "inbox",
  "list",
  "detail",
  "profile",
  "settings",
  "form",
  "checkout",
  "cart",
  "summary",
  "verify",
  "otp",
  "onboarding",
];

function titleCase(s: string): string {
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Cari kandidat screen dari struktur HTML (tanpa penanda). */
export function detectScreensFromHtml(html: string): { id: string; label: string }[] {
  const found: { id: string; label: string }[] = [];
  const seen = new Set<string>();

  SCREEN_ATTR.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SCREEN_ATTR.exec(html)) !== null) {
    for (const raw of m[1].split(/\s+/)) {
      const token = raw.trim().toLowerCase();
      if (!token || token.length < 3 || token.length > 40) continue;
      // Ambil kata terakhir yang cocok dengan petunjuk screen.
      const parts = token.split(/[-_]/).filter(Boolean);
      const hint = parts.find((p) => SCREEN_WORD_HINTS.includes(p));
      if (!hint) continue;
      const id = parts.slice(parts.indexOf(hint)).join("-");
      if (seen.has(id)) continue;
      seen.add(id);
      found.push({ id, label: titleCase(id) });
    }
  }

  // Kalau heuristik gagal, pakai elemen ber-id pendek yang tampak seperti screen.
  if (found.length === 0) {
    const ids = html.match(/\sid\s*=\s*["']([a-z][a-z0-9_-]{2,30})["']/gi) || [];
    for (const raw of ids) {
      const id = raw.replace(/^\s*id\s*=\s*["']|["']$/gi, "").toLowerCase();
      if (seen.has(id)) continue;
      if (/^(app|root|main|container|body|nav|bottom-nav|header|footer)$/.test(id)) continue;
      seen.add(id);
      found.push({ id, label: titleCase(id) });
      if (found.length >= 8) break;
    }
  }

  return found.slice(0, 8);
}

/** Potong HTML tepat sebelum penanda screen ke-N (untuk menghemat token). */
function sliceScreenBlocks(html: string): { label: string; body: string }[] {
  const marks: { label: string; start: number; end: number }[] = [];
  SCREEN_MARKER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SCREEN_MARKER.exec(html)) !== null) {
    marks.push({ label: m[1].trim(), start: m.index, end: m.index + m[0].length });
  }
  const out: { label: string; body: string }[] = [];
  for (let i = 0; i < marks.length; i++) {
    const from = marks[i].end;
    const to = i + 1 < marks.length ? marks[i + 1].start : html.length;
    out.push({ label: marks[i].label, body: html.slice(from, to) });
  }
  return out;
}

/** Ambil blok `<style>` dari HTML yang ada, agar palet/kelas tetap konsisten. */
function sliceStyleTag(html: string): string {
  const m = html.match(/<style[^>]*>[\s\S]*?<\/style>/i);
  return m ? m[0].slice(0, 8000) : "";
}

/**
 * Prompt untuk REGENERATE SATU SCREEN SAJA — versi hemat token.
 *
 * Pendekatan sebelumnya (kirim HTML penuh + minta dokumen utuh) GAGAL:
 *   1. HTML dipotong di 24 rb karakter -> penanda screen hilang
 *   2. AI menulis ulang SELURUH dokumen (47 rb karakter) tanpa penanda
 *   3. Hasilnya lebih mahal daripada borong, dan ditolak oleh validasi
 *
 * Pendekatan sekarang: kirim KERANGKA saja (daftar screen + tag <style> +
 * isi screen sasaran), dan minta AI mengembalikan HANYA potongan screen itu.
 * Penggabungan dilakukan oleh kode — jauh lebih andal.
 */
export function buildSingleScreenPrompt(
  opts: {
    title: string;
    screenLabel: string;
    screenIndex: number;
    totalScreens: number;
    currentHtml: string;
    theme?: ThemeTokensForPrompt | null;
  },
  languageDirective: string
): string {
  const blocks = sliceScreenBlocks(opts.currentHtml);
  const allLabels = blocks.map((b) => b.label);
  const targetIdx = Math.max(
    0,
    allLabels.findIndex((l) => l.toLowerCase() === opts.screenLabel.toLowerCase())
  );
  const target = blocks[targetIdx];
  const styleTag = sliceStyleTag(opts.currentHtml);

  return [
    `You are a senior product designer redesigning ONE screen of an existing HTML prototype.`,
    ``,
    `Project: ${opts.title}`,
    `Screen to redesign: "${opts.screenLabel}" (${targetIdx + 1} of ${opts.totalScreens})`,
    `All screens in this prototype: ${allLabels.join(", ") || "not specified"}`,
    ``,
    `=== TASK ===`,
    `Return ONLY the HTML for the "${opts.screenLabel}" screen — nothing else.`,
    `Do NOT return <!DOCTYPE>, <html>, <head>, <style>, or <script>.`,
    `Do NOT include screen markers. Output just the screen's markup.`,
    ``,
    `=== RULES ===`,
    `1. Reuse the CSS classes already defined in the stylesheet below.`,
    `2. Only use inline styles if strictly necessary.`,
    `3. No <img> with external URLs. Use a dashed placeholder box with a monospace caption for images/charts.`,
    `4. Keep it responsive (mobile-first; the layout must work under 768px).`,
    `5. No emoji as icons.`,
    `6. Content language must match the existing screens.`,
    opts.theme ? buildThemeOverrideBlock(opts.theme) : ``,
    ``,
    `=== EXISTING STYLESHEET (pakai kelas-kelas ini) ===`,
    styleTag || "(tidak ada <style> ditemukan — gunakan inline style sederhana)",
    ``,
    `=== CURRENT "${opts.screenLabel}" MARKUP (yang akan digantikan) ===`,
    target ? target.body.slice(0, 6000) : "(tidak ditemukan)",
    `=== END ===`,
    ``,
    languageDirective,
    `Output ONLY the screen markup. Mulai langsung dengan tag HTML (mis. <div class="...">).`,
  ].join("\n");
}

/**
 * Ganti isi satu screen di dalam HTML dengan markup baru.
 *
 * HANYA bekerja bila protokol penanda `<!-- screen: -->` ada. Bila tidak ada,
 * kembalikan `null` — sengaja TIDAK menebak, karena mengganti bagian dokumen
 * tanpa penanda berisiko merusak struktur. Pemanggil harus menangani `null`
 * (biasanya: minta regenerate penuh).
 */
export function replaceScreenInHtml(
  html: string,
  screenLabel: string,
  newMarkup: string
): string | null {
  const marks: { label: string; start: number; end: number }[] = [];
  SCREEN_MARKER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SCREEN_MARKER.exec(html)) !== null) {
    marks.push({ label: m[1].trim(), start: m.index, end: m.index + m[0].length });
  }

  const idx = marks.findIndex(
    (mk) => mk.label.toLowerCase() === screenLabel.trim().toLowerCase()
  );
  if (idx === -1) return null;

  const from = marks[idx].end;
  const to = idx + 1 < marks.length ? marks[idx + 1].start : html.length;

  return html.slice(0, from) + "\n" + newMarkup.trim() + "\n" + html.slice(to);
}

/** Apakah HTML memakai protokol penanda screen. */
export function hasScreenMarkers(html: string): boolean {
  SCREEN_MARKER.lastIndex = 0;
  return SCREEN_MARKER.test(html);
}
