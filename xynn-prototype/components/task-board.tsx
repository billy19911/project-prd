"use client";

import { useMemo, useState } from "react";
import {
  ClipboardList,
  Loader2,
  PlayCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  RotateCcw,
  AlertTriangle,
  Copy,
  ClipboardCopy,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  normalizeStatus,
  taskCounts,
  type TaskGroup,
  type TaskItem,
  type TaskStatus,
} from "@/lib/task-status";
import { buildTaskPrompt, buildTaskBoardPrompt, type WorkspaceContext } from "@/lib/task-prompt";

/**
 * Board kanban task: 4 kolom (Task → Ongoing → Selesai → Fail).
 *
 * Status DISIMPAN ke server via PATCH /api/workspace/tasks-status supaya
 * bertahan lintas refresh & perangkat (sebelumnya hanya checklist boolean di
 * state komponen yang hilang saat refresh).
 *
 * Optimistic update: UI berpindah duluan, lalu dikembalikan bila API gagal.
 */

type Props = {
  workspaceId: string;
  groups: TaskGroup[];
  /** Dipanggil setelah server mengonfirmasi perubahan (untuk sinkron state induk). */
  onChange?: (groups: TaskGroup[]) => void;
  /** Bila true, board read-only (mis. akses lihat saja). */
  readOnly?: boolean;
  /**
   * Konteks proyek untuk menyusun prompt per-task (copy prompt). Bila tidak
   * diisi, tombol copy tetap tampil memakai judul generik dari data board.
   */
  context?: WorkspaceContext;
  /**
   * Dipanggil saat pengguna menekan tombol "Tanya AI" pada sebuah task.
   * Induk (project detail) menanganinya — mis. membuka drawer konsultasi.
   */
  onAskAi?: (task: TaskItem, status: TaskStatus) => void;
};

const COLUMN_META: Record<
  TaskStatus,
  { icon: React.ComponentType<{ className?: string }>; tone: string; ring: string }
> = {
  todo: { icon: ClipboardList, tone: "text-muted", ring: "border-border" },
  doing: { icon: PlayCircle, tone: "text-accent", ring: "border-accent/40" },
  done: { icon: CheckCircle2, tone: "text-success", ring: "border-success/40" },
  failed: { icon: XCircle, tone: "text-danger", ring: "border-danger/40" },
};

/** Status berikutnya saat kartu digeser ke kanan (alur normal). */
const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  todo: "doing",
  doing: "done",
  failed: "doing",
};

