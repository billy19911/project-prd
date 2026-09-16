"use client";

import { useEffect, useState } from "react";
import { X, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PricingPlans, type PlanView } from "@/components/pricing-plans";
import { CheckoutModal, type CheckoutSummary } from "@/components/checkout-modal";

/**
 * Modal berlangganan: tampilkan paket, lalu masuk ke checkout (pembayaran).
 */
export function UpgradePlanModal({
  open,
  onClose,
  title = "Upgrade Paket",
  message = "Pilih paket yang sesuai. Pembayaran diproses lewat halaman checkout.",
  highlight,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  highlight?: string;
}) {
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [checkout, setCheckout] = useState<CheckoutSummary | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/plans")
      .then((r) => (r.ok ? r.json() : []))
      .then(setPlans)
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  // Checkout step
  if (checkout) {
    return (
      <CheckoutModal
        summary={checkout}
        onClose={() => setCheckout(null)}
        onPaid={() => {
          setCheckout(null);
          onClose();
          // Muat ulang agar status langganan ter-refresh di seluruh halaman.
          window.location.reload();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-10 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
              <p className="mt-0.5 max-w-xl text-xs text-muted">{message}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <PricingPlans
            plans={plans}
            mode="checkout"
            loadingCode={null}
            onSelect={(plan, cycle) => {
              const subtotal =
                cycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;
              const planDiscount = Math.round(
                (subtotal * (plan.discountPercent ?? 0)) / 100
              );
              setCheckout({
                planName: plan.name,
                billingCycle: cycle,
                subtotal,
                planDiscount,
                voucherDiscount: 0,
                total: Math.max(0, subtotal - planDiscount),
              });
            }}
          />
          {highlight && (
            <p className="mt-4 text-center text-xs text-accent">{highlight}</p>
          )}
        </div>

        <div className="border-t border-border p-4 text-center">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Nanti saja
          </Button>
        </div>
      </div>
    </div>
  );
}
