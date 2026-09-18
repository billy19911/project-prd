"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowLeft,
  Lock,
  Send,
  Plus,
  Loader2,
  Trash2,
  Wand2,
  FileText,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoonGate } from "@/components/coming-soon-gate";
import { Select } from "@/components/ui/input";
import { useSubscription } from "@/lib/use-subscription";
import { cn } from "@/lib/utils";

type Thread = {
  id: string;
  title: string;
  workspaceId: string | null;
  updatedAt: string;
  messageCount: number;
};

type Message = { id: string; role: string; content: string };

type ConsultAction = {
  kind: "regen-screen" | "fix-prd";
  target: string;
  reason: string;
};

type Project = { id: string; title: string; fullPrdMd?: string | null; prototypeJson?: unknown };

const PRD_SECTIONS = [
  "Executive Summary",
  "Problem Statement",
  "Goals & Non-Goals",
  "Target Users & Personas",
  "Core Features",
  "User Flows",
  "Screens & UI Structure",
  "Data Model",
  "Tech Stack",
  "Success Metrics",
  "Milestones / Phases",
  "Risks & Open Questions",
];

/**
 * Konsultasi AI — konsultan arsitektur & tech stack.
 *
 * Fitur berbayar (STARTER ke atas). Halaman dibungkus `ComingSoonGate`:
 * selama flag fitur "consult" belum LIVE, yang tampil adalah layar
 * "Segera Hadir" walaupun backend & frontend-nya sudah lengkap.
 */
export default function ConsultPage() {
  return (
    <ComingSoonGate
      feature="consult"
      title="Konsultasi AI"
      description="Diskusikan arsitektur, tech stack, dan roadmap eksekusi bersama AI konsultan. Fitur ini sedang disiapkan."
      bullets={[
        "Tanya-jawab arsitektur aplikasi secara mendalam",
        "Review tech stack & rekomendasi perbaikan",
        "Rencana eksekusi bertahap sesuai skala timmu",
      ]}
    >
      <ConsultWorkspace />
    </ComingSoonGate>
  );
}

