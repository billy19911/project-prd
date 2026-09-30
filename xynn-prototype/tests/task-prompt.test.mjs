/**
 * Uji builder prompt per-task (Fase 2: copy prompt).
 * Fokus: output selalu memuat konteks proyek + detail task + instruksi yang
 * sesuai status. Menjalankan: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  buildTaskPrompt,
  buildTaskBoardPrompt,
} from "../lib/task-prompt.ts";

const CTX = { title: "Toko Online", techStack: ["Next.js", "Postgres"], locale: "id" };
const TASK = {
  id: "t1",
  title: "Buat halaman login",
  description: "Email + Google OAuth",
  phase: "Auth",
  priority: "high",
};

describe("buildTaskPrompt", () => {
  test("memuat konteks proyek, task, dan instruksi implementasi", () => {
    const p = buildTaskPrompt(TASK, CTX, "todo");
    assert.match(p, /Toko Online/);
    assert.match(p, /Next\.js/);
    assert.match(p, /PRD\.md/);
    assert.match(p, /Buat halaman login/);
    assert.match(p, /Email \+ Google OAuth/);
    assert.match(p, /Implementasikan task ini/);
    assert.match(p, /Setelah selesai, laporkan/);
  });

  test("task failed → instruksi diagnosis, bukan implementasi biasa", () => {
    const p = buildTaskPrompt(TASK, CTX, "failed");
    assert.match(p, /GAGAL/);
    assert.doesNotMatch(p, /Implementasikan task ini/);
  });

  test("task done → instruksi verifikasi", () => {
    const p = buildTaskPrompt(TASK, CTX, "done");
    assert.match(p, /Verifikasi/);
  });

  test("bahasa Inggris bila locale en", () => {
    const p = buildTaskPrompt(TASK, { ...CTX, locale: "en" }, "todo");
    assert.match(p, /You are working on/);
    assert.doesNotMatch(p, /Anda mengerjakan proyek/);
  });

  test("tanpa tech stack tetap valid", () => {
    const p = buildTaskPrompt(TASK, { title: "X" }, "todo");
    assert.match(p, /belum ditentukan/);
  });
});

describe("buildTaskBoardPrompt", () => {
  test("mengelompokkan per status dengan heading", () => {
    const groups = [
      {
        phase: "A",
        tasks: [
          { ...TASK, id: "1", status: "doing" },
          { ...TASK, id: "2", status: "failed" },
          { ...TASK, id: "3", status: "done" },
        ],
      },
    ];
    const p = buildTaskBoardPrompt(groups, CTX, { statuses: ["doing", "failed"] });
    assert.match(p, /SEDANG DIKERJAKAN/);
    assert.match(p, /GAGAL/);
    assert.doesNotMatch(p, /Tandai selesai|### 3\./);
  });

  test("tanpa kecocokan → pesan jelas, bukan string kosong", () => {
    const p = buildTaskBoardPrompt([], CTX);
    assert.ok(p.length > 0);
    assert.match(p, /Tidak ada task/);
  });
});
