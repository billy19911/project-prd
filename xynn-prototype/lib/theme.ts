/**
 * Token tema + penyuntikan ke HTML prototype.
 *
 * Dipisah dari `components/theme-editor.tsx` supaya fungsi murni ini bisa
 * diuji langsung oleh `node:test` (file .tsx tidak dapat dimuat Node tanpa
 * transformasi JSX).
 */

export type ThemeTokens = {
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

export const DEFAULT_THEME: ThemeTokens = {
  primary: "#4f7cff",
  secondary: "#7c5cff",
  accent: "#ff8a4f",
  surface: "#0d1220",
  text: "#e5e9f0",
  border: "#1e293b",
  fontHeading: "Geist",
  fontBody: "Geist",
  baseSize: 16,
  radius: 14,
};

export const THEME_COLOR_KEYS = [
  "primary",  "secondary",
  "accent",
  "surface",
  "text",
  "border",
] as const;

export const THEME_FONT_KEYS = ["fontHeading", "fontBody"] as const;

/** Hanya hex yang sah; selain itu jatuh ke hitam. */
export function safeHex(v: unknown): string {
  return typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v) ? v : "#000000";
}

/** Hanya huruf, angka, spasi, tanda hubung — cukup untuk nama font. */
export function safeFontName(v: unknown): string {
  return typeof v === "string" && /^[a-z0-9 -]{1,40}$/i.test(v.trim())
    ? v.trim()
    : "Geist";
}

export function safeInt(v: unknown, min: number, max: number, fallback: number): number {
  // `Number(null)` === 0 dan `Number("")` === 0, sehingga keduanya akan
  // terjepit ke `min` alih-alih memakai fallback. Tangani eksplisit.
  if (v === null || v === undefined || v === "") return fallback;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/**
 * Bersihkan token tema dari bentuk apa pun menjadi bentuk yang diharapkan.
 * Dipakai server SEBELUM menyimpan, dan klien SEBELUM menyuntikkan.
 */
export function sanitizeThemeTokens(raw: unknown): ThemeTokens {
  const src = (raw ?? {}) as Record<string, unknown>;
  return {
    primary: safeHex(src.primary),
    secondary: safeHex(src.secondary),
    accent: safeHex(src.accent),
    surface: safeHex(src.surface),
    text: safeHex(src.text),
    border: safeHex(src.border),
    fontHeading: safeFontName(src.fontHeading),
    fontBody: safeFontName(src.fontBody),
    baseSize: safeInt(src.baseSize, 8, 48, 16),
    radius: safeInt(src.radius, 0, 64, 14),
  };
}

/**
 * Terapkan token ke HTML prototype dengan menyuntikkan CSS variables.
 *
 * KEAMANAN: nilai di sini masuk ke dalam string HTML, jadi SEMUA nilai
 * disanitasi — bukan hanya warna. Sebelumnya `fontHeading`/`fontBody`
 * disisipkan mentah, sehingga nilai seperti
 *   x'; }</style><script>alert(1)</script>
 * dapat keluar dari tag <style>.
 */
export function applyThemeToHtml(html: string, tokens: ThemeTokens): string {
  const t = sanitizeThemeTokens(tokens);

  const vars = [
    `--color-primary:${t.primary}`,
    `--color-secondary:${t.secondary}`,
    `--color-accent:${t.accent}`,
    `--color-surface:${t.surface}`,
    `--color-text:${t.text}`,
    `--color-border:${t.border}`,
    `--font-heading:'${t.fontHeading}'`,
    `--font-body:'${t.fontBody}'`,
    `--size-base:${t.baseSize}px`,
    `--radius:${t.radius}px`,
  ].join(";");

  const style = `<style id="xynn-theme">:root{${vars}}</style>`;

  // Bila sudah pernah disuntik, ganti blok lama.
  if (html.includes('<style id="xynn-theme">')) {
    return html.replace(/<style id="xynn-theme">[\s\S]*?<\/style>/, style);
  }
  // Sisipkan tepat setelah <head> bila ada, kalau tidak taruh di awal.
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1${style}`);
  }
  return style + html;
}

/* ------------------------------------------------------------------ *
 * Ekstraksi token tema dari Style Guide (markdown)
 * ------------------------------------------------------------------ */

/**
 * Kumpulkan semua kode hex (#rgb / #rrggbb) dari teks, urut kemunculan,
 * tanpa duplikat (case-insensitive, disimpan dalam bentuk asli pertama).
 */
export function extractHexColors(markdown: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /#([0-9a-f]{3}|[0-9a-f]{6})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const hex = (m[0].toLowerCase().startsWith("#") ? m[0] : `#${m[0]}`).toLowerCase();
    if (seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
  }
  return out;
}

/** Cari hex yang berada dekat sebuah kata kunci (mis. "primary", "background"). */
function colorNear(markdown: string, keywords: string[]): string | null {
  const lower = markdown.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw);
    if (idx === -1) continue;
    // Cari hex dalam ±80 karakter setelah kata kunci.
    const window = markdown.slice(idx, idx + 80);
    const m = window.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
    if (m) return m[0].toLowerCase();
  }
  return null;
}

/**
 * Cari hex dari token CSS bernama, mis. baris
 *   | `--accent` | `#2563EB` | Tombol operator |
 * atau
 *   --accent: #2563EB;
 *
 * Style guide yang di-generate sering memakai token bernama — ini jauh lebih
 * andal daripada sekadar "hex pertama". `names` dicocokkan sebagai bagian dari
 * nama token (mis. "accent", "text-primary", "bg-surface").
 */
