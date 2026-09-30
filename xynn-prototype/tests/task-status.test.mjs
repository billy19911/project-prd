/**
 * Uji model status task lifecycle (todo → doing → done | failed).
 *
 * Konteks: sebelumnya task hanyalah checklist boolean di state komponen yang
 * hilang saat refresh. Modul `lib/task-status.ts` murni agar board kanban,
 * ekspor markdown, dan laporan CLI memakai semantik yang sama.
 *
 * Menjalankan: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  boardStatus,
  isTaskStatus,
  normalizeStatus,
  setTaskStatus,
  taskCounts,
} from "../lib/task-status.ts";

function sample() {
  return [
    {
      phase: "Setup",
      tasks: [
        { id: "a", title: "Init", description: "", phase: "Setup", priority: "high" },
        { id: "b", title: "DB", description: "", phase: "Setup", priority: "medium", status: "doing" },
      ],
    },
    {
      phase: "Build",
      tasks: [
        { id: "c", title: "API", description: "", phase: "Build", priority: "low", status: "done" },
        { id: "d", title: "Bug", description: "", phase: "Build", priority: "high", status: "failed" },
      ],
    },
  ];
}

describe("normalizeStatus", () => {
  test("task lama tanpa status dianggap todo", () => {
    assert.equal(normalizeStatus(undefined), "todo");
    assert.equal(normalizeStatus(null), "todo");
    assert.equal(normalizeStatus("centang"), "todo");
  });

  test("status valid dipertahankan", () => {
    assert.equal(normalizeStatus("doing"), "doing");
    assert.equal(normalizeStatus("failed"), "failed");
  });
});

describe("isTaskStatus", () => {
  test("hanya 4 nilai yang diterima", () => {
    assert.ok(isTaskStatus("todo"));
    assert.ok(isTaskStatus("doing"));
    assert.ok(isTaskStatus("done"));
    assert.ok(isTaskStatus("failed"));
    assert.equal(isTaskStatus("selesai"), false);
    assert.equal(isTaskStatus(true), false);
    assert.equal(isTaskStatus(undefined), false);
  });
});

describe("setTaskStatus", () => {
  test("memindahkan satu task tanpa memutasi input", () => {
    const before = sample();
    const snapshot = JSON.stringify(before);
    const { groups, changed } = setTaskStatus(before, "a", "doing");
    assert.equal(changed, true);
    assert.equal(JSON.stringify(before), snapshot); // tidak termutasi
    assert.equal(
      groups[0].tasks.find((t) => t.id === "a")?.status,
      "doing"
    );
  });

  test("taskId tak dikenal → changed=false", () => {
    const { changed } = setTaskStatus(sample(), "tidak-ada", "done");
    assert.equal(changed, false);
  });

  test("status sudah sama → changed=false (hemat tulis DB)", () => {
    const { changed } = setTaskStatus(sample(), "c", "done");
    assert.equal(changed, false);
  });
});

describe("taskCounts", () => {
  test("menghitung per status dengan benar", () => {
    const c = taskCounts(sample());
    assert.deepEqual(c, { total: 4, todo: 1, doing: 1, done: 1, failed: 1 });
  });

  test("null → semua nol", () => {
    assert.deepEqual(taskCounts(null), {
      total: 0,
      todo: 0,
      doing: 0,
      done: 0,
      failed: 0,
    });
  });
});

describe("boardStatus", () => {
  test("failed menang atas doing", () => {
    assert.equal(boardStatus(sample()), "failed");
  });

  test("semua done → done; kosong → todo", () => {
    const allDone = [
      {
        phase: "P",
        tasks: [
          { id: "x", title: "X", description: "", phase: "P", priority: "low", status: "done" },
        ],
      },
    ];
    assert.equal(boardStatus(allDone), "done");
    assert.equal(boardStatus([]), "todo");
  });
});
