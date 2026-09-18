export type PaymentMethodId =
  | "qris"
  | "va_bca"
  | "va_bni"
  | "ewallet_gopay"
  | "ewallet_ovo"
  | "ewallet_dana"
  | "midtrans_snap"
  | "gateway";

export type PaymentMethod = {
  id: PaymentMethodId;
  label: string;
  group: "QRIS" | "Virtual Account" | "E-Wallet" | "Gateway";
  desc: string;
  /** Perlu redirect ke gateway eksternal (Midtrans/Xendit). */
  external?: boolean;
};

export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "midtrans_snap",
    label: "Midtrans (Snap)",
    group: "Gateway",
    desc: "Kartu, QRIS, VA, & e-wallet via halaman aman Midtrans.",
    external: true,
  },
  {
    id: "qris",
    label: "QRIS",
    group: "QRIS",
    desc: "Scan QR dari aplikasi bank/e-wallet apa pun.",
  },
  {
    id: "va_bca",
    label: "BCA Virtual Account",
    group: "Virtual Account",
    desc: "Transfer ke nomor VA BCA.",
  },
  {
    id: "va_bni",
    label: "BNI Virtual Account",
    group: "Virtual Account",
    desc: "Transfer ke nomor VA BNI.",
  },
  {
    id: "ewallet_gopay",
    label: "GoPay",
    group: "E-Wallet",
    desc: "Bayar lewat aplikasi Gojek.",
  },
  {
    id: "ewallet_ovo",
    label: "OVO",
    group: "E-Wallet",
    desc: "Bayar lewat aplikasi OVO.",
  },
  {
    id: "ewallet_dana",
    label: "DANA",
    group: "E-Wallet",
    desc: "Bayar lewat aplikasi DANA.",
  },
];

/**
 * Instruksi pembayaran yang digenerate untuk sebuah transaksi.
 * (Simulasi lokal — kode VA/QR asli datang dari gateway saat produksi.)
 */
export type PaymentInstruction = {
  method: PaymentMethodId;
  label: string;
  amount: number;
  expiresAt: string;
  reference: string;
  /** Nomor VA untuk transfer, atau payload QRIS. */
  vaNumber?: string;
  qrString?: string;
  steps: string[];
};

function randomDigits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

export function buildInstruction(
  method: PaymentMethodId,
  amount: number,
  reference: string
): PaymentInstruction {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 jam
  const meta = PAYMENT_METHODS.find((m) => m.id === method);

  if (method === "qris") {
    return {
      method,
      label: "QRIS",
      amount,
      expiresAt,
      reference,
      qrString: `00020101021226${randomDigits(20)}5204000053033605802ID5910XYNN${randomDigits(6)}6007JAKARTA`,
      steps: [
        "Buka aplikasi e-wallet / m-banking Anda.",
        "Pilih menu Bayar / Scan QRIS.",
        "Scan QR yang tampil, lalu konfirmasi nominal.",
      ],
    };
  }

  if (method.startsWith("va_")) {
    const bank = method === "va_bca" ? "BCA" : "BNI";
    const prefix = method === "va_bca" ? "8808" : "8810";
    return {
      method,
      label: `${bank} Virtual Account`,
      amount,
      expiresAt,
      reference,
      vaNumber: `${prefix}${randomDigits(12)}`,
      steps: [
        `Buka aplikasi m-banking ${bank} atau ATM.`,
        `Pilih Transfer > Virtual Account.`,
        "Masukkan nomor VA dan pastikan nominal sesuai.",
        "Selesaikan pembayaran sebelum batas waktu.",
      ],
    };
  }

  // E-wallet
  return {
    method,
    label: meta?.label ?? "E-Wallet",
    amount,
    expiresAt,
    reference,
    steps: [
      `Buka aplikasi ${meta?.label ?? "e-wallet"}.`,
      "Pilih Bayar / Scan.",
      "Masukkan kode referensi atau scan QR yang tampil.",
      "Konfirmasi nominal dan selesaikan pembayaran.",
    ],
  };
}

/**
 * Base URL Midtrans Snap.
 *
 * `isProduction=false` → Sandbox (uang simulasi, bukan uang nyata).
 * `isProduction=true`  → Production (uang nyata).
 *
 * Dipakai `app/api/checkout/route.ts` agar endpoint Snap mengikuti flag
 * `PaymentConfig.isProduction`, tidak lagi hard-code ke production.
 */
export function midtransSnapBaseUrl(isProduction: boolean): string {
  return isProduction
    ? "https://app.midtrans.com/snap/v1"
    : "https://app.sandbox.midtrans.com/snap/v1";
}

/** True bila metode ini menempuh jalur gateway (redirect ke Midtrans). */
export function isGatewayMethod(method: PaymentMethodId): boolean {
  return method === "midtrans_snap" || method === "gateway";
}

/**
 * Base URL API Midtrans (untuk cek status transaksi).
 * Sandbox untuk testing, Production untuk uang nyata.
 */
export function midtransApiBaseUrl(isProduction: boolean): string {
  return isProduction
    ? "https://api.midtrans.com/v2"
    : "https://api.sandbox.midtrans.com/v2";
}