function tokenColor(markdown: string, names: string[]): string | null {
  for (const name of names) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // `--name` ... hex (dalam ±60 karakter, menyeberangi pipa/spasi).
    const re = new RegExp(`--[a-z0-9-]*${esc}[a-z0-9-]*[^\n#]{0,60}?(#[0-9a-f]{3,6})`, "i");
    const m = markdown.match(re);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

/**
 * Cari hex dari BARIS TABEL yang kolom deskripsinya menyebut peran tertentu.
 *
 * Contoh baris: `| brand-500 | #3B82F6 | Tombol primer, link |`
 * Dicocokkan lewat kata kunci peran ("primer", "primary", "operator", ...).
 * Ini menangani style guide yang memakai skala numerik (brand-500) alih-alih
 * nama token eksplisit (--primary).
 */
function roleRowColor(markdown: string, roleKeywords: string[]): string | null {
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes("|")) continue;
    const lower = line.toLowerCase();
    // Baris tabel harus memuat hex dan setidaknya satu kata kunci peran.
    const hexMatch = line.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
    if (!hexMatch) continue;
    if (roleKeywords.some((kw) => lower.includes(kw))) {
      return hexMatch[0].toLowerCase();
    }
  }
  return null;
}

/** Ambil nama font pertama dari potongan teks (mis. "**Font:** Inter, sans-serif"). */
export function extractFontNames(markdown: string): string[] {
  const fonts: string[] = [];
  const known = [
    "Inter",
    "Geist",
    "Roboto",
    "Poppins",
    "Montserrat",
    "Outfit",
    "Plus Jakarta Sans",
    "IBM Plex Sans",
    "Source Sans",
    "Noto Sans",
    "Lato",
    "Open Sans",
    "Nunito",
    "Work Sans",
    "Space Grotesk",
    "DM Sans",
    "Manrope",
    "Satoshi",
    "Playfair Display",
    "Merriweather",
    "Lora",
    "Sora",
  ];
  for (const f of known) {
    if (new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(markdown)) {
      fonts.push(f);
    }
  }
  return fonts;
}

/**
 * Bangun ThemeTokens dari markdown Style Guide.
 *
 * Strategi: cari warna berdasarkan kata kunci (primary/accent/background/
 * surface/text/border); bila tidak ketemu, distribusikan dari daftar hex yang
 * ada; terakhir jatuh ke DEFAULT_THEME. Ini menjadikan tema prototype
 * KONSISTEN dengan Style Guide (satu sumber), bukan warna acak.
 *
 * @param base dipakai sebagai fallback bila style guide tidak menyebut token.
 */
export function themeFromStyleGuide(
  styleGuideMarkdown: string | null | undefined,
  base: ThemeTokens = DEFAULT_THEME
): ThemeTokens {
  const md = styleGuideMarkdown ?? "";
  if (!md.trim()) return { ...base };

  const hexes = extractHexColors(md);

  // Prioritas: (1) baris tabel berdasarkan PERAN ("Tombol primer"), (2) token
  // CSS bernama (--accent), (3) kata kunci dekat hex, (4) distribusi berurutan,
  // (5) base. Urutan ini penting: style guide nyata sering memakai skala
  // numerik (brand-500) yang hanya bisa dikenali lewat kolom "Penggunaan".
  const primary =
    roleRowColor(md, ["tombol primer", "tombol utama", "primary", "primer", "brand utama", "cta utama"]) ??
    tokenColor(md, ["primary", "brand"]) ??
    colorNear(md, ["primary", "brand", "utama"]) ??
    hexes[0] ??
    base.primary;
  const secondary =
    roleRowColor(md, ["sekunder", "secondary"]) ??
    tokenColor(md, ["secondary"]) ??
    colorNear(md, ["secondary", "sekunder", "support"]) ??
    hexes[1] ??
    base.secondary;
  const accent =
    roleRowColor(md, ["tombol operator", "aksen", "accent", "highlight", "fokus ring", "focus ring"]) ??
    tokenColor(md, ["accent", "cta", "highlight"]) ??
    colorNear(md, ["accent", "aksen", "cta", "highlight"]) ??
    hexes[2] ??
    base.accent;
  // Surface/background halaman. Hindari kata generic "background" agar tidak
  // tertangkap baris seperti "Background highlight" (token pucat).
  const surface =
    roleRowColor(md, ["background halaman", "background aplikasi", "latar halaman", "latar aplikasi", "card", "kartu", "surface"]) ??
    tokenColor(md, ["bg-base", "background", "surface", "bg"]) ??
    colorNear(md, ["background", "surface", "bg", "latar"]) ??
    base.surface;
  const text =
    roleRowColor(md, ["teks utama", "text primary", "angka display", "heading"]) ??
    tokenColor(md, ["text-primary", "text", "foreground"]) ??
    colorNear(md, ["text", "foreground", "tulisan", "teks"]) ??
    base.text;
  const border =
    roleRowColor(md, ["border", "garis", "pemisah"]) ??
    tokenColor(md, ["border", "stroke"]) ??
    colorNear(md, ["border", "garis", "stroke"]) ??
    base.border;

  const fonts = extractFontNames(md);
  const fontHeading = fonts[0] ?? base.fontHeading;
  const fontBody = fonts[1] ?? fonts[0] ?? base.fontBody;

  // Radius: cari "radius: 12px" atau "--radius 8" atau "rounded 8".
  let radius = base.radius;
  const radiusMatch =
    md.match(/radius[^0-9]{0,14}(\d{1,2})\s*px/i) ||
    md.match(/--[a-z-]*radius[a-z-]*[^\n\d]{0,14}(\d{1,2})\b/i);
  if (radiusMatch) radius = Math.min(64, Math.max(0, Number(radiusMatch[1])));

  return sanitizeThemeTokens({
    primary,
    secondary,
    accent,
    surface,
    text,
    border,
    fontHeading,
    fontBody,
    baseSize: base.baseSize,
    radius,
  });
}

