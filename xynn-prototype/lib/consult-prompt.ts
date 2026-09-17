/**
 * Prompt builder untuk Konsultasi AI (arsitektur & tech stack).
 *
 * Bebas dependensi (seperti chat-prompt.ts) supaya bisa diuji tanpa resolusi
 * alias `@/lib/*`.
 */

export type ConsultTurn = { role: "user" | "assistant"; content: string };

/** Batas jumlah pesan lama sebagai konteks (hemat token). */
export const CONSULT_HISTORY_LIMIT = 16;

const TURN_MAX = 3000;

/**
 * Ratakan riwayat menjadi satu transkrip. `chatCompletion` hanya menerima
 * satu string prompt (bukan array messages).
 */
export function buildConsultPrompt(history: ConsultTurn[]): string {
  const recent = history.slice(-CONSULT_HISTORY_LIMIT);
  if (recent.length === 0) return "";

  const lines: string[] = ["=== KONSULTASI SEJAUH INI ==="];
  for (const t of recent) {
    const body =
      t.content.length > TURN_MAX ? t.content.slice(0, TURN_MAX) + "…" : t.content;
    lines.push(`${t.role === "user" ? "Pengguna" : "Konsultan"}: ${body}`);
  }
  lines.push("", "=== SEKARANG ===", "Balas sebagai Konsultan atas pesan Pengguna terakhir.");
  lines.push("Keluarkan HANYA teks balasanmu. Jangan memberi awalan 'Konsultan:'.");
  return lines.join("\n");
}

/**
 * Prompt sistem untuk konsultan AI.
 *
 * Berbeda dari Chat Prototype (yang menggali kebutuhan prototype), konsultan
 * ini fokus pada ARSITEKTUR, tech stack, trade-off, dan roadmap eksekusi.
 */
export function buildConsultSystemPrompt(opts: {
  projectContext?: string | null;
  languageDirective: string;
}): string {
  return [
    `You are Xynn, a senior software architect acting as a consultant.`,
    ``,
    `Focus on: system architecture, tech stack choices and trade-offs, scalability,`,
    `data modeling, security, and a pragmatic step-by-step execution roadmap.`,
    ``,
    `Be opinionated but honest about trade-offs. Prefer concrete recommendations`,
    `over generic advice. When the request is vague, ask focused clarifying questions.`,
    `Be concise — short paragraphs and bullet lists, no filler.`,
    opts.projectContext
      ? `\n=== PROJECT CONTEXT ===\n${opts.projectContext.slice(0, 4000)}`
      : ``,
    ``,
    opts.languageDirective,
    `Reply in plain text (Markdown allowed). Do not output HTML.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Judul konsultasi otomatis dari pesan pertama. */
export function deriveConsultTitle(firstMessage: string): string {
  const clean = firstMessage.replace(/\s+/g, " ").trim();
  if (!clean) return "Konsultasi baru";
  return clean.length > 60 ? clean.slice(0, 57) + "..." : clean;
}
