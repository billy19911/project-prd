"use client";

import Link from "next/link";
import {
  FileText,
  ListChecks,
  Palette,
  MessagesSquare,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type Service = {
  id: string;
  icon: LucideIcon;
  title: string;
  tagline: string;
  bullets: string[];
  href: string;
  cta: string;
  tier: "gratis" | "premium" | "segera";
  accent: string;
};

export const SERVICES: Service[] = [
  {
    id: "prd",
    icon: FileText,
    title: "PRD & Mindmap Generator",
    tagline: "Ubah ide jadi spesifikasi teknis siap-kode.",
    bullets: [
      "Wizard AI 3 langkah + mindmap arsitektur",
      "Full PRD Markdown + task breakdown",
      "Sync ke Cursor/VS Code via CLI",
    ],
    href: "/login?callbackUrl=/projects",
    cta: "Buat Plan",
    tier: "gratis",
    accent: "from-accent/20 to-accent/0",
  },
  {
    id: "tasks",
    icon: ListChecks,
    title: "Task Breakdown",
    tagline: "PRD otomatis diterjemahkan jadi daftar task.",
    bullets: [
      "Task terstruktur per fase pengerjaan",
      "Prioritas & estimasi tiap item",
      "Checklist interaktif siap dikerjakan",
    ],
    href: "/login?callbackUrl=/projects",
    cta: "Jabarkan PRD",
    tier: "premium",
    accent: "from-success/20 to-success/0",
  },
  {
    id: "styleguide",
    icon: Palette,
    title: "Style Guide Generator",
    tagline: "Design system konsisten untuk aplikasi Anda.",
    bullets: [
      "Palet warna, tipografi, spacing",
      "Panduan komponen & state",
      "Anti-slop, siap dipakai developer",
    ],
    href: "/login?callbackUrl=/projects",
    cta: "Buat Style Guide",
    tier: "premium",
    accent: "from-warning/20 to-warning/0",
  },
  {
    id: "consult",
    icon: MessagesSquare,
    title: "Konsultasi Teknis",
    tagline: "Diskusikan arsitektur dengan praktisi.",
    bullets: [
      "Review arsitektur & tech stack",
      "Sesi tanya-jawab bersama expert",
      "Rekomendasi roadmap eksekusi",
    ],
    href: "/settings/plan",
    cta: "Segera Hadir",
    tier: "segera",
    accent: "from-muted/20 to-muted/0",
  },
];

const tierBadge: Record<Service["tier"], { label: string; tone: "neutral" | "accent" | "warning" }> = {
  gratis: { label: "Gratis", tone: "accent" },
  premium: { label: "Premium", tone: "neutral" },
  segera: { label: "Segera", tone: "warning" },
};

function ServiceCard({ service }: { service: Service }) {
  const Icon = service.icon;
  const badge = tierBadge[service.tier];
  const isSoon = service.tier === "segera";

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface/60 p-6 transition-all duration-300",
        !isSoon && "hover:-translate-y-1 hover:border-border-strong hover:shadow-xl hover:shadow-black/20"
      )}
    >
      {/* glow accent di atas kartu */}
      <div
        className={cn(
          "pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gradient-to-br opacity-0 blur-2xl transition-opacity duration-300",
          "group-hover:opacity-100",
          service.accent
        )}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-accent ring-1 ring-inset ring-border-strong transition-transform duration-300 group-hover:scale-110">
          <Icon className="h-5 w-5" />
        </div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>

      <h3 className="relative mt-4 text-base font-semibold text-foreground">
        {service.title}
      </h3>
      <p className="relative mt-1 text-xs text-muted">{service.tagline}</p>

      <ul className="relative mt-4 flex-1 space-y-2">
        {service.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-xs text-muted">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {isSoon ? (
        <span className="relative mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted">
          {service.cta}
        </span>
      ) : (
        <Link
          href={service.href}
          className="relative mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-accent transition-colors hover:text-accent-hover"
        >
          {service.cta}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

export function ServiceCatalog({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-5 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {SERVICES.map((s) => (
        <ServiceCard key={s.id} service={s} />
      ))}
    </div>
  );
}
