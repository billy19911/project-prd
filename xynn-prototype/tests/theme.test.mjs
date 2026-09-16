/**
 * Uji sanitasi token tema — lib/theme.ts
 * ======================================
 *
 * Fokus: nilai token disuntikkan ke dalam string HTML (<style>), jadi SEMUA
 * nilai harus disanitasi. Sebelumnya `fontHeading`/`fontBody` disisipkan
 * mentah sehingga bisa memutus tag <style>.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  applyThemeToHtml,
  sanitizeThemeTokens,
  safeHex,
  safeFontName,
  safeInt,
  DEFAULT_THEME,
} from "../lib/theme.ts";

const BASE_HTML = "<!DOCTYPE html><html><head></head><body>hi</body></html>";

/** Ambil isi blok <style id="xynn-theme"> dari hasil. */
function themeBlock(html) {
  const m = html.match(/<style id="xynn-theme">([\s\S]*?)<\/style>/);
  return m ? m[1] : "";
}

/* ------------------------------------------------------------------ */
/* sanitizer satuan                                                    */
/* ------------------------------------------------------------------ */

describe("safeHex", () => {
  test("menerima hex yang sah", () => {
    assert.equal(safeHex("#fff"), "#fff");
    assert.equal(safeHex("#4f7cff"), "#4f7cff");
    assert.equal(safeHex("#ABCDEF12"), "#ABCDEF12");
  });

  test("menolak selain hex", () => {
    for (const bad of [
      "red",
      "rgb(1,2,3)",
      "#4f7czz",
      "red} body{background:url(//evil)",
      "#fff; }</style>",
      "",
      123,
      null,
      undefined,
    ]) {
      assert.equal(safeHex(bad), "#000000", `harus menolak: ${String(bad)}`);
    }
  });
});

describe("safeFontName", () => {
  test("menerima nama font yang wajar", () => {
    assert.equal(safeFontName("Geist"), "Geist");
    assert.equal(safeFontName("Playfair Display"), "Playfair Display");
    assert.equal(safeFontName("IBM Plex Sans"), "IBM Plex Sans");
    assert.equal(safeFontName("  Sora  "), "Sora");
  });

  test("menolak nilai yang bisa memutus <style> atau HTML", () => {
    for (const bad of [
      "x'; }</style><script>alert(1)</script>",
      "a\n</style><img src=x onerror=alert(1)>",
      "font:url(javascript:alert(1))",
      "a{b:c}",
      "<script>",
      "",
      42,
      null,
    ]) {
      assert.equal(safeFontName(bad), "Geist", `harus menolak: ${String(bad)}`);
    }
  });
});

describe("safeInt", () => {
  test("membulatkan dan menjepit ke rentang", () => {
    assert.equal(safeInt(16, 8, 48, 16), 16);
    assert.equal(safeInt(99, 8, 48, 16), 48);
    assert.equal(safeInt(-5, 0, 64, 14), 0);
    assert.equal(safeInt(3.7, 0, 64, 14), 4);
  });

  test("mengembalikan fallback untuk nilai tidak masuk akal", () => {
    for (const bad of ["abc", NaN, Infinity, null, undefined, {}]) {
      assert.equal(safeInt(bad, 8, 48, 16), 16, `harus fallback: ${String(bad)}`);
    }
  });
});

/* ------------------------------------------------------------------ */
/* sanitizeThemeTokens                                                 */
/* ------------------------------------------------------------------ */

describe("sanitizeThemeTokens", () => {
  test("mengembalikan bentuk lengkap walau input kosong", () => {
    const t = sanitizeThemeTokens({});
    assert.deepEqual(Object.keys(t).sort(), Object.keys(DEFAULT_THEME).sort());
    assert.equal(t.primary, "#000000");
    assert.equal(t.fontHeading, "Geist");
    assert.equal(t.baseSize, 16);
    assert.equal(t.radius, 14);
  });

  test("input non-objek tetap aman", () => {
    for (const bad of [null, undefined, "x", 42, []]) {
      const t = sanitizeThemeTokens(bad);
      assert.equal(t.primary, "#000000");
      assert.equal(t.fontHeading, "Geist");
    }
  });

  test("membersihkan payload berbahaya di seluruh field", () => {
    const t = sanitizeThemeTokens({
      primary: "</style><script>alert(1)</script>",
      fontHeading: "x'; }</style><script>alert(1)</script>",
      fontBody: "a\n</style><img src=x onerror=alert(1)>",
      baseSize: "abc",
      radius: 99999,
    });
    assert.equal(t.primary, "#000000");
    assert.equal(t.fontHeading, "Geist");
    assert.equal(t.fontBody, "Geist");
    assert.equal(t.baseSize, 16);
    assert.equal(t.radius, 64);
  });
});

/* ------------------------------------------------------------------ */
/* applyThemeToHtml — yang paling penting                              */
/* ------------------------------------------------------------------ */

describe("applyThemeToHtml", () => {
  test("menyuntikkan semua variabel yang diharapkan", () => {
    const out = applyThemeToHtml(BASE_HTML, DEFAULT_THEME);
    const blk = themeBlock(out);
    for (const v of [
      "--color-primary",
      "--color-secondary",
      "--color-accent",
      "--color-surface",
      "--color-text",
      "--color-border",
      "--font-heading",
      "--font-body",
      "--size-base",
      "--radius",
    ]) {
      assert.ok(blk.includes(v), `variabel hilang: ${v}`);
    }
  });

  test("SERVER-TIDAK-PERCAYA: payload font tidak bisa keluar dari <style>", () => {
    const attacks = [
      { fontHeading: "x'; }</style><script>alert(1)</script>" },
      { fontBody: "a</style><script>alert(2)</script>" },
      { fontHeading: "</STYLE><script>alert(3)</script>" },
      { fontBody: "font</style ><img src=x onerror=alert(4)>" },
    ];
    for (const a of attacks) {
      const html = applyThemeToHtml(BASE_HTML, { ...DEFAULT_THEME, ...a });
      assert.ok(
        !/<script>/i.test(html),
        `script lolos: ${JSON.stringify(a)}`
      );
      assert.ok(!/onerror=/i.test(html), `onerror lolos: ${JSON.stringify(a)}`);
      assert.equal(
        (html.match(/<\/style>/gi) || []).length,
        1,
        `jumlah </style> harus 1: ${JSON.stringify(a)}`
      );
    }
  });

  test("payload warna tidak bisa keluar dari <style>", () => {
    const html = applyThemeToHtml(BASE_HTML, {
      ...DEFAULT_THEME,
      primary: "red} body{background:url(//evil)",
    });
    assert.ok(!html.includes("url(//evil)"));
    assert.equal((html.match(/<\/style>/gi) || []).length, 1);
  });

  test("idempoten: menyuntik ulang mengganti blok lama, bukan menumpuk", () => {
    const once = applyThemeToHtml(BASE_HTML, DEFAULT_THEME);
    const twice = applyThemeToHtml(once, { ...DEFAULT_THEME, radius: 4 });
    assert.equal((twice.match(/id="xynn-theme"/g) || []).length, 1);
    assert.ok(themeBlock(twice).includes("--radius:4px"));
  });

  test("HTML tanpa <head> tetap mendapat blok tema", () => {
    const out = applyThemeToHtml("<div>halo</div>", DEFAULT_THEME);
    assert.ok(out.includes('<style id="xynn-theme">'));
  });
});
