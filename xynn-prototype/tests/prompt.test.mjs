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
  buildSingleScreenPrompt,
  replaceScreenInHtml,
  detectScreensFromHtml,
  hasScreenMarkers,
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

/* ------------------------------------------------------------------ */
/* replaceScreenInHtml — paling rawan, bisa merusak dokumen            */
/* ------------------------------------------------------------------ */

describe("replaceScreenInHtml", () => {
  const DOC = [
    "<!DOCTYPE html><html><head><style>.a{}</style></head><body>",
    "<!-- screen: Landing -->",
    '<div id="landing"><h1>Lama</h1></div>',
    "<!-- screen: Dashboard -->",
    '<div id="dash"><h1>Dash</h1></div>',
    "<script>router()</script>",
    "</body></html>",
  ].join("\n");

  test("mengganti isi screen yang diminta", () => {
    const out = replaceScreenInHtml(DOC, "Landing", '<div id="landing"><h1>Baru</h1></div>');
    assert.ok(out, "harus mengembalikan HTML, bukan null");
    assert.ok(out.includes("<h1>Baru</h1>"), "markup baru harus masuk");
    assert.ok(!out.includes("<h1>Lama</h1>"), "markup lama harus hilang");
  });

  test("tidak menyentuh screen lain", () => {
    const out = replaceScreenInHtml(DOC, "Landing", "<div>baru</div>");
    assert.ok(out.includes("<h1>Dash</h1>"), "screen lain harus utuh");
    assert.ok(out.includes("router()"), "script router harus utuh");
    assert.ok(out.includes("<!DOCTYPE html>"), "doctype harus utuh");
  });

  test("mempertahankan penanda screen", () => {
    const out = replaceScreenInHtml(DOC, "Landing", "<div>baru</div>");
    assert.equal((out.match(/<!--\s*screen:/gi) || []).length, 2, "kedua penanda harus tetap ada");
  });

  test("mengganti screen TERAKHIR (tanpa penanda penutup)", () => {
    const out = replaceScreenInHtml(DOC, "Dashboard", "<div>dash baru</div>");
    assert.ok(out.includes("<div>dash baru</div>"));
    assert.ok(out.includes("<h1>Lama</h1>"), "screen sebelumnya tetap utuh");
  });

  test("case-insensitive pada label", () => {
    const out = replaceScreenInHtml(DOC, "landing", "<div>x</div>");
    assert.ok(out);
    assert.ok(out.includes("<div>x</div>"));
  });

  test("label tidak ditemukan -> null (bukan merusak dokumen)", () => {
    const out = replaceScreenInHtml(DOC, "TidakAda", "<div>x</div>");
    assert.equal(out, null);
  });

  test("dokumen tanpa penanda -> null", () => {
    const out = replaceScreenInHtml("<html><body>tanpa penanda</body></html>", "Landing", "<div>x</div>");
    assert.equal(out, null);
  });
});

/* ------------------------------------------------------------------ */
/* hasScreenMarkers & detectScreensFromHtml (cadangan bila AI lupa)    */
/* ------------------------------------------------------------------ */

describe("hasScreenMarkers", () => {
  test("true bila ada penanda", () => {
    assert.equal(hasScreenMarkers("<!-- screen: Landing --><div></div>"), true);
  });
  test("false bila tidak ada", () => {
    assert.equal(hasScreenMarkers("<html><body><div id='x'></div></body></html>"), false);
  });
});

describe("detectScreensFromHtml", () => {
  test("mendeteksi dari id/class berpola screen", () => {
    const html = `
      <div id="screen-landing">a</div>
      <div id="screen-dashboard">b</div>
      <div id="screen-settings">c</div>`;
    const s = detectScreensFromHtml(html);
    const ids = s.map((x) => x.id);
    assert.ok(ids.includes("landing"), `harus menemukan landing, dapat: ${ids}`);
    assert.ok(ids.includes("dashboard"), `harus menemukan dashboard, dapat: ${ids}`);
    assert.ok(s.every((x) => x.label && x.label.length > 0), "label harus terisi");
  });

  test("mendeteksi dari class berpola page/view", () => {
    const html = `<section class="page-checkout"></section><section class="page-cart"></section>`;
    const s = detectScreensFromHtml(html);
    assert.ok(s.length >= 2, `harus menemukan minimal 2, dapat ${s.length}`);
  });

  test("tidak mengembalikan id struktural umum", () => {
    const html = `<div id="app"></div><div id="root"></div><div id="main"></div>`;
    const s = detectScreensFromHtml(html);
    const ids = s.map((x) => x.id);
    assert.ok(!ids.includes("app"), "app bukan screen");
    assert.ok(!ids.includes("root"), "root bukan screen");
  });

  test("dedupe id yang sama", () => {
    const html = `<div id="screen-chat"></div><div id="screen-chat"></div>`;
    const s = detectScreensFromHtml(html);
    assert.equal(s.length, 1);
  });

  test("HTML tanpa kandidat -> array kosong (tidak crash)", () => {
    assert.deepEqual(detectScreensFromHtml("<html><body>halo</body></html>"), []);
  });
});

