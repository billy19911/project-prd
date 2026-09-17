/**
 * Uji definisi urutan langkah wizard "Project Baru".
 *
 * Fokus: dua jalur harus tetap konsisten —
 *   idea   : ide → tech → questions → mindmap → hasil
 *   import : import PRD → mindmap → hasil (tanpa tech/questions)
 *
 * Bila urutan salah, pengguna yang mengimpor PRD akan dipaksa melewati
 * langkah teknologi/pertanyaan yang tidak relevan, atau langkah hasil tidak
 * tercapai.
 *
 * Menjalankan: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { FLOW_STEPS, stepIndex, firstStep } from "../lib/wizard-flow.ts";

describe("FLOW_STEPS", () => {
  test("jalur idea berurutan: idea→tech→questions→mindmap→output", () => {
    assert.deepEqual(FLOW_STEPS.idea, [
      "idea",
      "tech",
      "questions",
      "mindmap",
      "output",
    ]);
  });

  test("jalur import: import→mindmap→output (tanpa tech/questions)", () => {
    assert.deepEqual(FLOW_STEPS.import, ["import", "mindmap", "output"]);
    assert.ok(!FLOW_STEPS.import.includes("tech"));
    assert.ok(!FLOW_STEPS.import.includes("questions"));
  });

  test("kedua jalur berakhir di output", () => {
    assert.equal(FLOW_STEPS.idea.at(-1), "output");
    assert.equal(FLOW_STEPS.import.at(-1), "output");
  });

  test("kedua jalur melewati mindmap", () => {
    assert.ok(FLOW_STEPS.idea.includes("mindmap"));
    assert.ok(FLOW_STEPS.import.includes("mindmap"));
  });
});

describe("stepIndex", () => {
  test("menghitung indeks dengan benar", () => {
    assert.equal(stepIndex("idea", "idea"), 0);
    assert.equal(stepIndex("import", "import"), 0);
    assert.equal(stepIndex("import", "mindmap"), 1);
    assert.equal(stepIndex("import", "output"), 2);
  });

  test("step tidak dikenal → 0 (aman, tidak crash)", () => {
    assert.equal(stepIndex("import", "tech"), 0);
  });
});

describe("firstStep", () => {
  test("langkah pertama tiap jalur", () => {
    assert.equal(firstStep("idea"), "idea");
    assert.equal(firstStep("import"), "import");
  });
});
