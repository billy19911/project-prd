"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Eye, GitFork, Lock, Inbox } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeletonGrid } from "@/components/ui/skeleton";
import { useUpgrade } from "@/components/upgrade-provider";
import { useSubscription } from "@/lib/use-subscription";
import { cn } from "@/lib/utils";

type VaultItem = {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  category: string;
  viewsCount: number;
  forksCount: number;
  shareSlug: string;
  isAnonymous: boolean;
  user: { name: string; avatarUrl: string | null };
};

export default function VaultPage() {
  const upgrade = useUpgrade();
  const { isPaid: hasAccess } = useSubscription();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);

  useEffect(() => {
    let active = true;
    const t = setTimeout(() => {
      fetch(`/api/vault/search?q=${encodeURIComponent(query)}`)
        .then(async (res) => {
          if (!active) return;
          if (res.status === 402) {
            setGated(true);
            setItems([]);
            return;
          }
          const data = await res.json();
          setItems(data);
        })
        .catch(() => setItems([]))
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gudang PRD"
        description="Jelajahi spesifikasi teknis dari komunitas developer."
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari PRD, kategori, atau stack..."
          className="pl-9"
        />
      </div>

      {/* Gate notice */}
      {!hasAccess && (
        <Card className="flex flex-col items-start gap-2 border-accent/20 bg-accent/5 p-4 sm:flex-row sm:items-center">
          <Lock className="h-4 w-4 shrink-0 text-accent" />
          <p className="flex-1 text-sm text-muted">
            Upgrade ke STARTER/PRO untuk mengakses Gudang PRD secara penuh,
            termasuk copy specs dan fork.
          </p>
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => upgrade.open({ title: "Akses Gudang PRD" })}
          >
            Lihat Plan
          </Button>
        </Card>
      )}

      {loading ? (
        <CardSkeletonGrid count={6} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title={gated ? "Gudang terkunci" : "Belum ada PRD publik"}
          description={
            gated
              ? "Upgrade paket Anda untuk menjelajahi Gudang PRD komunitas."
              : "Publikasikan project Anda untuk membagikannya ke komunitas."
          }
        />
      ) : (
        <div
          className={cn(
            "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
            !hasAccess && "pointer-events-none select-none blur-[3px]"
          )}
        >
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/prd/${item.shareSlug}`}
              className="group flex flex-col rounded-[var(--radius-card)] border border-border bg-surface/60 p-4 transition-colors hover:border-border-strong hover:bg-surface"
            >
              <h3 className="line-clamp-1 font-medium text-foreground transition-colors group-hover:text-accent">
                {item.title}
              </h3>
              <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-muted">
                {item.description || "Tanpa deskripsi"}
              </p>

              {item.techStack.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.techStack.slice(0, 3).map((s) => (
                    <Badge key={s} tone="outline">
                      {s}
                    </Badge>
                  ))}
                  {item.techStack.length > 3 && (
                    <Badge tone="outline">+{item.techStack.length - 3}</Badge>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-[11px] text-muted">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {item.viewsCount}
                </span>
                <span className="flex items-center gap-1">
                  <GitFork className="h-3 w-3" />
                  {item.forksCount}
                </span>
                <span className="ml-auto truncate">
                  {item.isAnonymous ? "Anonim" : item.user?.name || "—"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