/* ------------------------------------------------------------------ */
/* buildSingleScreenPrompt — mode hemat (regenerate 1 screen)          */
/* ------------------------------------------------------------------ */

describe("buildSingleScreenPrompt", () => {
  const HTML = `<!DOCTYPE html><html><head><style>:root{--c:#16a34a}.card{padding:8px}</style></head><body>
<!-- screen: Landing --><div class="card">landing</div>
<!-- screen: Dashboard --><div class="card">dash</div>
</body></html>`;

  const CANDIDATE = {
    title: "Aplikasi Uji",
    screenLabel: "Dashboard",
    screenIndex: 1,
    totalScreens: 2,
    currentHtml: HTML,
  };

  test("meminta HANYA markup screen, bukan dokumen utuh", () => {
    const p = buildSingleScreenPrompt(CANDIDATE, LANG);
    assert.ok(/Return ONLY the HTML for the "Dashboard" screen/i.test(p));
    assert.ok(/Do NOT return <!DOCTYPE>/i.test(p));
    assert.ok(/Do NOT include screen markers/i.test(p));
  });

  test("menyebut daftar semua screen sebagai konteks", () => {
    const p = buildSingleScreenPrompt(CANDIDATE, LANG);
    assert.ok(p.includes("Landing, Dashboard"), "daftar screen harus disebut");
  });

  test("menyertakan stylesheet agar kelas bisa dipakai ulang", () => {
    const p = buildSingleScreenPrompt(CANDIDATE, LANG);
    assert.ok(p.includes(".card{padding:8px}"), "style harus disertakan");
    assert.ok(p.includes("--c:#16a34a"));
  });

  test("menyertakan markup screen sasaran saja", () => {
    const p = buildSingleScreenPrompt(CANDIDATE, LANG);
    assert.ok(p.includes(">landing<") || p.includes("dash"), "markup sasaran disertakan");
    // Yang penting: DOKUMEN PENUH tidak dikirim (diminta output bukan dokumen).
    assert.ok(!/=== CURRENT HTML ===/.test(p), "tidak boleh mengirim blok dokumen penuh");
  });

  test("hanya mengirim markup screen SASARAN, bukan semua screen", () => {
    const p = buildSingleScreenPrompt(CANDIDATE, LANG);
    // Blok sasaran memuat "dash"; screen lain ("landing") hanya boleh muncul
    // di daftar label, bukan sebagai markup yang dikirim untuk digantikan.
    const afterHeader = p.split('MARKUP (yang akan digantikan) ===')[1] || "";
    assert.ok(afterHeader.includes("dash"), "markup sasaran harus ada di blok sasaran");
    assert.ok(
      !afterHeader.includes(">landing<"),
      "markup screen lain tidak boleh ikut di blok sasaran"
    );
  });

  test("PROMPT JAUH LEBIH KECIL dari dokumen penuh (tujuan hemat)", () => {
    const p = buildSingleScreenPrompt(CANDIDATE, LANG);
    assert.ok(
      p.length < HTML.length + 2500,
      `prompt (${p.length}) harus mendekati ukuran dokumen (${HTML.length}), bukan berkali-kali lipat`
    );
  });

  test("menyertakan blok tema bila ada", () => {
    const p = buildSingleScreenPrompt({ ...CANDIDATE, theme: THEME }, LANG);
    assert.ok(p.includes("THEME OVERRIDE"));
  });

  test("batasan penting tetap ada", () => {
    const p = buildSingleScreenPrompt(CANDIDATE, LANG);
    assert.ok(/responsive/i.test(p));
    assert.ok(/No emoji as icons/i.test(p));
  });
});
