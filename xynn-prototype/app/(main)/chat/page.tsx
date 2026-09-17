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
  const logRef = useRef<HTMLDivElement>(null);

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

    try {
      const res = await fetch("/api/ai/chat", {
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
      void loadThreads();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim pesan");
      // Kembalikan draft agar tidak hilang.
      setDraft(text);
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("local-")));
    } finally {
      setSending(false);
    }
  };

  /* ---------- gate PRO ---------- */
  if (!subLoading && !canUsePrototype) {
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
    <div className="space-y-6">
      <PageHeader
        title="Chat Prototype"
        description="Susun kebutuhan prototype sambil mengobrol. Prototype di-generate dari tab Prototype."
      />

      <div className="grid h-[calc(100dvh-14rem)] min-h-[420px] overflow-hidden rounded-[var(--radius-card)] border border-border lg:h-auto lg:min-h-[600px] lg:grid-cols-[260px_1fr]">
        {/* Daftar thread */}
        <aside className="flex flex-col border-b border-border bg-surface/40 lg:border-b-0 lg:border-r">
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
                        onClick={() => setActiveId(t.id)}
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
        <section className="flex flex-col">
          <div className="flex flex-1 flex-col overflow-hidden">
            <div ref={logRef} className="flex-1 space-y-3 overflow-auto p-4">
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
        </section>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted">
        <ArrowLeft className="h-3 w-3" />
        Setelah alur jelas, buka sebuah project lalu generate prototype dari tab
        Prototype.
      </p>
    </div>
  );
}
