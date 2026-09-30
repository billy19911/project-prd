import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Guard server-side untuk area terautentikasi.
 *
 * Layout `(main)` & `(admin)` sudah punya guard, tetapi keduanya berjalan
 * di CLIENT (`useSession`) — artinya halaman sempat ter-render (HTTP 200)
 * sebelum JS jalan, lalu baru redirect. Proxy ini memeriksa cookie sesi
 * DI SERVER, sehingga user anonim langsung menerima redirect 307 ke
 * `/login` sebelum halaman apa pun ter-render.
 *
 * Login tetap diarahkan lewat `/post-login` agar role (admin → `/admin`)
 * dan `callbackUrl` ditangani di satu tempat.
 *
 * Catatan: Next.js 16 mengganti konvensi `middleware` menjadi `proxy`.
 * Proxy berjalan di Node.js runtime, jadi `next-auth/jwt` aman dipakai.
 */

// Halaman yang wajib login. Daftar ini HARUS sejalan dengan `config.matcher`
// di bawah — matcher menentukan proxy dipanggil, daftar ini menentukan
// penolakan. `/post-login` sengaja tidak termasuk: ia menangani login-nya
// sendiri dan mengarahkan ke tujuan akhir.
const PROTECTED_PREFIXES = [
  "/admin",
  "/dashboard",
  "/projects",
  "/new-project",
  "/project",
  "/prototype",
  "/templates",
  "/vault",
  "/settings",
  "/chat",
  "/consult",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (!isProtected(pathname)) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (token) return NextResponse.next();

  // Belum login → redirect ke /login, simpan tujuan asli agar bisa kembali
  // ke halaman yang diminta setelah berhasil masuk.
  const callbackUrl = `${pathname}${search}`;
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("callbackUrl", callbackUrl);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Cocokkan hanya area terproteksi (dan lewati aset statis/API).
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/projects/:path*",
    "/new-project/:path*",
    "/project/:path*",
    "/prototype/:path*",
    "/templates/:path*",
    "/vault/:path*",
    "/settings/:path*",
    "/chat/:path*",
    "/consult/:path*",
  ],
};
