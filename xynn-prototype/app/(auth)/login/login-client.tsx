"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginErrorInfo, type LoginErrorInfo } from "@/lib/login-error";

export default function LoginClient({
  error,
  intended,
}: {
  error?: string;
  intended?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [demoEmail, setDemoEmail] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [info, setInfo] = useState<LoginErrorInfo | null>(() =>
    loginErrorInfo(error)
  );

  // NextAuth menyamakan "kredensial salah" dan "server tak terjangkau"
  // sebagai `CredentialsSignin`. Bila itu penyebabnya, cek kesehatan DB agar
  // pesannya akurat (bukan menyalahkan input padahal server yang mati).
  useEffect(() => {
    if (error !== "CredentialsSignin") return;
    let active = true;
    fetch("/api/health/db")
      .then((r) => {
        if (!active) return;
        if (r.status === 503) {
          setInfo({
            message: "Server sedang tidak dapat dihubungi.",
            hint: "Database tidak terjangkau. Coba lagi sebentar lagi.",
            serverSide: true,
          });
        }
      })
      .catch(() => {
        /* kegagalan cek kesehatan bukan hal fatal untuk UI */
      });
    return () => {
      active = false;
    };
  }, [error]);

  // Selalu lewat /post-login agar admin diarahkan ke /admin, user ke tujuan.
  const callbackUrl = intended
    ? `/post-login?to=${encodeURIComponent(intended)}`
    : "/post-login";

  const handleGoogle = async () => {
    setLoading(true);
    await signIn("google", { callbackUrl });
  };

  const handleDemo = async () => {
    if (!demoEmail.trim()) return;
    setDemoLoading(true);
    await signIn("credentials", {
      email: demoEmail.trim(),
      callbackUrl,
    });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-96 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo href="/" />
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface/70 p-6 backdrop-blur-sm sm:p-7">
          <h1 className="text-center text-lg font-semibold tracking-tight text-foreground">
            Masuk ke Xynn
          </h1>
          <p className="mt-1 text-center text-sm text-muted">
            Kelola workspace &amp; PRD komunitas Anda.
          </p>

          {info && (
            <div className="mt-5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
              <p className="font-medium">{info.message}</p>
              {info.hint && <p className="mt-1 text-danger/80">{info.hint}</p>}
            </div>
          )}

          <Button
            onClick={handleGoogle}
            disabled={loading}
            variant="secondary"
            size="lg"
            className="mt-6 w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FcGoogle className="h-4 w-4" />
            )}
            {loading ? "Mengalihkan..." : "Sign in with Google"}
          </Button>

          {process.env.NODE_ENV === "development" && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="mb-2 text-xs text-muted">Development demo login</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={demoEmail}
                  onChange={(e) => setDemoEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleDemo()}
                  placeholder="demo@example.com"
                  className="h-9 text-xs"
                />
                <Button
                  onClick={handleDemo}
                  disabled={demoLoading || !demoEmail.trim()}
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                >
                  {demoLoading ? "..." : "Login"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-muted/80">
          Tanpa form pendaftaran manual. Cukup satu akun Google.
        </p>
      </div>
    </div>
  );
}
