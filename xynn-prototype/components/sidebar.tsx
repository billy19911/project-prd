"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LayoutDashboard, Sparkles, Search, Settings, LogOut, Menu, X, Shield, MonitorSmartphone, MessageSquare, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Bikin Project", icon: Sparkles },
  { href: "/templates", label: "Template PRD", icon: LayoutTemplate },
  { href: "/prototype", label: "Prototype", icon: MonitorSmartphone },
  { href: "/chat", label: "Chat Prototype", icon: MessageSquare },
  { href: "/vault", label: "Gudang PRD", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";

  const items = isAdmin
    ? [...nav, { href: "/admin", label: "Admin", icon: Shield }]
    : nav;

  return (
    <nav className="flex-1 space-y-0.5 px-2 py-3">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
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

function AccountFooter() {
  const { data: session } = useSession();
  const name = session?.user?.name || session?.user?.email || "Pengguna";

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium text-muted">
          {name.slice(0, 1).toUpperCase()}
        </div>
        <p className="min-w-0 flex-1 truncate text-sm text-foreground">{name}</p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Sign out"
          title="Sign out"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border lg:flex">
        <div className="flex h-14 items-center px-5">
          <Logo />
        </div>
        <NavLinks />
        <AccountFooter />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button
          aria-label="Buka menu"
          onClick={() => setOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[80vw] flex-col border-r border-border bg-background">
            <div className="flex h-14 items-center justify-between px-5">
              <Logo />
              <button
                aria-label="Tutup menu"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <AccountFooter />
          </div>
        </div>
      )}
    </>
  );
}
