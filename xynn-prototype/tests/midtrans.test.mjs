/**
 * Uji helper integrasi Midtrans — lib/midtrans.ts
 * ===============================================
 *
 * Mengunci dua hal yang mudah salah:
 *   1. Signature webhook = SHA512(order_id + status_code + gross_amount + serverKey).
 *      Jika rumus ini salah, SEMUA notifikasi Midtrans ditolak (401) → langganan
 *      tak pernah aktif padahal user sudah bayar.
 *   2. Mapping status: `settlement`/`capture` → SUCCESS, `pending` → PENDING
 *      (jangan menandai gagal), `deny`/`cancel`/`expire` → FAILED.
 *
 * Menjalankan: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  midtransSignatureKey,
  verifyMidtransSignature,
  mapMidtransStatus,
} from "../lib/midtrans.ts";

describe("midtransSignatureKey", () => {
  test("rumus = SHA512(orderId + statusCode + grossAmount + serverKey)", () => {
    const get = {
      orderId: "order-1",
      statusCode: "200",
      grossAmount: "199000.00",
      serverKey: "SB-Mid-server-abc",
    };
    const expected = crypto
      .createHash("sha512")
      .update("order-1200199000.00SB-Mid-server-abc")
      .digest("hex");
    assert.equal(midtransSignatureKey(get), expected);
  });

  test("perubahan satu karakter mengubah hash", () => {
    const a = midtransSignatureKey({
      orderId: "o",
      statusCode: "200",
      grossAmount: "1000.00",
      serverKey: "k",
    });
    const b = midtransSignatureKey({
      orderId: "o",
      statusCode: "201",
      grossAmount: "1000.00",
      serverKey: "k",
    });
    assert.notEqual(a, b);
  });
});

describe("verifyMidtransSignature", () => {
  const base = {
    orderId: "tx-123",
    statusCode: "200",
    grossAmount: "500000.00",
    serverKey: "SB-Mid-server-test",
  };

  test("signature yang benar → true", () => {
    const signatureKey = midtransSignatureKey(base);
    assert.equal(verifyMidtransSignature({ ...base, signatureKey }), true);
  });

  test("signature salah → false", () => {
    assert.equal(
      verifyMidtransSignature({ ...base, signatureKey: "deadbeef" }),
      false
    );
  });

  test("signature kosong → false (bukan throw)", () => {
    assert.equal(verifyMidtransSignature({ ...base, signatureKey: "" }), false);
  });

  test("panjang berbeda → false (bukan throw)", () => {
    assert.equal(
      verifyMidtransSignature({ ...base, signatureKey: "abc" }),
      false
    );
  });
});

describe("mapMidtransStatus", () => {
  test("settlement → SUCCESS", () => {
    assert.equal(mapMidtransStatus("settlement"), "SUCCESS");
  });

  test("capture + fraud accept / tanpa fraud → SUCCESS", () => {
    assert.equal(mapMidtransStatus("capture"), "SUCCESS");
    assert.equal(mapMidtransStatus("capture", "accept"), "SUCCESS");
  });

  test("capture + challenge → PENDING", () => {
    assert.equal(mapMidtransStatus("capture", "challenge"), "PENDING");
  });

  test("capture + deny → FAILED", () => {
    assert.equal(mapMidtransStatus("capture", "deny"), "FAILED");
  });

  test("deny / cancel / expire / failure → FAILED", () => {
    for (const s of ["deny", "cancel", "expire", "failure"]) {
      assert.equal(mapMidtransStatus(s), "FAILED", `${s} harus FAILED`);
    }
  });

  test("pending → PENDING (jangan dianggap gagal)", () => {
    assert.equal(mapMidtransStatus("pending"), "PENDING");
  });

  test("status tak dikenal → PENDING", () => {
    assert.equal(mapMidtransStatus("whatever"), "PENDING");
  });
});