function ConsultWorkspace() {
  const { isPaid, loading: subLoading } = useSubscription();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [booting, setBooting] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [actions, setActions] = useState<ConsultAction[]>([]);
  const [applyingAction, setApplyingAction] = useState<string | null>(null);
  const [manualKind, setManualKind] = useState<"fix-prd" | "regen-screen">("fix-prd");
  const [manualTarget, setManualTarget] = useState<string>("");
  const logRef = useRef<HTMLDivElement>(null);

  // Project efektif yang sedang dibahas (thread aktif bila ada, atau pilihan dropdown).
  const activeWorkspaceId =
    threads.find((t) => t.id === activeId)?.workspaceId || projectId || "";
  const activeProject = projects.find((p) => p.id === activeWorkspaceId);
  const screens: string[] =
    (activeProject?.prototypeJson as { screens?: { label?: string }[] } | null)
      ?.screens?.map((s) => s.label)
      .filter((l): l is string => !!l) ?? [];
  const hasPrd = !!activeProject?.fullPrdMd;
  const canApply = !!activeWorkspaceId && (manualKind === "fix-prd" ? hasPrd : screens.length > 0);

  /* ---------- muat daftar project ---------- */
  useEffect(() => {
    if (subLoading || !isPaid) return;
    fetch("/api/workspace")
      .then((r) => (r.ok ? r.json() : []))
      .then(
        (
          d: {
            id: string;
            title: string;
            fullPrdMd?: string | null;
            prototypeJson?: unknown;
          }[]
        ) =>
          setProjects(
            d.map((w) => ({
              id: w.id,
              title: w.title,
              fullPrdMd: w.fullPrdMd ?? null,
              prototypeJson: w.prototypeJson ?? null,
            }))
          )
      )
      .catch(() => {});
  }, [subLoading, isPaid]);

  /* ---------- muat daftar thread ---------- */
  const loadThreads = async () => {
    const res = await fetch("/api/consult/threads");
    if (!res.ok) throw new Error();
    setThreads(await res.json());
  };

  useEffect(() => {
    if (subLoading) return;
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active) return;
      if (!isPaid) {
        setBooting(false);
        return;
      }
      try {
        const res = await fetch("/api/consult/threads");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (active) setThreads(data);
      } catch {
        /* gate ditangani UI */
      } finally {
        if (active) setBooting(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [subLoading, isPaid]);

  /* ---------- muat pesan thread aktif ---------- */
  useEffect(() => {
    if (!activeId) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/consult/threads/${activeId}`);
        if (!res.ok) throw new Error();
        const d = await res.json();
        if (active) setMessages(d.messages || []);
      } catch {
        if (active) toast.error("Gagal memuat pesan");
      }
    })();
    return () => {
      active = false;
    };
  }, [activeId]);

  /* ---------- scroll ke bawah ---------- */
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, sending]);

  /* ---------- aksi ---------- */
  const newThread = async () => {
    try {
      const res = await fetch("/api/consult/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: projectId || undefined }),
      });
      if (!res.ok) throw new Error();
      const t = await res.json();
      setThreads((prev) => [
        { ...t, messageCount: 0, workspaceId: t.workspaceId ?? null },
        ...prev,
      ]);
      setActiveId(t.id);
      setMessages([]);
      setActions([]);
    } catch {
      toast.error("Gagal membuat konsultasi");
    }
  };

  const removeThread = async (id: string) => {
    try {
      const res = await fetch("/api/consult/threads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      setThreads((prev) => prev.filter((t) => t.id !== id));
      if (activeId === id) setActiveId(null);
    } catch {
      toast.error("Gagal menghapus konsultasi");
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    // Buat thread otomatis bila belum ada.
    let tid = activeId;
    if (!tid) {
      const res = await fetch("/api/consult/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: projectId || undefined }),
      });
      if (!res.ok) {
        toast.error("Gagal membuat konsultasi");
        return;
      }
      const t = await res.json();
      tid = t.id;
      setActiveId(t.id);
      setThreads((prev) => [{ ...t, messageCount: 0, workspaceId: t.workspaceId ?? null }, ...prev]);
    }

    // Optimistis: tampilkan pesan pengguna langsung.
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: text },
    ]);
    setDraft("");
    setActions([]);
    setSending(true);

    try {
      const res = await fetch("/api/ai/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: tid, message: text }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal mengirim");
      setMessages((prev) => [
        ...prev,
        { id: `ai-${Date.now()}`, role: "assistant", content: d.reply },
      ]);
      setActions(Array.isArray(d.actions) ? d.actions : []);
      void loadThreads();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim pesan");
      setDraft(text);
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("local-")));
    } finally {
      setSending(false);
    }
  };

  const applyAction = async (a: ConsultAction) => {
    if (!activeId) return;
    const key = `${a.kind}:${a.target}`;
    setApplyingAction(key);
    try {
      const res = await fetch(`/api/consult/threads/${activeId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: a.kind, target: a.target, reason: a.reason }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal menerapkan aksi");
      toast.success(d.message || "Aksi diterapkan.");
      setActions((prev) => prev.filter((x) => !(x.kind === a.kind && x.target === a.target)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menerapkan aksi");
    } finally {
      setApplyingAction(null);
    }
  };

  // Tombol aksi MANUAL — tidak bergantung blok aksi dari AI (selalu tersedia
  // bila thread tertaut project). Blok AI tetap jadi bonus bila muncul.
  const applyManual = async () => {
    if (!activeId || !manualTarget) return;
    const key = `manual:${manualKind}:${manualTarget}`;
    setApplyingAction(key);
    try {
      const res = await fetch(`/api/consult/threads/${activeId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: manualKind, target: manualTarget }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal menerapkan aksi");
      toast.success(d.message || "Aksi diterapkan.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menerapkan aksi");
    } finally {
      setApplyingAction(null);
    }
  };

  /* ---------- gate berbayar ---------- */
  // Selama status langganan dimuat, tampilkan rangka (bukan konten penuh) agar
  // tidak ada kedipan konten lalu tertimpa layar lock.
  if (subLoading) {
    return <ConsultSkeleton />;
  }

  if (!isPaid) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface/60 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">
            Konsultasi AI untuk pelanggan berbayar
          </h2>
          <p className="max-w-md text-xs text-muted">
            Diskusikan arsitektur, tech stack, dan roadmap eksekusi bersama AI
            konsultan. Tersedia mulai paket STARTER.
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
    // Tinggi dikunci ke viewport (offset topbar mobile + padding `main`), area
    // chat memakai `flex-1 min-h-0` agar mengisi sisa ruang tanpa menebak.
    <div className="flex h-[calc(100dvh-6.5rem)] flex-col gap-4 lg:h-[calc(100dvh-4rem)]">
      <PageHeader
        title="Konsultasi AI"
        description="Diskusikan arsitektur, tech stack, dan roadmap eksekusi bersama AI konsultan."
      />

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-[var(--radius-card)] border border-border lg:grid-cols-[260px_1fr]">
        {/* Daftar thread */}
        <aside className="flex min-h-0 flex-col overflow-hidden border-b border-border bg-surface/40 lg:border-b-0 lg:border-r">
          <div className="flex h-11 items-center gap-2 border-b border-border px-3">
            <span className="text-xs font-medium text-foreground">Konsultasi</span>
            <button
              onClick={() => void newThread()}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-border-strong bg-surface-2 px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-surface"
            >
              <Plus className="h-3 w-3" />
              Baru
            </button>
          </div>

          <div className="flex-1 overflow-auto p-2">
            {booting ? (
              <p className="flex items-center gap-2 px-2 py-3 text-[11px] text-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                Memuat...
              </p>
            ) : threads.length === 0 ? (
              <p className="px-2 py-3 text-[11px] leading-relaxed text-muted">
                Belum ada konsultasi. Klik <b className="text-foreground">Baru</b>{" "}
                untuk mulai.
              </p>
            ) : (
              <ul className="space-y-1">
                {threads.map((t) => (
                  <li key={t.id}>
                    <div
                      className={cn(
                        "group flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors",
                        activeId === t.id ? "bg-surface-2" : "hover:bg-surface-2/60"
                      )}
                    >
                      <button
                        onClick={() => {
                          setActiveId(t.id);
                          setActions([]);
                        }}
                        className={cn(
                          "min-w-0 flex-1 truncate text-left text-[11px]",
                          activeId === t.id ? "text-foreground" : "text-muted"
                        )}
                      >
                        {t.title}
                        <span className="ml-1 font-mono text-[9px] text-muted">
                          {t.messageCount}
                        </span>
                      </button>
                      <button
                        onClick={() => void removeThread(t.id)}
                        aria-label={`Hapus ${t.title}`}
                        className="shrink-0 rounded p-1.5 text-muted transition-opacity hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Ruang percakapan */}
        <section className="flex min-h-0 flex-col overflow-hidden">
          {/* Baris atas: pilih project (konteks konsultasi) */}
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
            <span className="shrink-0 text-[11px] text-muted">Project</span>
            <Select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={!!activeId}
              className="h-7 max-w-[200px] truncate text-[11px]"
              title={activeId ? "Project terkunci setelah konsultasi dimulai" : undefined}
            >
              <option value="">— tanpa project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
            {activeId && (
              <span className="truncate text-[10px] text-muted">
                {activeProject?.title ?? "tanpa project"}
              </span>
            )}
          </div>

          {/* Baris aksi manual: terapkan perubahan ke PRD / prototype */}
          {activeWorkspaceId && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/30 px-3 py-2">
              <Wand2 className="h-3.5 w-3.5 shrink-0 text-accent" />
              <Select
                value={manualKind}
                onChange={(e) => {
                  setManualKind(e.target.value as "fix-prd" | "regen-screen");
                  setManualTarget("");
                }}
                className="h-7 w-auto text-[11px]"
              >
                <option value="fix-prd" disabled={!hasPrd}>
                  Perbaiki PRD
                </option>
                <option value="regen-screen" disabled={screens.length === 0}>
                  Regenerate screen
                </option>
              </Select>
              <Select
                value={manualTarget}
                onChange={(e) => setManualTarget(e.target.value)}
                className="h-7 max-w-[220px] text-[11px]"
              >
                <option value="">— pilih —</option>
                {manualKind === "fix-prd"
                  ? PRD_SECTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))
                  : screens.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
              </Select>
              <button
                onClick={() => void applyManual()}
                disabled={!canApply || !manualTarget || !!applyingAction}
                className={buttonClasses({
                  variant: "secondary",
                  size: "sm",
                  className: "h-7 px-2 text-[11px]",
                })}
              >
                {applyingAction?.startsWith("manual:") ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Wand2 className="h-3 w-3" />
                )}
                Terapkan
              </button>
              {!hasPrd && manualKind === "fix-prd" && (
                <span className="text-[10px] text-muted">Project ini belum punya PRD.</span>
              )}
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col">
            <div ref={logRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && !sending ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <Sparkles className="h-6 w-6 text-muted" />
                  <p className="max-w-sm text-xs leading-relaxed text-muted">
                    Tanyakan apa saja soal arsitektur, pilihan tech stack,
                    tantangan skalabilitas, atau roadmap eksekusi. Pilih sebuah
                    project agar saran bisa langsung diterapkan ke PRD/prototype.
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                      m.role === "user"
                        ? "ml-auto bg-accent text-white"
                        : "border border-border bg-surface-2 text-foreground"
                    )}
                  >
                    {m.content}
                  </div>
                ))
              )}

              {/* Tombol aksi terarah dari konsultan (bila ada) */}
              {actions.length > 0 && !sending && (
                <div className="space-y-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                    <Wand2 className="h-3.5 w-3.5 text-accent" />
                    Saran aksi — klik untuk menerapkan
                  </p>
                  {actions.map((a) => {
                    const key = `${a.kind}:${a.target}`;
                    const busy = applyingAction === key;
                    return (
                      <button
                        key={key}
                        onClick={() => void applyAction(a)}
                        disabled={!!applyingAction}
                        className="flex w-full items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-left text-[11px] transition-colors hover:border-accent/50 disabled:opacity-60"
                      >
                        {busy ? (
                          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
                        ) : a.kind === "regen-screen" ? (
                          <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                        ) : (
                          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                        )}
                        <span className="min-w-0">
                          <span className="font-medium text-foreground">
                            {a.kind === "regen-screen"
                              ? `Regenerate screen: ${a.target}`
                              : `Perbaiki PRD: ${a.target}`}
                          </span>
                          {a.reason && (
                            <span className="mt-0.5 block text-muted">{a.reason}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {sending && (
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Menyusun balasan...
                </div>
              )}
            </div>

            <div className="flex items-end gap-2 border-t border-border p-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder="Tanya soal arsitektur atau tech stack... (Enter untuk kirim)"
                className="min-h-[44px] flex-1 resize-none rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-xs text-foreground placeholder:text-muted"
              />
              <button
                onClick={() => void send()}
                disabled={!draft.trim() || sending}
                aria-label="Kirim"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </section>
      </div>

      <p className="flex items-center gap-1.5 text-[10px] text-muted">
        <ArrowLeft className="h-3 w-3" />
        Untuk spesifikasi siap-kode, buat project lalu generate PRD lengkap.
      </p>
    </div>
  );
}

/**
 * Rangka pemuatan untuk Konsultasi AI. Tampil selama status langganan dimuat
 * sehingga konten tidak berkedip lalu tertimpa layar lock.
 */
function ConsultSkeleton() {
  return (
    <div className="flex h-[calc(100dvh-6.5rem)] flex-col gap-4 lg:h-[calc(100dvh-4rem)]">
      <PageHeader
        title="Konsultasi AI"
        description="Diskusikan arsitektur, tech stack, dan roadmap eksekusi bersama AI konsultan."
      />
      <div className="grid min-h-0 flex-1 overflow-hidden rounded-[var(--radius-card)] border border-border lg:grid-cols-[260px_1fr]">
        <aside className="hidden min-h-0 flex-col gap-2 border-r border-border bg-surface/40 p-3 lg:flex">
          <div className="h-8 w-full animate-pulse rounded-md bg-surface-2" />
          <div className="h-7 w-full animate-pulse rounded-md bg-surface-2/70" />
          <div className="h-7 w-3/4 animate-pulse rounded-md bg-surface-2/70" />
        </aside>
        <section className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
          <div className="border-t border-border p-3">
            <div className="h-11 w-full animate-pulse rounded-lg bg-surface-2" />
          </div>
        </section>
      </div>
    </div>
  );
}
