import { languageDirective, type Locale } from "@/lib/i18n";

export type MindmapData = {
  nodes: Array<{
    id: string;
    data: { label: string };
    position?: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
};

export type UsageInfo = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
};

export const DEFAULT_SYSTEM_PROMPT = "You are an expert product architect.";

/**
 * Estimasi biaya per 1K token (USD) berdasarkan keluarga model (PRD §7B).
 * Nilai konservatif; dipakai untuk menghitung AI Cost & Margin Health.
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "claude-3-5-sonnet": { input: 0.003, output: 0.015 },
  "claude-3-7-sonnet": { input: 0.003, output: 0.015 },
  "claude-sonnet-4": { input: 0.003, output: 0.015 },
  default: { input: 0.001, output: 0.003 },
};

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const key = Object.keys(MODEL_PRICING).find((k) =>
    model.toLowerCase().includes(k.toLowerCase())
  );
  const pricing = MODEL_PRICING[key ?? "default"];
  const cost =
    (promptTokens / 1000) * pricing.input +
    (completionTokens / 1000) * pricing.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

function extractUsage(model: string, usage: { inputTokens?: number; outputTokens?: number } | undefined): UsageInfo {
  const promptTokens = usage?.inputTokens ?? 0;
  const completionTokens = usage?.outputTokens ?? 0;
  return {
    model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    costUsd: estimateCost(model, promptTokens, completionTokens),
  };
}

type ChatResponse = {
  content: string;
  usage: { inputTokens?: number; outputTokens?: number };
};

/**
 * Panggil endpoint OpenAI-compatible secara langsung dengan parsing yang tahan
 * banting. Beberapa gateway (mis. 9router) mengembalikan body bergaya SSE
 * (`...}}data: [DONE]`) meski `stream:false`, sehingga parser JSON ketat pada
 * AI SDK gagal. Fungsi ini menormalkan kedua bentuk tersebut.
 */
export async function chatCompletion(
  model: string,
  system: string,
  prompt: string
): Promise<ChatResponse> {
  const baseUrl = (process.env.AI_BASE_URL || "http://127.0.0.1:20128/v1").replace(
    /\/$/,
    ""
  );
  const apiKey = process.env.AI_API_KEY || "xynn-local-key";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  const raw = await res.text();

  if (!res.ok) {
    throw new Error(
      `AI request gagal (${res.status}): ${raw.slice(0, 300)}`
    );
  }

  return parseChatBody(raw);
}

/**
 * Normalkan body respons menjadi { content, usage }.
 * Mendukung: JSON murni, JSON+trailer `data: [DONE]`, dan SSE multi-chunk.
 */
function parseChatBody(raw: string): ChatResponse {
  const trimmed = raw.trim();

  // 1) Coba JSON murni lebih dulu.
  const direct = tryParseChatObject(trimmed);
  if (direct) return direct;

  // 2) Body bergaya SSE: pisahkan per baris `data:`.
  const dataLines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .filter((l) => l && l !== "[DONE]");

  if (dataLines.length > 0) {
    // Gabungkan delta konten dari semua chunk bila ini stream sungguhan.
    let content = "";
    let usage: ChatResponse["usage"] = {};

    for (const line of dataLines) {
      const obj = tryParseChatObject(line);
      if (!obj) continue;
      if (obj.content) content += obj.content;
      if (obj.usage.inputTokens || obj.usage.outputTokens) usage = obj.usage;
    }

    if (content) return { content, usage };
  }

  // 3) Fallback terakhir: ambil segmen JSON pertama yang seimbang.
  const sliced = sliceFirstJsonObject(trimmed);
  if (sliced) {
    const obj = tryParseChatObject(sliced);
    if (obj) return obj;
  }

  throw new Error(
    `Respons AI tidak dapat diparsing: ${trimmed.slice(0, 200)}`
  );
}

type RawChoice = {
  message?: { content?: string };
  delta?: { content?: string };
};

