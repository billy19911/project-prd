/**
 * Uji perbandingan node mindmap.
 *
 * Fokus: memutus bug "Maximum update depth exceeded". Sinkronisasi
 * parent↔canvas hanya boleh memicu setState saat data benar-benar berubah;
 * bila perbandingan salah (menganggap selalu berbeda), render berantai tak
 * berujung akan terjadi lagi.
 *
 * Menjalankan: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { sameNodes } from "../lib/mindmap-compare.ts";

const n = (id, label, x, y) => ({ id, data: { label }, position: { x, y } });

describe("sameNodes", () => {
  test("daftar identik → true", () => {
    const a = [n("1", "A", 0, 0), n("2", "B", 10, 20)];
    const b = [n("1", "A", 0, 0), n("2", "B", 10, 20)];
    assert.equal(sameNodes(a, b), true);
  });

  test("dua array kosong → true", () => {
    assert.equal(sameNodes([], []), true);
  });

  test("panjang berbeda → false", () => {
    assert.equal(sameNodes([n("1", "A", 0, 0)], []), false);
  });

  test("label berubah → false", () => {
    assert.equal(
      sameNodes([n("1", "A", 0, 0)], [n("1", "B", 0, 0)]),
      false
    );
  });

  test("posisi berubah → false", () => {
    assert.equal(
      sameNodes([n("1", "A", 0, 0)], [n("1", "A", 5, 0)]),
      false
    );
  });

  test("urutan berbeda → false", () => {
    assert.equal(
      sameNodes([n("1", "A", 0, 0), n("2", "B", 0, 0)], [n("2", "B", 0, 0), n("1", "A", 0, 0)]),
      false
    );
  });

  test("label undefined vs string kosong dianggap sama", () => {
    const a = [{ id: "1" }];
    const b = [{ id: "1", data: { label: "" } }];
    assert.equal(sameNodes(a, b), true);
  });

  test("posisi hilang vs posisi ada → false", () => {
    assert.equal(
      sameNodes([{ id: "1", data: { label: "A" } }], [n("1", "A", 0, 0)]),
      false
    );
  });

  test("referensi array berbeda tapi isi sama → true (kunci anti-loop)", () => {
    // Ini kasus nyata: parent membuat array baru tiap render; perbandingan
    // harus berbasis isi, bukan referensi.
    const a = [n("1", "A", 0, 0)];
    const b = [n("1", "A", 0, 0)];
    assert.notEqual(a, b);
    assert.equal(sameNodes(a, b), true);
  });
});
