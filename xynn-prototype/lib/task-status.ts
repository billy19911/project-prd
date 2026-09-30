/**
 * Status lifecycle sebuah task — MURNI (tanpa React/DB) supaya bisa diuji.
 *
 * Sebelumnya task breakdown hanyalah checklist boolean (dicentang / tidak) yang
 * disimpan di state komponen sehingga hilang saat refresh. Board kanban butuh
 * status yang lebih kaya dan tersimpan, plus bisa dilaporkan CLI.
 *
 * Alur normal: todo → doing → done
 * Cabang gagal: doing → failed → (doing lagi bila dikerjakan ulang)
 */

export type TaskStatus = "todo" | "doing" | "done" | "failed";

/** Task item tunggal di dalam sebuah phase. */
export type TaskItem = {
  id: string;
  title: string;
  description: string;
  phase: string;
  priority: "high" | "medium" | "low";
  /** Status lifecycle. Task lama (tanpa field ini) dianggap "todo". */
  status?: TaskStatus;
};

export type TaskGroup = { phase: string; tasks: TaskItem[] };

export const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "done", "failed"];

/** Label manusiawi per status (untuk board & laporan CLI). */
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Task",
  doing: "Ongoing",
  done: "Selesai",
  failed: "Fail",
};

/** Status yang valid dianggap "sudah dikerjakan" (untuk progress). */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES as string[]).includes(value);
}

/**
 * Normalisasi status dari data tak tepercaya (JSON lama / input klien).
 * Nilai tidak dikenal → "todo" agar tidak pernah ada task tanpa kolom.
 */
export function normalizeStatus(value: unknown): TaskStatus {
  return isTaskStatus(value) ? value : "todo";
}

/**
 * Ubah status satu task di dalam struktur groups.
 *
 * MURNI: mengembalikan salinan baru, tidak memutasi input. Bila taskId tidak
 * ditemukan, mengembalikan groups apa adanya (false pada `changed`) supaya
 * pemanggil bisa menjawab 404 tanpa menulis ulang DB dengan data yang sama.
 */
export function setTaskStatus(
  groups: TaskGroup[] | null | undefined,
  taskId: string,
  status: TaskStatus
): { groups: TaskGroup[]; changed: boolean } {
  if (!Array.isArray(groups) || !taskId) {
    return { groups: Array.isArray(groups) ? groups : [], changed: false };
  }

  let changed = false;
  const next = groups.map((group) => ({
    ...group,
    tasks: (Array.isArray(group.tasks) ? group.tasks : []).map((task) => {
      if (task.id !== taskId) return task;
      if (normalizeStatus(task.status) === status) return task; // sudah sama
      changed = true;
      return { ...task, status };
    }),
  }));

  return { groups: next, changed };
}

/**
 * Hitung progress per status untuk seluruh groups.
 * Dipakai board (badge kolom) & laporan ke server via CLI.
 */
export function taskCounts(groups: TaskGroup[] | null | undefined): {
  total: number;
  todo: number;
  doing: number;
  done: number;
  failed: number;
} {
  const counts = { total: 0, todo: 0, doing: 0, done: 0, failed: 0 };
  if (!Array.isArray(groups)) return counts;

  for (const group of groups) {
    for (const task of Array.isArray(group.tasks) ? group.tasks : []) {
      counts.total += 1;
      counts[normalizeStatus(task.status)] += 1;
    }
  }
  return counts;
}

/**
 * Status keseluruhan board — `failed` menang agar kegagalan menonjol, lalu
 * `doing` bila ada yang berjalan, `done` bila semua selesai.
 */
export function boardStatus(groups: TaskGroup[] | null | undefined): TaskStatus {
  const c = taskCounts(groups);
  if (c.total === 0) return "todo";
  if (c.failed > 0) return "failed";
  if (c.doing > 0) return "doing";
  if (c.done === c.total) return "done";
  return "todo";
}
