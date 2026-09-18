/**
 * Prompt builder untuk Konsultasi AI (arsitektur & tech stack).
 *
 * Bebas dependensi (seperti chat-prompt.ts) supaya bisa diuji tanpa resolusi
 * alias `@/lib/*`.
 *
 * KONSEP BARU: Konsultasi tidak hanya memberi teks — ia bisa merekomendasikan
 * AKSI terarah (regenerate screen prototype / perbaiki section PRD). Aksi
 * dikodekan sebagai blok di teks balasan, misal:
 *
 *   [[ACTION:regen-screen|Dashboard|Ringkasan belum ada]]
 *   [[ACTION:fix-prd|User Flows|Alur gagal bayar belum dibahas]]
 *
 * UI mem-parse blok ini (lihat `parseConsultActions`) dan menampilkan tombol.
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
 * Fokus pada ARSITEKTUR, tech stack, trade-off, dan roadmap eksekusi — PLUS
 * kemampuan mengusulkan aksi terarah yang bisa diterapkan ke project.
 */
export function buildConsultSystemPrompt(opts: {
  projectContext?: string | null;
  hasProject?: boolean;
  availableScreens?: string[];
  languageDirective: string;
}): string {
  const screens = opts.availableScreens?.filter(Boolean) ?? [];

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
    `=== ACTIONS ===`,
    opts.hasProject
      ? [
          `This project exists. When you recommend a concrete fix to the PRD or a prototype screen,`,
          `emit EXACTLY ONE action block at the very END of your reply, on its own line, with no`,
          `extra prose after it. Format (two pipes, no spaces around them):`,
          `[[ACTION:fix-prd|User Flows|alur gagal bayar belum ada]]`,
          `[[ACTION:regen-screen|Dashboard|ringkasan & statistik belum tampil]]`,
          screens.length
            ? `Available screens for regen-screen: ${screens.join(", ")}`
            : `(No prototype screens available — do NOT emit regen-screen; only fix-prd is valid.)`,
          `Choose fix-prd when the issue is in the PRD text, and regen-screen only when it concerns a screen.`,
          `Only emit an action if the user asked for a fix or a concrete improvement is clearly warranted.`,
          `Do not explain or mention the block syntax to the user.`,
        ].join("\n")
      : `No project is linked, so do not emit action blocks.`,
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

/* ---------------------------------------------------------------- */
/* Parsing aksi                                                     */
/* ---------------------------------------------------------------- */

export type ConsultActionKind = "regen-screen" | "fix-prd";

export type ConsultAction = {
  kind: ConsultActionKind;
  /** label screen (regen-screen) atau nama section PRD (fix-prd). */
  target: string;
  reason: string;
};

const ACTION_RE = /\[\[ACTION:(regen-screen|fix-prd)\|([^|\]]+)\|([^\]]*)\]\]/gi;

/**
 * Pisahkan blok aksi dari teks balasan.
 *
 * Mengembalikan teks bersih (tanpa blok) + daftar aksi yang valid. Aksi dengan
 * kind tak dikenal atau target kosong diabaikan.
 */
export function parseConsultActions(raw: string): {
  text: string;
  actions: ConsultAction[];
} {
  const actions: ConsultAction[] = [];
  const text = (raw ?? "")
    .replace(ACTION_RE, (_m, kind: string, target: string, reason: string) => {
      const t = target.trim();
      if (t) {
        actions.push({
          kind: kind.toLowerCase() === "regen-screen" ? "regen-screen" : "fix-prd",
          target: t,
          reason: (reason || "").trim(),
        });
      }
      return ""; // buang blok dari teks
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, actions };
}
