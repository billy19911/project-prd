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
  test("menyebut peran asisten", () => {
    const p = buildChatSystemPrompt({
      projectContext: null,
      hasPrototype: false,
      languageDirective: LANG,
    });
    assert.ok(/Xynn/i.test(p));
    assert.ok(/product design assistant/i.test(p));
  });

  test("beda arahan saat prototype sudah ada vs belum", () => {
    const belum = buildChatSystemPrompt({
      projectContext: null,
      hasPrototype: false,
      languageDirective: LANG,
    });
    const sudah = buildChatSystemPrompt({
      projectContext: null,
      hasPrototype: true,
      languageDirective: LANG,
    });
    assert.ok(/no prototype yet/i.test(belum));
    assert.ok(/already has a prototype/i.test(sudah));
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
