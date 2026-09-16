"use client";

import { useState } from "react";
import {
  X,
  Check,
  Copy,
  Loader2,
  QrCode,
  Landmark,
  Wallet,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PAYMENT_METHODS,
  type PaymentMethodId,
  type PaymentInstruction,
} from "@/lib/payments";

export type CheckoutSummary = {
  planName: string;
  billingCycle: "MONTHLY" | "YEARLY";
  subtotal: number;
  planDiscount: number;
  voucherDiscount: number;
  total: number;
};

const fmt = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

const METHOD_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  QRIS: QrCode,
  "Virtual Account": Landmark,
  "E-Wallet": Wallet,
};

export function CheckoutModal({
  summary,
  voucherCode,
  onClose,
  onPaid,
}: {
  summary: CheckoutSummary;
  voucherCode?: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethodId>("qris");
  const [loading, setLoading] = useState(false);
  const [instruction, setInstruction] = useState<PaymentInstruction | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  const createTransaction = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode: summary.planName.toUpperCase(),
          billingCycle: summary.billingCycle,
          voucherCode: voucherCode || undefined,
          method,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat transaksi");

      if (data.paymentUrl) {
        toast.info("Mengarahkan ke payment gateway...");
        window.location.assign(data.paymentUrl);
        return;
      }

      setTransactionId(data.transactionId);
      setInstruction(data.instruction);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const confirmPaid = async () => {
    if (!transactionId) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memverifikasi");
      toast.success("Pembayaran berhasil! Langganan aktif.");
      onPaid();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memverifikasi pembayaran");
    } finally {
      setConfirming(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Disalin");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {instruction ? "Selesaikan Pembayaran" : "Checkout"}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Paket {summary.planName} ·{" "}
              {summary.billingCycle === "YEARLY" ? "Tahunan" : "Bulanan"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-0 sm:grid-cols-[1fr_240px]">
          {/* Left: method / instruction */}
          <div className="border-b border-border p-5 sm:border-b-0 sm:border-r">
            {!instruction ? (
              <>
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
                  Metode Pembayaran
                </p>
                <div className="space-y-2">
                  {PAYMENT_METHODS.map((m) => {
                    const Icon = METHOD_ICON[m.group] ?? Wallet;
                    const active = method === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setMethod(m.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                          active
                            ? "border-accent/60 bg-accent/5 ring-1 ring-inset ring-accent/20"
                            : "border-border hover:border-border-strong"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">{m.label}</p>
                          <p className="text-[11px] text-muted">{m.desc}</p>
                        </div>
                        {active && <Check className="h-4 w-4 shrink-0 text-accent" />}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge tone="accent">{instruction.label}</Badge>
                  <span className="flex items-center gap-1 text-[11px] text-muted">
                    <Clock className="h-3 w-3" />
                    Berlaku 1 jam
                  </span>
                </div>

                {instruction.qrString && (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-2/40 p-4">
                    <div className="flex h-40 w-40 items-center justify-center rounded-lg bg-white p-2">
                      {/* QR placeholder bergaya — di produksi pakai gambar QRIS asli */}
                      <QrCode className="h-28 w-28 text-black" />
                    </div>
                    <p className="text-[11px] text-muted">
                      Scan dengan aplikasi e-wallet / m-banking
                    </p>
                  </div>
                )}

                {instruction.vaNumber && (
                  <div className="rounded-xl border border-border bg-surface-2/40 p-4">
                    <p className="text-[11px] uppercase tracking-wide text-muted">
                      Nomor Virtual Account
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-lg font-semibold tracking-wider text-foreground">
                        {instruction.vaNumber}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => copy(instruction.vaNumber!)}
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-muted">
                    Cara bayar
                  </p>
                  <ol className="space-y-1.5">
                    {instruction.steps.map((s, i) => (
                      <li key={i} className="flex gap-2 text-xs text-muted">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] text-foreground">
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>

          {/* Right: summary */}
          <div className="p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
              Ringkasan
            </p>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="font-mono text-foreground">{fmt(summary.subtotal)}</dd>
              </div>
              {summary.planDiscount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">Diskon paket</dt>
                  <dd className="font-mono text-success">-{fmt(summary.planDiscount)}</dd>
                </div>
              )}
              {summary.voucherDiscount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">Voucher</dt>
                  <dd className="font-mono text-success">-{fmt(summary.voucherDiscount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2">
                <dt className="font-medium text-foreground">Total</dt>
                <dd className="font-mono text-base font-bold text-foreground">
                  {fmt(summary.total)}
                </dd>
              </div>
            </dl>

            <div className="mt-5">
              {!instruction ? (
                <Button className="w-full" onClick={createTransaction} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {loading ? "Membuat pembayaran..." : "Lanjut Bayar"}
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button className="w-full" onClick={confirmPaid} disabled={confirming}>
                    {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {confirming ? "Memverifikasi..." : "Saya Sudah Bayar"}
                  </Button>
                  <p className="text-center text-[10px] leading-relaxed text-muted">
                    Tekan setelah melakukan pembayaran untuk mengaktifkan langganan.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
