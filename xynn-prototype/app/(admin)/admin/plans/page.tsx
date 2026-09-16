"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Sparkles, Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  discountPercent: number;
  prdLimit: number;
  features: string[];
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
};

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/plans")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setPlans(d))
      .catch(() => toast.error("Gagal memuat plan"))
      .finally(() => setLoading(false));
  }, []);

  const update = (code: string, patch: Partial<Plan>) => {
    setPlans((prev) => prev.map((p) => (p.code === code ? { ...p, ...patch } : p)));
  };

  const save = async (plan: Plan) => {
    setSavingCode(plan.code);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: plan.code,
          name: plan.name,
          description: plan.description,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          discountPercent: plan.discountPercent,
          prdLimit: plan.prdLimit,
          features: plan.features,
          isActive: plan.isActive,
          isPopular: plan.isPopular,
          sortOrder: plan.sortOrder,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      setPlans((prev) => prev.map((p) => (p.code === plan.code ? data : p)));
      toast.success(`Plan ${plan.name} disimpan`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSavingCode(null);
    }
  };

  const fmt = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

  const priceAfterDiscount = (base: number, pct: number) =>
    pct > 0 ? Math.round(base * (1 - pct / 100)) : base;

  if (loading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paket & Harga"
        description="Atur harga bulanan/tahunan, diskon, fitur, dan status paket SaaS."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const monthlyFinal = priceAfterDiscount(plan.priceMonthly, plan.discountPercent);
          return (
            <Card key={plan.code} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted" />
                  {plan.name}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  {plan.isPopular && (
                    <Badge tone="accent">
                      <Sparkles className="h-3 w-3" />
                      Populer
                    </Badge>
                  )}
                  <Badge tone={plan.isActive ? "success" : "danger"}>
                    {plan.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>
              </CardHeader>

              <CardBody className="flex-1 space-y-4">
                <p className="text-xs text-muted">
                  Kode: <span className="font-mono text-foreground">{plan.code}</span>
                </p>

                <Field label="Nama">
                  <Input
                    value={plan.name}
                    onChange={(e) => update(plan.code, { name: e.target.value })}
                  />
                </Field>

                <Field label="Deskripsi">
                  <Input
                    value={plan.description ?? ""}
                    onChange={(e) => update(plan.code, { description: e.target.value })}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Harga Bulanan">
                    <Input
                      type="number"
                      value={plan.priceMonthly}
                      onChange={(e) =>
                        update(plan.code, { priceMonthly: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Harga Tahunan">
                    <Input
                      type="number"
                      value={plan.priceYearly}
                      onChange={(e) =>
                        update(plan.code, { priceYearly: Number(e.target.value) })
                      }
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Diskon (%)"
                    hint={plan.discountPercent > 0 ? `Jadi ${fmt(monthlyFinal)}` : undefined}
                  >
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={plan.discountPercent}
                      onChange={(e) =>
                        update(plan.code, {
                          discountPercent: Math.min(100, Math.max(0, Number(e.target.value))),
                        })
                      }
                    />
                  </Field>
                  <Field label="PRD Limit (-1 = ∞)">
                    <Input
                      type="number"
                      value={plan.prdLimit}
                      onChange={(e) => update(plan.code, { prdLimit: Number(e.target.value) })}
                    />
                  </Field>
                </div>

                <Field label="Fitur (satu per baris)">
                  <textarea
                    value={plan.features.join("\n")}
                    onChange={(e) =>
                      update(plan.code, {
                        features: e.target.value.split("\n").filter((l) => l.trim()),
                      })
                    }
                    rows={5}
                    className="w-full rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-xs text-foreground focus:border-accent/70 focus:outline-none"
                  />
                </Field>

                <div className="flex flex-wrap gap-4 text-xs text-muted">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={plan.isActive}
                      onChange={(e) => update(plan.code, { isActive: e.target.checked })}
                      className="h-4 w-4 rounded border-border-strong bg-surface-2 accent-[color:var(--accent)]"
                    />
                    Aktif
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={plan.isPopular}
                      onChange={(e) => update(plan.code, { isPopular: e.target.checked })}
                      className="h-4 w-4 rounded border-border-strong bg-surface-2 accent-[color:var(--accent)]"
                    />
                    Tandai Populer
                  </label>
                </div>
              </CardBody>

              <div className="border-t border-border p-4">
                <Button
                  className="w-full"
                  onClick={() => save(plan)}
                  disabled={savingCode === plan.code}
                >
                  <Save className="h-4 w-4" />
                  {savingCode === plan.code ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
