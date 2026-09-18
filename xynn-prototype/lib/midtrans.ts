/**
 * Helper integrasi Midtrans — murni (tanpa dependensi DB/Next) agar mudah diuji.
 *
 * Fokus:
 *   - Verifikasi signature notifikasi/webhook Midtrans.
 *   - Normalisasi `transaction_status` Midtrans → keputusan sukses/gagal/pending.
 *
 * Referensi format notifikasi Midtrans:
 *   signature_key = SHA512(order_id + status_code + gross_amount + server_key)
 */

import crypto from "crypto";

export type MidtransTransactionStatus =
  | "capture"
  | "settlement"
  | "pending"
  | "deny"
  | "cancel"
  | "expire"
  | "refund"
  | "partial_refund"
  | "failure"
  | string;

/**
 * Hitung signature_key Midtrans dari komponen notifikasi.
 * `gross_amount` dipakai apa adanya (Midtrans mengirim string, mis. "199000.00").
 */
export function midtransSignatureKey(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey: string;
}): string {
  return crypto
    .createHash("sha512")
    .update(
      `${input.orderId}${input.statusCode}${input.grossAmount}${input.serverKey}`
    )
    .digest("hex");
}

/**
 * Bandingkan signature dengan aman (timing-safe).
 * Panjang berbeda → false (menghindari throw dari timingSafeEqual).
 */
export function verifyMidtransSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey: string;
  signatureKey: string;
}): boolean {
  const expected = midtransSignatureKey(input);
  const a = Buffer.from(expected);
  const b = Buffer.from(input.signatureKey || "");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export type PaymentOutcome = "SUCCESS" | "FAILED" | "PENDING";/**
 * Petakan `transaction_status` (+ `fraud_status`) Midtrans ke keputusan kita.
 *
 * - `settlement` / `capture`(accept) → SUCCESS
 * - `capture` tapi fraud `challenge`/`deny` → PENDING/FAILED
 * - `deny` / `cancel` / `expire` / `failure` → FAILED
 * - `pending` / lainnya → PENDING (jangan ubah status apa pun)
 */
export function mapMidtransStatus(
  transactionStatus: MidtransTransactionStatus,
  fraudStatus?: string
): PaymentOutcome {
  switch (transactionStatus) {
    case "capture":
      // Kartu kredit: capture perlu cek fraud.
      if (fraudStatus === "challenge") return "PENDING";
      if (fraudStatus === "deny") return "FAILED";
      return "SUCCESS";
    case "settlement":
      return "SUCCESS";
    case "deny":
    case "cancel":
    case "expire":
    case "failure":
      return "FAILED";
    case "pending":
      return "PENDING";
    default:
      return "PENDING";
  }
}
