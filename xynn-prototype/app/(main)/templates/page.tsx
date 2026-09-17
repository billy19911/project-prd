"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, LayoutTemplate } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeletonGrid } from "@/components/ui/skeleton";
import { useUpgrade } from "@/components/upgrade-provider";
import { useSubscription } from "@/lib/use-subscription";
import { templateIcon, categoryLabel } from "@/lib/template-meta";
import { cn } from "@/lib/utils";

type TemplateItem = {
  slug: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  techStack: string[];
};

export default function TemplatesPage() {
  const router = useRouter();
  const upgrade = useUpgrade();
  const { isPaid: hasAccess, loading: subLoading } = useSubscription();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    if (subLoading) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/templates");
        if (!active) return;
        if (res.status === 402) {
          setGated(true);
          setTemplates([]);
          return;
        }
        if (!res.ok) throw new Error();
        setTemplates(await res.json());
      } catch {
        if (active) setTemplates([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [subLoading]);

  // Kategori unik untuk filter, urut sesuai kemunculan.
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const t of templates) {
      if (!seen.includes(t.category)) seen.push(t.category);
    }
    return seen;
  }, [templates]);

  const visible = useMemo(
    () =>
      activeCategory === "all"
        ? templates
        : templates.filter((t) => t.category === activeCategory),
    [templates, activeCategory]
  );

  const startFromTemplate = (slug: string) => {
    // Wizard project baru membaca `?template=` dan mengisi ide/stack.
    router.push(`/new-project?template=${encodeURIComponent(slug)}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Template PRD"
        description="Mulai dari template siap pakai untuk menghemat token. Bisa dikustomisasi di wizard."
      />

      {/* Gate notice — hanya bila TIDAK punya akses */}
      {!subLoading && !hasAccess && (
        <Card className="flex flex-col items-start gap-2 border-accent/20 bg-accent/5 p-4 sm:flex-row sm:items-center">
          <Lock className="h-4 w-4 shrink-0 text-accent" />
          <p className="flex-1 text-sm text-muted">
            Template eksklusif untuk pelanggan berbayar (STARTER ke atas).
            Gunakan template untuk memangkas token dan mempercepat mulai.
          </p>
          <Button
            size="sm"
            className="shrink-0"
            onClick={() =>
              upgrade.open({
                title: "Buka Template PRD",
                message: "Upgrade ke STARTER/PRO untuk memakai template siap pakai.",
              })
            }
          >
            Lihat Plan
          </Button>
        </Card>
      )}

      {/* Filter kategori */}
      {templates.length > 0 && categories.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <CategoryChip
            active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
          >
            Semua
          </CategoryChip>
          {categories.map((c) => (
            <CategoryChip
              key={c}
              active={activeCategory === c}
              onClick={() => setActiveCategory(c)}
            >
              {categoryLabel(c)}
            </CategoryChip>
          ))}
        </div>
      )}

      {loading ? (
        <CardSkeletonGrid count={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate className="h-5 w-5" />}
          title={gated ? "Template terkunci" : "Belum ada template"}
          description={
            gated
              ? "Upgrade paket Anda untuk memakai template PRD siap pakai."
              : "Template akan muncul di sini setelah ditambahkan."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => {
            const Icon = templateIcon(t.icon);
            return (
              <div
                key={t.slug}
                className="group flex flex-col rounded-[var(--radius-card)] border border-border bg-surface/60 p-4 transition-colors hover:border-border-strong hover:bg-surface"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-1 font-medium text-foreground">
                      {t.title}
                    </h3>
                    <div className="mt-1">
                      <Badge tone="outline">{categoryLabel(t.category)}</Badge>
                    </div>
                  </div>
                </div>

                <p className="mt-3 line-clamp-3 flex-1 text-xs leading-relaxed text-muted">
                  {t.description}
                </p>

                {t.techStack.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {t.techStack.slice(0, 3).map((s) => (
                      <Badge key={s} tone="neutral">
                        {s}
                      </Badge>
                    ))}
                    {t.techStack.length > 3 && (
                      <Badge tone="neutral">+{t.techStack.length - 3}</Badge>
                    )}
                  </div>
                )}

                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-4 w-full"
                  disabled={!hasAccess}
                  onClick={() => startFromTemplate(t.slug)}
                >
                  Pakai template
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-accent/60 bg-accent/10 text-foreground"
          : "border-border text-muted hover:border-border-strong hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
