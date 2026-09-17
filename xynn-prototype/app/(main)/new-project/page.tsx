"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Wand2,
  SlidersHorizontal,
  SkipForward,
  ListChecks,
  Palette,
  Terminal,
  Check,
  CheckCircle2,
  Lock,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StepIndicator } from "@/components/ui/step-indicator";
import { useUpgrade } from "@/components/upgrade-provider";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { MindmapCanvas } from "@/components/mindmap-canvas";
import { sameNodes } from "@/lib/mindmap-compare";
import { FLOW_STEPS as WIZARD_FLOW_STEPS, type WizardStep } from "@/lib/wizard-flow";
import { cn } from "@/lib/utils";
import { LOCALES, t, type Locale } from "@/lib/i18n";

type Step = WizardStep;

type TechPrefs = {
  mode: "ai" | "manual";
  frontend: string;
  backend: string;
  database: string;
  deployment: string;
  reasoning?: string;
};

type TaskItem = {
  id: string;
  title: string;
  description: string;
  phase: string;
  priority: "high" | "medium" | "low";
};
type TaskGroup = { phase: string; tasks: TaskItem[] };

const EXAMPLE_IDEA = {
  id: "Aplikasi tracking pengeluaran setiap hari, bisa di-input lewat WhatsApp, ada dashboard dan ringkasan bulanan.",
  en: "A daily expense tracking app, with input via WhatsApp, plus a dashboard and monthly summary.",
};

const STACK_CHOICES = {
  frontend: ["Next.js + Tailwind", "React + Vite", "Vue 3", "SvelteKit", "Flutter"],
  backend: ["Next.js API Routes", "Express", "NestJS", "FastAPI", "Laravel", "Go Fiber"],
  database: ["PostgreSQL", "MySQL", "MongoDB", "SQLite", "Supabase"],
  deployment: ["Vercel", "Railway", "Fly.io", "AWS", "VPS/Docker"],
};