function tryParseChatObject(text: string): ChatResponse | null {
  if (!text) return null;
  try {
    const obj = JSON.parse(text) as {
      choices?: RawChoice[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        input_tokens?: number;
        output_tokens?: number;
      };
    };
    const choice = obj.choices?.[0];
    const content = choice?.message?.content ?? choice?.delta?.content ?? "";
    if (!content) return null;
    return {
      content,
      usage: {
        inputTokens:
          obj.usage?.prompt_tokens ?? obj.usage?.input_tokens ?? undefined,
        outputTokens:
          obj.usage?.completion_tokens ?? obj.usage?.output_tokens ?? undefined,
      },
    };
  } catch {
    return null;
  }
}

/** Ambil objek JSON pertama yang brace-nya seimbang. */
function sliceFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }
  return text.trim();
}

export async function generateMindmapWithAI(
  title: string,
  description: string,
  techStack: string[],
  questions: string[],
  answers: string[],
  model: string = "OpenCodeCombo",
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
  locale: Locale = "id"
): Promise<{ mindmap: MindmapData; usage: UsageInfo }> {
  const qaBlock =
    questions.length > 0
      ? questions.map((q, i) => `Q: ${q}\nA: ${answers[i] || "N/A"}`).join("\n")
      : "(no additional answers)";

  const prompt = [
    `You are a senior software architect. Analyze the project below and DERIVE the concrete building blocks it needs — do not just restate the title.`,
    ``,
    `Title: ${title}`,
    `Description: ${description || "(no description)"}`,
    `Tech Stack: ${techStack.length ? techStack.join(", ") : "(not specified)"}`,
    ``,
    `Clarifying context:`,
    qaBlock,
    ``,
    `Think step by step about what this specific product requires, then produce a mindmap of its architecture.`,
    `Cover these categories with concrete, product-specific labels:`,
    `- Core modules/screens`,
    `- Key features derived from the description`,
    `- Data entities / models`,
    `- User roles`,
    `- Integrations / external services`,
    `- Technical components from the tech stack`,
    ``,
    `Rules:`,
    `- 8 to 16 nodes total.`,
    `- Node labels MUST be specific to THIS product (short, 1-4 words).`,
    `- The first node is the root (the product name).`,
    `- Layout: root at {x:400,y:0}; each subsequent node x=index*220 % 900, y=120*floor(index/4).`,
    `- Edges connect parent -> child logically (root -> modules, module -> features).`,
    ``,
    languageDirective(locale),
    ``,
    `CRITICAL: Respond with ONLY a raw JSON object, no markdown fences, no commentary. Exact shape:`,
    `{"nodes":[{"id":"1","data":{"label":"App Name"},"position":{"x":400,"y":0}},{"id":"2","data":{"label":"Auth"},"position":{"x":0,"y":120}}],"edges":[{"id":"e1","source":"1","target":"2"}]}`,
  ].join("\n");

  try {
    const result = await chatCompletion(
      model,
      systemPrompt || DEFAULT_SYSTEM_PROMPT,
      prompt
    );

    const usage = extractUsage(model, result.usage);
    const jsonStr = extractJson(result.content);
    const parsed = JSON.parse(jsonStr) as {
      nodes?: unknown;
      edges?: unknown;
    };

    const nodes = normalizeNodes(parsed.nodes, title, techStack);
    if (nodes.length === 0) {
      return { mindmap: synthMindmap(title, description, techStack), usage };
    }

    return {
      mindmap: {
        nodes,
        edges: normalizeEdges(parsed.edges, nodes),
      },
      usage,
    };
  } catch {
    // Fallback: susun mindmap sintetis dari judul, deskripsi & tech stack
    // agar canvas TIDAK pernah kosong walau AI gagal.
    return {
      mindmap: synthMindmap(title, description, techStack),
      usage: extractUsage(model, undefined),
    };
  }
}

