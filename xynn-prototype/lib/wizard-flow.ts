/**
 * Definisi urutan langkah wizard "Project Baru" — MURNI (tanpa React).
 *
 * Dipisah agar urutan alur bisa diuji tanpa merender komponen, dan agar
 * jelas: jalur "ide" dan jalur "import PRD" menghasilkan rangkaian berbeda.
 */

export type WizardFlow = "idea" | "import";
export type WizardStep =
  | "idea"
  | "import"
  | "tech"
  | "questions"
  | "mindmap"
  | "output";

/**
 * Urutan step per mode.
 *
 * - idea  : ide → teknologi → questions → mindmap → hasil
 * - import: import PRD → mindmap → hasil (PRD sudah ada; lewati tech/questions)
 */
export const FLOW_STEPS: Record<WizardFlow, WizardStep[]> = {
  idea: ["idea", "tech", "questions", "mindmap", "output"],
  import: ["import", "mindmap", "output"],
};

/** Indeks langkah saat ini di dalam alur (0-based). */
export function stepIndex(flow: WizardFlow, step: WizardStep): number {
  const steps = FLOW_STEPS[flow];
  const i = steps.indexOf(step);
  return i < 0 ? 0 : i;
}

/** Langkah pertama pada alur. */
export function firstStep(flow: WizardFlow): WizardStep {
  return FLOW_STEPS[flow][0];
}
