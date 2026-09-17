/**
 * Pemetaan kode error NextAuth → pesan yang akurat & ramah pengguna.
 *
 * MURNI (tanpa dependensi) supaya bisa diuji tanpa DB maupun browser.
 *
 * Sebelumnya halaman login menampilkan satu pesan generik untuk SEMUA error
 * ("Google OAuth gagal...") — menyesatkan bila penyebabnya bukan konfigurasi
 * OAuth (mis. kredensial salah, akses ditolak, atau server tak terjangkau).
 */

export type LoginErrorInfo = {
  message: string;
  /** Saran tindakan (opsional). */
  hint?: string;
  /** true bila kemungkinan besar masalah di sisi server, bukan input user. */
  serverSide: boolean;
};

const UNKNOWN: LoginErrorInfo = {
  message: "Gagal masuk. Silakan coba lagi.",
  serverSide: false,
};

const MAP: Record<string, LoginErrorInfo> = {
  CredentialsSignin: {
    message: "Login gagal. Periksa kembali email/akun Anda.",
    hint: "Bila ini bukan kesalahan input, kemungkinan server sedang bermasalah — coba lagi sebentar.",
    serverSide: false,
  },
  AccessDenied: {
    message: "Akses ditolak.",
    hint: "Akun ini tidak diizinkan masuk.",
    serverSide: false,
  },
  Configuration: {
    message: "Login belum dikonfigurasi dengan benar.",
    hint: "Hubungi admin: kredensial penyedia login tidak lengkap.",
    serverSide: true,
  },
  OAuthSignin: {
    message: "Tidak bisa memulai proses masuk dengan Google.",
    hint: "Coba lagi; bila berulang, periksa konfigurasi OAuth.",
    serverSide: true,
  },
  OAuthCallback: {
    message: "Google menolak proses masuk.",
    hint: "Pastikan callback URL sudah terdaftar di Google Cloud Console.",
    serverSide: true,
  },
  OAuthCreateAccount: {
    message: "Gagal membuat akun dari Google.",
    hint: "Coba lagi sebentar lagi.",
    serverSide: true,
  },
  EmailCreateAccount: {
    message: "Gagal membuat akun.",
    hint: "Coba lagi sebentar lagi.",
    serverSide: true,
  },
  OAuthAccountNotLinked: {
    message: "Email ini sudah terdaftar dengan cara masuk lain.",
    hint: "Gunakan metode masuk yang sama seperti sebelumnya.",
    serverSide: false,
  },
  Callback: {
    message: "Terjadi kesalahan saat memproses login.",
    hint: "Coba lagi sebentar lagi.",
    serverSide: true,
  },
  SessionRequired: {
    message: "Anda perlu masuk terlebih dahulu.",
    serverSide: false,
  },
  Verification: {
    message: "Tautan verifikasi tidak valid atau sudah kedaluwarsa.",
    serverSide: false,
  },
};

/** Terjemahkan kode error NextAuth menjadi pesan yang akurat. */
export function loginErrorInfo(code: string | undefined | null): LoginErrorInfo | null {
  if (!code) return null;
  return MAP[code] ?? UNKNOWN;
}
