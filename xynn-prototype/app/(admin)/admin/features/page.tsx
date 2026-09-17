"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ToggleRight, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

type FeatureRow = {
  key: string;
  label: string;
  description: string | null;
  status: "LIVE" | "SOON" | "HIDDEN";
};

const STATUS_OPTIONS: FeatureRow["status"][] = ["LIVE", "SOON", "HIDDEN"];

const STATUS_LABEL: Record<FeatureRow["status"], string> = {
  LIVE: "Live (bisa dipakai)",
  SOON: "Segera Hadir (dikunci)",
  HIDDEN: "Tersembunyi (allowlist saja)",
};

/**
 * Kontrol rilis fitur. Fitur bisa dibangun penuh tapi tetap ditampilkan
 * "Segera Hadir" atau disembunyikan — tanpa deploy ulang.
 */
export default function FeaturesPage() {
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, FeatureRow["status"]>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/features")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: FeatureRow[]) => {
        setFeatures(d);
        const init: Record<string, FeatureRow["status"]> = {};
        d.forEach((f) => (init[f.key] = f.status));
        setDrafts(init);
      })
      .catch(() => toast.error("Gagal memuat status fitur"))
      .finally(() => setLoading(false));
  }, []);

  const save = async (key: string) => {
    const status = drafts[key];
    if (!status) return;
    setSavingKey(key);
    try {
      const res = await fetch("/api/admin/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(`Status fitur diperbarui: ${status}`);
      setFeatures((prev) =>
        prev.map((f) => (f.key === key ? { ...f, status: data.status } : f))
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSavingKey(null);
    }
  };

  const tone = (s: FeatureRow["status"]) =>
    s === "LIVE" ? "success" : s === "SOON" ? "warning" : "neutral";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fitur"
        description="Atur fitur mana yang Live, Segera Hadir, atau Tersembunyi. Backend & frontend tetap jalan — hanya aksesnya yang dikunci."
        actions={<Badge tone="neutral">{features.length} fitur</Badge>}
      />

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : features.length === 0 ? (
        <EmptyState icon={<ToggleRight className="h-5 w-5" />} title="Belum ada fitur" />
      ) : (
        <Card className="divide-y divide-border">
          {features.map((f) => {
            const current = f.status;
            const draft = drafts[f.key] ?? current;
            return (
              <div
                key={f.key}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {f.label}
                    </p>
                    <span className="font-mono text-[10px] text-muted">{f.key}</span>
                    <Badge tone={tone(current)}>{current}</Badge>
                  </div>
                  {f.description && (
                    <p className="mt-1 text-xs text-muted">{f.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 sm:w-auto">
                  <Select
                    value={draft}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [f.key]: e.target.value as FeatureRow["status"],
                      }))
                    }
                    className="h-9 w-52 text-xs"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => save(f.key)}
                    disabled={savingKey === f.key || draft === current}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingKey === f.key ? "..." : "Simpan"}
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <p className="text-[11px] leading-relaxed text-muted">
        <b className="text-foreground">LIVE</b> — fitur utuh & tampil di navigasi.{" "}
        <b className="text-foreground">SOON</b> — fitur utuh tapi menampilkan
        layar &quot;Segera Hadir&quot;; akses langsung dialihkan.{" "}
        <b className="text-foreground">HIDDEN</b> — tidak tampil sama sekali;
        hanya bisa dibuka lewat allowlist.
      </p>
    </div>
  );
}
