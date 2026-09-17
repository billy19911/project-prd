/**
 * Uji prompt builder Konsultasi AI.
 *
 * Fokus: transkrip harus dibangun dengan benar (terpotong agar hemat token)
 * dan prompt sistem tetap menyertakan direktif bahasa.
 *
 * Menjalankan: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  buildConsultPrompt,
  buildConsultSystemPrompt,
  deriveConsultTitle,
  CONSULT_HISTORY_LIMIT,
} from "../lib/consult-prompt.ts";

describe("buildConsultPrompt", () => {
  test("riwayat kosong → string kosong (tidak memanggil AI)", () => {
    assert.equal(buildConsultPrompt([]), "");
  });

  test("berisi transkrip Pengguna/Konsultan dan arahan akhir", () => {
    const p = buildConsultPrompt([
      { role: "user", content: "Arsitektur apa yang cocok?" },
      { role: "assistant", content: "Tergantung skala." },
      { role: "user", content: "Skalanya kecil." },
    ]);
    assert.match(p, /Pengguna: Arsitektur apa yang cocok\?/);
    assert.match(p, /Konsultan: Tergantung skala\./);
    assert.match(p, /=== SEKARANG ===/);
  });

  test("hanya menyertakan sejumlah pesan terakhir", () => {
    const many = Array.from({ length: CONSULT_HISTORY_LIMIT + 5 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `pesan-${i}`,
    }));
    const p = buildConsultPrompt(many);
    // Pesan paling awal harus terbuang.
    assert.doesNotMatch(p, /pesan-0\b/);
    // Pesan terakhir harus ada.
    assert.match(p, new RegExp(`pesan-${many.length - 1}\\b`));
  });

  test("pesan sangat panjang dipotong (hemat token)", () => {
    const long = "x".repeat(5000);
    const p = buildConsultPrompt([{ role: "user", content: long }]);
    assert.match(p, /…/);
    assert.ok(p.length < 5000, "prompt harus lebih pendek dari pesan mentah");
  });
});

describe("buildConsultSystemPrompt", () => {
  test("menyertakan direktif bahasa", () => {
    const p = buildConsultSystemPrompt({ languageDirective: "WRITE_IN_EN" });
    assert.match(p, /WRITE_IN_EN/);
  });

  test("menyertakan konteks project bila ada", () => {
    const p = buildConsultSystemPrompt({
      languageDirective: "x",
      projectContext: "Project: Toko Online",
    });
    assert.match(p, /Project: Toko Online/);
  });

  test("menyebut peran konsultan arsitektur", () => {
    const p = buildConsultSystemPrompt({ languageDirective: "x" });
    assert.match(p, /architect|consultant/i);
  });
});

describe("deriveConsultTitle", () => {
  test("memendekkan judul panjang", () => {
    const t = deriveConsultTitle("a".repeat(100));
    assert.ok(t.length <= 60);
  });
  test("pesan kosong → judul default", () => {
    assert.equal(deriveConsultTitle("   "), "Konsultasi baru");
  });
});
