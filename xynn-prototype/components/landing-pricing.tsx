"use client";

import { useEffect, useState } from "react";
import { PricingPlans, type PlanView } from "@/components/pricing-plans";

export function LandingPricing() {
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setPlans(d))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-96 animate-pulse rounded-2xl border border-border bg-surface/40"
          />
        ))}
      </div>
    );
  }

  return <PricingPlans plans={plans} mode="display" />;
}