/** Validasi & rapikan node dari AI agar aman dirender React Flow. */
function normalizeNodes(
  raw: unknown,
  title: string,
  techStack: string[]
): MindmapData["nodes"] {
  if (!Array.isArray(raw)) return [];

  const nodes: MindmapData["nodes"] = [];

  raw.forEach((n, i) => {
    const node = n as {
      id?: unknown;
      data?: { label?: unknown };
      position?: { x?: number; y?: number };
    };
    const label =
      typeof node?.data?.label === "string"
        ? node.data.label.trim()
        : typeof node?.id === "string"
          ? node.id
          : "";
    if (!label) return;

    nodes.push({
      id: String(node?.id ?? i + 1),
      data: { label: label.slice(0, 60) },
      position: {
        x: typeof node?.position?.x === "number" ? node.position.x : (i % 4) * 220,
        y:
          typeof node?.position?.y === "number"
            ? node.position.y
            : Math.floor(i / 4) * 120,
      },
    });
  });

  // Pastikan setidaknya ada root bila ada node.
  if (nodes.length > 0 && !nodes.some((n) => n.id === "1")) {
    nodes.unshift({
      id: "1",
      data: { label: title.slice(0, 60) || "Aplikasi" },
      position: { x: 400, y: 0 },
    });
  }
  void techStack;
  return nodes;
}

