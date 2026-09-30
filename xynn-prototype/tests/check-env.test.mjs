/**
 * Uji validator environment (scripts/check-env.mjs).
 * Fokus: fail-fast untuk mode pembayaran non-dummy tanpa kunci, dan pesan
 * akurat untuk kasus AI kosong. Menjalankan: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parseEnv, checkEnv } from "../scripts/check-env.mjs";

const BASE = {
  DATABASE_URL: "postgresql://x",
  NEXTAUTH_URL: "http://localhost:3000",
  NEXTAUTH_SECRET: "secret",
  ENCRYPTION_KEY: "a".repeat(64),
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
  PAYMENT_MODE: "dummy",
  OPENAI_API_KEY: "sk-x",
  AI_MODELS: "m",
};

describe("parseEnv", () => {
  test("mengupas kutip + mengabaikan komentar", () => {
    const env = parseEnv('# komen\nA="1"\nB=\'2\'\nC=3\n');
    assert.deepEqual(env, { A: "1", B: "2", C: "3" });
  });
});

describe("checkEnv", () => {
  test("konfigurasi valid → tanpa error", () => {
    const r = checkEnv({ ...BASE });
    assert.equal(r.errors.length, 0);
  });

  test("ENCRYPTION_KEY bukan 64 hex → error", () => {
    const r = checkEnv({ ...BASE, ENCRYPTION_KEY: '"abc"' });
    assert.ok(r.errors.some((e) => e.includes("ENCRYPTION_KEY")));
  });

  test("midtrans tanpa kunci → error (fail-fast)", () => {
    const r = checkEnv({ ...BASE, PAYMENT_MODE: "midtrans" });
    assert.ok(r.errors.some((e) => e.includes("MIDTRANS_SERVER_KEY")));
    assert.ok(r.errors.some((e) => e.includes("MIDTRANS_CLIENT_KEY")));
  });

  test("midtrans dengan kunci → lolos", () => {
    const r = checkEnv({
      ...BASE,
      PAYMENT_MODE: "midtrans",
      MIDTRANS_SERVER_KEY: "SB-key",
      MIDTRANS_CLIENT_KEY: "SB-key",
    });
    assert.equal(r.errors.length, 0);
  });

  test("xendit tanpa kunci → error", () => {
    const r = checkEnv({ ...BASE, PAYMENT_MODE: "xendit" });
    assert.ok(r.errors.some((e) => e.includes("XENDIT_SECRET_KEY")));
  });

  test("PAYMENT_MODE asing → error", () => {
    const r = checkEnv({ ...BASE, PAYMENT_MODE: "paypal" });
    assert.ok(r.errors.some((e) => e.includes("PAYMENT_MODE")));
  });

  test("tanpa penyedia AI → warning, bukan error", () => {
    const r = checkEnv({ ...BASE, OPENAI_API_KEY: "" });
    assert.equal(r.errors.length, 0);
    assert.ok(r.warnings.some((w) => w.includes("penyedia AI")));
  });

  test("AI_API_KEY tanpa BASE_URL → warning", () => {
    const r = checkEnv({
      ...BASE,
      OPENAI_API_KEY: "",
      AI_API_KEY: "sk-x",
      AI_BASE_URL: "",
    });
    assert.ok(r.warnings.some((w) => w.includes("AI_BASE_URL kosong")));
  });
});
