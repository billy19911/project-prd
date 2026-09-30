"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight, Folder, Globe, Layers, Zap, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeletonGrid } from "@/components/ui/skeleton";
import { useUpgrade } from "@/components/upgrade-provider";

type Workspace = {
  id: string;
  title: string;
  description: string | null;
  techStack: string[];
  updatedAt: string;
  isPublic: boolean;
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const upgrade = useUpgrade();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiry, setExpiry] = useState<{ daysLeft: number; validUntil: string } | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    fetch("/api/workspace")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (active) setWorkspaces(data);
      })
      .catch(() => toast.error("Gagal memuat workspace"))
      .finally(() => {
        if (active) setLoading(false);
      });
    fetch("/api/user/subscription")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.isActive && d.daysLeft !== null && d.daysLeft <= 7) {
          setExpiry({ daysLeft: d.daysLeft, validUntil: d.validUntil });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [status]);

  // Layout `(main)` sudah mengurus redirect saat belum login. Di sini cukup
  // tampilkan skeleton selama sesi belum siap agar tidak berkedip "kosong".
  if (status === "loading") {
    return <CardSkeletonGrid count={3} />;
  }

  const plan = (session?.user as { plan?: string })?.plan || "FREE";

  const metrics = [
    { label: "Plan", value: plan, icon: Zap },
    { label: "Workspaces", value: String(workspaces.length), icon: Layers },
    {
      label: "Akses",
      value: plan === "FREE" ? "1 Draft" : plan === "STARTER" ? "5/bln" : "Unlimited",
      icon: Folder,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Selamat datang kembali, ${session?.user?.name || "Developer"}.`}
        actions={
          <Link href="/projects" className={buttonClasses({ size: "md" })}>
            <Plus className="h-4 w-4" />
            Bikin Plan
          </Link>
        }
      />

      {/* Peringatan langganan hampir habis */}
      {expiry && (
        <button
          onClick={() =>
            upgrade.open({
              title: "Perpanjang langganan",
              message: `Langganan berakhir ${new Date(expiry.validUntil).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} · sisa ${expiry.daysLeft} hari.`,
            })
          }
          className="flex w-full items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-left text-sm text-warning transition-colors hover:bg-warning/15"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            Langganan berakhir{" "}
            {new Date(expiry.validUntil).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "}
            · tersisa {expiry.daysLeft} hari. Perpanjang sekarang.
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </button>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">{m.label}</p>
                <Icon className="h-4 w-4 text-muted" />
              </div>
              <p className="mt-2 truncate text-lg font-semibold text-foreground">
                {m.value}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Workspaces */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Workspace Anda
          </h2>
          {!loading && workspaces.length > 0 && (
            <span className="text-xs text-muted">
              {workspaces.length} proyek
            </span>
          )}
        </div>

        {loading ? (
          <CardSkeletonGrid count={3} />
        ) : workspaces.length === 0 ? (
          <EmptyState
            icon={<Folder className="h-5 w-5" />}
            title="Belum ada workspace"
            description="Mulai dengan membuat PRD pertama Anda dari sebuah ide produk."
            action={
              <Link href="/projects" className={buttonClasses({})}>
                Buat PRD pertama
                <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <Link
                key={ws.id}
                href={`/project/${ws.id}`}
                className="group flex flex-col rounded-[var(--radius-card)] border border-border bg-surface/60 p-4 transition-colors hover:border-border-strong hover:bg-surface"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-1 font-medium text-foreground transition-colors group-hover:text-accent">
                    {ws.title}
                  </h3>
                  {ws.isPublic && (
                    <Badge tone="success">
                      <Globe className="h-3 w-3" />
                      Publik
                    </Badge>
                  )}
                </div>

                <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-muted">
                  {ws.description || "Tidak ada deskripsi"}
                </p>

                {ws.techStack.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {ws.techStack.slice(0, 3).map((stack) => (
                      <Badge key={stack} tone="outline">
                        {stack}
                      </Badge>
                    ))}
                    {ws.techStack.length > 3 && (
                      <Badge tone="outline">+{ws.techStack.length - 3}</Badge>
                    )}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted">
                  <span>
                    {new Date(ws.updatedAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="flex items-center gap-1 text-muted transition-colors group-hover:text-accent">
                    Buka
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
