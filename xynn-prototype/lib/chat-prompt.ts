/**
 * Prompt builder untuk Chat Prototype.
 *
 * Modul ini sengaja bebas dependensi (direktif bahasa diterima sebagai
 * parameter) supaya bisa diuji `node:test` tanpa resolusi alias `@/lib/*`.
 *
 * KONSEP BARU: Chat Prototype bukan chatbot biasa. Ia menuntun user dari ide
 * mentah menjadi PRD yang tajam — dengan cara:
 *   1. mempertajam WORKFLOW aplikasi (bagaimana alurnya berjalan),
 *   2. mengusulkan pertanyaan yang perlu ditambah/dikurangi,
 *   3. memberi analisa + alasan/hipotesis yang masuk akal,
 *   4. menyimpulkan PRD saat sudah matang (lewat endpoint terpisah).
 */

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Batas jumlah pesan lama yang dikirim sebagai konteks (hemat token). */
export const CHAT_HISTORY_LIMIT = 12;

/** Batas panjang tiap pesan yang disertakan (hemat token). */
const TURN_MAX = 1500;

/**
 * Susun prompt TUNGGAL dari riwayat percakapan.
 *
 * `chatCompletion` di lib/ai.ts hanya menerima satu string prompt (bukan array
 * messages), jadi riwayat diratakan menjadi transkrip.
 *
 * Hanya `CHAT_HISTORY_LIMIT` pesan terakhir yang dikirim, masing-masing
 * dipotong `TURN_MAX` karakter — agar biaya tidak meledak pada percakapan
 * panjang.
 */
export function buildChatPrompt(history: ChatTurn[]): string {
  const recent = history.slice(-CHAT_HISTORY_LIMIT);
  if (recent.length === 0) return "";

  const lines: string[] = ["=== CONVERSATION SO FAR ==="];
  for (const t of recent) {
    const body =
      t.content.length > TURN_MAX ? t.content.slice(0, TURN_MAX) + "…" : t.content;
    lines.push(`${t.role === "user" ? "User" : "Assistant"}: ${body}`);
  }
  lines.push("", "=== NOW ===", "Reply as the Assistant to the last User message.");
  lines.push("Output ONLY your reply text. Do not prefix it with 'Assistant:'.");
  return lines.join("\n");
}

/**
 * Instruksi inti persona "product analyst" yang menuntun ide → PRD.
 * Dipakai bersama oleh chat (obrolan) dan saat menyimpulkan PRD.
 */
const PRODUCT_ANALYST_CORE = [
  `You are Xynn, a pragmatic product analyst. Your mission: guide the user from a raw idea`,
  `to a sharp, buildable PRD — through conversation.`,
  ``,
  `In every reply, aim to do these things (only what fits the moment):`,
  `1. Briefly reflect what is already clear (1 line).`,
  `2. Sharpen the WORKFLOW: who acts, what happens step by step, the happy path, and the`,
  `   failure/edge paths. Ask about the steps that are still unanswered.`,
  `3. Suggest which questions to ADD or DROP — and say WHY.`,
  `4. Give an analysis with a reasonable hypothesis (e.g. "do X because Y"), not just prompts.`,
  ``,
  `Style: concise. Short paragraphs. No filler. Markdown lists allowed.`,
  `Do NOT output HTML. Do NOT invent features the user did not imply — propose them clearly as suggestions.`,
];

/**
 * Prompt sistem untuk chat prototype (obrolan).
 *
 * Bila thread sudah tertaut ke sebuah project (`hasProject`), chat beralih mode
 * mempertajam PRD project itu; bila belum, ia sedang menyusun project baru.
 */
export function buildChatSystemPrompt(opts: {
  projectContext?: string | null;
  hasPrototype: boolean;
  hasProject?: boolean;
  languageDirective: string;
}): string {
  return [
    ...PRODUCT_ANALYST_CORE,
    ``,
    opts.hasProject
      ? `This project already exists. If the user wants changes, describe what you would change`
      + ` in which PRD section or screen.`
      : `No project exists yet. Help the user reach a point where a PRD can be generated.`,
    opts.hasPrototype
      ? `A prototype already exists for this project.`
      : ``,
    opts.projectContext
      ? `\n=== PROJECT CONTEXT (PRD/Style Guide) ===\n${opts.projectContext.slice(0, 4000)}`
      : ``,
    ``,
    `When the conversation is mature enough, tell the user they can press "Susun PRD" to draft it.`,
    opts.languageDirective,
    `Reply in plain text (Markdown allowed for lists). Do not output HTML unless the user asks for it.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Judul thread otomatis dari pesan pertama (dipotong agar rapi). */
export function deriveThreadTitle(firstMessage: string): string {
  const clean = firstMessage.replace(/\s+/g, " ").trim();
  if (!clean) return "Percakapan baru";
  return clean.length > 60 ? clean.slice(0, 57) + "..." : clean;
}

/**
 * Prompt untuk MENYIMPULKAN PRD dari transkrip chat.
 *
 * Berbeda dari `generatePRDWithAI` (yang memakai mindmap), sumber di sini adalah
 * percakapan + hasil analisa workflow. Output mengikuti struktur 12 seksi yang
 * sama agar konsisten dengan PRD dari wizard.
 */
export function buildPrdFromChatPrompt(history: ChatTurn[]): string {
  // Transkrip lebih panjang diizinkan di sini karena ini momen "finalisasi".
  const recent = history.slice(-40);
  const transcript = recent
    .map(
      (t) =>
        `${t.role === "user" ? "User" : "Analyst"}: ` +
        (t.content.length > 4000 ? t.content.slice(0, 4000) + "…" : t.content)
    )
    .join("\n\n");

  return [
    `=== CONVERSATION TRANSCRIPT ===`,
    transcript,
    ``,
    `=== TASK ===`,
    `Write a complete PRD in Markdown from the conversation above.`,
    `Use EXACTLY these 12 sections (## headings):`,
    `1. Executive Summary`,
    `2. Problem Statement`,
    `3. Goals & Non-Goals`,
    `4. Target Users & Personas`,
    `5. Core Features`,
    `6. User Flows (step-by-step, include failure/edge paths)`,
    `7. Screens & UI Structure`,
    `8. Data Model (entities & key fields)`,
    `9. Tech Stack (propose a sensible one; mark it as a suggestion)`,
    `10. Success Metrics`,
    `11. Milestones / Phases`,
    `12. Risks & Open Questions`,
    ``,
    `Rules:`,
    `- Be concrete and specific to what was discussed; do not pad with generic filler.`,
    `- If something important was never discussed, list it under "Risks & Open Questions"`,
    `  instead of inventing an answer.`,
    `- Output ONLY the Markdown PRD. No preamble, no code fences around the whole document.`,
  ].join("\n");
}
