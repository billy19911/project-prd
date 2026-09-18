/**
 * Uji prompt builder Chat Prototype — lib/chat-prompt.ts
 * =====================================================
 *
 * Fokus: riwayat panjang tidak boleh membengkakkan biaya (ada batas jumlah
 * pesan & panjang tiap pesan), dan batas itu benar-benar bekerja.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  buildChatPrompt,
  buildChatSystemPrompt,
  buildPrdFromChatPrompt,
  deriveThreadTitle,
  CHAT_HISTORY_LIMIT,
} from "../lib/chat-prompt.ts";

const LANG = "Write in Indonesian.";

describe("buildChatPrompt", () => {
  test("riwayat kosong -> string kosong", () => {
    assert.equal(buildChatPrompt([]), "");
  });

  test("menyertakan pesan user dan assistant", () => {
    const p = buildChatPrompt([
      { role: "user", content: "Saya mau app kasir" },
      { role: "assistant", content: "Baik, fitur apa saja?" },
      { role: "user", content: "Ada laporan harian" },
    ]);
    assert.ok(p.includes("User: Saya mau app kasir"));
    assert.ok(p.includes("Assistant: Baik, fitur apa saja?"));
    assert.ok(p.includes("User: Ada laporan harian"));
  });

  test("meminta balasan TANPA prefix 'Assistant:'", () => {
    const p = buildChatPrompt([{ role: "user", content: "halo" }]);
    assert.ok(/Do not prefix it with 'Assistant:'/i.test(p));
  });

  test("MEMOTONG riwayat panjang ke CHAT_HISTORY_LIMIT pesan", () => {
    const history = Array.from({ length: CHAT_HISTORY_LIMIT + 20 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `pesan-${i}`,
    }));
    const p = buildChatPrompt(history);
    // Pesan paling lama harus TERBUANG.
    assert.ok(!p.includes("pesan-0"), "pesan tertua harus dibuang");
    assert.ok(p.includes(`pesan-${history.length - 1}`), "pesan terbaru harus ada");
  });

  test("memotong pesan yang sangat panjang (hemat token)", () => {
    const long = "x".repeat(10000);
    const p = buildChatPrompt([{ role: "user", content: long }]);
    assert.ok(p.length < 5000, `prompt harus dipotong, panjang: ${p.length}`);
    assert.ok(p.includes("…"), "harus ada penanda dipotong");
  });

  test("percakapan normal TIDAK dipotong", () => {
    const p = buildChatPrompt([{ role: "user", content: "pesan pendek" }]);
    assert.ok(!p.includes("…"));
  });
});

describe("buildChatSystemPrompt", () => {
  test("menyebut peran analis produk", () => {
    const p = buildChatSystemPrompt({
      projectContext: null,
      hasPrototype: false,
      languageDirective: LANG,
    });
    assert.ok(/Xynn/i.test(p));
    assert.ok(/product analyst/i.test(p));
    // Konsep baru: mempertajam workflow & menyimpulkan PRD.
    assert.ok(/workflow/i.test(p));
    assert.ok(/PRD/.test(p));
  });

  test("beda arahan saat project sudah ada vs belum", () => {
    const belum = buildChatSystemPrompt({
      projectContext: null,
      hasPrototype: false,
      hasProject: false,
      languageDirective: LANG,
    });
    const sudah = buildChatSystemPrompt({
      projectContext: null,
      hasPrototype: false,
      hasProject: true,
      languageDirective: LANG,
    });
    assert.ok(/No project exists yet/i.test(belum));
    assert.ok(/already exists/i.test(sudah));
  });

  test("menyertakan konteks project bila ada, dan memotongnya", () => {
    const p = buildChatSystemPrompt({
      projectContext: "x".repeat(10000),
      hasPrototype: false,
      languageDirective: LANG,
    });
    assert.ok(p.includes("PROJECT CONTEXT"));
    assert.ok(p.length < 6000, "konteks harus dipotong");
  });

  test("tidak menyertakan blok konteks bila tidak ada", () => {
    const p = buildChatSystemPrompt({
      projectContext: null,
      hasPrototype: false,
      languageDirective: LANG,
    });
    assert.ok(!p.includes("PROJECT CONTEXT"));
  });

  test("melarang output HTML kecuali diminta", () => {
    const p = buildChatSystemPrompt({
      projectContext: null,
      hasPrototype: false,
      languageDirective: LANG,
    });
    assert.ok(/Do not output HTML unless/i.test(p));
  });
});

describe("buildPrdFromChatPrompt", () => {
  test("menyertakan transkrip & daftar 12 seksi", () => {
    const p = buildPrdFromChatPrompt([
      { role: "user", content: "Aplikasi kasir warung" },
      { role: "assistant", content: "Fitur apa saja?" },
    ]);
    assert.match(p, /Aplikasi kasir warung/);
    assert.match(p, /Executive Summary/);
    assert.match(p, /Risks & Open Questions/);
  });

  test("riwayat kosong tetap menghasilkan prompt", () => {
    const p = buildPrdFromChatPrompt([]);
    assert.ok(typeof p === "string" && p.length > 0);
  });
});

describe("deriveThreadTitle", () => {
  test("memakai pesan pertama sebagai judul", () => {
    assert.equal(deriveThreadTitle("Aplikasi kasir"), "Aplikasi kasir");
  });

  test("merapikan spasi berlebih", () => {
    assert.equal(deriveThreadTitle("  halo    dunia  "), "halo dunia");
  });

  test("memotong judul yang terlalu panjang", () => {
    const t = deriveThreadTitle("x".repeat(200));
    assert.ok(t.length <= 60, `judul terlalu panjang: ${t.length}`);
    assert.ok(t.endsWith("..."));
  });

  test("pesan kosong -> judul default", () => {
    assert.equal(deriveThreadTitle("   "), "Percakapan baru");
  });
});
