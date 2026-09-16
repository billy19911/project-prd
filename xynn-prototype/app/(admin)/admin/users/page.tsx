"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  subscription: {
    planType: string;
    status: string;
    validUntil: string | null;
  } | null;
};

const PLAN_OPTIONS = ["FREE", "STARTER", "PRO", "PRO_YEARLY"];

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: UserRow[]) => {
        setUsers(d);
        const init: Record<string, string> = {};
        d.forEach((u) => (init[u.id] = u.subscription?.planType || "FREE"));
        setDrafts(init);
      })
      .catch(() => toast.error("Gagal memuat user"))
      .finally(() => setLoading(false));
  }, []);

  const changePlan = async (userId: string) => {
    const code = drafts[userId];
    if (!code) return;
    setSavingId(userId);
    try {
      const res = await fetch("/api/admin/users/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah paket");
      toast.success(`Paket diubah ke ${code}`);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, subscription: data.subscription } : u
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah paket");
    } finally {
      setSavingId(null);
    }
  };

  const planTone = (plan: string) =>
    plan === "PRO" || plan === "PRO_YEARLY"
      ? "success"
      : plan === "STARTER"
        ? "accent"
        : "neutral";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Kelola pengguna, paket langganan, dan akses."
        actions={<Badge tone="neutral">{users.length} user</Badge>}
      />

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : users.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="Belum ada user" />
      ) : (
        <Card className="divide-y divide-border">
          {users.map((u) => {
            const plan = u.subscription?.planType || "FREE";
            return (
              <div
                key={u.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {u.name || "—"}
                  </p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone={planTone(plan)}>{plan}</Badge>
                    <Badge tone={u.subscription?.status === "ACTIVE" ? "success" : "warning"}>
                      {u.subscription?.status || "INACTIVE"}
                    </Badge>
                    {u.subscription?.validUntil && (
                      <span className="text-[11px] text-muted">
                        s/d{" "}
                        {new Date(u.subscription.validUntil).toLocaleDateString("id-ID")}
                      </span>
                    )}
                    {u.role === "ADMIN" && <Badge tone="danger">ADMIN</Badge>}
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:w-auto">
                  <Select
                    value={drafts[u.id] || "FREE"}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [u.id]: e.target.value }))
                    }
                    className="h-9 w-36 text-xs"
                  >
                    {PLAN_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => changePlan(u.id)}
                    disabled={savingId === u.id || drafts[u.id] === plan}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingId === u.id ? "..." : "Set"}
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