export function TaskBoard({
  workspaceId,
  groups,
  onChange,
  readOnly = false,
  context,
  onAskAi,
}: Props) {
  const [local, setLocal] = useState<TaskGroup[]>(groups);
  const [pending, setPending] = useState<string | null>(null);

  const ctx: WorkspaceContext = context ?? { title: "Project" };

  /** Salin prompt satu task ke clipboard. */
  const copyTaskPrompt = async (task: TaskItem, status: TaskStatus) => {
    const prompt = buildTaskPrompt(task, ctx, status);
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt task disalin");
    } catch {
      toast.error("Gagal menyalin prompt");
    }
  };

  /** Salin prompt gabungan (prioritas: ongoing → failed → todo). */
  const copyBoardPrompt = async () => {
    const prompt = buildTaskBoardPrompt(local, ctx);
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt board disalin");
    } catch {
      toast.error("Gagal menyalin prompt");
    }
  };

  // Selaraskan dengan prop bila induk memuat ulang data (mis. setelah generate).
  const groupsKey = useMemo(() => JSON.stringify(groups), [groups]);
  const [lastKey, setLastKey] = useState(groupsKey);
  if (groupsKey !== lastKey) {
    setLastKey(groupsKey);
    setLocal(groups);
  }

  const counts = taskCounts(local);
  const donePct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;

  const columns = useMemo(() => {
    const map: Record<TaskStatus, TaskItem[]> = {
      todo: [],
      doing: [],
      done: [],
      failed: [],
    };
    for (const g of local) {
      for (const t of g.tasks ?? []) {
        map[normalizeStatus(t.status)].push(t);
      }
    }
    return map;
  }, [local]);

  const move = async (task: TaskItem, status: TaskStatus) => {
    if (readOnly || pending) return;
    const prev = local;
    // Optimistic: pindahkan kartu dulu.
    const optimistic = prev.map((g) => ({
      ...g,
      tasks: g.tasks.map((t) =>
        t.id === task.id ? { ...t, status } : t
      ),
    }));
    setLocal(optimistic);
    setPending(task.id);

    try {
      const res = await fetch("/api/workspace/tasks-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: workspaceId, taskId: task.id, status }),
      });
      if (!res.ok) throw new Error();
      onChange?.(optimistic);
    } catch {
      setLocal(prev); // kembalikan bila gagal
      toast.error("Gagal memindahkan task");
    } finally {
      setPending(null);
    }
  };

  if (counts.total === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted">Belum ada task.</p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress ringkas */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="font-medium text-foreground">{donePct}%</span>
          selesai
        </div>
        <div className="h-1.5 min-w-32 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-success transition-all"
            style={{ width: `${donePct}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TASK_STATUSES.map((s) => (
            <Badge key={s} tone={s === "failed" && counts.failed > 0 ? "danger" : "outline"}>
              {TASK_STATUS_LABEL[s]} {counts[s]}
            </Badge>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={copyBoardPrompt}
          className="shrink-0"
          title="Salin prompt semua task (ongoing → gagal → todo) untuk di-paste ke AI coding agent"
        >
          <ClipboardCopy className="h-3.5 w-3.5" />
          Copy prompt
        </Button>
      </div>

      {readOnly && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-xs text-muted">
          <AlertTriangle className="h-3.5 w-3.5" />
          Anda punya akses lihat saja — status tidak dapat diubah.
        </div>
      )}

      {/* Kanban */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUSES.map((status) => {
          const meta = COLUMN_META[status];
          const Icon = meta.icon;
          const items = columns[status];
          const next = NEXT_STATUS[status];

          return (
            <div
              key={status}
              className={cn(
                "flex min-h-40 flex-col rounded-xl border bg-surface/30",
                meta.ring
              )}
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <span className={cn("flex items-center gap-1.5 text-xs font-semibold", meta.tone)}>
                  <Icon className="h-3.5 w-3.5" />
                  {TASK_STATUS_LABEL[status]}
                </span>
                <span className="font-mono text-[10px] text-muted">{items.length}</span>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-2">
                {items.length === 0 && (
                  <p className="px-1 py-4 text-center text-[11px] text-muted/60">Kosong</p>
                )}

                {items.map((task) => {
                  const isPending = pending === task.id;
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "group rounded-lg border border-border bg-surface-2/50 p-2.5 transition-colors",
                        isPending && "opacity-60"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium leading-snug text-foreground">
                          {task.title}
                        </p>
                        <Badge
                          tone={
                            task.priority === "high"
                              ? "danger"
                              : task.priority === "medium"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {task.priority}
                        </Badge>
                      </div>

                      {task.description && (
                        <p className="mt-1 text-[11px] leading-relaxed text-muted">
                          {task.description}
                        </p>
                      )}

                      <div className="mt-2 flex items-center justify-between gap-1">
                        <span className="truncate text-[10px] text-muted/70">
                          {task.phase}
                        </span>

                        <div className="flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                          {/* Copy prompt task — tersedia walau read-only. */}
                          <button
                            title="Copy prompt task ini"
                            onClick={() => copyTaskPrompt(task, status)}
                            className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                          </button>

                          {onAskAi && (
                            <button
                              title="Tanya AI soal task ini"
                              onClick={() => onAskAi(task, status)}
                              className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-accent/10 hover:text-accent"
                            >
                              <Sparkles className="h-3 w-3" />
                            </button>
                          )}

                          {!readOnly && (
                            <>
                              {isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
                              ) : (
                                <>
                                  {status !== "todo" && (
                                    <button
                                      title="Kembalikan ke Task"
                                      onClick={() => move(task, "todo")}
                                      className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface hover:text-foreground"
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                    </button>
                                  )}
                                  {next && (
                                    <button
                                      title={`Pindah ke ${TASK_STATUS_LABEL[next]}`}
                                      onClick={() => move(task, next)}
                                      className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface hover:text-foreground"
                                    >
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {status === "doing" && (
                                    <button
                                      title="Tandai gagal"
                                      onClick={() => move(task, "failed")}
                                      className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-danger/10 hover:text-danger"
                                    >
                                      <XCircle className="h-3 w-3" />
                                    </button>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
