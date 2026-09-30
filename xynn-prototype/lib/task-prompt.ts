/**
 * Penyusun prompt per-task untuk di-paste ke AI coding agent (CLI/IDE) —
 * MURNI (tanpa React/DB) supaya bisa diuji tanpa browser.
 *
 * Tujuan: pengguna tidak perlu menyalin PRD seluruhnya lalu menulis instruksi
 * manual. Setiap task menghasilkan prompt ringkas & mandiri yang memuat
 * konteks proyek (judul, tech stack, acuan file) + acceptance criteria task.
 *
 * CATATAN: modul ini SENGAJA tidak mengimpor apa pun (mis. `@/lib/task-status`)
 * agar `node:test` bisa memuatnya tanpa resolver alias. Label status
 * diduplikasi kecil di sini — sumber kebenarannya tetap `lib/task-status.ts`.
 */

export type TaskStatus = "todo" | "doing" | "done" | "failed";

export type TaskItem = {
  id: string;
  title: string;
  description: string;
  phase: string;
  priority: "high" | "medium" | "low";
  status?: TaskStatus;
};

/** Label manusiawi per status — harus selaras dengan lib/task-status.ts. */
const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Task",
  doing: "Ongoing",
  done: "Selesai",
  failed: "Fail",
};

export type WorkspaceContext = {
  title: string;
  description?: string | null;
  techStack?: string[] | null;
  locale?: string | null;
};

/** Prefix penanda status di output bulk (biar mudah dibaca manusia). */
const STATUS_HEADING: Record<TaskStatus, string> = {
  todo: "TODO",
  doing: "SEDANG DIKERJAKAN",
  done: "SELESAI",
  failed: "GAGAL — PERLU DIPERBAIKI",
};

/**
 * Prompt untuk SATU task.
 *
 * `status` memengaruhi instruksi: task yang `failed` diberi arahan perbaikan,
 * task `done` diberi arahan verifikasi (bukan implementasi ulang).
 */
export function buildTaskPrompt(
  task: TaskItem,
  ctx: WorkspaceContext,
  status: TaskStatus = "todo"
): string {
  const stack = (ctx.techStack ?? []).filter(Boolean).join(", ") || "(belum ditentukan)";
  const lang = ctx.locale === "en" ? "en" : "id";

  const intro =
    lang === "en"
      ? `You are working on the project "${ctx.title}".`
      : `Anda mengerjakan proyek "${ctx.title}".`;

  const ctxLines =
    lang === "en"
      ? [
          `- Tech stack: ${stack}`,
          ctx.description ? `- Project description: ${ctx.description}` : null,
          `- Reference files: PRD.md (spec), tasks.md (task list), STYLEGUIDE.md (design system)`,
        ]
      : [
          `- Tech stack: ${stack}`,
          ctx.description ? `- Deskripsi proyek: ${ctx.description}` : null,
          `- Acuan file: PRD.md (spesifikasi), tasks.md (daftar task), STYLEGUIDE.md (design system)`,
        ];

  const instruction =
    status === "failed"
      ? lang === "en"
        ? "The previous attempt FAILED. Diagnose the root cause and fix it. Explain what went wrong in 1-2 lines, then apply the fix."
        : "Percobaan sebelumnya GAGAL. Cari akar masalahnya lalu perbaiki. Jelaskan penyebabnya 1-2 baris, lalu terapkan perbaikannya."
      : status === "done"
        ? lang === "en"
          ? "This task is marked done. Verify the implementation is complete and list any gaps; only change code if something is missing."
          : "Task ini sudah ditandai selesai. Verifikasi implementasinya lengkap dan sebutkan bila ada yang kurang; ubah kode hanya bila memang ada yang belum."
        : lang === "en"
          ? "Implement this task. Follow the PRD and style guide. Keep changes scoped to this task."
          : "Implementasikan task ini. Ikuti PRD dan style guide. Batasi perubahan hanya pada task ini.";

  return [
    intro,
    "",
    ...ctxLines.filter(Boolean),
    "",
    lang === "en" ? "## Task" : "## Task",
    `- ${lang === "en" ? "Phase" : "Fase"}: ${task.phase}`,
    `- ${lang === "en" ? "Priority" : "Prioritas"}: ${task.priority}`,
    `- ${lang === "en" ? "Status" : "Status"}: ${TASK_STATUS_LABEL[status]}`,
    `- ${lang === "en" ? "Title" : "Judul"}: ${task.title}`,
    task.description ? `- ${lang === "en" ? "Detail" : "Detail"}: ${task.description}` : null,
    "",
    "## " + (lang === "en" ? "Instructions" : "Instruksi"),
    instruction,
    "",
    lang === "en"
      ? "When done, report: what changed, which files, and how to verify."
      : "Setelah selesai, laporkan: apa yang berubah, file mana saja, dan cara memverifikasinya.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/**
 * Prompt gabungan untuk banyak task, dikelompokkan per status agar pengguna
 * bisa paste bertahap (mis. kerjakan yang `doing` dulu, baru yang `failed`).
 */
export function buildTaskBoardPrompt(
  groups: { phase: string; tasks: TaskItem[] }[],
  ctx: WorkspaceContext,
  opts: { statuses?: TaskStatus[] } = {}
): string {
  const wanted = opts.statuses ?? (["doing", "failed", "todo"] as TaskStatus[]);
  const langs = ctx.locale === "en" ? "en" : "id";

  const picked = groups.flatMap((g) =>
    (g.tasks ?? [])
      .map((t) => ({ task: t, status: (t.status ?? "todo") as TaskStatus }))
      .filter((x) => wanted.includes(x.status))
  );

  if (picked.length === 0) {
    return langs === "en"
      ? "No tasks match the selected statuses."
      : "Tidak ada task yang cocok dengan status terpilih.";
  }

  const parts: string[] = [
    langs === "en"
      ? `# Execution prompts — ${ctx.title}`
      : `# Prompt eksekusi — ${ctx.title}`,
    "",
    langs === "en"
      ? `${picked.length} task(s). Paste the relevant block into your AI coding agent.`
      : `${picked.length} task. Paste blok yang relevan ke AI coding agent Anda.`,
    "",
  ];

  for (const status of wanted) {
    const items = picked.filter((p) => p.status === status);
    if (items.length === 0) continue;

    parts.push(`## ${STATUS_HEADING[status]} (${items.length})`, "");

    items.forEach((p, i) => {
      parts.push(
        `### ${i + 1}. ${p.task.title}`,
        "",
        buildTaskPrompt(p.task, ctx, status),
        "",
        "---",
        ""
      );
    });
  }

  return parts.join("\n");
}
