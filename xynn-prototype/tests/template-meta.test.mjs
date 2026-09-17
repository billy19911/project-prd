/**
 * Uji metadata template (pemetaan ikon & label kategori).
 *
 * Fokus: data template di DB menyimpan NAMA ikon & kategori mentah (string).
 * Bila pemetaannya salah, kartu template kehilangan ikon atau menampilkan
 * kategori mentah ("saas" alih-alih "SaaS").
 *
 * Menjalankan: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { templateIcon, categoryLabel } from "../lib/template-meta.ts";

describe("templateIcon", () => {
  test("nama ikon yang dikenal mengembalikan komponen (fungsi/objek)", () => {
    for (const name of ["Sparkles", "Building2", "ShoppingCart", "Smartphone"]) {
      const Icon = templateIcon(name);
      assert.ok(Icon, `ikon ${name} harus ditemukan`);
      assert.notEqual(Icon, undefined);
    }
  });

  test("nama ikon tak dikenal jatuh ke fallback (tidak pernah undefined)", () => {
    const Icon = templateIcon("IkonYangTidakAda");
    assert.notEqual(Icon, undefined);
  });

  test("string kosong tetap mengembalikan fallback", () => {
    assert.notEqual(templateIcon(""), undefined);
  });
});

describe("categoryLabel", () => {
  test("kategori dikenal diterjemahkan ramah", () => {
    assert.equal(categoryLabel("saas"), "SaaS");
    assert.equal(categoryLabel("ecommerce"), "E-commerce");
    assert.equal(categoryLabel("mobile"), "Mobile");
    assert.equal(categoryLabel("internal"), "Internal");
  });

  test("kategori tak dikenal dikembalikan apa adanya (tidak kosong)", () => {
    assert.equal(categoryLabel("fintech"), "fintech");
  });
});
