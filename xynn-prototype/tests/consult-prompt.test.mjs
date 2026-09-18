/**
 * Uji prompt builder Konsultasi AI.
 *
 * Fokus: transkrip harus dibangun dengan benar (terpotong agar hemat token),
 * prompt sistem tetap menyertakan direktif bahasa & instruksi aksi, serta
 * `parseConsultActions` memisahkan blok aksi dari teks dengan benar.
 *
 * Menjalankan: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  buildConsultPrompt,
  buildConsultSystemPrompt,
  deriveConsultTitle,
  parseConsultActions,
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

  test("tanpa project → tidak menawarkan blok aksi", () => {
    const p = buildConsultSystemPrompt({ languageDirective: "x" });
    assert.match(p, /do not emit action blocks/i);
  });

  test("dengan project → menyertakan format aksi & daftar screen", () => {
    const p = buildConsultSystemPrompt({
      languageDirective: "x",
      hasProject: true,
      availableScreens: ["Landing", "Dashboard"],
    });
    assert.match(p, /\[\[ACTION:fix-prd\|/);
    assert.match(p, /Dashboard/);
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

describe("parseConsultActions", () => {
  test("tanpa blok aksi → teks utuh, actions kosong", () => {
    const r = parseConsultActions("Saran saya: pakai PostgreSQL.");
    assert.equal(r.text, "Saran saya: pakai PostgreSQL.");
    assert.deepEqual(r.actions, []);
  });

  test("blok fix-prd dipisah dari teks", () => {
    const raw =
      "Perbaiki alur gagal bayar.\n[[ACTION:fix-prd|User Flows|alur refund belum ada]]";
    const r = parseConsultActions(raw);
    assert.equal(r.actions.length, 1);
    assert.deepEqual(r.actions[0], {
      kind: "fix-prd",
      target: "User Flows",
      reason: "alur refund belum ada",
    });
    assert.ok(!r.text.includes("[[ACTION"), "blok harus dibuang dari teks");
    assert.match(r.text, /Perbaiki alur gagal bayar/);
  });

  test("blok regen-screen dipisah dengan benar", () => {
    const raw =
      "Dashboard perlu ringkasan.\n[[ACTION:regen-screen|Dashboard|statistik belum tampil]]";
    const r = parseConsultActions(raw);
    assert.deepEqual(r.actions[0], {
      kind: "regen-screen",
      target: "Dashboard",
      reason: "statistik belum tampil",
    });
  });

  test("reason kosong tetap valid", () => {
    const r = parseConsultActions("[[ACTION:fix-prd|Data Model|]]");
    assert.equal(r.actions.length, 1);
    assert.equal(r.actions[0].target, "Data Model");
    assert.equal(r.actions[0].reason, "");
  });

  test("kind tak dikenal diabaikan", () => {
    const r = parseConsultActions("[[ACTION:delete-everything|X|y]]");
    assert.deepEqual(r.actions, []);
  });

  test("dua blok terbaca berurutan", () => {
    const raw =
      "A\n[[ACTION:fix-prd|Data Model|a]]\nB\n[[ACTION:regen-screen|Login|b]]";
    const r = parseConsultActions(raw);
    assert.equal(r.actions.length, 2);
    assert.equal(r.actions[0].kind, "fix-prd");
    assert.equal(r.actions[1].kind, "regen-screen");
  });

  test("input kosong/null aman", () => {
    assert.deepEqual(parseConsultActions("").actions, []);
    assert.deepEqual(parseConsultActions(null).actions, []);
  });
});
