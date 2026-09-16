"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock, Plus, Save, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

type PaymentGateway = {
  id: string;
  provider: string;
  isActive: boolean;
  isProduction: boolean;
  clientKey: string;
  merchantId?: string | null;
  hasServerKey: boolean;
  hasWebhookSecret: boolean;
};

type FormState = {
  provider: string;
  isProduction: boolean;
  merchantId: string;
  clientKey: string;
  serverKey: string;
  webhookSecret: string;
};

const emptyForm: FormState = {
  provider: "midtrans",
  isProduction: false,
  merchantId: "",
  clientKey: "",
  serverKey: "",
  webhookSecret: "",
};

export default function PaymentsPage() {
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/payment-gateways");
      if (res.ok) setGateways(await res.json());
    } catch {
      toast.error("Gagal memuat gateway");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/admin/payment-gateways")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (active) setGateways(data);
      })
      .catch(() => toast.error("Gagal memuat gateway"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch("/api/admin/payment-gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      if (!res.ok) throw new Error();
      setGateways((prev) =>
        prev.map((g) => (g.id === id ? { ...g, isActive: !isActive } : g))
      );
      toast.success(`Gateway ${!isActive ? "diaktifkan" : "dinonaktifkan"}`);
    } catch {
      toast.error("Gagal mengubah status");
    }
  };

  const handleCreate = async () => {
    if (!form.clientKey.trim()) {
      toast.error("Client Key wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/payment-gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success("Gateway tersimpan (serverKey terenkripsi AES-256-GCM)");
      setForm(emptyForm);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

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
        title="Payment Gateways"
        description="Kelola integrasi Midtrans/Xendit. Server Key dienkripsi di level database."
      />

      {gateways.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-5 w-5" />}
          title="Belum ada gateway"
          description="Tambahkan gateway di bawah untuk mulai menerima pembayaran."
        />
      ) : (
        <div className="space-y-3">
          {gateways.map((gw) => (
            <Card key={gw.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium capitalize text-foreground">{gw.provider}</p>
                  <Badge tone={gw.isProduction ? "danger" : "neutral"}>
                    {gw.isProduction ? "Production" : "Sandbox"}
                  </Badge>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-muted">
                  {gw.clientKey.slice(0, 24)}...
                </p>
                {gw.hasServerKey && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-success">
                    <Lock className="h-3 w-3" />
                    Server Key terenkripsi
                  </p>
                )}
              </div>
              <Button
                variant={gw.isActive ? "success" : "secondary"}
                size="sm"
                onClick={() => toggleActive(gw.id, gw.isActive)}
                className="shrink-0"
              >
                {gw.isActive ? "Aktif" : "Nonaktif"}
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-muted" />
            Tambah / Perbarui Gateway
          </CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider">
            <Select
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
            >
              <option value="midtrans">midtrans</option>
              <option value="xendit">xendit</option>
            </Select>
          </Field>

          <Field label="Merchant ID (opsional)">
            <Input
              value={form.merchantId}
              onChange={(e) => setForm({ ...form, merchantId: e.target.value })}
            />
          </Field>

          <Field label="Client Key">
            <Input
              value={form.clientKey}
              onChange={(e) => setForm({ ...form, clientKey: e.target.value })}
              className="font-mono"
            />
          </Field>

          <Field label="Server Key" hint="Dienkripsi AES-256-GCM sebelum disimpan">
            <Input
              type="password"
              value={form.serverKey}
              onChange={(e) => setForm({ ...form, serverKey: e.target.value })}
              placeholder="SB-Mid-server-..."
              className="font-mono"
            />
          </Field>

          <Field label="Webhook Secret">
            <Input
              type="password"
              value={form.webhookSecret}
              onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
              className="font-mono"
            />
          </Field>

          <label className="flex items-end gap-2 pb-2.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={form.isProduction}
              onChange={(e) => setForm({ ...form, isProduction: e.target.checked })}
              className="h-4 w-4 rounded border-border-strong bg-surface-2 accent-[color:var(--accent)]"
            />
            Mode Production
          </label>

          <div className="sm:col-span-2">
            <Button onClick={handleCreate} disabled={saving} className="w-full sm:w-auto">
              <Save className="h-4 w-4" />
              {saving ? "Menyimpan..." : "Simpan Gateway"}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
