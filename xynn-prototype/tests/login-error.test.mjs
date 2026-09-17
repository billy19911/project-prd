/**
 * Uji pemetaan pesan error login.
 *
 * Fokus: halaman login sebelumnya menampilkan SATU pesan generik
 * ("Google OAuth gagal...") untuk semua error — menyesatkan. Uji ini
 * memastikan tiap kode NextAuth dipetakan ke pesan yang tepat, dan kode
 * tak dikenal tetap punya fallback (tidak pernah kosong).
 *
 * Menjalankan: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { loginErrorInfo } from "../lib/login-error.ts";

describe("loginErrorInfo", () => {
  test("tanpa kode → null (tidak menampilkan pesan)", () => {
    assert.equal(loginErrorInfo(undefined), null);
    assert.equal(loginErrorInfo(null), null);
    assert.equal(loginErrorInfo(""), null);
  });

  test("CredentialsSignin → pesan kredensial, bukan pesan OAuth", () => {
    const info = loginErrorInfo("CredentialsSignin");
    assert.ok(info);
    assert.match(info.message, /login gagal/i);
    assert.doesNotMatch(info.message, /google oauth/i);
  });

  test("OAuthCallback → menyebut callback URL", () => {
    const info = loginErrorInfo("OAuthCallback");
    assert.ok(info);
    assert.match(info.hint ?? "", /callback url/i);
  });

  test("Configuration → ditandai masalah server", () => {
    const info = loginErrorInfo("Configuration");
    assert.ok(info);
    assert.equal(info.serverSide, true);
  });

  test("kode tak dikenal → fallback non-kosong", () => {
    const info = loginErrorInfo("KodeAnehTidakAda");
    assert.ok(info);
    assert.ok(info.message.length > 0);
  });

  test("setiap pesan selalu punya teks (tidak kosong)", () => {
    const codes = [
      "CredentialsSignin",
      "AccessDenied",
      "Configuration",
      "OAuthSignin",
      "OAuthCallback",
      "OAuthCreateAccount",
      "EmailCreateAccount",
      "OAuthAccountNotLinked",
      "Callback",
      "SessionRequired",
      "Verification",
      "ApaKeLainYang",
    ];
    for (const c of codes) {
      const info = loginErrorInfo(c);
      assert.ok(info && info.message.trim().length > 0, `pesan untuk ${c}`);
    }
  });
});
