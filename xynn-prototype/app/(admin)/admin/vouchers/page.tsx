"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Ticket } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

type Voucher = {
  id: string;
  code: string;
  discountPercent: number | null;
  discountAmount: number | null;
  usedCount: number;
  maxUses: number;
  validUntil: string | null;
};

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [code, setCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/vouchers")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setVouchers(d))
      .catch(() => toast.error("Gagal memuat voucher"))
      .finally(() => setLoading(false));
  }, []);

  const createVoucher = async () => {
    if (!code) {
      toast.error("Kode wajib diisi");
      return;
    }
    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, discountPercent }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVouchers((prev) => [data, ...prev]);
      setCode("");
      toast.success("Voucher dibuat");
    } catch {
      toast.error("Gagal membuat voucher");
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
        title="Vouchers"
        description="Kelola kupon diskon langganan."
      />

      <Card>
        <CardHeader>
          <CardTitle>Buat Voucher</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Kode" className="flex-1">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="LAUNCH50"
              className="font-mono uppercase"
            />
          </Field>
          <Field label="Diskon (%)" className="sm:w-32">
            <Input
              type="number"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
            />
          </Field>
          <Button onClick={createVoucher} className="sm:w-auto">
            <Plus className="h-4 w-4" />
            Buat
          </Button>
        </CardBody>
      </Card>

      {vouchers.length === 0 ? (
        <EmptyState icon={<Ticket className="h-5 w-5" />} title="Belum ada voucher" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {vouchers.map((v) => (
            <Card key={v.id} className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <p className="truncate font-mono font-semibold text-foreground">
                  {v.code}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Diskon {v.discountPercent ?? 0}% · {v.usedCount}/{v.maxUses} terpakai
                </p>
              </div>
              <Badge tone={v.usedCount >= v.maxUses ? "danger" : "success"}>
                {v.usedCount >= v.maxUses ? "Habis" : "Aktif"}
              </Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
