"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  CreditCard,
  Users,
  Ticket,
  Shield,
  Menu,
  X,
  Command,
  Layers,
  ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/ai-config", label: "AI Config", icon: Sparkles },
  { href: "/admin/plans", label: "Paket & Harga", icon: Layers },
  { href: "/admin/features", label: "Fitur", icon: ToggleRight },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/vouchers", label: "Vouchers", icon: Ticket },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-0.5 px-2 py-3">
      {nav.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active ? "text-foreground" : "text-muted hover:text-foreground"
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
            )}
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

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

  if ((session.user as { role?: string })?.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <Shield className="h-8 w-8 text-muted" />
        <div>
          <p className="text-sm font-medium text-foreground">Akses ditolak</p>
          <p className="mt-1 max-w-sm text-xs text-muted">
            Akun Anda tidak memiliki hak admin. Pastikan email Anda terdaftar di{" "}
            <code className="text-foreground">ADMIN_EMAILS</code>, lalu login ulang.
          </p>
        </div>
        <Link href="/dashboard" className={buttonClasses({ variant: "secondary", size: "sm" })}>
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <CommandPalette />

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface/40 lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Shield className="h-5 w-5 text-accent" />
          <span className="font-semibold text-foreground">Admin</span>
        </div>
        <NavLinks />
        <div className="space-y-2 border-t border-border p-3">
          <button
            onClick={() => window.dispatchEvent(new Event("xynn:open-command"))}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-[11px] text-muted transition-colors hover:border-border-strong hover:text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <Command className="h-3 w-3" />
              Command
            </span>
            <kbd className="rounded border border-border-strong bg-background px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            ← Ke Dashboard
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-accent" />
          <span className="font-semibold text-foreground">Admin</span>
        </div>
        <button
          aria-label="Buka menu"
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col border-r border-border bg-background">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-accent" />
                <span className="font-semibold text-foreground">Admin</span>
              </div>
              <button
                aria-label="Tutup menu"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="border-t border-border p-3">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground"
              >
                ← Ke Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
