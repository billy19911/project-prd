"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, User, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/settings/plan", label: "Plan & Usage", icon: CreditCard },
  { href: "/settings/profile", label: "Profil", icon: User },
  { href: "/settings/developer", label: "Developer", icon: Code2 },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface/60 p-1">
      {tabs.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-surface-2 text-foreground"
                : "text-muted hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
