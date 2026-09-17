/**
 * Uji ekstraksi token tema dari Style Guide.
 *
 * Fokus: tema prototype harus KONSISTEN dengan Style Guide (satu sumber),
 * bukan warna acak. Fungsi-fungsi ini menjembatani style guide → token tema
 * dan dipakai untuk Reset serta fallback tema prototype.
 *
 * Menjalankan: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  extractHexColors,
  extractFontNames,
  themeFromStyleGuide,
  DEFAULT_THEME,
} from "../lib/theme.ts";

describe("extractHexColors", () => {
  test("mengambil hex 3 & 6 digit, tanpa duplikat, huruf kecil", () => {
    const md = "Primary #4F7CFF, accent #F80, lagi #4f7cff (duplikat)";
    assert.deepEqual(extractHexColors(md), ["#4f7cff", "#f80"]);
  });
  test("teks tanpa hex → array kosong", () => {
    assert.deepEqual(extractHexColors("tidak ada warna"), []);
  });
});

describe("extractFontNames", () => {
  test("mengenali font populer", () => {
    const fonts = extractFontNames("Heading: Inter, Body: Poppins");
    assert.ok(fonts.includes("Inter"));
    assert.ok(fonts.includes("Poppins"));
  });
  test("tanpa font dikenal → array kosong", () => {
    assert.deepEqual(extractFontNames("pakai font ajaib"), []);
  });
});

describe("themeFromStyleGuide", () => {
  test("style guide kosong → kembalikan base (DEFAULT_THEME)", () => {
    assert.deepEqual(themeFromStyleGuide(""), { ...DEFAULT_THEME });
    assert.deepEqual(themeFromStyleGuide(null), { ...DEFAULT_THEME });
  });

  test("token warna diambil dari style guide (bukan default)", () => {
    const md = `
      ## Colors
      - Primary: #ff0000
      - Accent: #00ff00
      - Background: #101010
    `;
    const t = themeFromStyleGuide(md);
    assert.equal(t.primary, "#ff0000");
    assert.equal(t.accent, "#00ff00");
    assert.equal(t.surface, "#101010");
  });

  test("font heading & body terambil", () => {
    const md = "Tipografi: Heading pakai Inter, body pakai Poppins.";
    const t = themeFromStyleGuide(md);
    assert.equal(t.fontHeading, "Inter");
    assert.equal(t.fontBody, "Poppins");
  });

  test("radius diambil bila ada 'radius: Npx'", () => {
    const md = "Shape: radius: 6px untuk kartu.";
    assert.equal(themeFromStyleGuide(md).radius, 6);
  });

  test("nilai tetap tervalidasi (tidak menghasilkan hex invalid)", () => {
    // Tanpa hex sama sekali → semua warna jatuh ke base yang valid.
    const t = themeFromStyleGuide("Style guide tanpa warna.");
    for (const key of ["primary", "secondary", "accent", "surface", "text", "border"]) {
      assert.match(t[key], /^#[0-9a-f]{6}$/i, `${key} harus hex valid`);
    }
  });

  test("tabel skala numerik: ambil warna dari KOLOM PERAN, bukan hex pertama", () => {
    // Skenario nyata: style guide memakai brand-500 untuk tombol primer,
    // brand-50 hanya highlight. Parser harus memilih brand-500.
    const md = `
      ## Palet Warna
      | Token | Hex | Penggunaan |
      |---|---|---|
      | brand-50 | #EFF6FF | Background highlight, selected row |
      | brand-500 | #3B82F6 | Tombol primer, link, fokus ring |
      | gray-900 | #111827 | Teks utama |
      | gray-200 | #E5E7EB | Border |
    `;
    const t = themeFromStyleGuide(md);
    assert.equal(t.primary, "#3b82f6", "primary harus brand-500");
    assert.equal(t.text, "#111827", "text harus gray-900");
    assert.equal(t.border, "#e5e7eb", "border harus gray-200");
  });

  test("token CSS bernama (--accent) dikenali", () => {
    const md = "| `--accent` | `#2563EB` | Tombol operator |";
    assert.equal(themeFromStyleGuide(md).accent, "#2563eb");
  });
});
