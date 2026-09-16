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
    `=== STYLE GUIDE (ikuti token warna, tipografi, radius, spacing) ===`,
    opts.styleGuideMarkdown.slice(0, 6000),
    ``,
    `HARD REQUIREMENTS:`,
    `1. Output ONE self-contained HTML file. All CSS inside a <style> tag. All JS inside a <script> tag.`,
    `2. NO external resources: no CDN, no <img src="http...">, no external fonts, no imports.`,
    `3. Render 5 screens, each clearly separated. Before each screen write a marker comment exactly like:`,
    `   <!-- screen: Landing -->`,
    `   (adjust the label to the screen's real purpose; use the output language)`,
    `4. Only ONE screen visible at a time. Use a simple JS router: clicking nav/buttons switches the visible screen.`,
    `5. MUST be responsive: mobile-first CSS with a breakpoint around 768px. Use CSS grid/flex.`,
    `6. Apply the Style Guide's colors and typography as CSS custom properties in :root.`,
    opts.theme ? buildThemeOverrideBlock(opts.theme) : ``,
    `7. Use placeholder blocks for images/charts — a dashed box with a monospace caption. Do NOT draw complex SVG.`,
    `8. No emoji as icons. No gradients unless the Style Guide specifies them.`,
    `9. Indonesian/English copy that matches the PRD's domain. Real, meaningful text — not lorem ipsum.`,
    ``,
    languageDirective,
    `Output ONLY the HTML document. Start with <!DOCTYPE html>. No explanation before or after.`,
  ].join("\n");
}
