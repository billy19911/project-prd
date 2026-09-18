/**
 * Uji perhitungan masa aktif langganan — lib/plans.ts
 * ===================================================
 *
 * Masa aktif dihitung berbasis KALENDER, bukan fix 30/90/365 hari. Uji ini
 * mengunci perilaku penting:
 *   - penyesuaian bulan tidak "meluber" (31 Jan + 1 bulan = 28/29 Feb),
 *   - tahunan tidak meleset di tahun kabisat (29 Feb + 12 bulan = 28 Feb),
 *   - QUARTERLY = 3 bulan, MONTHLY = 1 bulan.
 *
 * Menjalankan: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { monthsForCycle, addMonths, computeValidUntil } from "../lib/billing.ts";

const d = (y, m, day) => new Date(Date.UTC(y, m - 1, day));

describe("monthsForCycle", () => {
  test("MONTHLY = 1, QUARTERLY = 3, YEARLY = 12", () => {
    assert.equal(monthsForCycle("MONTHLY"), 1);
    assert.equal(monthsForCycle("QUARTERLY"), 3);
    assert.equal(monthsForCycle("YEARLY"), 12);
  });
});

describe("addMonths — penyesuaian kalender (clamp akhir bulan)", () => {
  test("tambah bulan biasa", () => {
    assert.deepEqual(addMonths(d(2026, 1, 15), 1), d(2026, 2, 15));
  });

  test("31 Jan + 1 bulan = 28 Feb (2026 non-kabisat)", () => {
    assert.deepEqual(addMonths(d(2026, 1, 31), 1), d(2026, 2, 28));
  });

  test("31 Jan + 1 bulan = 29 Feb (2028 kabisat)", () => {
    assert.deepEqual(addMonths(d(2028, 1, 31), 1), d(2028, 2, 29));
  });

  test("31 Mar + 1 bulan = 30 Apr (bukan 1 Mei)", () => {
    assert.deepEqual(addMonths(d(2026, 3, 31), 1), d(2026, 4, 30));
  });

  test("31 Des + 1 bulan = 31 Jan tahun berikutnya", () => {
    assert.deepEqual(addMonths(d(2026, 12, 31), 1), d(2027, 1, 31));
  });

  test("29 Feb (kabisat) + 12 bulan = 28 Feb (non-kabisat)", () => {
    assert.deepEqual(addMonths(d(2028, 2, 29), 12), d(2029, 2, 28));
  });

  test("tidak mengubah objek asli", () => {
    const from = d(2026, 1, 31);
    addMonths(from, 1);
    assert.deepEqual(from, d(2026, 1, 31));
  });
});

describe("computeValidUntil — masa aktif per siklus", () => {
  test("MONTHLY menambah 1 bulan", () => {
    assert.deepEqual(computeValidUntil(d(2026, 1, 15), "MONTHLY"), d(2026, 2, 15));
  });

  test("QUARTERLY menambah 3 bulan", () => {
    assert.deepEqual(computeValidUntil(d(2026, 1, 15), "QUARTERLY"), d(2026, 4, 15));
  });

  test("YEARLY menambah 12 bulan (tanggal sama tahun depan)", () => {
    assert.deepEqual(computeValidUntil(d(2026, 6, 10), "YEARLY"), d(2027, 6, 10));
  });

  test("YEARLY dari 29 Feb kabisat = 28 Feb", () => {
    assert.deepEqual(computeValidUntil(d(2028, 2, 29), "YEARLY"), d(2029, 2, 28));
  });

  test("MONTHLY dari 31 Jan = 28/29 Feb (bukan 2/3 Mar)", () => {
    assert.deepEqual(computeValidUntil(d(2026, 1, 31), "MONTHLY"), d(2026, 2, 28));
    assert.deepEqual(computeValidUntil(d(2028, 1, 31), "MONTHLY"), d(2028, 2, 29));
  });
});
