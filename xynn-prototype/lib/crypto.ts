import crypto from "crypto";

/**
 * AES-256-GCM Encryption untuk field sensitif (PRD §8).
 * Format keluaran: `iv:authTag:cipherText` (semua hex).
 * Master key diambil dari env `ENCRYPTION_KEY` (32 byte / 64 char hex).
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV sesuai rekomendasi GCM

function getMasterKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;

  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY belum di-set. Generate dengan: openssl rand -hex 32"
    );
  }

  // Terima baik hex (64 char) maupun passphrase apa pun (di-derive jadi 32 byte).
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(plainText: string): string {
  if (!plainText) return "";

  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  if (!payload) return "";

  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Format ciphertext tidak valid");
  }

  const [ivHex, tagHex, dataHex] = parts;
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Cek apakah string terlihat seperti hasil encryptSecret().
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]*$/i.test(value);
}