/** Validasi edge: hanya yang menunjuk node yang ada, hindari duplikat. */
function normalizeEdges(
  raw: unknown,
  nodes: MindmapData["nodes"]
): MindmapData["edges"] {
  const ids = new Set(nodes.map((n) => n.id));
  const seen = new Set<string>();
  const edges: MindmapData["edges"] = [];

  if (Array.isArray(raw)) {
    raw.forEach((e, i) => {
      const edge = e as { id?: unknown; source?: unknown; target?: unknown };
      const source = String(edge?.source ?? "");
      const target = String(edge?.target ?? "");
      if (!ids.has(source) || !ids.has(target) || source === target) return;
      const key = `${source}->${target}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({
        id: typeof edge?.id === "string" ? edge.id : `e${i + 1}`,
        source,
        target,
      });
    });
  }

  // Bila AI tak memberi edge valid, sambungkan semua node ke root.
  if (edges.length === 0 && nodes.length > 1) {
    const root = ids.has("1") ? "1" : nodes[0].id;
    nodes
      .filter((n) => n.id !== root)
      .forEach((n, i) => {
        edges.push({ id: `e${i + 1}`, source: root, target: n.id });
      });
  }

  return edges;
}

/**
 * Mindmap sintetis dari data proyek — dipakai sebagai fallback agar
 * canvas selalu berisi struktur yang masuk akal.
 */
function synthMindmap(
  title: string,
  description: string,
  techStack: string[]
): MindmapData {
  const root = title.trim() || "Aplikasi";
  const labels: string[] = [root];

  // Turunkan fitur dari deskripsi (kalimat/kata kunci bermakna).
  const stop = new Set([
    "yang", "dan", "untuk", "dengan", "aplikasi", "web", "adalah", "ini",
    "itu", "para", "dari", "akan", "pada", "the", "and", "for", "with",
    "app", "simple", "sederhana",
  ]);
  const descWords = (description || "")
    .split(/[\s,.;:!?()\n]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 3 && !stop.has(w.toLowerCase()));
  const keyFeatures = Array.from(new Set(descWords)).slice(0, 6);

  const coreSections = [
    "Autentikasi",
    "Halaman Utama",
    "Manajemen Data",
    "Pengaturan",
  ];

  const stackNodes = techStack.slice(0, 4);

  const all = [...coreSections, ...keyFeatures, ...stackNodes];
  all.forEach((l) => {
    if (labels.length < 16 && !labels.includes(l)) labels.push(l);
  });

  const nodes: MindmapData["nodes"] = labels.map((label, i) => ({
    id: String(i + 1),
    data: { label: label.slice(0, 60) },
    position: {
      x: i === 0 ? 400 : (i % 4) * 220,
      y: i === 0 ? 0 : Math.ceil(i / 4) * 120,
    },
  }));

  const edges: MindmapData["edges"] = nodes
    .filter((n) => n.id !== "1")
    .map((n, i) => ({ id: `e${i + 1}`, source: "1", target: n.id }));

  return { nodes, edges };
}

export async function generatePRDWithAI(
  title: string,
  description: string,
  techStack: string[],
  mindmapJson: unknown,
  model: string = "OpenCodeCombo",
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
  locale: Locale = "id"
): Promise<{ prd: string; usage: UsageInfo }> {
  const prompt = [
    `You are a senior product manager. Write a complete, implementation-ready Product Requirements Document (PRD) in Markdown.`,
    ``,
    `# Project: ${title}`,
    `Description: ${description}`,
    `Tech Stack: ${techStack.join(", ")}`,
    `Mindmap: ${JSON.stringify(mindmapJson, null, 2)}`,
    ``,
    `Cover at least these sections (translate the headings to the output language):`,
    `## 1. Executive Summary`,
    `## 2. Product Overview`,
    `## 3. Target Users & Personas`,
    `## 4. User Stories`,
    `## 5. Functional Requirements`,
    `## 6. Non-Functional Requirements`,
    `## 7. Technical Architecture`,
    `## 8. API Endpoints`,
    `## 9. Database Schema`,
    `## 10. Implementation Timeline`,
    `## 11. Success Metrics`,
    `## 12. Risk Assessment`,
    ``,
    `Be thorough and detailed. Output ONLY the markdown, no surrounding commentary.`,
    languageDirective(locale),
  ].join("\n");

  const result = await chatCompletion(
    model,
    systemPrompt || DEFAULT_SYSTEM_PROMPT,
    prompt
  );

  return {
    prd: result.content.trim(),
    usage: extractUsage(model, result.usage),
  };
}

export async function fetchAvailableModels(): Promise<Array<{ id: string; name: string }>> {
  const baseUrl = process.env.AI_BASE_URL || "http://127.0.0.1:20128/v1";
  try {
    const res = await fetch(`${baseUrl}/models`);
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    if (data.data) {
      return data.data.map((m) => ({ id: m.id, name: m.id }));
    }
  } catch {
    // ignore
  }
  return [];
}

export const FALLBACK_QUESTIONS = [
  "Siapa target pengguna utama produk ini?",
  "Fitur apa yang paling penting untuk MVP?",
  "Masalah utama apa yang ingin diselesaikan?",
  "Bagaimana cara pengguna menemukan produk ini?",
  "Apa metrik keberhasilan yang ingin diukur?",
];

export const FALLBACK_QUESTIONS_EN = [
  "Who is the primary target user of this product?",
  "Which features are most critical for the MVP?",
  "What core problem does it solve?",
  "How will users discover this product?",
  "What success metrics should be measured?",
];

function fallbackQuestionsFor(locale: Locale): string[] {
  return locale === "en" ? FALLBACK_QUESTIONS_EN : FALLBACK_QUESTIONS;
}

/**
 * Generate 5 pertanyaan penajaman fitur via AI (PRD §3.1).
 * Fallback ke daftar pertanyaan statis bila AI gagal.
 */
export async function generateQuestionsWithAI(
  title: string,
  description: string,
  techStack: string[],
  model: string = "OpenCodeCombo",
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
  locale: Locale = "id"
): Promise<{ questions: string[]; usage: UsageInfo | null }> {
  const prompt = [
    `You are a product discovery assistant.`,
    ``,
    `Product Title: ${title}`,
    `Description: ${description}`,
    `Tech Stack: ${techStack.join(", ")}`,
    ``,
    `Generate exactly 5 sharp clarifying questions that will help refine the feature scope of this product.`,
    languageDirective(locale),
    `Respond with ONLY a JSON array of 5 strings, e.g. ["Q1","Q2","Q3","Q4","Q5"]. No markdown, no extra text.`,
  ].join("\n");

  try {
    const result = await chatCompletion(
      model,
      systemPrompt || DEFAULT_SYSTEM_PROMPT,
      prompt
    );

    const jsonStr = extractJson(result.content);
    const parsed = JSON.parse(jsonStr);
    const questions = Array.isArray(parsed)
      ? parsed.filter((q): q is string => typeof q === "string").slice(0, 5)
      : [];

    return {
      questions: questions.length === 5 ? questions : fallbackQuestionsFor(locale),
      usage: extractUsage(model, result.usage),
    };
  } catch {
    return { questions: fallbackQuestionsFor(locale), usage: null };
  }
}

export type TechRecommendation = {
  frontend: string;
  backend: string;
  database: string;
  deployment: string;
  reasoning: string;
};

const TECH_FALLBACK: TechRecommendation = {
  frontend: "Next.js + Tailwind CSS",
  backend: "Next.js API Routes (Node.js)",
  database: "PostgreSQL (Prisma ORM)",
  deployment: "Vercel",
  reasoning: "Stack full-stack modern yang cepat untuk MVP.",
};

/**
 * Rekomendasi tech stack otomatis berdasarkan deskripsi produk (mode "AI").
 */
export async function recommendTechStackWithAI(
  title: string,
  description: string,
  model: string = "OpenCodeCombo",
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
  locale: Locale = "id"
): Promise<{ tech: TechRecommendation; usage: UsageInfo | null }> {
  const prompt = [
    `You are a pragmatic software architect. Recommend a concrete, production-ready tech stack for this product.`,
    ``,
    `Title: ${title}`,
    `Description: ${description || "(no description)"}`,
    ``,
    `Pick the BEST fit for each layer, considering the product's nature (web/mobile/data-heavy/realtime etc).`,
    `Each of frontend/backend/database/deployment must be a SHORT label: 1-3 words, a product/tech name only — NO sentences, NO explanations.`,
    `Put any explanation only in the "reasoning" field (one short sentence, in the output language).`,
    languageDirective(locale),
    `Respond with ONLY a raw JSON object, no markdown:`,
    `{"frontend":"Next.js","backend":"NestJS","database":"PostgreSQL","deployment":"Vercel","reasoning":"one short sentence"}`,
  ].join("\n");

  try {
    const result = await chatCompletion(
      model,
      systemPrompt || DEFAULT_SYSTEM_PROMPT,
      prompt
    );
    const parsed = JSON.parse(extractJson(result.content)) as Partial<TechRecommendation>;
    return {
      tech: {
        frontend: parsed.frontend?.trim() || TECH_FALLBACK.frontend,
        backend: parsed.backend?.trim() || TECH_FALLBACK.backend,
        database: parsed.database?.trim() || TECH_FALLBACK.database,
        deployment: parsed.deployment?.trim() || TECH_FALLBACK.deployment,
        reasoning: parsed.reasoning?.trim() || TECH_FALLBACK.reasoning,
      },
      usage: extractUsage(model, result.usage),
    };
  } catch {
    return { tech: TECH_FALLBACK, usage: null };
  }
}

export type TaskItem = {
  id: string;
  title: string;
  description: string;
  phase: string;
  priority: "high" | "medium" | "low";
  done?: boolean;
};

export type TaskGroup = {
  phase: string;
  tasks: TaskItem[];
};

/**
 * Pecah PRD menjadi task breakdown terstruktur per fase.
 */
export async function generateTasksWithAI(
  title: string,
  prdMarkdown: string,
  mindmapJson: unknown = null,
  techStack: string[] = [],
  model: string = "OpenCodeCombo",
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
  locale: Locale = "id"
): Promise<{ groups: TaskGroup[]; usage: UsageInfo | null }> {
  const prompt = [
    `You are a tech lead. Break the PRD into an actionable engineering task list.`,
    `Tasks MUST trace back to PRD requirements and the architecture mindmap. Do not invent unrelated work.`,
    ``,
    `Project: ${title}`,
    `Tech Stack: ${techStack.join(", ") || "not specified"}`,
    `Mindmap source:`,
    JSON.stringify(mindmapJson, null, 2),
    ``,
    `PRD source:`,
    prdMarkdown.slice(0, 10000),
    ``,
    `Group tasks by implementation phase. Each task needs: title (short), description (1-2 sentences), priority (high/medium/low).`,
    `Preserve feature names and technical components from the PRD/mindmap so every task is traceable.`,
    languageDirective(locale),
    `Respond with ONLY a raw JSON array of phases, no markdown:`,
    `[{"phase":"Setup","tasks":[{"title":"Init project","description":"...","priority":"high"}]}]`,
  ].join("\n");

  try {
    const result = await chatCompletion(
      model,
      systemPrompt || DEFAULT_SYSTEM_PROMPT,
      prompt
    );
    const parsed = JSON.parse(extractJson(result.content)) as unknown;

    const groups: TaskGroup[] = [];
    if (Array.isArray(parsed)) {
      parsed.forEach((g, gi) => {
        const group = g as { phase?: unknown; tasks?: unknown };
        const phase = typeof group.phase === "string" ? group.phase : `Fase ${gi + 1}`;
        const tasks: TaskItem[] = [];
        if (Array.isArray(group.tasks)) {
          group.tasks.forEach((t, ti) => {
            const task = t as { title?: unknown; description?: unknown; priority?: unknown };
            const tTitle = typeof task.title === "string" ? task.title.trim() : "";
            if (!tTitle) return;
            const prio =
              task.priority === "high" || task.priority === "low"
                ? task.priority
                : "medium";
            tasks.push({
              id: `${gi + 1}-${ti + 1}`,
              title: tTitle.slice(0, 120),
              description:
                typeof task.description === "string" ? task.description.slice(0, 300) : "",
              phase,
              priority: prio,
              done: false,
            });
          });
        }
        if (tasks.length) groups.push({ phase, tasks });
      });
    }

    if (groups.length === 0) return { groups: fallbackTasks(title), usage: null };
    return { groups, usage: extractUsage(model, result.usage) };
  } catch {
    return { groups: fallbackTasks(title), usage: null };
  }
}

function fallbackTasks(title: string): TaskGroup[] {
  const base: Array<{ phase: string; items: Array<[string, TaskItem["priority"]]> }> = [
    {
      phase: "Setup & Fondasi",
      items: [
        ["Inisialisasi proyek & struktur folder", "high"],
        ["Konfigurasi linter, formatter & env", "medium"],
        ["Setup database & skema awal", "high"],
      ],
    },
    {
      phase: "Backend",
      items: [
        ["Implementasi autentikasi", "high"],
        ["Endpoint API inti", "high"],
        ["Validasi & error handling", "medium"],
      ],
    },
    {
      phase: "Frontend",
      items: [
        ["Layout & navigasi utama", "high"],
        ["Halaman fitur utama", "high"],
        ["Responsif & state management", "medium"],
      ],
    },
    {
      phase: "Testing & Deploy",
      items: [
        ["Testing alur kritis", "high"],
        ["Konfigurasi deployment & CI", "medium"],
        ["Dokumentasi & serah terima", "low"],
      ],
    },
  ];

  return base.map((g, gi) => ({
    phase: g.phase,
    tasks: g.items.map(([t, p], ti) => ({
      id: `${gi + 1}-${ti + 1}`,
      title: t,
      description: `${t} untuk ${title}.`,
      phase: g.phase,
      priority: p,
      done: false,
    })),
  }));
}

/**
 * Style guide / design system dari PRD.
 */
export async function generateStyleGuideWithAI(
  title: string,
  prdMarkdown: string,
  taskSummary: string = "",
  techStack: string[] = [],
  model: string = "OpenCodeCombo",
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
  locale: Locale = "id"
): Promise<{ styleGuide: string; usage: UsageInfo | null }> {
  const prompt = [
    `You are a product designer. Create a concise, developer-ready STYLE GUIDE (design system) in Markdown.`,
    `This guide MUST be consistent with the PRD and task breakdown for this project.`,
    ``,
    `Project: ${title}`,
    `Tech Stack: ${techStack.join(", ") || "not specified"}`,
    `PRD:`,
    prdMarkdown.slice(0, 8000),
    ``,
    `Task Breakdown (UI-relevant parts):`,
    taskSummary.slice(0, 4000),
    ``,
    `Cover at least these sections (translate headings to the output language):`,
    `## 1. Design Principles`,
    `## 2. Color Palette (with hex)`,
    `## 3. Typography (font & scale)`,
    `## 4. Spacing & Layout Grid`,
    `## 5. Components (button, input, card) & states`,
    `## 6. Iconography & Illustration`,
    `## 7. Accessibility`,
    `## 8. Do & Don't`,
    ``,
    `Reference specific requirements, screens, and task names from the PRD and task breakdown where appropriate.`,
    languageDirective(locale),
    `Output ONLY the markdown, anti-slop, practical, no fluff.`,
  ].join("\n");

  try {
    const result = await chatCompletion(
      model,
      systemPrompt || DEFAULT_SYSTEM_PROMPT,
      prompt
    );
    const md = result.content.trim();
    return {
      styleGuide: md || fallbackStyleGuide(title),
      usage: extractUsage(model, result.usage),
    };
  } catch {
    return { styleGuide: fallbackStyleGuide(title), usage: null };
  }
}

/** Ringkas task breakdown menjadi teks untuk konteks prompt style guide. */
export function summarizeTasks(tasksJson: unknown): string {
  if (!Array.isArray(tasksJson) || tasksJson.length === 0) return "";
  const lines: string[] = [];
  for (const g of tasksJson) {
    const group = g as { phase?: unknown; tasks?: unknown };
    const phase = typeof group.phase === "string" ? group.phase : "Phase";
    lines.push(`### ${phase}`);
    if (Array.isArray(group.tasks)) {
      for (const t of group.tasks) {
        const task = t as { title?: unknown; description?: unknown };
        const title = typeof task.title === "string" ? task.title : "";
        if (!title) continue;
        const desc = typeof task.description === "string" ? ` — ${task.description}` : "";
        lines.push(`- ${title}${desc}`);
      }
    }
  }
  return lines.join("\n");
}

function fallbackStyleGuide(title: string): string {
  return [
    `# Style Guide — ${title}`,
    ``,
    `## 1. Prinsip Desain`,
    `- Sederhana, fokus, tanpa dekorasi berlebih (anti-slop).`,
    `- Konsisten: satu sumber warna, radius, dan spacing.`,
    ``,
    `## 2. Palet Warna`,
    `- Background: #080b12`,
    `- Surface: #0d1220`,
    `- Border: #1e293b`,
    `- Accent: #4f7cff`,
    `- Success: #22c55e · Warning: #eab308 · Danger: #ef4444`,
    ``,
    `## 3. Tipografi`,
    `- Sans: Geist / system-ui`,
    `- Skala: 12 / 14 / 16 / 20 / 24 / 32 px`,
    ``,
    `## 4. Spacing`,
    `- Basis 4px; gunakan 4/8/12/16/24/32.`,
    ``,
    `## 5. Komponen`,
    `- Button: primary/secondary/ghost, state hover/focus/disabled.`,
    `- Input: border 1px, radius 10px, focus ring accent.`,
    `- Card: radius 14px, border tipis, bg surface.`,
    ``,
    `## 6. Ikonografi`,
    `- Lucide, ukuran 16/20/24px, stroke 2px.`,
    ``,
    `## 7. Aksesibilitas`,
    `- Kontras minimal WCAG AA, fokus keyboard jelas.`,
    ``,
    `## 8. Do & Don't`,
    `- Do: gunakan token warna & spacing konsisten.`,
    `- Don't: gradien mencolok, shadow berlebihan, emoji dekoratif.`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Prototype Design (PRO)                                             */
/* ------------------------------------------------------------------ */

/**
 * Prompt builder prototype pindah ke `lib/prototype-prompt.ts` supaya bisa
 * diuji tanpa resolusi alias `@/lib/*`.
 */
import {
  buildPrototypePrompt as buildProtoPrompt,
  type ThemeTokensForPrompt as ThemeTokens,
} from "@/lib/prototype-prompt";

export {
  buildPrototypePrompt,
  buildThemeOverrideBlock,
} from "@/lib/prototype-prompt";
export type { ThemeTokensForPrompt } from "@/lib/prototype-prompt";

export type PrototypeScreen = {
  id: string;
  label: string;
};

export type PrototypeResult = {
  html: string;
  screens: PrototypeScreen[];
  usage: UsageInfo | null;
};

/** Label screen default bila model tidak mengembalikan penanda SCREEN. */
const DEFAULT_SCREEN_LABELS = ["Landing", "Dashboard", "Detail", "Form", "Settings"];

/**
 * Awasi keluaran model: ambil blok HTML saja.
 *
 * Model sering membungkus HTML dalam pagar markdown (```html ... ```) atau
 * menambahkan penjelasan sebelum/sesudah. Fungsi ini mengekstrak bagian
 * HTML-nya agar yang disimpan ke database benar-benar dokumen HTML.
 */
export function extractHtmlDocument(raw: string): string {
  let text = raw.trim();

  // Buang pagar markdown bila ada.
  const fenced = text.match(/```(?:html)?\s*\n([\s\S]*?)```/i);
  if (fenced && fenced[1].trim()) text = fenced[1].trim();

  // Ambil dari <!DOCTYPE html> atau <html> pertama.
  const start = text.search(/<!doctype html|<html[\s>]/i);
  if (start > 0) text = text.slice(start);

  // Buang teks setelah </html>.
  const end = text.toLowerCase().lastIndexOf("</html>");
  if (end !== -1) text = text.slice(0, end + "</html>".length);

  return text.trim();
}

/**
 * Parse penanda screen dari HTML, bila model menuliskannya.
 * Model diminta menulis komentar `<!-- screen: Label -->` sebelum tiap layar.
 */
export function extractScreens(html: string): PrototypeScreen[] {
  const out: PrototypeScreen[] = [];
  const re = /<!--\s*screen:\s*([^>]+?)\s*-->/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const label = m[1].trim();
    if (!label) continue;
    const id = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (out.some((s) => s.id === id)) continue;
    out.push({ id: id || `screen-${out.length + 1}`, label });
  }
  return out;
}

function fallbackScreens(): PrototypeScreen[] {
  return DEFAULT_SCREEN_LABELS.map((label: string) => ({
    id: label.toLowerCase(),
    label,
  }));
}

/**
 * Generate prototype HTML dari PRD + Style Guide.
 *
 * Catatan: ini panggilan AI termahal di aplikasi (output HTML penuh,
 * multi-screen), karena itu pemanggilnya WAJIB memeriksa kuota lebih dulu.
 */
export async function generatePrototypeWithAI(
  title: string,
  prdMarkdown: string,
  styleGuideMarkdown: string,
  techStack: string[] = [],
  model: string = "OpenCodeCombo",
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
  locale: Locale = "id",
  theme?: ThemeTokens | null
): Promise<PrototypeResult> {
  const prompt = buildProtoPrompt(
    {
      title,
      prdMarkdown,
      styleGuideMarkdown,
      techStack,
      locale,
      theme: theme ?? null,
    },
    languageDirective(locale as Locale)
  );

  try {
    const result = await chatCompletion(
      model,
      systemPrompt || DEFAULT_SYSTEM_PROMPT,
      prompt
    );
    const html = extractHtmlDocument(result.content);
    if (!html) {
      return { html: fallbackPrototype(title), screens: fallbackScreens(), usage: null };
    }
    const screens = extractScreens(html);
    return {
      html,
      screens: screens.length > 0 ? screens : fallbackScreens(),
      usage: extractUsage(model, result.usage),
    };
  } catch {
    return { html: fallbackPrototype(title), screens: fallbackScreens(), usage: null };
  }
}


/** Prototype minimal bila AI gagal — tetap bisa dirender, jujur soal keadaannya. */
function fallbackPrototype(title: string): string {
  return [
    `<!DOCTYPE html>`,
    `<html lang="id">`,
    `<head>`,
    `<meta charset="utf-8" />`,
    `<meta name="viewport" content="width=device-width, initial-scale=1" />`,
    `<title>${title} — Prototype</title>`,
    `<style>`,
    `  :root{--bg:#080b12;--surface:#0d1220;--border:#1e293b;--fg:#e5e9f0;--muted:#8b97ab;--accent:#4f7cff}`,
    `  *{box-sizing:border-box;margin:0;padding:0}`,
    `  body{background:var(--bg);color:var(--fg);font-family:ui-sans-serif,system-ui,sans-serif;padding:32px;line-height:1.6}`,
    `  .box{max-width:640px;margin:0 auto;border:1px solid var(--border);border-radius:14px;background:var(--surface);padding:24px}`,
    `  h1{font-size:20px;margin-bottom:8px}`,
    `  p{color:var(--muted);font-size:14px}`,
    `  code{font-family:ui-monospace,monospace;color:var(--accent)}`,
    `</style>`,
    `</head>`,
    `<body>`,
    `<!-- screen: Placeholder -->`,
    `<div class="box">`,
    `  <h1>${title}</h1>`,
    `  <p>Prototype belum berhasil di-generate. Coba tekan <code>Regenerate</code>.</p>`,
    `</div>`,
    `</body>`,
    `</html>`,
  ].join("\n");
}
