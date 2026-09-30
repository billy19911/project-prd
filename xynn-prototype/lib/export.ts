/**
 * Helper ekspor markdown untuk PRD, Task Breakdown, dan Style Guide,
 * agar user bisa mengerjakan proyeknya secara manual dari 3 file ini.
 */

export type TaskItem = {
  id: string;
  title: string;
  description: string;
  phase: string;
  priority: "high" | "medium" | "low";
  /** Status lifecycle board. Task lama tanpa field ini dianggap "todo". */
  status?: "todo" | "doing" | "done" | "failed";
};
export type TaskGroup = { phase: string; tasks: TaskItem[] };

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "project"
  );
}

export function downloadPrd(title: string, prd: string | null) {
  download(`${slugify(title)}-PRD.md`, prd || `# ${title}\n\n_PRD belum di-generate._\n`);
}

/** Peta status → penanda checkbox markdown. */
const STATUS_MARK: Record<string, string> = {
  todo: " ",
  doing: "/",
  done: "x",
  failed: "!",
};

/**
 * Task groups → markdown, MEMPERTAHANKAN status board:
 *   [ ] todo · [/] doing · [x] done · [!] failed
 */
export function tasksToMarkdown(title: string, groups: TaskGroup[] | null): string {
  const lines: string[] = [`# ${title} — Task Breakdown`, ""];
  if (!groups || groups.length === 0) {
    lines.push("_Task breakdown belum di-generate._");
    return lines.join("\n");
  }
  lines.push(
    "> Checklist tugas implementasi. Status board: `[ ]` todo · `[/]` ongoing · `[x]` selesai · `[!]` gagal.",
    ""
  );
  for (const g of groups) {
    lines.push(`## ${g.phase}`, "");
    for (const t of g.tasks) {
      const mark = STATUS_MARK[t.status ?? "todo"] ?? " ";
      lines.push(`- [${mark}] **${t.title}** _(${t.priority})_`);
      if (t.description) lines.push(`  ${t.description}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function downloadTasks(title: string, groups: TaskGroup[] | null) {
  download(`${slugify(title)}-TASKS.md`, tasksToMarkdown(title, groups));
}

export function downloadStyle(title: string, styleGuide: string | null) {
  download(
    `${slugify(title)}-STYLEGUIDE.md`,
    styleGuide || `# ${title} — Style Guide\n\n_Style guide belum di-generate._\n`
  );
}

/** Paket lengkap: unduh PRD + Task + Style Guide sekaligus. */
export function downloadAllBundle(
  title: string,
  prd: string | null,
  groups: TaskGroup[] | null,
  styleGuide: string | null
) {
  downloadPrd(title, prd);
  setTimeout(() => downloadTasks(title, groups), 300);
  setTimeout(() => downloadStyle(title, styleGuide), 600);
}
