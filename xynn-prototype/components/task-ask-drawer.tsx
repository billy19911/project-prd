"use client";

import { useEffect, useRef, useState } from "react";
import { X, Send, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TASK_STATUS_LABEL, type TaskItem, type TaskStatus } from "@/lib/task-status";
import { buildTaskPrompt } from "@/lib/task-prompt";

/**
 * Drawer "Tanya AI" per task.
 *
 * Menghubungkan kartu kanban ke Konsultasi AI tanpa pindah halaman: pesan
 * pertama otomatis diisi prompt konteks task, lalu pengguna bisa lanjut
 * bertanya. Thread dibuat/dipakai per task agar riwayatnya terpisah.
 */

type Props = {
  /** Workspace tempat task berada (untuk thread consult). */
  workspaceId: string;
  /** Task yang sedang dibahas. null = drawer tertutup. */
  task: TaskItem | null;
  status: TaskStatus;
  /** Konteks proyek untuk prompt pembuka. */
  context: { title: string; techStack?: string[] | null; description?: string | null; locale?: string | null };
  onClose: () => void;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

async function fetchThread(taskId: string, workspaceId: string): Promise<string> {
  const listRes = await fetch("/api/consult/threads");
  if (listRes.ok) {
    const threads: { id: string; title: string; workspaceId: string | null }[] =
      await listRes.json();
    // Cari thread yang dibuat untuk task ini (judul mengandung id task).
    const existing = threads.find(
      (t) => t.workspaceId === workspaceId && t.title.includes(`[${taskId}]`)
    );
    if (existing) return existing.id;
  }
  const res = await fetch("/api/consult/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId }),
  });
  if (!res.ok) throw new Error("Gagal membuat thread konsultasi");
  return (await res.json()).id;
}

async function sendConsult(
  threadId: string,
  message: string
): Promise<string> {
  const res = await fetch("/api/ai/consult", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, message }),
  });
  const d = await res.json().catch(() => ({}));
  if (res.status === 402) {
    const err = new Error(d.error || "Konsultasi AI tersedia untuk paket berbayar.") as Error & {
      paywall?: boolean;
    };
    err.paywall = true;
    throw err;
  }
  if (!res.ok) throw new Error(d.error || "Gagal mengirim");
  return d.reply as string;
}

export function TaskAskDrawer({ workspaceId, task, status, context, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [booting, setBooting] = useState(true);
  const [threadId, setThreadId] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Boot: buat/cari thread lalu kirim prompt konteks task otomatis.
  useEffect(() => {
    if (!task) return;
    let active = true;
    // Reset dijadwalkan asinkron agar tidak memicu cascading render
    // (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      if (!active) return;
      setMessages([]);
      setDraft("");
      setThreadId(null);
      setBooting(true);
    });
    (async () => {
      try {
        const tid = await fetchThread(task.id, workspaceId);
        if (!active) return;
        setThreadId(tid);
        const opener =
          status === "failed"
            ? `Task "${task.title}" GAGAL. Bantu saya mendiagnosis penyebabnya lalu perbaiki. Detail: ${task.description || "(tanpa detail)"}`
            : `Bantu saya mengerjakan task "${task.title}". Detail: ${task.description || "(tanpa detail)"}. Status saat ini: ${TASK_STATUS_LABEL[status]}.`;
        const primer = buildTaskPrompt(task, context, status);
        const reply = await sendConsult(tid, `${opener}\n\n---\n${primer}`);
        if (!active) return;
        setMessages([
          { role: "user", content: opener },
          { role: "assistant", content: reply },
        ]);
      } catch (e) {
        if (!active) return;
        const err = e as Error & { paywall?: boolean };
        if (err.paywall) {
          setMessages([
            {
              role: "assistant",
              content:
                "Konsultasi AI tersedia untuk paket berbayar. Upgrade dulu untuk berdiskusi soal task ini — atau pakai tombol copy prompt untuk dikerjakan di CLI.",
            },
          ]);
        } else {
          toast.error(err.message || "Gagal memulai konsultasi");
        }
      } finally {
        if (active) setBooting(false);
      }
    })();
    return () => {
      active = false;
    };
    // Boot ulang tiap ganti task. sengaja bukan tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, sending]);

  if (!task) return null;

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || !threadId) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setDraft("");
    setSending(true);
    try {
      const reply = await sendConsult(threadId, text);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim pesan");
      setDraft(text);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Sparkles className="h-4 w-4 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
            <p className="text-[11px] text-muted">
              {task.phase} · <Badge tone="outline">{TASK_STATUS_LABEL[status]}</Badge>
            </p>
          </div>
          <button
            aria-label="Tutup"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={logRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {booting && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Menyiapkan konsultasi task...
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-relaxed",
                m.role === "user"
                  ? "ml-auto bg-accent/15 text-foreground"
                  : "bg-surface-2 text-foreground"
              )}
            >
              {m.content}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              AI berpikir...
            </div>
          )}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Tanya soal task ini..."
              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-xs text-foreground placeholder:text-muted/60 focus:border-accent/60 focus:outline-none"
            />
            <Button size="sm" onClick={send} disabled={!draft.trim() || sending || !threadId}>
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] text-muted">
            Dibalas Konsultasi AI dengan konteks PRD + style guide project ini.
          </p>
        </div>
      </div>
    </div>
  );
}
