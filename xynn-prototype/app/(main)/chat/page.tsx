"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowLeft,
  Lock,
  Send,
  Plus,
  Loader2,
  Trash2,
  FileText,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoonGate } from "@/components/coming-soon-gate";
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

/**
 * Chat Prototype — pintu masuk kedua untuk Prototype Design.
 *
 * Chat ini menggali kebutuhan pengguna (bukan langsung menulis HTML);
 * prototype di-generate dari tab Prototype. Karena itu ia PRO ke atas.
 *
 * Halaman dibungkus `ComingSoonGate`: selama flag fitur "chat" belum LIVE,
 * yang tampil adalah layar "Segera Hadir" walaupun fiturnya sudah lengkap.
 */
export default function ChatPage() {
  return (
    <ComingSoonGate
      feature="chat"
      title="Chat Prototype"
      description="Susun kebutuhan prototype sambil mengobrol dengan AI. Fitur ini sedang disiapkan."
      bullets={[
        "Ngobrol untuk memetakan screen & alur",
        "Jadi pintu masuk kedua untuk Prototype Design",
        "Tersedia mulai paket PRO",
      ]}
    >
      <ChatWorkspace />
    </ComingSoonGate>
  );
}

function ChatWorkspace() {
  const { canUsePrototype, loading: subLoading } = useSubscription();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [booting, setBooting] = useState(true);
  const [prdDraft, setPrdDraft] = useState<string | null>(null);
  const [draftingPrd, setDraftingPrd] = useState(false);
  const [applyingPrd, setApplyingPrd] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  /* ---------- muat daftar thread ---------- */
  const loadThreads = async () => {
    const res = await fetch("/api/chat/threads");
    if (!res.ok) throw new Error();
    setThreads(await res.json());
  };

  useEffect(() => {
    if (subLoading) return;
    let active = true;
    (async () => {
      // Tunggu microtask agar tidak setState langsung di badan effect.
      await Promise.resolve();
      if (!active) return;
      if (!canUsePrototype) {
        setBooting(false);
        return;
      }
      try {
        const res = await fetch("/api/chat/threads");
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
  }, [subLoading, canUsePrototype]);

  /* ---------- muat pesan thread aktif ---------- */
  useEffect(() => {
    if (!activeId) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/chat/threads/${activeId}`);
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
      const res = await fetch("/api/chat/threads", { method: "POST" });
      if (!res.ok) throw new Error();
      const t = await res.json();
      setThreads((prev) => [
        { ...t, messageCount: 0, workspaceId: t.workspaceId ?? null },
        ...prev,
      ]);
      setActiveId(t.id);
      setMessages([]);
    } catch {
      toast.error("Gagal membuat percakapan");
    }
  };

  const removeThread = async (id: string) => {
    try {
      const res = await fetch("/api/chat/threads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      setThreads((prev) => prev.filter((t) => t.id !== id));
      if (activeId === id) setActiveId(null);
    } catch {
      toast.error("Gagal menghapus percakapan");
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    // Buat thread otomatis bila belum ada.
    let tid = activeId;
    if (!tid) {
      const res = await fetch("/api/chat/threads", { method: "POST" });
      if (!res.ok) {
        toast.error("Gagal membuat percakapan");
        return;
      }
      const t = await res.json();
      tid = t.id;
      setActiveId(t.id);
      setThreads((prev) => [{ ...t, messageCount: 0 }, ...prev]);
    }

    // Optimistis: tampilkan pesan pengguna langsung.
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: text },
    ]);
    setDraft("");
    setSending(true);

    const aiId = `ai-${Date.now()}`;
    // Placeholder balasan assistant yang diisi bertahap dari stream.
    setMessages((prev) => [...prev, { id: aiId, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: tid, message: text }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Gagal mengirim");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload) continue;
          let evt: { delta?: string; done?: boolean; error?: string } | null = null;
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          if (evt?.error) throw new Error(evt.error);
          if (evt?.delta) {
            acc += evt.delta;
            setMessages((prev) =>
              prev.map((m) => (m.id === aiId ? { ...m, content: acc } : m))
            );
          }
        }
      }

      if (!acc.trim()) {
        throw new Error("Tidak ada balasan. Coba lagi.");
      }
      void loadThreads();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim pesan");
      // Kembalikan draft & buang balasan kosong.
      setDraft(text);
      setMessages((prev) =>
        prev.filter((m) => !m.id.startsWith("local-") && !(m.id === aiId && !m.content))
      );
    } finally {
      setSending(false);
    }
  };

  /* ---------- simpulkan & terapkan PRD ---------- */
  const draftPrd = async () => {
    if (!activeId) {
      toast.error("Mulai percakapan dulu sebelum menyusun PRD.");
      return;
    }
    setDraftingPrd(true);
    try {
      const res = await fetch(`/api/chat/threads/${activeId}/draft-prd`, {
        method: "POST",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal menyusun PRD");
      setPrdDraft(d.prd as string);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyusun PRD");
    } finally {
      setDraftingPrd(false);
    }
  };

  const applyPrd = async () => {
    if (!activeId || !prdDraft) return;
    setApplyingPrd(true);
    try {
      const res = await fetch(`/api/chat/threads/${activeId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prd: prdDraft }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal menerapkan PRD");
      toast.success("Project dibuat! Mengarahkan ke project...");
      router.push(`/project/${d.workspaceId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menerapkan PRD");
    } finally {
      setApplyingPrd(false);
    }
  };

  /* ---------- gate PRO ---------- */
  // Selama status langganan dimuat, tampilkan rangka (bukan konten chat penuh)
  // agar tidak ada kedipan konten lalu tertimpa layar lock.
  if (subLoading) {
    return <ChatSkeleton />;
  }

  if (!canUsePrototype) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface/60 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">
            Chat Prototype khusus PRO
          </h2>
          <p className="max-w-md text-xs text-muted">
            Susun prototype sambil mengobrol. Tersedia mulai paket PRO.
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
    // Tinggi halaman dikunci ke viewport (dikurangi offset topbar mobile +
    // padding `main`), lalu area chat memakai `flex-1 min-h-0` agar mengisi
    // SISA ruang — tidak lagi menebak tinggi lewat `calc` yang mudah meleset.
    <div className="flex h-[calc(100dvh-6.5rem)] flex-col gap-4 lg:h-[calc(100dvh-4rem)]">
      <PageHeader
        title="Chat Prototype"
        description="Dari ide mentah jadi PRD: AI mempertajam workflow, mengusulkan pertanyaan & analisa, lalu menyimpulkan PRD untuk kamu terapkan."
      />

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-[var(--radius-card)] border border-border lg:grid-cols-[260px_1fr]">
        {/* Daftar thread */}
        <aside className="flex min-h-0 flex-col overflow-hidden border-b border-border bg-surface/40 lg:border-b-0 lg:border-r">
          <div className="flex h-11 items-center gap-2 border-b border-border px-3">
            <span className="text-xs font-medium text-foreground">Percakapan</span>
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
                Belum ada percakapan. Klik <b className="text-foreground">Baru</b>{" "}
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
                          setPrdDraft(null);
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
        <section className="relative flex min-h-0 flex-col overflow-hidden">
          {/* Baris aksi: Susun PRD dari percakapan */}
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
            <span className="truncate text-xs font-medium text-foreground">
              {threads.find((t) => t.id === activeId)?.title ?? "Chat Prototype"}
            </span>
            <button
              onClick={() => void draftPrd()}
              disabled={!activeId || messages.length === 0 || draftingPrd}
              className={buttonClasses({
                variant: "secondary",
                size: "sm",
                className: "ml-auto h-7 px-2 text-[11px]",
              })}
            >
              {draftingPrd ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <FileText className="h-3 w-3" />
              )}
              Susun PRD
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div ref={logRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && !sending ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <Sparkles className="h-6 w-6 text-muted" />
                  <p className="max-w-sm text-xs leading-relaxed text-muted">
                    Ceritakan aplikasi yang ingin kamu bangun. Saya bantu
                    memetakan screen, alur, dan kontennya — lalu prototype
                    di-generate dari tab Prototype.
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

              {sending && !messages.some((m) => m.role === "assistant" && m.content) && (
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
                placeholder="Ceritakan aplikasimu... (Enter untuk kirim)"
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

          {/* Panel draf PRD (overlay) — user review/edit lalu Terapkan */}
          {prdDraft !== null && (
            <div className="absolute inset-0 z-10 flex flex-col bg-background">
              <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
                <FileText className="h-4 w-4 text-accent" />
                <span className="text-xs font-medium text-foreground">
                  Draf PRD — tinjau &amp; edit sebelum diterapkan
                </span>
                <button
                  onClick={() => setPrdDraft(null)}
                  aria-label="Tutup"
                  className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={prdDraft}
                onChange={(e) => setPrdDraft(e.target.value)}
                spellCheck={false}
                className="min-h-0 flex-1 resize-none bg-background p-4 font-mono text-xs leading-relaxed text-foreground outline-none"
              />
              <div className="flex items-center justify-end gap-2 border-t border-border p-3">
                <button
                  onClick={() => setPrdDraft(null)}
                  className={buttonClasses({ variant: "secondary", size: "sm" })}
                >
                  Batal
                </button>
                <button
                  onClick={() => void applyPrd()}
                  disabled={applyingPrd || !prdDraft.trim()}
                  className={buttonClasses({ variant: "primary", size: "sm" })}
                >
                  {applyingPrd ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Terapkan ke Project
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <p className="flex items-center gap-1.5 text-[10px] text-muted">
        <ArrowLeft className="h-3 w-3" />
        Setelah alur jelas, buka sebuah project lalu generate prototype dari tab
        Prototype.
      </p>
    </div>
  );
}

/**
 * Rangka pemuatan untuk Chat Prototype. Tampil selama status langganan dimuat
 * sehingga konten chat tidak berkedip lalu tertimpa layar lock.
 */
function ChatSkeleton() {
  return (
    <div className="flex h-[calc(100dvh-6.5rem)] flex-col gap-4 lg:h-[calc(100dvh-4rem)]">
      <PageHeader
        title="Chat Prototype"
        description="Dari ide mentah jadi PRD: AI mempertajam workflow, mengusulkan pertanyaan & analisa, lalu menyimpulkan PRD untuk kamu terapkan."
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
