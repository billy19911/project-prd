"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  Users,
  Zap,
  TrendingUp,
  Sparkles,
  CreditCard,
  Ticket,
  Layers,
  ArrowRight,
  Activity,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Stats = {
  totalRevenue: number;
  aiCost: number;
  profit: number;
  margin: number;
  aiCostMonth: number;
  tokensThisMonth: number;
  totalTokens: number;
  costByKind: Record<string, number>;
  activeUsers: number;
  totalUsers: number;
  proUsers: number;
  starterUsers: number;
  freeUsers: number;
  totalWorkspaces: number;
  publicWorkspaces: number;
};

const EMPTY: Stats = {
  totalRevenue: 0,
  aiCost: 0,
  profit: 0,
  margin: 0,
  aiCostMonth: 0,
  tokensThisMonth: 0,
  totalTokens: 0,
  costByKind: {},
  activeUsers: 0,
  totalUsers: 0,
  proUsers: 0,
  starterUsers: 0,
  freeUsers: 0,
  totalWorkspaces: 0,
  publicWorkspaces: 0,
};

const fmtIDR = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const fmtNum = (n: number) => n.toLocaleString("id-ID");

/* ---------------- KPI ---------------- */

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden p-4">
      <div className={`pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full ${accent} opacity-20 blur-2xl`} />
      <div className="relative flex items-center justify-between">
        <p className="text-xs text-muted">{label}</p>
        <Icon className="h-4 w-4 text-muted" />
      </div>
      <p className="relative mt-2 font-mono text-xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      {sub && <p className="relative mt-0.5 text-[11px] text-muted">{sub}</p>}
    </Card>
  );
}

/* ---------------- Profit ring ---------------- */

function ProfitRing({ margin }: { margin: number }) {
  const pct = Math.max(0, Math.min(1, margin));
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const dash = circ * pct;
  const color =
    pct >= 0.5 ? "var(--success)" : pct > 0 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg width="128" height="128" className="-rotate-90">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="var(--border)" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-2xl font-bold text-foreground">
          {Math.round(pct * 100)}%
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted">Margin</span>
      </div>
    </div>
  );
}

/* ---------------- Distribution bar ---------------- */

function DistributionBar({
  segments,
}: {
  segments: { label: string; value: number; className: string }[];
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className="space-y-3">
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
        {segments.map((s) => (
          <div
            key={s.label}
            className={s.className}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${s.className}`} />
            <span className="text-muted">{s.label}</span>
            <span className="font-mono font-medium text-foreground">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Quick links ---------------- */

const QUICK_LINKS = [
  { href: "/admin/plans", label: "Paket & Harga", icon: Layers },
  { href: "/admin/ai-config", label: "AI Config", icon: Sparkles },
  { href: "/admin/payments", label: "Payment", icon: CreditCard },
  { href: "/admin/vouchers", label: "Voucher", icon: Ticket },
];

/* ---------------- Page ---------------- */

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setStats(d))
      .catch(() => setStats(EMPTY))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      </div>
    );
  }

  const d = stats;
  const costItems = [
    { key: "prd", label: "PRD" },
    { key: "mindmap", label: "Mindmap" },
    { key: "tasks", label: "Task" },
    { key: "styleguide", label: "Style Guide" },
    { key: "questions", label: "Questions" },
    { key: "techstack", label: "Tech Stack" },
  ];
  const costTotal = costItems.reduce((a, c) => a + (d.costByKind[c.key] ?? 0), 0) || 1;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard Admin"
        description="Ringkasan bisnis, biaya AI, dan pengguna."
        actions={
          <Badge tone={d.margin >= 0.5 ? "success" : d.margin > 0 ? "warning" : "danger"}>
            <Activity className="h-3 w-3" />
            Margin {Math.round(d.margin * 100)}%
          </Badge>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total Revenue" value={fmtIDR(d.totalRevenue)} icon={DollarSign} accent="bg-success" />
        <Kpi
          label="AI Cost"
          value={fmtIDR(d.aiCost)}
          sub={`Bulan ini ${fmtIDR(d.aiCostMonth)}`}
          icon={Zap}
          accent="bg-warning"
        />
        <Kpi label="Profit" value={fmtIDR(d.profit)} icon={TrendingUp} accent="bg-accent" />
        <Kpi
          label="User Aktif"
          value={`${d.activeUsers}/${d.totalUsers}`}
          sub={`${d.totalUsers} terdaftar`}
          icon={Users}
          accent="bg-accent"
        />
      </div>

      {/* Profit + token + cost */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="flex items-center gap-5 p-5">
          <ProfitRing margin={d.margin} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Profit Health</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Margin = Profit ÷ Revenue. Di bawah 50% perlu evaluasi biaya AI.
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-foreground">Token Burn Rate</p>
          <div className="mt-4 space-y-3">
            <div>
              <p className="font-mono text-2xl font-bold text-foreground">
                {fmtNum(d.totalTokens)}
              </p>
              <p className="text-[11px] text-muted">Total token</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="font-mono text-base font-semibold text-warning">
                {fmtNum(d.tokensThisMonth)}
              </p>
              <p className="text-[11px] text-muted">Bulan ini</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-foreground">Cost Breakdown</p>
          <ul className="mt-4 space-y-2">
            {costItems.map((c) => {
              const val = d.costByKind[c.key] ?? 0;
              const pct = Math.round((val / costTotal) * 100);
              return (
                <li key={c.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">{c.label}</span>
                    <span className="font-mono text-foreground">{fmtIDR(val)}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent/60" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Users + content */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Distribusi Paket</p>
            <span className="text-xs text-muted">{d.totalUsers} user</span>
          </div>
          <DistributionBar
            segments={[
              { label: "PRO", value: d.proUsers, className: "bg-success" },
              { label: "Starter", value: d.starterUsers, className: "bg-accent" },
              { label: "Free", value: d.freeUsers, className: "bg-muted" },
            ]}
          />
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-foreground">Konten</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="font-mono text-2xl font-bold text-foreground">{d.totalWorkspaces}</p>
              <p className="text-[11px] text-muted">Total workspace</p>
            </div>
            <div>
              <p className="font-mono text-2xl font-bold text-foreground">
                {d.publicWorkspaces}
              </p>
              <p className="text-[11px] text-muted">PRD publik</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Kelola
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {QUICK_LINKS.map((q) => {
            const Icon = q.icon;
            return (
              <Link
                key={q.href}
                href={q.href}
                className="group flex items-center justify-between rounded-xl border border-border bg-surface/40 px-4 py-3 transition-colors hover:border-border-strong hover:bg-surface"
              >
                <span className="flex items-center gap-2.5 text-sm text-foreground">
                  <Icon className="h-4 w-4 text-muted" />
                  {q.label}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
