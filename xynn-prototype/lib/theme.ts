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
  "primary",
  "secondary",
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
