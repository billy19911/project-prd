"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users, Plus, Loader2, Lock, Trash2, Crown, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

type Member = {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  role: "OWNER" | "EDITOR" | "VIEWER";
};

type Invite = { id: string; email: string; role: string; createdAt: string };

type Org = {
  id: string;
  name: string;
  slug: string;
  myRole: string;
  isOwner: boolean;
  seat: { used: number; limit: number; pending: number };
  members: Member[];
  invites: Invite[];
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Pemilik",
  EDITOR: "Editor",
  VIEWER: "Lihat saja",
};

const ROLE_TONE: Record<string, "accent" | "success" | "neutral"> = {
  OWNER: "accent",
  EDITOR: "success",
  VIEWER: "neutral",
};

function RoleIcon({ role }: { role: string }) {
  if (role === "OWNER") return <Crown className="h-3 w-3" />;
  if (role === "EDITOR") return <Pencil className="h-3 w-3" />;
  return <Eye className="h-3 w-3" />;
}

export default function TeamPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  // Gate diambil dari SERVER, bukan dari langganan pribadi klien.
  // Anggota org ENTERPRISE berhak walau langganan pribadinya bukan ENTERPRISE,
  // jadi `canSaveThemes` (yang hanya melihat langganan sendiri) akan salah
  // mengunci mereka. Server (/api/org) memakai `hasEnterpriseViaOrg`.
  const [allowed, setAllowed] = useState(true);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({});
  const [inviteRole, setInviteRole] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/org");
      if (res.status === 401) {
        setAllowed(false);
        return;
      }
      if (res.status === 402) {
        // Bukan ENTERPRISE (langsung atau lewat org).
        setAllowed(false);
        return;
      }
      if (!res.ok) throw new Error();
      setAllowed(true);
      setOrgs(await res.json());
    } catch {
      /* kegagalan jaringan: biarkan state terakhir */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (active) await load();
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const createOrg = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setNewName("");
      toast.success("Tim dibuat");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat tim");
    } finally {
      setBusy(false);
    }
  };

  const invite = async (orgId: string) => {
    const email = (inviteEmail[orgId] || "").trim();
    if (!email) return;
    setBusy(true);
    try {
      const res = await fetch("/api/org/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          email,
          role: inviteRole[orgId] || "VIEWER",
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setInviteEmail((p) => ({ ...p, [orgId]: "" }));
      toast.success("Undangan dikirim");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengundang");
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (orgId: string, userId: string, role: string) => {
    try {
      const res = await fetch("/api/org/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, userId, role }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success("Peran diperbarui");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah peran");
    }
  };

  const removeMember = async (orgId: string, userId: string) => {
    try {
      const res = await fetch("/api/org/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, userId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success("Anggota dikeluarkan");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengeluarkan anggota");
    }
  };

  const revokeInvite = async (orgId: string, inviteId: string) => {
    try {
      const res = await fetch("/api/org/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, inviteId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Undangan dibatalkan");
      await load();
    } catch {
      toast.error("Gagal membatalkan undangan");
    }
  };

  /* ---------- gate ENTERPRISE (ditentukan server) ---------- */
  if (!loading && !allowed) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface/60 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">
            Kolaborasi tim khusus ENTERPRISE
          </h2>
          <p className="max-w-md text-xs text-muted">
            Undang anggota, atur peran, dan kelola seat bersama tim Anda.
            Tersedia di paket ENTERPRISE (3 seat termasuk).
          </p>
          <Link
            href="/settings/plan"
            className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-1" })}
          >
            Lihat Plan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tim"
        description="Kelola anggota, peran, dan seat tim Anda."
      />

      <Card>
        <CardHeader>
          <CardTitle>Buat tim baru</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Nama tim" className="flex-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="cth: Studio Nusantara"
              maxLength={60}
            />
          </Field>
          <Button onClick={createOrg} disabled={!newName.trim() || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Buat tim
          </Button>
        </CardBody>
      </Card>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      ) : orgs.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Belum ada tim"
          description="Buat tim untuk mulai berkolaborasi. Paket ENTERPRISE termasuk 3 seat."
        />
      ) : (
        orgs.map((org) => {
          const seatFull = org.seat.used + org.seat.pending >= org.seat.limit;
          return (
            <Card key={org.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{org.name}</CardTitle>
                  <Badge tone={ROLE_TONE[org.myRole] || "neutral"}>
                    <RoleIcon role={org.myRole} />
                    {ROLE_LABEL[org.myRole] || org.myRole}
                  </Badge>
                  <span className="font-mono text-[10px] text-muted">{org.slug}</span>
                </div>
                <Badge tone={seatFull ? "warning" : "outline"}>
                  Seat {org.seat.used}/{org.seat.limit}
                  {org.seat.pending > 0 ? ` (+${org.seat.pending} menunggu)` : ""}
                </Badge>
              </CardHeader>

              <CardBody className="space-y-4">
                {/* Anggota */}
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                    Anggota ({org.members.length})
                  </p>
                  <ul className="space-y-1.5">
                    {org.members.map((m) => (
                      <li
                        key={m.membershipId}
                        className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-[10px] text-muted">
                          {(m.name || m.email).slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                          {m.name || m.email}
                          <span className="ml-1 text-muted">{m.name ? m.email : ""}</span>
                        </span>

                        {org.isOwner && m.role !== "OWNER" ? (
                          <>
                            <select
                              value={m.role}
                              onChange={(e) => void changeRole(org.id, m.userId, e.target.value)}
                              className="shrink-0 rounded border border-border-strong bg-surface-2 px-1.5 py-0.5 text-[10px] text-foreground"
                            >
                              <option value="EDITOR">Editor</option>
                              <option value="VIEWER">Lihat saja</option>
                            </select>
                            <button
                              onClick={() => void removeMember(org.id, m.userId)}
                              aria-label={`Keluarkan ${m.email}`}
                              className="shrink-0 rounded p-1 text-muted transition-colors hover:text-danger"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <Badge tone={ROLE_TONE[m.role] || "neutral"}>
                            <RoleIcon role={m.role} />
                            {ROLE_LABEL[m.role] || m.role}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Undangan menunggu */}
                {org.invites.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                      Menunggu diterima ({org.invites.length})
                    </p>
                    <ul className="space-y-1.5">
                      {org.invites.map((i) => (
                        <li
                          key={i.id}
                          className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2"
                        >
                          <span className="min-w-0 flex-1 truncate text-xs text-muted">
                            {i.email}
                          </span>
                          <Badge tone="outline">{ROLE_LABEL[i.role] || i.role}</Badge>
                          {org.isOwner && (
                            <button
                              onClick={() => void revokeInvite(org.id, i.id)}
                              aria-label={`Batalkan undangan ${i.email}`}
                              className="shrink-0 rounded p-1 text-muted transition-colors hover:text-danger"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Undang anggota (hanya pemilik) */}
                {org.isOwner && (
                  <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-end">
                    <Field label="Undang lewat email" className="flex-1">
                      <Input
                        type="email"
                        value={inviteEmail[org.id] || ""}
                        onChange={(e) =>
                          setInviteEmail((p) => ({ ...p, [org.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void invite(org.id);
                        }}
                        placeholder="nama@email.com"
                        disabled={seatFull}
                      />
                    </Field>
                    <Field label="Peran">
                      <Select
                        value={inviteRole[org.id] || "VIEWER"}
                        onChange={(e) =>
                          setInviteRole((p) => ({ ...p, [org.id]: e.target.value }))
                        }
                        disabled={seatFull}
                      >
                        <option value="EDITOR">Editor</option>
                        <option value="VIEWER">Lihat saja</option>
                      </Select>
                    </Field>
                    <Button
                      onClick={() => void invite(org.id)}
                      disabled={seatFull || busy || !(inviteEmail[org.id] || "").trim()}
                    >
                      <Plus className="h-4 w-4" />
                      Undang
                    </Button>
                  </div>
                )}

                {seatFull && org.isOwner && (
                  <p className="text-[10px] text-warning">
                    Seat penuh ({org.seat.used + org.seat.pending}/{org.seat.limit}).
                    Keluarkan anggota atau batalkan undangan untuk mengundang lagi.
                  </p>
                )}
              </CardBody>
            </Card>
          );
        })
      )}
    </div>
  );
}
