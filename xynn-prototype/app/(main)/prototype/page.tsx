"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MonitorSmartphone, ArrowRight, Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useSubscription } from "@/lib/use-subscription";
import { useUpgrade } from "@/components/upgrade-provider";

type Item = {
  id: string;
  title: string;
  description: string | null;
  updatedAt: string;
  hasPrototype: boolean;
};

/**
 * Galeri Prototype lintas project.
 *
 * Hanya menampilkan workspace yang SUDAH punya prototype; project yang belum
 * di-generate ditampilkan sebagai baris "belum ada" agar pengguna tahu harus
 * ke mana. Gate PRO ditampilkan sebagai banner, bukan error.
 */
export default function PrototypePage() {
  const { canUsePrototype, prototypeQuotaLeft, loading: subLoading } = useSubscription();
  const upgrade = useUpgrade();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/workspace")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!active) return;
        setItems(
          (data as Array<Record<string, unknown>>).map((w) => ({
            id: String(w.id),
            title: String(w.title),
            description: (w.description as string) ?? null,
            updatedAt: String(w.updatedAt),
            hasPrototype: !!w.prototypeHtml,
          }))
        );
      })
      .catch(() => toast.error("Gagal memuat prototype"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const withProto = items.filter((i) => i.hasPrototype);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prototype"
        description="Prototype HTML yang di-generate dari PRD & Style Guide project Anda."
        actions={
          <Link href="/projects" className={buttonClasses({ size: "md" })}>
            <Plus className="h-4 w-4" />
            Bikin Plan
          </Link>
        }
      />

      {/* Gate PRO */}
      {!subLoading && !canUsePrototype && (
        <Card className="flex flex-col items-start gap-2 border-accent/20 bg-accent/5 p-4 sm:flex-row sm:items-center">
          <Lock className="h-4 w-4 shrink-0 text-accent" />
          <p className="flex-1 text-sm text-muted">
            Prototype Design tersedia mulai paket <b className="text-foreground">PRO</b> —
            generate prototype multi-screen dari PRD dan Style Guide Anda, lengkap
            dengan pratinjau mobile &amp; desktop.
          </p>
          <Button
            size="sm"
            className="shrink-0"
            onClick={() =>
              upgrade.open({
                title: "Prototype Design khusus PRO",
                message: "Generate prototype HTML tersedia mulai paket PRO.",
              })
            }
          >
            Lihat Plan
          </Button>
        </Card>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
        </div>
      ) : withProto.length === 0 ? (
        <EmptyState
          icon={<MonitorSmartphone className="h-5 w-5" />}
          title="Belum ada prototype"
          description="Buka sebuah project yang sudah punya PRD dan Style Guide, lalu generate prototype dari tab Prototype."
          action={
            <Link href="/projects" className={buttonClasses({})}>
              Ke daftar project
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withProto.map((item) => (
            <Link
              key={item.id}
              href={`/project/${item.id}`}
              className="group flex flex-col rounded-[var(--radius-card)] border border-border bg-surface/60 p-4 transition-colors hover:border-border-strong hover:bg-surface"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-1 font-medium text-foreground transition-colors group-hover:text-accent">
                  {item.title}
                </h3>
                <Badge tone="accent">
                  <MonitorSmartphone className="h-3 w-3" />
                  Prototype
                </Badge>
              </div>

              <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-muted">
                {item.description || "Tidak ada deskripsi"}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted">
                <span>
                  {new Date(item.updatedAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-1 transition-colors group-hover:text-accent">
                  Buka
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!subLoading && canUsePrototype && (
        <p className="text-center text-[11px] text-muted">
          {prototypeQuotaLeft === null
            ? "Kuota prototype tidak terbatas."
            : `Sisa kuota generate bulan ini: ${prototypeQuotaLeft}.`}
        </p>
      )}
    </div>
  );
}
