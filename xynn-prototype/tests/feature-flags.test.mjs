/**
 * Uji logika flag rilis fitur.
 * ============================
 *
 * Fokus: keputusan yang menentukan apakah fitur boleh diakses (LIVE),
 * ditampilkan "Segera Hadir" (SOON), atau disembunyikan (HIDDEN). Salah di
 * sini berarti fitur yang belum siap bisa bocor ke pengguna — atau fitur
 * yang sudah siap malah terkunci.
 *
 * Menjalankan: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  FEATURE_KEYS,
  FEATURE_DEFS,
  isFeatureKey,
  featureByPath,
  isAccessible,
  isVisibleInNav,
} from "../lib/feature-flags-core.ts";

describe("isFeatureKey", () => {
  test("kunci dikenal → true", () => {
    for (const k of FEATURE_KEYS) assert.equal(isFeatureKey(k), true);
  });
  test("kunci tak dikenal → false", () => {
    assert.equal(isFeatureKey("nope"), false);
    assert.equal(isFeatureKey(""), false);
  });
});

describe("isAccessible (hanya LIVE)", () => {
  test("LIVE boleh diakses", () => assert.equal(isAccessible("LIVE"), true));
  test("SOON & HIDDEN tidak boleh", () => {
    assert.equal(isAccessible("SOON"), false);
    assert.equal(isAccessible("HIDDEN"), false);
  });
});

describe("isVisibleInNav", () => {
  test("LIVE & SOON tampil di navigasi", () => {
    assert.equal(isVisibleInNav("LIVE"), true);
    assert.equal(isVisibleInNav("SOON"), true);
  });
  test("HIDDEN tidak tampil", () => {
    assert.equal(isVisibleInNav("HIDDEN"), false);
  });
});

describe("featureByPath", () => {
  test("memetakan rute ke fitur", () => {
    assert.equal(featureByPath("/consult")?.key, "consult");
    assert.equal(featureByPath("/chat")?.key, "chat");
    assert.equal(featureByPath("/consult/abc")?.key, "consult");
  });
  test("rute tak terkait → undefined", () => {
    assert.equal(featureByPath("/dashboard"), undefined);
  });
});

describe("FEATURE_DEFS konsisten", () => {
  test("setiap kunci punya definisi", () => {
    for (const k of FEATURE_KEYS) {
      assert.ok(
        FEATURE_DEFS.some((d) => d.key === k),
        `definisi untuk ${k} harus ada`
      );
    }
  });
  test("default bukan LIVE (fitur baru harus dikunci dulu)", () => {
    for (const d of FEATURE_DEFS) {
      assert.notEqual(d.defaultStatus, "LIVE", `${d.key} default tidak boleh LIVE`);
    }
  });
});
