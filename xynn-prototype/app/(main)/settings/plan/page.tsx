"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Ticket, CalendarClock, Zap, CheckCircle2, Receipt, AlertTriangle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PricingPlans, type PlanView } from "@/components/pricing-plans";
import { CheckoutModal, type CheckoutSummary } from "@/components/checkout-modal";

type Usage = {
  planType: string;
  status: string;
  billingCycle: string;
  prdLimit: number;
  prdUsedThisMonth: number;
  workspaceCount: number;
  startedAt: string | null;
  validUntil: string | null;
  daysLeft: number | null;
  isActive: boolean;
};

type TransactionRow = {
  id: string;
  amount: number;
  planType: string;
  billingCycle: string;
  status: string;
  createdAt: string;
};

export default function PlanSettingsPage() {
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [voucher, setVoucher] = useState("");
  const [checkout, setCheckout] = useState<CheckoutSummary | null>(null);

  const loadUsage = () =>
    fetch("/api/user/subscription")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUsage)
      .catch(() => {});

  const loadTransactions = () =>
    fetch("/api/user/transactions")
      .then((r) => (r.ok ? r.json() : []))
      .then(setTransactions)
      .catch(() => {});

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => (r.ok ? r.json() : []))
      .then(setPlans)
      .catch(() => {});
    loadTransactions();
    loadUsage();
  }, []);

  // Setelah kembali dari gateway (mis. Snap Midtrans), cek status transaksi yang
  // tertunda. Bila Midtrans sudah menandainya lunas, langganan diaktifkan server.
  useEffect(() => {
    let pendingId: string | null = null;
    try {
      pendingId = localStorage.getItem("xynn_pending_tx");
    } catch {
      /* abaikan */
    }
    if (!pendingId) return;

    let tries = 0;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      tries += 1;
      try {
        const r = await fetch(`/api/checkout/status?id=${pendingId}`);
        if (r.ok) {
          const d = (await r.json()) as { status?: string };
          if (d.status === "SUCCESS") {
            localStorage.removeItem("xynn_pending_tx");
            await Promise.all([loadUsage(), loadTransactions()]);
            toast.success("Pembayaran berhasil! Langganan aktif.");
            return;
          }
          if (d.status === "FAILED") {
            localStorage.removeItem("xynn_pending_tx");
            return;
          }
        }
      } catch {
        /* lanjut poll */
      }
      if (tries < 5 && !cancelled) setTimeout(poll, 3000);
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = (plan: PlanView, cycle: "MONTHLY" | "YEARLY") => {
    const subtotal = cycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;
    const planDiscount = Math.round((subtotal * (plan.discountPercent ?? 0)) / 100);
    setCheckout({
      planName: plan.name,
      billingCycle: cycle,
      subtotal,
      planDiscount,
      voucherDiscount: 0,
      total: Math.max(0, subtotal - planDiscount),
    });
  };

  const limitLabel = usage
    ? usage.prdLimit === -1
      ? "Unlimited"
      : `${usage.prdUsedThisMonth} / ${usage.prdLimit}`
    : "—";

  const fmtDate = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "—";

  return (
    <div className="space-y-6">
      {/* Status langganan */}
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">Paket Aktif</p>
            <div className="mt-1.5 flex items-center gap-2">
              <p className="font-mono text-lg font-bold text-foreground">
                {usage?.planType ?? "FREE"}
              </p>
              <Badge tone={usage?.isActive ? "success" : "neutral"}>
                {usage?.isActive ? "Aktif" : "Tidak Aktif"}
              </Badge>
            </div>
            {usage?.isActive && usage.billingCycle && (
              <p className="mt-0.5 text-[11px] text-muted">
                Siklus {usage.billingCycle === "YEARLY" ? "Tahunan" : "Bulanan"}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted">PRD Bulan Ini</p>
            <p className="mt-1.5 font-mono text-lg font-bold text-foreground">
              {limitLabel}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {usage?.workspaceCount ?? 0} workspace
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-muted">
              <CalendarClock className="h-3 w-3" />
              Masa Aktif
            </p>
            {usage?.isActive && usage.validUntil ? (
              <>
                <p className="mt-1.5 text-sm font-medium text-foreground">
                  s/d {fmtDate(usage.validUntil)}
                </p>
                <p
                  className={
                    usage.daysLeft !== null && usage.daysLeft <= 7
                      ? "mt-0.5 text-[11px] text-warning"
                      : "mt-0.5 text-[11px] text-success"
                  }
                >
                  {usage.daysLeft !== null
                    ? `Sisa ${usage.daysLeft} hari`
                    : "Aktif"}
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-sm text-muted">Tidak berlangganan</p>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Info aktif / peringatan hampir habis */}
      {usage?.isActive && usage.daysLeft !== null && usage.daysLeft <= 7 && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Langganan berakhir <strong>{fmtDate(usage.validUntil)}</strong> · tersisa{" "}
            <strong>{usage.daysLeft} hari</strong>. Segera perpanjang agar akses tidak terputus.
          </span>
        </div>
      )}
      {usage?.isActive && (usage.daysLeft === null || usage.daysLeft > 7) && (
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-4 py-3 text-sm text-muted">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          <span>
            Langganan aktif hingga <strong className="text-foreground">{fmtDate(usage.validUntil)}</strong>
            {usage.daysLeft !== null && ` · tersisa ${usage.daysLeft} hari`}.
          </span>
        </div>
      )}

      {/* Voucher */}
      <Card>
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Kode Voucher (opsional)" className="flex-1">
            <div className="relative">
              <Ticket className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={voucher}
                onChange={(e) => setVoucher(e.target.value.toUpperCase())}
                placeholder="cth: LAUNCH50"
                className="pl-9 font-mono"
              />
            </div>
          </Field>
          <p className="text-xs text-muted sm:pb-2.5">
            Diterapkan otomatis saat checkout.
          </p>
        </CardBody>
      </Card>

      {/* Pricing */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Pilih Paket</h2>
        </div>
        <PricingPlans
          plans={plans}
          mode="checkout"
          currentPlan={usage?.planType}
          onSelect={handleSelect}
        />
      </div>

      {checkout && (
        <CheckoutModal
          summary={checkout}
          voucherCode={voucher.trim() || undefined}
          onClose={() => setCheckout(null)}
          onPaid={() => {
            setCheckout(null);
            loadUsage();
            fetch("/api/user/transactions")
              .then((r) => (r.ok ? r.json() : []))
              .then(setTransactions)
              .catch(() => {});
          }}
        />
      )}

      {/* Riwayat transaksi */}
      {transactions.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted" />
            <h2 className="text-sm font-semibold text-foreground">Riwayat Transaksi</h2>
          </div>
          <Card className="divide-y divide-border">
            {transactions.map((trx) => {
              const statusTone =
                trx.status === "SUCCESS"
                  ? "success"
                  : trx.status === "PENDING"
                    ? "warning"
                    : "danger";
              return (
                <div
                  key={trx.id}
                  className="flex items-center justify-between gap-3 p-4 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {trx.planType}{" "}
                      <span className="text-xs font-normal text-muted">
                        · {trx.billingCycle === "YEARLY" ? "Tahunan" : trx.billingCycle === "QUARTERLY" ? "Kuartal" : "Bulanan"}
                      </span>
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(trx.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-foreground">
                      Rp {trx.amount.toLocaleString("id-ID")}
                    </p>
                    <Badge tone={statusTone}>{trx.status}</Badge>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}
    </div>
  );
}
