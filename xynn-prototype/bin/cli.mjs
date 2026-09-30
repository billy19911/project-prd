#!/usr/bin/env node

import { Command } from "commander";
import axios from "axios";
import fs from "fs/promises";
import path from "path";

const program = new Command();

program
  .name("xynn")
  .description("XynnPrototype CLI sync engine")
  .version("0.2.0");

/** Tulis satu task ke markdown dengan penanda status board. */
function taskToLine(t) {
  const mark =
    t.status === "done" ? "x"
    : t.status === "doing" ? "/"
    : t.status === "failed" ? "!"
    : " ";
  const lines = [`- [${mark}] **${t.title}** _(${t.priority})_`];
  if (t.description) lines.push(`  ${t.description}`);
  return lines;
}

/** Ubah task groups (JSON) menjadi markdown checklist. */
function tasksToMarkdown(title, groups) {
  const lines = [`# ${title} — Task Breakdown`, ""];
  if (!groups || groups.length === 0) {
    lines.push("_Task breakdown belum di-generate._");
    return lines.join("\n");
  }
  lines.push(
    "> Status board: `[ ]` todo · `[/]` ongoing · `[x]` selesai · `[!]` gagal.",
    ""
  );
  for (const g of groups) {
    lines.push(`## ${g.phase}`, "");
    for (const t of g.tasks) {
      lines.push(...taskToLine(t));
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Hitung berapa task yang sudah selesai / gagal di sebuah file markdown. */
async function countCompletedTasks(file) {
  try {
    const content = await fs.readFile(file, "utf8");
    const done = (content.match(/^\s*-\s*\[x\]/gim) || []).length;
    const failed = (content.match(/^\s*-\s*\[!\]/gim) || []).length;
    const doing = (content.match(/^\s*-\s*\[\/\]/gim) || []).length;
    const total = (content.match(/^\s*-\s*\[(x|\/|!| )\]/gim) || []).length;
    return { done, failed, doing, total };
  } catch {
    return { done: 0, failed: 0, doing: 0, total: 0 };
  }
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/** Susun laporan progress lokal → dikirim ke server agar web auto-detect. */
async function buildProgressReport(dir, data) {
  const files = {
    prd: await fileExists(path.join(dir, "PRD.md")),
    tasks: await fileExists(path.join(dir, "tasks.md")),
    style: await fileExists(path.join(dir, "STYLEGUIDE.md")),
    prototype: await fileExists(path.join(dir, "prototype.html")),
    cursorrules: await fileExists(path.join(dir, ".cursorrules")),
  };
  const { done, failed, doing, total } = await countCompletedTasks(path.join(dir, "tasks.md"));
  return {
    files,
    taskProgress: { done, failed, doing, total },
    taskStatuses: await parseTaskStatuses(path.join(dir, "tasks.md"), data.tasks),
    title: data.title,
  };
}

/** Peta penanda checkbox → status board. */
const MARK_TO_STATUS = { " ": "todo", "/": "doing", x: "done", X: "done", "!": "failed" };

/**
 * Baca tasks.md lokal, petakan baris `- [ ] **Judul**` ke status, lalu
 * cocokkan dengan task server berdasarkan JUDUL (tasks.md tidak menyimpan id).
 * Mengembalikan { [taskId]: status } untuk task yang BERBEDA dari server —
 * supaya POST sync hanya mengubah yang memang berubah di lokal.
 */
async function parseTaskStatuses(file, serverGroups) {
  try {
    const content = await fs.readFile(file, "utf8");
    const byTitle = {};
    const re = /^\s*-\s*\[([ xX/! ])\]\s*\*\*(.+?)\*\*/gim;
    let m;
    while ((m = re.exec(content)) !== null) {
      byTitle[m[2].trim()] = MARK_TO_STATUS[m[1]] || "todo";
    }
    if (Object.keys(byTitle).length === 0) return undefined;

    const out = {};
    for (const g of serverGroups || []) {
      for (const t of g.tasks || []) {
        const local = byTitle[t.title.trim()];
        if (local && local !== (t.status || "todo")) out[t.id] = local;
      }
    }
    return Object.keys(out).length ? out : undefined;
  } catch {
    return undefined;
  }
}

/** Tulis ulang tasks.md dari task server + override status lokal (untuk command status). */
function applyLocalStatuses(groups, overrides) {
  return (groups || []).map((g) => ({
    ...g,
    tasks: (g.tasks || []).map((t) =>
      overrides[t.id] ? { ...t, status: overrides[t.id] } : t
    ),
  }));
}

function slugify(str){
  return str.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"project";
}
function resolveServer(options) {
  return (options.server || process.env.XYNN_SERVER_URL || "http://localhost:3000").replace(/\/$/, "");
}

function resolveApiKey(options) {
  const apiKey = options.apiKey || process.env.XYNN_API_KEY;
  if (!apiKey) {
    throw new Error("API key wajib diisi lewat --api-key atau XYNN_API_KEY");
  }
  return apiKey;
}

program
  .command("connect")
  .description("Sync semua artifact (PRD, tasks, style guide, .cursorrules) dua arah")
  .option("--workspace <id>", "Xynn workspace ID (opsional bila akun hanya punya 1)")
  .option("--api-key <key>", "Xynn API key")
  .option("--server <url>", "Xynn server URL", process.env.XYNN_SERVER_URL || "http://localhost:3000")
  .option("--dir <path>", "Folder tujuan (default: direktori saat ini)")
  .option("--report-only", "Jangan tulis file, hanya laporkan progress lokal ke web")
  .action(async (options) => {
    const apiKey = resolveApiKey(options);
    const server = resolveServer(options);
    const outputDir = options.dir ? path.resolve(options.dir) : process.cwd();

    await fs.mkdir(outputDir, { recursive: true });

    // Deteksi otomatis workspace bila tidak diberikan.
    let workspaceId = options.workspace;
    if (!workspaceId) {
      const listRes = await axios.get(`${server}/api/cli/workspaces`, {
        headers: { "x-api-key": apiKey },
        validateStatus: () => true,
      });
      if (listRes.status !== 200) {
        throw new Error(listRes.data?.error || `Gagal mengambil daftar workspace (${listRes.status})`);
      }
      const list = listRes.data || [];
      if (list.length === 0) {
        throw new Error("Tidak ada workspace. Buat project dulu di web Xynn.");
      }
      if (list.length > 1) {
        const names = list.map((w) => `  - ${w.title}  (${w.id})`).join("\n");
        throw new Error(
          `Ada ${list.length} workspace. Tentukan satu dengan --workspace <id>:\n${names}`
        );
      }
      workspaceId = list[0].id;
      console.log(`Workspace terdeteksi otomatis: ${list[0].title} (${workspaceId})`);
    }

    const response = await axios.get(`${server}/api/cli/sync`, {
      params: { workspace: workspaceId },
      headers: { "x-api-key": apiKey },
      validateStatus: () => true,
    });

    if (response.status !== 200) {
      throw new Error(response.data?.error || `Sync gagal (${response.status})`);
    }

    const data = response.data;
    const written = [];

    // Buat subfolder berdasarkan nama workspace (slugified) agar tidak tumpang‑tindih.
    const projectSlug = slugify(data.title);
    const projectDir = path.join(outputDir, projectSlug);
    await fs.mkdir(projectDir, { recursive: true });

    if (!options.reportOnly) {
      await fs.writeFile(path.join(projectDir, "PRD.md"), data.prd, "utf8");
      written.push("PRD.md");

      await fs.writeFile(path.join(projectDir, ".cursorrules"), data.cursorRules, "utf8");
      written.push(".cursorrules");

      if (data.tasks) {
        await fs.writeFile(
          path.join(projectDir, "tasks.md"),
          tasksToMarkdown(data.title, data.tasks),
          "utf8"
        );
        written.push("tasks.md");
      }
      if (data.styleGuide) {
        await fs.writeFile(path.join(projectDir, "STYLEGUIDE.md"), data.styleGuide, "utf8");
        written.push("STYLEGUIDE.md");
      }
      if (data.prototypeHtml) {
        await fs.writeFile(path.join(projectDir, "prototype.html"), data.prototypeHtml, "utf8");
        written.push("prototype.html");
      }
    }

    // Laporan balik ke server: tandai bahwa proyek tersambung & step terdeteksi.
    const report = await buildProgressReport(projectDir, data);
    const reportRes = await axios.post(
      `${server}/api/cli/sync`,
      { workspace: workspaceId, ...report },
      { headers: { "x-api-key": apiKey }, validateStatus: () => true }
    );
    if (reportRes.status !== 200) {
      console.warn(`Peringatan: gagal mengirim status sync (${reportRes.status})`);
    }

    const { done, failed, doing, total } = report.taskProgress;
    console.log(`\nSinkron selesai dari workspace "${data.title}"`);
    console.log(`  Folder proyek: ${projectDir}`);
    console.log(`  File  : ${written.length ? written.join(", ") : "(report-only, tidak menulis file)"}`);
    console.log(`  Progress task: ${done}/${total} selesai${doing ? `, ${doing} berjalan` : ""}${failed ? `, ${failed} gagal` : ""}`);
    if (report.taskStatuses) {
      console.log(`  Status lokal terdeteksi & dikirim: ${Object.keys(report.taskStatuses).length} task berubah`);
    }
    console.log(`  Web Xynn akan menampilkan status tersambung & step yang sudah terdeteksi.`);
  });

program
  .command("status")
  .description("Baca tasks.md lokal, laporkan status ([ ]/[/]/[x]/[!]) ke board web")
  .option("--workspace <id>", "Xynn workspace ID (opsional bila akun hanya punya 1)")
  .option("--api-key <key>", "Xynn API key")
  .option("--server <url>", "Xynn server URL", process.env.XYNN_SERVER_URL || "http://localhost:3000")
  .option("--dir <path>", "Folder proyek (default: direktori saat ini)")
  .option("--task <title>", "Tandai satu task (berdasarkan judul) ke status tertentu")
  .option("--state <status>", "Status untuk --task: todo | doing | done | failed")
  .action(async (options) => {
    const apiKey = resolveApiKey(options);
    const server = resolveServer(options);
    const baseDir = options.dir ? path.resolve(options.dir) : process.cwd();

    // Tentukan workspace.
    let workspaceId = options.workspace;
    if (!workspaceId) {
      const listRes = await axios.get(`${server}/api/cli/workspaces`, {
        headers: { "x-api-key": apiKey },
        validateStatus: () => true,
      });
      if (listRes.status !== 200) {
        throw new Error(listRes.data?.error || `Gagal mengambil daftar workspace (${listRes.status})`);
      }
      const list = listRes.data || [];
      if (list.length === 0) throw new Error("Tidak ada workspace.");
      if (list.length > 1) {
        throw new Error(`Ada ${list.length} workspace. Tentukan dengan --workspace <id>.`);
      }
      workspaceId = list[0].id;
    }

    // Ambil task server untuk memetakan judul → id.
    const syncRes = await axios.get(`${server}/api/cli/sync`, {
      params: { workspace: workspaceId },
      headers: { "x-api-key": apiKey },
      validateStatus: () => true,
    });
    if (syncRes.status !== 200) {
      throw new Error(syncRes.data?.error || `Gagal sync (${syncRes.status})`);
    }
    const data = syncRes.data;
    const groups = data.tasks || [];

    // Cari folder proyek (kalau --dir menunjuk ke root yang berisi subfolder slug).
    let projectDir = baseDir;
    if (!(await fileExists(path.join(projectDir, "tasks.md")))) {
      const slugDir = path.join(baseDir, slugify(data.title));
      if (await fileExists(path.join(slugDir, "tasks.md"))) projectDir = slugDir;
    }
    const tasksFile = path.join(projectDir, "tasks.md");

    if (!(await fileExists(tasksFile))) {
      throw new Error(`tasks.md tidak ditemukan di ${projectDir}. Jalankan "xynn connect" dulu.`);
    }

    // Mode --task: ubah satu task berdasarkan judul (substring, case-insensitive).
    let overrides;
    if (options.task) {
      const valid = ["todo", "doing", "done", "failed"];
      const state = options.state || "doing";
      if (!valid.includes(state)) {
        throw new Error(`--state harus salah satu dari: ${valid.join(", ")}`);
      }
      const needle = options.task.toLowerCase();
      overrides = {};
      for (const g of groups) {
        for (const t of g.tasks || []) {
          if (t.title.toLowerCase().includes(needle)) overrides[t.id] = state;
        }
      }
      const n = Object.keys(overrides).length;
      if (n === 0) throw new Error(`Tidak ada task yang cocok dengan "${options.task}".`);
      console.log(`Menandai ${n} task → ${state}`);
    } else {
      // Mode default: baca status dari tasks.md.
      overrides = await parseTaskStatuses(tasksFile, groups);
      if (!overrides) {
        console.log("Tidak ada perubahan status yang terdeteksi di tasks.md.");
        return;
      }
      console.log(`Terdeteksi ${Object.keys(overrides).length} task berubah status.`);
    }

    // Kirim ke server.
    const res = await axios.post(
      `${server}/api/cli/sync`,
      { workspace: workspaceId, taskStatuses: overrides },
      { headers: { "x-api-key": apiKey }, validateStatus: () => true }
    );
    if (res.status !== 200) {
      throw new Error(res.data?.error || `Gagal mengirim status (${res.status})`);
    }

    // Tulis ulang tasks.md agar konsisten dengan status terbaru.
    const merged = applyLocalStatuses(groups, overrides);
    await fs.writeFile(tasksFile, tasksToMarkdown(data.title, merged), "utf8");

    const counts = { todo: 0, doing: 0, done: 0, failed: 0 };
    for (const g of merged) for (const t of g.tasks || []) counts[t.status || "todo"]++;
    console.log(`\nBoard terbaru: ${counts.done} selesai · ${counts.doing} berjalan · ${counts.todo} todo · ${counts.failed} gagal`);
    console.log("  Buka board di web untuk melihat perubahan.");
  });

program
  .command("workspaces")
  .description("Tampilkan daftar workspace yang bisa diakses API key ini")
  .option("--api-key <key>", "Xynn API key")
  .option("--server <url>", "Xynn server URL", process.env.XYNN_SERVER_URL || "http://localhost:3000")
  .action(async (options) => {
    const apiKey = resolveApiKey(options);
    const server = resolveServer(options);
    const res = await axios.get(`${server}/api/cli/workspaces`, {
      headers: { "x-api-key": apiKey },
      validateStatus: () => true,
    });
    if (res.status !== 200) {
      throw new Error(res.data?.error || `Gagal (${res.status})`);
    }
    const list = res.data || [];
    if (list.length === 0) {
      console.log("Belum ada workspace.");
      return;
    }
    for (const w of list) {
      const prd = w.hasPrd ? "PRD" : "-";
      const tasks = w.hasTasks ? "tasks" : "-";
      const style = w.hasStyle ? "style" : "-";
      console.log(`${w.id}  ${w.title}  [${prd} ${tasks} ${style}]`);
    }
  });

program.parseAsync().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
