/**
 * Prompt builder untuk Chat Prototype.
 *
 * Modul ini sengaja bebas dependensi (direktif bahasa diterima sebagai
 * parameter) supaya bisa diuji `node:test` tanpa resolusi alias `@/lib/*`.
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
 * Prompt sistem untuk chat prototype.
 *
 * Chat ini adalah pintu masuk kedua: pengguna mengobrol, lalu prototype
 * di-generate/diubah dari percakapan itu. Jadi asisten diarahkan untuk
 * menggali kebutuhan dulu, bukan langsung menulis HTML.
 */
export function buildChatSystemPrompt(opts: {
  projectContext?: string | null;
  hasPrototype: boolean;
  languageDirective: string;
}): string {
  return [
    `You are Xynn, a product design assistant helping the user shape a clickable HTML prototype.`,
    ``,
    `Your job: help the user think through screens, flows, and content BEFORE generating.`,
    `Ask clarifying questions when the request is vague. Be concise — short paragraphs, no filler.`,
    ``,
    opts.hasPrototype
      ? `This project already has a prototype. If the user asks for a change, describe what you would change in which screen.`
      : `This project has no prototype yet. Guide the user to a point where a prototype can be generated.`,
    opts.projectContext
      ? `\n=== PROJECT CONTEXT (PRD/Style Guide) ===\n${opts.projectContext.slice(0, 4000)}`
      : ``,
    ``,
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
