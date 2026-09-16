"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  CreditCard,
  Users,
  Ticket,
  Search,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Command = {
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const COMMANDS: Command[] = [
  { id: "dashboard", label: "Dashboard Admin", hint: "AI Cost & Margin", href: "/admin", icon: LayoutDashboard },
  { id: "ai-config", label: "AI Config & Sandbox", hint: "System Prompt", href: "/admin/ai-config", icon: Sparkles },
  { id: "plans", label: "Paket & Harga", hint: "Atur harga SaaS & diskon", href: "/admin/plans", icon: CreditCard },
  { id: "payments", label: "Payment Gateways", hint: "Midtrans / Xendit", href: "/admin/payments", icon: CreditCard },
  { id: "users", label: "Cari / Kelola User", hint: "User Command Center", href: "/admin/users", icon: Users },
  { id: "vouchers", label: "Kelola Voucher", hint: "Kupon diskon", href: "/admin/vouchers", icon: Ticket },
];

/**
 * Command Palette (Cmd/Ctrl + K) — PRD §7B.
 * Navigasi cepat ke modul admin.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    // Buka juga saat dipicu dari tombol (custom event).
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("xynn:open-command", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("xynn:open-command", onOpenEvent);
    };
  }, []);

  const filtered = useMemo(
    () =>
      COMMANDS.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.hint.toLowerCase().includes(query.toLowerCase())
      ),
    [query]
  );

  const run = (cmd: Command) => {
    router.push(cmd.href);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      run(filtered[activeIndex]);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-[15vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Cari modul, buka konfigurasi..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
          />
          <kbd className="rounded border border-border-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
            ESC
          </kbd>
        </div>

        <ul className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted">
              Tidak ada perintah.
            </li>
          )}
          {filtered.map((cmd, i) => {
            const Icon = cmd.icon;
            return (
              <li key={cmd.id}>
                <button
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => run(cmd)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    i === activeIndex ? "bg-surface-2" : "hover:bg-surface-2/60"
                  )}
                >
                  <Icon className="h-4 w-4 text-muted" />
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{cmd.label}</p>
                    <p className="text-xs text-muted">{cmd.hint}</p>
                  </div>
                  {i === activeIndex && (
                    <CornerDownLeft className="h-3.5 w-3.5 text-muted" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
