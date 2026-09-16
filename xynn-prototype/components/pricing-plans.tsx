"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type PlanView = {
  code: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  discountPercent: number;
  prdLimit: number;
  features: string[];
  isPopular: boolean;
};

function formatIDR(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

/** Harga bulanan efektif bila bayar tahunan. */
function monthlyEquivalent(plan: PlanView): number {
  return Math.round(plan.priceYearly / 12);
}

/** Persentase hemat tahunan vs 12× bulanan. */
function yearlySavings(plan: PlanView): number {
  const monthly12 = plan.priceMonthly * 12;
  if (monthly12 <= 0 || plan.priceYearly <= 0) return 0;
  return Math.max(0, Math.round((1 - plan.priceYearly / monthly12) * 100));
}

export function PricingPlans({
  plans,
  mode = "checkout",
  currentPlan,
  loadingCode,
  onSelect,
  className,
}: {
  plans: PlanView[];
  mode?: "checkout" | "display";
  currentPlan?: string;
  loadingCode?: string | null;
  onSelect?: (plan: PlanView, cycle: "MONTHLY" | "YEARLY") => void;
  className?: string;
}) {
  const [cycle, setCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");

  return (
    <div className={className}>
      {/* Billing toggle */}
      <div className="mb-8 flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface/60 p-1">
          {(["MONTHLY", "YEARLY"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={cn(
                "relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                cycle === c
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground"
              )}
            >
              {c === "MONTHLY" ? "Bulanan" : "Tahunan"}
              {c === "YEARLY" && (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    cycle === "YEARLY"
                      ? "bg-white/20 text-white"
                      : "bg-success/15 text-success"
                  )}
                >
                  Hemat
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isFree = plan.code === "FREE";
          const isCurrent = currentPlan === plan.code;
          const price =
            cycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;
          const shownPrice =
            cycle === "YEARLY" && plan.priceYearly > 0 ? monthlyEquivalent(plan) : price;
          const period = cycle === "YEARLY" ? "/bln" : "/bln";
          const savings = yearlySavings(plan);
          const hasDiscount = plan.discountPercent > 0;
          const discounted =
            hasDiscount ? Math.round(price * (1 - plan.discountPercent / 100)) : price;

          return (
            <div
              key={plan.code}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-surface/60 p-5 transition-all",
                plan.isPopular
                  ? "border-accent/50 ring-1 ring-inset ring-accent/20 lg:-translate-y-2"
                  : "border-border hover:border-border-strong"
              )}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-white shadow-lg shadow-accent/30">
                    <Sparkles className="h-3 w-3" />
                    Paling Populer
                  </span>
                </div>
              )}

              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {plan.name}
                </h3>
                {plan.description && (
                  <p className="mt-1 text-xs text-muted">{plan.description}</p>
                )}
                {plan.code === "PRO" && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                    Prototype Design mulai di sini
                  </span>
                )}
                {plan.code === "ENTERPRISE" && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-md border border-border-strong px-2 py-0.5 text-[10px] font-medium text-muted">
                    Library tema tersimpan
                  </span>
                )}
              </div>

              <div className="mt-5">
                {isFree ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-foreground">Gratis</span>
                  </div>
                ) : (
                  <>
                    {hasDiscount && (
                      <span className="text-sm text-muted line-through">
                        {formatIDR(discounted)}
                      </span>
                    )}
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-foreground">
                        {formatIDR(shownPrice)}
                      </span>
                      <span className="text-sm text-muted">{period}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      {cycle === "YEARLY"
                        ? `Ditagih ${formatIDR(discounted)}/tahun`
                        : `Ditagih bulanan`}
                      {savings > 0 && cycle === "YEARLY" && (
                        <span className="ml-1 text-success">· hemat {savings}%</span>
                      )}
                    </p>
                  </>
                )}
              </div>

              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {mode === "display" ? (
                  <Button
                    variant={plan.isPopular ? "primary" : "secondary"}
                    className="w-full"
                    disabled
                  >
                    {isFree ? "Mulai Gratis" : "Pilih Paket"}
                  </Button>
                ) : isCurrent ? (
                  <Button variant="secondary" className="w-full" disabled>
                    Paket Aktif
                  </Button>
                ) : isFree ? (
                  <Button variant="ghost" className="w-full" disabled>
                    {currentPlan ? "Termasuk" : "Paket Dasar"}
                  </Button>
                ) : (
                  <Button
                    variant={plan.isPopular ? "primary" : "secondary"}
                    className="w-full"
                    disabled={loadingCode === plan.code}
                    onClick={() => onSelect?.(plan, cycle)}
                  >
                    {loadingCode === plan.code ? "Memproses..." : `Pilih ${plan.name}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
