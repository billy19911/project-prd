#!/usr/bin/env node
/**
 * Validasi environment — MURNI (tanpa dependensi) supaya bisa dijalankan
 * cepat sebelum dev/build maupun di CI.
 *
 *   node scripts/check-env.mjs          -> cek .env di root proyek
 *   node scripts/check-env.mjs --strict -> gagalkan jika ada warning
 *
 * Aturan:
 *  - WAJIB SELALU: DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, ENCRYPTION_KEY
 *    (ENCRYPTION_KEY = tepat 64 hex char = AES-256).
 *  - PAYMENT_MODE=dummy           : gateway key boleh kosong.
 *  - PAYMENT_MODE=midtrans        : MIDTRANS_SERVER_KEY + CLIENT wajib.
 *  - PAYMENT_MODE=xendit          : XENDIT_SECRET_KEY wajib.
 *  - AI: minimal SATU penyedia terisi — OPENAI_API_KEY, ANTHROPIC_API_KEY,
 *    atau (AI_BASE_URL + AI_API_KEY). Bila kosong semua = warning (fitur AI
 *    dimatikan tapi server tetap jalan), kecuali --strict.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict");
const envPath = process.env.ENV_FILE || path.join(root, ".env");

export function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Kupas kutip sepasang bila ada.
    if (
      val.length >= 2 &&
      ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'")))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const PLACEHOLDER = [/^your[-_]/i, /^0{32,}$/, /^change[-_ ]?me/i, /^\.\.\.$/];
function isBlank(v) {
  return !v || !v.trim() || PLACEHOLDER.some((re) => re.test(v.trim()));
}

export function checkEnv(env) {
  const errors = [];
  const warnings = [];
  const mode = (env.PAYMENT_MODE || "dummy").trim().toLowerCase();

  for (const k of ["DATABASE_URL", "NEXTAUTH_URL", "NEXTAUTH_SECRET"]) {
    if (isBlank(env[k])) errors.push(`${k} wajib diisi.`);
  }

  const enc = (env.ENCRYPTION_KEY || "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(enc)) {
    errors.push("ENCRYPTION_KEY wajib 64 karakter hex (AES-256). Generate: openssl rand -hex 32");
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    warnings.push("GOOGLE_CLIENT_ID/SECRET kosong — login Google nonaktif, tersedia demo login (dev).");
  }

  if (mode === "midtrans") {
    if (isBlank(env.MIDTRANS_SERVER_KEY)) errors.push("MIDTRANS_SERVER_KEY wajib untuk PAYMENT_MODE=midtrans.");
    if (isBlank(env.MIDTRANS_CLIENT_KEY)) errors.push("MIDTRANS_CLIENT_KEY wajib untuk PAYMENT_MODE=midtrans.");
  } else if (mode === "xendit") {
    if (isBlank(env.XENDIT_SECRET_KEY)) errors.push("XENDIT_SECRET_KEY wajib untuk PAYMENT_MODE=xendit.");
  } else if (mode !== "dummy") {
    errors.push(`PAYMENT_MODE tidak dikenal: "${mode}". Gunakan: dummy | midtrans | xendit.`);
  }

  const hasOpenAI = !isBlank(env.OPENAI_API_KEY);
  const hasAnthropic = !isBlank(env.ANTHROPIC_API_KEY);
  const hasGateway = !isBlank(env.AI_BASE_URL) && !isBlank(env.AI_API_KEY);
  if (!hasOpenAI && !hasAnthropic && !hasGateway) {
    warnings.push("Tidak ada penyedia AI terisi (OPENAI / ANTHROPIC / AI_BASE_URL+AI_API_KEY) — fitur generate dimatikan.");
  }
  if (!isBlank(env.AI_API_KEY) && isBlank(env.AI_BASE_URL)) {
    warnings.push("AI_API_KEY terisi tapi AI_BASE_URL kosong — gateway tidak akan dipakai.");
  }
  if (!env.AI_MODELS) {
    warnings.push("AI_MODELS kosong — memakai model default bawaan kode.");
  }

  return { errors, warnings, mode };
}

export function formatReport({ errors, warnings, mode }) {
  const lines = [`PAYMENT_MODE=${mode}`];
  for (const e of errors) lines.push(`ERROR: ${e}`);
  for (const w of warnings) lines.push(`WARN: ${w}`);
  if (errors.length === 0 && warnings.length === 0) lines.push("OK — semua variabel valid.");
  return lines.join("\n");
}

// CLI entry — dilewati saat diimpor oleh test.
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (!existsSync(envPath)) {
    console.error(`✗ .env tidak ditemukan di ${envPath}. Salin dari .env.example dulu.`);
    process.exit(1);
  }
  const result = checkEnv(parseEnv(readFileSync(envPath, "utf8")));
  console.log(formatReport(result));
  if (result.errors.length > 0) process.exit(1);
  if (strict && result.warnings.length > 0) process.exit(2);
}
