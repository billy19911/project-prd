"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, data: session } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      </div>
    );
  }

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        {/*
          Lebar konten ditentukan DI SINI (max-w-6xl) sebagai satu sumber
          kebenaran. Halaman tidak perlu menambah `mx-auto max-w-*` sendiri —
          kecuali alur fokus yang sengaja sempit (mis. wizard `/new-project`,
          `/project/[id]/execute`) atau kartu gate terpusat. Pengecualian itu
          didokumentasikan di file masing-masing.
        */}
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