export default function NewProjectWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idea");
  const [busy, setBusy] = useState<string | null>(null);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Step 1
  const [locale, setLocale] = useState<Locale>("id");
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");

  // Mode alur: mulai dari ide, atau impor PRD yang sudah ada.
  const [flow, setFlow] = useState<"idea" | "import">("idea");
  // PRD yang ditempel pada mode import.
  const [importPrd, setImportPrd] = useState("");

  // Tim (opsional) — hanya muncul bila user anggota org dengan hak menambah.
  const [orgs, setOrgs] = useState<{ id: string; name: string; myRole: string }[]>([]);
  const [orgId, setOrgId] = useState<string>("");

  // Step 2
  const [tech, setTech] = useState<TechPrefs>({
    mode: "ai",
    frontend: "",
    backend: "",
    database: "",
    deployment: "",
  });

  // Step 3
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);

  // Mindmap
  const [nodes, setNodes] = useState<
    { id: string; data: { label: string }; position?: { x: number; y: number } }[]
  >([]);
  const [edges, setEdges] = useState<{ id: string; source: string; target: string }[]>([]);

  /**
   * Callback stabil untuk MindmapCanvas. WAJIB `useCallback`: bila dibuat
   * inline, referensinya berubah setiap render dan (bersama efek di dalam
   * canvas) memicu loop "Maximum update depth exceeded".
   */
  const handleMindmapNodesChange = useCallback(
    (updated: { id: string; data?: { label?: string }; position?: { x: number; y: number } }[]) => {
      setNodes((prev) => {
        // Hindari setState bila tidak ada perubahan nyata (cegah render loop).
        if (sameNodes(prev, updated)) return prev;
        return updated.map((n) => ({
          id: n.id,
          data: { label: n.data?.label ?? "" },
          position: n.position,
        }));
      });
    },
    []
  );

  // Output
  const [prd, setPrd] = useState("");
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [styleGuide, setStyleGuide] = useState("");
  const [activeTab, setActiveTab] = useState<"prd" | "tasks" | "style">("prd");

  const upgrade = useUpgrade();
  const L = t(locale);
  // Urutan step bergantung mode (lihat lib/wizard-flow.ts):
  //   idea   : ide → tech → questions → mindmap → output
  //   import : import PRD → mindmap → output  (PRD sudah ada, tanpa tech/questions)
  const FLOW_STEPS = WIZARD_FLOW_STEPS[flow];
  const STEP_LABELS = FLOW_STEPS.map((s) =>
    s === "idea"
      ? L.stepIdea
      : s === "import"
        ? L.stepImport
        : s === "tech"
          ? L.stepTech
          : s === "questions"
            ? L.stepQuestions
            : s === "mindmap"
              ? L.stepMindmap
              : L.stepOutput
  );
  const OUTPUT_STEPS = [
    { id: "prd" as const, label: L.tabPrd, icon: Sparkles },
    { id: "tasks" as const, label: L.tabTasks, icon: ListChecks },
    { id: "style" as const, label: L.tabStyle, icon: Palette },
  ];
  const currentIndex = Math.max(0, FLOW_STEPS.indexOf(step));
  /* ---------- Step 1: create workspace ---------- */
  const createWorkspace = useCallback(async () => {
    if (!title.trim()) return toast.error(locale === "en" ? "Project title is required" : "Judul proyek wajib diisi");

    // Bila workspace sudah dibuat (mis. pengguna kembali ke langkah awal lalu
    // maju lagi), JANGAN buat ulang — cukup lanjutkan. Mencegah workspace
    // duplikat yang nyata terjadi di mode import.
    if (workspaceId) {
      setStep(flow === "import" ? "mindmap" : "tech");
      return;
    }

    if (flow === "import") {
      if (!importPrd.trim())
        return toast.error(
          locale === "en" ? "Paste your PRD first" : "Tempel PRD Anda terlebih dahulu"
        );
    } else if (!idea.trim()) {
      return toast.error(locale === "en" ? "Describe your idea" : "Jelaskan ide aplikasinya");
    }

    setBusy("creating");
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: flow === "import" ? "" : idea,
          techStack: [],
          locale,
          organizationId: orgId || undefined,
          // Mode import: kirim PRD agar langsung tersimpan di workspace.
          importedPrd: flow === "import" ? importPrd : undefined,
        }),
      });

      if (res.status === 402) {
        const data = await res.json();
        toast.error(data.error || "Batas Free tier tercapai");
        upgrade.open({
          title: "Batas Free tier tercapai",
          message: data.error || "Upgrade untuk membuat lebih banyak project.",
        });
        return;
      }
      if (!res.ok) throw new Error("create failed");

      const ws = await res.json();
      setWorkspaceId(ws.id);
      // Mode import: PRD hasil tempelan sudah tersimpan → taruh di state agar
      // tab PRD langsung menampilkannya (tanpa generate).
      if (flow === "import" && ws.fullPrdMd) setPrd(ws.fullPrdMd);
      // Import → langsung ke mindmap (PRD sudah ada; lewati tech & questions).
      // Ide → lanjut ke pemilihan teknologi.
      setStep(flow === "import" ? "mindmap" : "tech");
    } catch {
      toast.error(locale === "en" ? "Failed to create project" : "Gagal membuat project");
    } finally {
      setBusy(null);
    }
  }, [title, idea, locale, upgrade, orgId, flow, importPrd, workspaceId]);

  /* ---------- Step 2: tech prefs ---------- */
  const saveTechAndContinue = useCallback(async () => {
    if (!workspaceId) return;

    let finalTech = tech;
    setBusy("tech");
    try {
      if (tech.mode === "ai") {
        const res = await fetch("/api/ai/techstack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description: idea, locale }),
        });
        if (res.ok) {
          const rec = await res.json();
          finalTech = { mode: "ai", ...rec };
          setTech(finalTech);
        }
      } else if (!tech.frontend || !tech.backend || !tech.database || !tech.deployment) {
        toast.error(locale === "en" ? "Complete all technology choices" : "Lengkapi semua pilihan teknologi");
        setBusy(null);
        return;
      }

      const stack = [
        finalTech.frontend,
        finalTech.backend,
        finalTech.database,
        finalTech.deployment,
      ].filter(Boolean);

      await fetch("/api/workspace/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: workspaceId, techStack: stack, techPreferences: finalTech }),
      });

      setBusy("questions");
      const qRes = await fetch(`/api/ai/questions?id=${workspaceId}`);
      if (qRes.ok) {
        const qData = await qRes.json();
        setQuestions(qData.questions || []);
        setAnswers(new Array(qData.questions?.length || 0).fill(""));
      }
      setStep("questions");
    } catch {
      toast.error(locale === "en" ? "Failed to process tech preferences" : "Gagal memproses preferensi teknologi");
    } finally {
      setBusy(null);
    }
  }, [workspaceId, tech, title, idea, locale]);

  /* ---------- Step 4: mindmap ---------- */
  const generateMindmap = useCallback(async () => {
    if (!workspaceId) return;
    setBusy("mindmap");
    try {
      const res = await fetch(`/api/ai/mindmap?id=${workspaceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions, answers }),
      });
      if (!res.ok) throw new Error();
      const mindmap = await res.json();
      setNodes(mindmap.nodes || []);
      setEdges(mindmap.edges || []);
      setStep("mindmap");
    } catch {
      toast.error(locale === "en" ? "Failed to generate mindmap" : "Gagal generate mindmap");
    } finally {
      setBusy(null);
    }
  }, [workspaceId, questions, answers, locale]);

  /* ---------- Step 6: PRD → Task → Style (BERTAHAP, bukan sekaligus) ---------- */
  // Tiap tahap di-generate HANYA saat diminta (menekan tombol lanjut), supaya
  // pengguna meninjau tiap hasil dan tidak membakar kuota AI sekaligus.

  /** Hasilkan PRD. Mengembalikan true bila berhasil. */
  const generatePrd = useCallback(async (): Promise<boolean> => {
    if (!workspaceId) return false;
    setBusy("prd");
    try {
      const res = await fetch("/api/ai/full-prd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: workspaceId }),
      });
      const data = await res.json();
      if (res.status === 402) {
        upgrade.open({
          title: "Berlangganan untuk melanjutkan",
          message: "Untuk men-generate PRD, pilih paket berbayar.",
        });
        return false;
      }
      if (!res.ok) throw new Error(data.error || "Gagal generate PRD");
      setPrd(data.prd);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal generate PRD");
      return false;
    } finally {
      setBusy(null);
    }
  }, [workspaceId, upgrade]);

  /** Hasilkan Task Breakdown (butuh PRD). */
  const generateTasks = useCallback(async (): Promise<boolean> => {
    if (!workspaceId) return false;
    setBusy("tasks");
    try {
      const res = await fetch("/api/ai/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: workspaceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) {
        upgrade.open({
          title: "Berlangganan untuk melanjutkan",
          message: "Untuk men-generate Task Breakdown, pilih paket berbayar.",
        });
        return false;
      }
      if (!res.ok) throw new Error(data.error || "Gagal generate task");
      setTaskGroups(data.groups || []);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal generate task");
      return false;
    } finally {
      setBusy(null);
    }
  }, [workspaceId, upgrade]);

  /** Hasilkan Style Guide (butuh Task). */
  const generateStyle = useCallback(async (): Promise<boolean> => {
    if (!workspaceId) return false;
    setBusy("style");
    try {
      const res = await fetch("/api/ai/styleguide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: workspaceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) {
        upgrade.open({
          title: "Berlangganan untuk melanjutkan",
          message: "Untuk men-generate Style Guide, pilih paket berbayar.",
        });
        return false;
      }
      if (!res.ok) throw new Error(data.error || "Gagal generate style guide");
      setStyleGuide(data.styleGuide || "");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal generate style guide");
      return false;
    } finally {
      setBusy(null);
    }
  }, [workspaceId, upgrade]);

  /* ---------- Step 5: paywall → mulai output ---------- */
  const continueFromMindmap = useCallback(async () => {
    const res = await fetch("/api/user/subscription");
    const sub = res.ok ? await res.json() : { isActive: false, planType: "FREE" };
    if (!sub.isActive || sub.planType === "FREE") {
      upgrade.open({
        title: "Berlangganan untuk melanjutkan",
        message:
          flow === "import"
            ? "Mindmap siap! Untuk men-generate Task & Style Guide, pilih paket berbayar."
            : "Mindmap siap! Untuk men-generate PRD lengkap, pilih paket berbayar.",
        highlight: "Struktur Anda tersimpan — lanjut setelah berlangganan.",
      });
      return;
    }
    setStep("output");
    if (flow === "import") {
      // PRD sudah diimpor → langsung ke Task.
      setActiveTab("tasks");
    } else {
      // Jalur ide: mulai dari PRD.
      setActiveTab("prd");
      await generatePrd();
    }
  }, [generatePrd, upgrade, flow]);

  // Resume workspace yang sudah ada (?id=...). Ambil datanya agar step & isi
  // sesuai keadaan nyata (PRD/task/style yang sudah ada) — bukan menebak "tech".
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/workspace");
        if (!res.ok) return;
        const list: Array<Record<string, unknown>> = await res.json();
        const ws = list.find((w) => w.id === id);
        if (!active) return;
        setWorkspaceId(id);
        if (!ws) return;
        // Selaraskan state dgn workspace yang ada.
        if (typeof ws.title === "string") setTitle(ws.title);
        if (typeof ws.fullPrdMd === "string") setPrd(ws.fullPrdMd);
        if (Array.isArray(ws.tasksJson)) setTaskGroups(ws.tasksJson as TaskGroup[]);
        if (typeof ws.styleGuideMd === "string") setStyleGuide(ws.styleGuideMd);
        const hasPrd = typeof ws.fullPrdMd === "string" && ws.fullPrdMd.length > 0;
        // Mode import = PRD sudah ada tapi deskripsi kosong.
        const isImport =
          hasPrd && !(typeof ws.description === "string" && ws.description.trim());
        setFlow(isImport ? "import" : "idea");
        if (hasPrd) {
          setStep("output");
          setActiveTab(Array.isArray(ws.tasksJson) && ws.tasksJson.length ? "style" : "tasks");
        } else {
          setStep("tech");
        }
      } catch {
        /* diamkan; wizard tetap bisa dipakai */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Muat tim yang bisa dipakai membuat workspace. Gagal (mis. bukan ENTERPRISE)
  // bukan masalah — dropdown cukup tidak muncul.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/org?lite=1");
        if (!res.ok) return;
        const data = await res.json();
        if (active) setOrgs(Array.isArray(data) ? data : []);
      } catch {
        /* diamkan */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Prefill dari template (?template=slug). Hanya mengisi field yang masih
  // kosong agar tidak menimpa ketikan pengguna bila ia sudah mulai mengisi.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const slug = new URLSearchParams(window.location.search).get("template");
    if (!slug) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/templates?slug=${encodeURIComponent(slug)}`);
        if (!res.ok) return;
        const tpl = await res.json();
        if (!active) return;
        setTitle((prev) => prev || tpl.title || "");
        setIdea((prev) => prev || tpl.idea || "");
        if (tpl.locale === "en" || tpl.locale === "id") {
          setLocale((prev) => prev || tpl.locale);
        }
        // Bila template menyertakan tepat 4 teknologi (urutan: frontend,
        // backend, database, deployment), prefill mode manual. Kalau tidak,
        // biarkan mode AI memilih agar tidak salah memetakan.
        const stack: string[] = Array.isArray(tpl.techStack) ? tpl.techStack : [];
        if (stack.length === 4) {
          setTech((prev) =>
            prev.frontend || prev.backend || prev.database || prev.deployment
              ? prev
              : {
                  mode: "manual",
                  frontend: stack[0],
                  backend: stack[1],
                  database: stack[2],
                  deployment: stack[3],
                }
          );
        }
      } catch {
        /* diamkan */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    // Lebar sengaja lebih sempit dari layout (max-w-6xl): wizard = alur fokus
    // satu kolom, agar mata tidak melebar. Pengecualian terdokumentasi.
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted">
            {currentIndex + 1} / {STEP_LABELS.length}
          </span>
          <span className="text-xs text-muted">{STEP_LABELS[currentIndex]}</span>
        </div>
        <StepIndicator current={currentIndex + 1} steps={STEP_LABELS} />
      </div>

      {/* ============ STEP 1: IDEA / IMPORT ============ */}
      {(step === "idea" || step === "import") && (
        <div className="xynn-rise space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {L.wizardTitle}
            </h1>
            <p className="text-sm text-muted">{L.wizardDesc}</p>
          </div>

          {/* Pemilih mode alur: mulai dari ide atau impor PRD */}
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              active={flow === "idea"}
              onClick={() => {
                setFlow("idea");
                setStep("idea");
              }}
              icon={Sparkles}
              title={L.flowIdeaTitle}
              desc={L.flowIdeaDesc}
            />
            <ChoiceCard
              active={flow === "import"}
              onClick={() => {
                setFlow("import");
                setStep("import");
              }}
              icon={FileText}
              title={L.flowImportTitle}
              desc={L.flowImportDesc}
            />
          </div>

          {/* Language selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted">{L.langLabel}</label>
            <div className="flex gap-2">
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLocale(l.code)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm transition-all",
                    locale === l.code
                      ? "border-accent/60 bg-accent/5 text-foreground shadow-[0_0_0_1px_var(--accent)]"
                      : "border-border text-muted hover:border-border-strong hover:text-foreground"
                  )}
                >
                  <span>{l.flag}</span>
                  {l.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted">{L.langHint}</p>
          </div>

          {/* Team selector — hanya muncul bila user bisa membuat proyek tim */}
          {orgs.length > 0 && (
            <div className="space-y-2">
              <Field label="Tim (opsional)">
                <Select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                  <option value="">Pribadi (hanya saya)</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <p className="text-[11px] text-muted">
                Bila memilih tim, seluruh anggota tim dapat melihat proyek ini.
              </p>
            </div>
          )}

          {/* Input: ide ATAU PRD impor */}
          <div className="space-y-4 rounded-2xl border border-border bg-surface/40 p-5">
            <Field label={L.titleLabel}>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={L.titlePlaceholder}
              />
            </Field>

            {flow === "idea" ? (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-muted">{L.ideaLabel}</label>
                  <button
                    type="button"
                    onClick={() => setIdea(EXAMPLE_IDEA[locale])}
                    className="text-[11px] text-accent hover:underline"
                  >
                    {L.useExample}
                  </button>
                </div>
                <Textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  rows={5}
                  placeholder={locale === "en" ? `e.g. ${EXAMPLE_IDEA.en}` : `cth: ${EXAMPLE_IDEA.id}`}
                />
                <p className="mt-1.5 text-[11px] text-muted">{L.ideaHint}</p>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  {L.importPrdLabel}
                </label>
                <Textarea
                  value={importPrd}
                  onChange={(e) => setImportPrd(e.target.value)}
                  rows={10}
                  placeholder={L.importPrdPlaceholder}
                />
                <p className="mt-1.5 text-[11px] text-muted">{L.importPrdHint}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={createWorkspace} disabled={busy === "creating"} size="lg">
              {busy === "creating" && <Loader2 className="h-4 w-4 animate-spin" />}
              {flow === "import" ? L.importPrdCta : L.next}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ============ STEP 2: TECH ============ */}
      {step === "tech" && (
        <div className="xynn-rise space-y-6">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {L.techTitle}
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              active={tech.mode === "ai"}
              onClick={() => setTech((t) => ({ ...t, mode: "ai" }))}
              icon={Wand2}
              title={L.letAi}
              desc={L.letAiDesc}
            />
            <ChoiceCard
              active={tech.mode === "manual"}
              onClick={() => setTech((t) => ({ ...t, mode: "manual" }))}
              icon={SlidersHorizontal}
              title={L.chooseSelf}
              desc={L.chooseSelfDesc}
            />
          </div>

          {tech.mode === "ai" ? (
            <div className="flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs text-muted">
              <Sparkles className="h-4 w-4 shrink-0 text-accent" />
              {L.aiAnalyzing}
            </div>
          ) : (
            <div className="grid gap-4 rounded-2xl border border-border bg-surface/40 p-5 sm:grid-cols-2">
              {(
                [
                  ["frontend", L.fe],
                  ["backend", L.be],
                  ["database", L.db],
                  ["deployment", L.deploy],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <Select
                    value={tech[key]}
                    onChange={(e) => setTech((t) => ({ ...t, [key]: e.target.value }))}
                  >
                    <option value="">{L.choose}</option>
                    {STACK_CHOICES[key].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep("idea")} disabled={!!busy}>
              <ArrowLeft className="h-4 w-4" />
              {L.back}
            </Button>
            <Button onClick={saveTechAndContinue} disabled={!!busy} size="lg">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {L.next}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ============ STEP 3: QUESTIONS ============ */}
      {step === "questions" && (
        <div className="xynn-rise space-y-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {L.qTitle}
            </h2>
            <Badge tone="neutral">{L.qOptional}</Badge>
          </div>
          <p className="text-sm text-muted">{L.qDesc}</p>

          <div className="space-y-4 rounded-2xl border border-border bg-surface/40 p-5">
            {questions.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                {L.qPreparing}
              </div>
            ) : (
              questions.map((q, idx) => (
                <Field key={idx} label={`${idx + 1}. ${q}`}>
                  <Textarea
                    value={answers[idx] || ""}
                    onChange={(e) =>
                      setAnswers((prev) => {
                        const next = [...prev];
                        next[idx] = e.target.value;
                        return next;
                      })
                    }
                    rows={2}
                    placeholder={L.qAnswerPh}
                  />
                </Field>
              ))
            )}
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep("tech")} disabled={!!busy}>
              <ArrowLeft className="h-4 w-4" />
              {L.back}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setAnswers(new Array(questions.length).fill(""));
                  generateMindmap();
                }}
                disabled={!!busy}
              >
                <SkipForward className="h-4 w-4" />
                {L.skip}
              </Button>
              <Button onClick={generateMindmap} disabled={!!busy} size="lg">
                {busy === "mindmap" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {L.makeStructure}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============ STEP 4: MINDMAP ============ */}
      {step === "mindmap" && (
        <div className="xynn-rise space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {L.mindmapTitle}
            </h2>
            <Badge tone="accent">{nodes.length} nodes</Badge>
          </div>

          <div className="rounded-2xl border border-border bg-surface/40 p-3 sm:p-4">
            {nodes.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Sparkles className="h-6 w-6 text-muted" />
                <p className="text-sm text-muted">{L.noNode}</p>
                <Button variant="secondary" size="sm" onClick={generateMindmap} disabled={!!busy}>
                  <Sparkles className="h-3.5 w-3.5" />
                  {L.regenerate}
                </Button>
              </div>
            ) : (
              <MindmapCanvas
                nodes={nodes}
                edges={edges}
                editable
                onNodesChangeExternal={handleMindmapNodesChange}
                height="h-[480px]"
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep(flow === "import" ? "import" : "questions")}
              disabled={!!busy}
            >
              <ArrowLeft className="h-4 w-4" />
              {L.back}
            </Button>
            <Button onClick={continueFromMindmap} disabled={!!busy || nodes.length === 0} size="lg">
              {flow === "import" ? L.tabTasks : L.toPrd}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ============ STEP 5: OUTPUT (berurutan: PRD → Task → Style) ============ */}
      {step === "output" && (
        <div className="xynn-rise space-y-6">
          {/* Stepper */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-surface/40 p-1.5">
            {OUTPUT_STEPS.map((s, i) => {
              const Icon = s.icon;
              const done =
                (s.id === "prd" && !!prd) ||
                (s.id === "tasks" && taskGroups.length > 0) ||
                (s.id === "style" && !!styleGuide);
              const reached =
                (s.id === "prd") ||
                (s.id === "tasks" && !!prd) ||
                (s.id === "style" && taskGroups.length > 0);
              const loading =
                s.id === busy;
              const active = activeTab === s.id;
              const clickable = done || reached;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (clickable) setActiveTab(s.id);
                  }}
                  disabled={!clickable}
                  className={cn(
                    "flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    active
                      ? "bg-surface-2 text-foreground"
                      : clickable
                        ? "text-muted hover:text-foreground"
                        : "cursor-not-allowed text-muted/40"
                  )}
                  title={!clickable ? L.stepLocked : undefined}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full text-[9px]",
                      done
                        ? "bg-success/20 text-success"
                        : reached
                          ? "bg-accent/20 text-accent"
                          : "bg-surface-2 text-muted/50"
                    )}
                  >
                    {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
                  </span>
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                  {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                  {!clickable && <Lock className="h-3 w-3" />}
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-border bg-surface/40 p-5">
            {activeTab === "prd" &&
              (busy === "prd" && !prd ? (
                <LoadingBlock label={L.generatingPrd} />
              ) : prd ? (
                <MarkdownRenderer markdown={prd} storageKey={`wizard-${workspaceId}-prd`} />
              ) : (
                <GeneratePrompt
                  label={L.prdEmpty}
                  cta={L.projGenPrd}
                  busy={busy === "prd"}
                  onGenerate={() => void generatePrd()}
                />
              ))}

            {activeTab === "tasks" &&
              (!prd ? (
                <StepLocked onUnlock={() => setActiveTab("prd")} label={L.unlockPrdFirst} />
              ) : busy === "tasks" ? (
                <LoadingBlock label={L.generatingTasks} />
              ) : taskGroups.length > 0 ? (
                <TaskList groups={taskGroups} emptyLabel={L.tasksEmpty} />
              ) : (
                <GeneratePrompt
                  label={L.tasksEmpty}
                  cta={L.tabTasks}
                  busy={busy === "tasks"}
                  onGenerate={() => void generateTasks()}
                />
              ))}

            {activeTab === "style" &&
              (taskGroups.length === 0 ? (
                <StepLocked onUnlock={() => setActiveTab("tasks")} label={L.unlockTasksFirst} />
              ) : busy === "style" ? (
                <LoadingBlock label={L.generatingStyle} />
              ) : styleGuide ? (
                <MarkdownRenderer markdown={styleGuide} storageKey={`wizard-${workspaceId}-style`} />
              ) : (
                <GeneratePrompt
                  label={L.styleEmpty}
                  cta={L.tabStyle}
                  busy={busy === "style"}
                  onGenerate={() => void generateStyle()}
                />
              ))}
          </div>

          {/* Navigasi antar-step — sticky agar selalu terjangkau walau konten
              (mis. PRD) sangat panjang. */}
          <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/90 px-3 py-2.5 backdrop-blur">
            <Button
              variant="ghost"
              onClick={() => {
                const order: ("prd" | "tasks" | "style")[] = ["prd", "tasks", "style"];
                const i = order.indexOf(activeTab);
                if (i > 0) setActiveTab(order[i - 1]);
              }}
              disabled={activeTab === "prd" || !!busy}
            >
              <ArrowLeft className="h-4 w-4" />
              {L.back}
            </Button>
            {activeTab !== "style" ? (
              <Button
                onClick={async () => {
                  // Lanjut = generate tahap berikutnya (bila belum ada), lalu
                  // pindah tab HANYA bila berhasil.
                  if (activeTab === "prd") {
                    if (!prd) {
                      const ok = await generatePrd();
                      if (!ok) return;
                    }
                    if (taskGroups.length === 0) {
                      const ok = await generateTasks();
                      if (!ok) return;
                    }
                    setActiveTab("tasks");
                  } else if (activeTab === "tasks") {
                    if (taskGroups.length === 0) {
                      const ok = await generateTasks();
                      if (!ok) return;
                    }
                    if (!styleGuide) {
                      const ok = await generateStyle();
                      if (!ok) return;
                    }
                    setActiveTab("style");
                  }
                }}
                disabled={!!busy}
                size="lg"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {activeTab === "prd" ? L.tabTasks : L.tabStyle}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="lg" onClick={() => router.push(`/project/${workspaceId}`)}>
                <CheckCircle2 className="h-4 w-4" />
                {L.openProject}
              </Button>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-surface/40 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
              <Terminal className="h-4 w-4 text-muted" />
              {L.exec}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/project/${workspaceId}/execute`}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface-2 text-sm text-foreground transition-colors hover:bg-surface"
              >
                <Terminal className="h-4 w-4" />
                {L.downloadCli}
              </Link>
              <Button className="flex-1" onClick={() => router.push(`/project/${workspaceId}`)}>
                <CheckCircle2 className="h-4 w-4" />
                {L.openProject}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- sub-components ---------------- */

function ChoiceCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all",
        active
          ? "border-accent/60 bg-accent/5 shadow-[0_0_0_1px_var(--accent)]"
          : "border-border hover:border-border-strong"
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", active ? "text-accent" : "text-muted")} />
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted">{desc}</p>
      </div>
    </button>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-accent" />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

/** Ajakan generate untuk tab yang belum punya data (PRD/Task/Style). */
function GeneratePrompt({
  label,
  cta,
  busy,
  onGenerate,
}: {
  label: string;
  cta: string;
  busy: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">
        <Sparkles className="h-5 w-5" />
      </div>
      <p className="max-w-sm text-sm text-muted">{label}</p>
      <Button onClick={onGenerate} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {cta}
      </Button>
    </div>
  );
}

function StepLocked({ label, onUnlock }: { label: string; onUnlock: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-muted">
        <Lock className="h-5 w-5" />
      </div>
      <p className="text-sm text-muted">{label}</p>
      <Button variant="secondary" size="sm" onClick={onUnlock}>
        Kembali ke langkah sebelumnya
      </Button>
    </div>
  );
}

function TaskList({ groups, emptyLabel }: { groups: TaskGroup[]; emptyLabel: string }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  if (groups.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{emptyLabel}</p>;
  }

  const prioTone: Record<TaskItem["priority"], "danger" | "warning" | "neutral"> = {
    high: "danger",
    medium: "warning",
    low: "neutral",
  };

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.phase}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <ListChecks className="h-4 w-4 text-accent" />
            {g.phase}
          </h3>
          <ul className="space-y-1.5">
            {g.tasks.map((task) => (
              <li key={task.id}>
                <button
                  onClick={() => setChecked((p) => ({ ...p, [task.id]: !p[task.id] }))}
                  className="flex w-full items-start gap-3 rounded-lg border border-border bg-surface-2/30 p-3 text-left transition-colors hover:bg-surface-2/60"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      checked[task.id]
                        ? "border-accent bg-accent text-white"
                        : "border-border-strong"
                    )}
                  >
                    {checked[task.id] && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-sm",
                        checked[task.id] ? "text-muted line-through" : "text-foreground"
                      )}
                    >
                      {task.title}
                    </span>
                    {task.description && (
                      <span className="mt-0.5 block text-xs text-muted">{task.description}</span>
                    )}
                  </span>
                  <Badge tone={prioTone[task.priority]}>{task.priority}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
