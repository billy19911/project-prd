import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import LoginClient from "./login-client";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;
  const intended = params?.callbackUrl;

  // Sudah login? Jangan tampilkan form lagi — arahkan sesuai role/tujuan.
  const session = await getServerSession(authOptions);
  if (session) {
    redirect(
      intended ? `/post-login?to=${encodeURIComponent(intended)}` : "/post-login"
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-muted">Loading...</p>
        </div>
      }
    >
      <LoginClient error={error} intended={intended} />
    </Suspense>
  );
}
