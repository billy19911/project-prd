/**
 * Uji prompt generator prototype — lib/prototype-prompt.ts
 * =======================================================
 *
 * Fokus: tema tersimpan dari Theme Editor HARUS masuk ke prompt. Tanpa ini,
 * menekan "Regenerate" akan menghasilkan warna default dan menghapus
 * penyesuaian pengguna tanpa peringatan.
 *
 * Modul ini sengaja bebas dependensi (direktif bahasa diterima sebagai
 * parameter) supaya bisa diuji `node:test` tanpa resolusi alias `@/lib/*`.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  buildPrototypePrompt,
  buildThemeOverrideBlock,
} from "../lib/prototype-prompt.ts";

const LANG = "Write the copy in Indonesian.";

const THEME = {
  primary: "#16a34a",
  secondary: "#0ea5e9",
  accent: "#f59e0b",
  surface: "#0b1220",
  text: "#e2e8f0",
  border: "#334155",
  fontHeading: "Sora",
  fontBody: "DM Sans",
  baseSize: 17,
  radius: 8,
};

const BASE_OPTS = {
  title: "Aplikasi Uji",
  prdMarkdown: "PRD isi",
  styleGuideMarkdown: "Style isi",
  techStack: ["Next.js"],
  locale: "id",
};

describe("buildThemeOverrideBlock", () => {
  test("memuat seluruh 10 nilai token", () => {
    const blk = buildThemeOverrideBlock(THEME);
    for (const [label, val] of [
      ["primary", THEME.primary],
      ["secondary", THEME.secondary],
      ["accent", THEME.accent],
      ["surface", THEME.surface],
      ["text", THEME.text],
      ["border", THEME.border],
      ["fontHeading", THEME.fontHeading],
      ["fontBody", THEME.fontBody],
      ["baseSize", `${THEME.baseSize}px`],
      ["radius", `${THEME.radius}px`],
    ]) {
      assert.ok(blk.includes(val), `nilai ${label} (${val}) hilang dari blok tema`);
    }
  });

  test("menyuruh AI memakai nilai persis & melarang mengarang warna", () => {
    const blk = buildThemeOverrideBlock(THEME);
    assert.ok(/EXACT values/i.test(blk));
    assert.ok(/Do NOT invent other colors/i.test(blk));
    assert.ok(/THEME OVERRIDE/i.test(blk));
  });
});

describe("buildPrototypePrompt — tema diteruskan", () => {
  test("tanpa tema: tidak ada blok override", () => {
    const p = buildPrototypePrompt({ ...BASE_OPTS, theme: null }, LANG);
    assert.ok(!p.includes("THEME OVERRIDE"));
  });

  test("theme undefined juga tidak menambahkan blok", () => {
    const p = buildPrototypePrompt({ ...BASE_OPTS }, LANG);
    assert.ok(!p.includes("THEME OVERRIDE"));
  });

  test("dengan tema: blok override muncul dan nilainya persis", () => {
    const p = buildPrototypePrompt({ ...BASE_OPTS, theme: THEME }, LANG);
    assert.ok(p.includes("THEME OVERRIDE"), "blok override harus muncul");
    for (const val of [
      THEME.primary,
      THEME.secondary,
      THEME.accent,
      THEME.surface,
      THEME.text,
      THEME.border,
      THEME.fontHeading,
      THEME.fontBody,
      `${THEME.baseSize}px`,
      `${THEME.radius}px`,
    ]) {
      assert.ok(p.includes(val), `nilai ${val} harus masuk ke prompt`);
    }
  });

  test("instruksi wajib tetap ada walau tema disertakan", () => {
    const p = buildPrototypePrompt({ ...BASE_OPTS, theme: THEME }, LANG);
    // Jangan sampai penambahan tema merusak batasan inti.
    assert.ok(/ONE self-contained HTML file/i.test(p));
    assert.ok(/NO external resources/i.test(p));
    assert.ok(/screen:/i.test(p));
    assert.ok(/responsive/i.test(p));
    assert.ok(/No emoji as icons/i.test(p));
  });
});
