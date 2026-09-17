"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Download,
  FileDown,
  Globe,
  Loader2,
  Pencil,
  Sparkles,
  Terminal,
  Network,
  ListChecks,
  Palette,
  MonitorSmartphone,
  Check,
  CheckCircle2,
  Lock,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Field } from "@/components/ui/input";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { MindmapCanvas } from "@/components/mindmap-canvas";
import { PrototypeCanvas } from "@/components/prototype-canvas";
import {
  ThemeEditor,
  applyThemeToHtml,
  DEFAULT_THEME,
  themeFromStyleGuide,
  type ThemeTokens,
} from "@/components/theme-editor";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useUpgrade } from "@/components/upgrade-provider";
import { useSubscription } from "@/lib/use-subscription";
import {
  downloadPrd,
  downloadTasks,
  downloadStyle,
  downloadAllBundle,
} from "@/lib/export";

type TaskItem = {
  id: string;
  title: string;
  description: string;
  phase: string;
  priority: "high" | "medium" | "low";
};
type TaskGroup = { phase: string; tasks: TaskItem[] };

type Workspace = {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  techPreferences?: {
    mode?: string;
    frontend?: string;
    backend?: string;
    database?: string;
    deployment?: string;
    reasoning?: string;
  } | null;
  mindmapJson: {
    nodes?: { id: string; data?: { label?: string }; position?: { x: number; y: number } }[];
    edges?: { id: string; source: string; target: string }[];
  };
  fullPrdMd: string | null;
  tasksJson: TaskGroup[] | null;
  styleGuideMd: string | null;
  prototypeHtml?: string | null;
  prototypeJson?: { screens?: { id: string; label: string }[] } | null;
  themeTokensJson?: Record<string, unknown> | null;
  isPublic: boolean;
  isAnonymous: boolean;
  shareSlug: string | null;
  category: string | null;
  locale: string;
};

type Tab = "prd" | "tasks" | "style" | "mindmap" | "prototype";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("mindmap");
  // Panel tema prototype bisa dilipat agar kanvas dapat lebar penuh di desktop.
  const [themePanelOpen, setThemePanelOpen] = useState(true);

  // edit
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const L = t(workspace?.locale);
  const upgrade = useUpgrade();
  const { isPaid, canUsePrototype, prototypeQuotaLeft, canSaveThemes } = useSubscription();
  const [theme, setTheme] = useState<ThemeTokens>(DEFAULT_THEME);

  // Token "awal" dari Style Guide — target Reset & fallback tema. Dihitung
  // ulang saat style guide berubah, agar Reset selalu selaras dengan style
  // guide terkini (mindmap→PRD→task→style→prototype tetap terhubung).
  const styleGuideTheme = useMemo<ThemeTokens>(
    () => themeFromStyleGuide(workspace?.styleGuideMd ?? null),
    [workspace?.styleGuideMd]
  );

  const load = () =>
    fetch("/api/workspace")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((workspaces: Workspace[]) => {
        const ws = workspaces.find((w) => w.id === id);
        if (ws) {
          setWorkspace(ws);
          setTitle(ws.title);
          setDescription(ws.description || "");
          setCategory(ws.category || "");
          setIsPublic(ws.isPublic);
          setIsAnonymous(ws.isAnonymous);
          // Tema awal: pakai tema tersimpan bila ada; bila BELUM, ambil token
          // dari Style Guide agar prototype konsisten dengan style guide.
          if (ws.themeTokensJson) {
            setTheme({ ...DEFAULT_THEME, ...(ws.themeTokensJson as Partial<ThemeTokens>) });
          } else if (ws.styleGuideMd) {
            setTheme(themeFromStyleGuide(ws.styleGuideMd));
          }
          // Mulai dari langkah terjauh yang sudah selesai.
          if (ws.prototypeHtml) setTab("prototype");
          else if (ws.styleGuideMd) setTab("style");
          else if (ws.tasksJson?.length) setTab("tasks");
          else if (ws.fullPrdMd) setTab("prd");
          else setTab("mindmap");
        }
      });

  useEffect(() => {
    load()
      .catch(() => toast.error("Gagal memuat project"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = async () => {
    setBusy("save");
    try {
      const res = await fetch("/api/workspace/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title, description, category }),
      });
      if (!res.ok) throw new Error();
      setWorkspace((prev) => (prev ? { ...prev, title, description, category } : null));
      setEditing(false);
      toast.success("Tersimpan");
    } catch {
      toast.error("Gagal menyimpan");
    } finally {
      setBusy(null);
    }
  };

  const handlePublish = async () => {
    try {
      const res = await fetch("/api/workspace/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isPublic: !isPublic, isAnonymous, category }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWorkspace((prev) =>
        prev ? { ...prev, isPublic: data.isPublic, shareSlug: data.shareSlug } : null
      );
      setIsPublic(data.isPublic);
      toast.success(data.isPublic ? "Dipublikasikan" : "Diset ke privat");
    } catch {
      toast.error("Gagal mengubah status");
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch("/api/workspace/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      toast.success("Project dihapus");
      router.push("/projects");
    } catch {
      toast.error("Gagal menghapus project");
    }
  };

  const generate = async (kind: "prd" | "tasks" | "style" | "prototype", screenLabel?: string) => {
    setBusy(kind);
    const url =
      kind === "prd"
        ? "/api/ai/full-prd"
        : kind === "tasks"
          ? "/api/ai/tasks"
          : kind === "style"
            ? "/api/ai/styleguide"
            : "/api/ai/prototype";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(screenLabel ? { id, screenLabel } : { id }),
      });
      const data = await res.json();
      if (res.status === 402) {
        upgrade.open({
          title: kind === "prototype" ? "Prototype Design khusus PRO" : "Berlangganan untuk melanjutkan",
          message:
            data.error ||
            (kind === "prototype"
              ? "Generate prototype tersedia mulai paket PRO."
              : "Fitur ini tersedia untuk paket berbayar."),
        });
        return;
      }
      if (res.status === 429) {
        upgrade.open({
          title: "Kuota prototype habis",
          message: data.error || "Kuota generate bulan ini sudah terpakai.",
        });
        return;
      }
      if (!res.ok) {
        toast.error(data.error || "Gagal generate");
        return;
      }

      if (kind === "prd") {
        setWorkspace((prev) => (prev ? { ...prev, fullPrdMd: data.prd } : null));
        setTab("prd");
      } else if (kind === "tasks") {
        setWorkspace((prev) => (prev ? { ...prev, tasksJson: data.groups } : null));
        setTab("tasks");
      } else if (kind === "style") {
        setWorkspace((prev) => (prev ? { ...prev, styleGuideMd: data.styleGuide } : null));
        setTab("style");
      } else {
        setWorkspace((prev) =>
          prev
            ? {
                ...prev,
                prototypeHtml: data.prototypeHtml,
                prototypeJson: { screens: data.screens },
              }
            : null
        );
        setTab("prototype");
      }
      toast.success("Berhasil di-generate");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal generate");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-muted">
        <p className="text-sm">{L.projNotFound}</p>
        <Button variant="secondary" onClick={() => router.push("/projects")}>
          <ArrowLeft className="h-4 w-4" />
          Project
        </Button>
      </div>
    );
  }

  const nodeCount = workspace.mindmapJson?.nodes?.length ?? 0;
  const hasPrd = !!workspace.fullPrdMd;
  const hasTasks = !!workspace.tasksJson?.length;
  const hasStyle = !!workspace.styleGuideMd;
  const hasPrototype = !!workspace.prototypeHtml;

  const tabs = [
    {
      id: "mindmap" as const,
      label: L.projTabMindmap,
      icon: Network,
      has: nodeCount > 0,
      locked: false,
    },
    {
      id: "prd" as const,
      label: L.projTabPrd,
      icon: Sparkles,
      has: hasPrd,
      // PRD perlu langganan berbayar (dan mindmap sudah ada).
      locked: !isPaid || nodeCount === 0,
      reason: !isPaid ? "paid" : "mindmap",
    },
    {
      id: "tasks" as const,
      label: L.projTabTasks,
      icon: ListChecks,
      has: hasTasks,
      // Perlu PRD dulu + berbayar.
      locked: !isPaid || !hasPrd,
      reason: !isPaid ? "paid" : "prd",
    },
    {
      id: "style" as const,
      label: L.projTabStyle,
      icon: Palette,
      has: hasStyle,
      // Perlu Task dulu + berbayar.
      locked: !isPaid || !hasTasks,
      reason: !isPaid ? "paid" : "tasks",
    },
    {
      id: "prototype" as const,
      label: "Prototype",
      icon: MonitorSmartphone,
      has: hasPrototype,
      // Prototype Design = pembeda Pro. Perlu Style Guide dulu.
      locked: !canUsePrototype || !hasStyle,
      reason: !canUsePrototype ? "pro" : "style",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={workspace.title}
        description={workspace.description || L.projNoDesc}
        actions={
          <>
            <Link
              href={`/project/${id}/execute`}
              className={buttonClasses({ variant: "secondary", size: "md" })}
            >
              <Terminal className="h-4 w-4" />
              {L.projExportSync}
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar info — disembunyikan saat tab Prototype (mode fokus penuh)
            agar kanvas prototype memakai lebar penuh di desktop. */}
        {tab !== "prototype" && (
          <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>{L.projDetail}</CardTitle>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  <Pencil className="h-3 w-3" />
                  {L.projEdit}
                </button>
              )}
            </CardHeader>
            <CardBody className="space-y-3">
              {editing ? (
                <>
                  <Field label={L.projTitle}>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </Field>
                  <Field label={L.projDesc}>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                  </Field>
                  <Field label={L.projCategory}>
                    <Input value={category} onChange={(e) => setCategory(e.target.value)} />
                  </Field>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={handleSave} size="sm" className="flex-1" disabled={busy === "save"}>
                      {L.projSave}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditing(false)} className="flex-1">
                      {L.projCancel}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={isPublic ? "success" : "neutral"}>
                      {isPublic ? L.projPublic : L.projPrivate}
                    </Badge>
                    {workspace.category && <Badge tone="outline">{workspace.category}</Badge>}
                  </div>

                  {(() => {
                    const tp = workspace.techPreferences;
                    const layers: { label: string; value: string }[] = tp
                      ? [
                          { label: "Frontend", value: tp.frontend || "" },
                          { label: "Backend", value: tp.backend || "" },
                          { label: "Database", value: tp.database || "" },
                          { label: "Deployment", value: tp.deployment || "" },
                        ].filter((l) => l.value)
                      : [];

                    const items: { label: string; value: string }[] =
                      layers.length > 0
                        ? layers
                        : workspace.techStack.map((s, i) => ({
                            label: `Layer ${i + 1}`,
                            value: s,
                          }));

                    if (items.length === 0) return null;

                    return (
                      <div className="space-y-2 pt-1">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                          Tech Stack
                        </p>
                        <ul className="space-y-1.5">
                          {items.map((it, i) => (
                            <li
                              key={`${it.label}-${i}`}
                              className="rounded-lg border border-border bg-surface-2/40 px-3 py-2"
                            >
                              <span className="block text-[10px] uppercase tracking-wide text-muted">
                                {it.label}
                              </span>
                              <span className="mt-0.5 block break-words text-xs leading-relaxed text-foreground">
                                {it.value}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {tp?.reasoning && (
                          <p className="pt-0.5 text-[11px] italic leading-relaxed text-muted">
                            {tp.reasoning}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{L.projPublish}</CardTitle>
              <Badge tone={isPublic ? "success" : "neutral"}>
                {isPublic ? "Publik" : "Privat"}
              </Badge>
            </CardHeader>
            <CardBody className="space-y-3">
              {isPublic ? (
                <>
                  <p className="text-xs text-muted">
                    Project ini terlihat di Gudang PRD publik. Anda bisa
                    mengubahnya menjadi privat kapan saja.
                  </p>
                  <label className="flex items-center justify-between gap-3 text-sm text-muted">
                    <span>{L.projAnonymous}</span>
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="h-4 w-4 rounded border-border-strong bg-surface-2 accent-[color:var(--accent)]"
                    />
                  </label>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePublish}
                    className="w-full"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Jadikan Privat (Unpublish)
                  </Button>
                  {workspace.shareSlug && (
                    <div className="space-y-1.5 border-t border-border pt-3">
                      <Link
                        href={`/prd/${workspace.shareSlug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        <Globe className="h-3 w-3" />
                        {L.projPublicLink}
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-muted">
                    Project ini privat. Publikasikan jika ingin dibagikan ke
                    komunitas di Gudang PRD.
                  </p>
                  <label className="flex items-center justify-between gap-3 text-sm text-muted">
                    <span>Anonim saat dipublikasikan</span>
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="h-4 w-4 rounded border-border-strong bg-surface-2 accent-[color:var(--accent)]"
                    />
                  </label>
                  <Button size="sm" onClick={handlePublish} className="w-full">
                    <Globe className="h-3.5 w-3.5" />
                    {L.projPublishBtn}
                  </Button>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{L.projQuickActions}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              {!isPaid && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-[11px] text-muted">
                  <Lock className="h-3 w-3" />
                  Export terkunci — upgrade untuk mengunduh.
                </div>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={!isPaid}
                onClick={() => {
                  navigator.clipboard.writeText(workspace.fullPrdMd || "");
                  toast.success(workspace.fullPrdMd ? "PRD disalin" : "PRD belum ada");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                {L.projCopyPrd}
              </Button>

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!isPaid}
                  onClick={() => downloadPrd(workspace.title, workspace.fullPrdMd)}
                  title="Download PRD.md"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  PRD
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!isPaid}
                  onClick={() => downloadTasks(workspace.title, workspace.tasksJson)}
                  title="Download Tasks.md"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Task
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!isPaid}
                  onClick={() => downloadStyle(workspace.title, workspace.styleGuideMd)}
                  title="Download StyleGuide.md"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Style
                </Button>
              </div>

              <Button
                className="w-full"
                size="sm"
                disabled={!isPaid}
                onClick={() => {
                  downloadAllBundle(
                    workspace.title,
                    workspace.fullPrdMd,
                    workspace.tasksJson,
                    workspace.styleGuideMd
                  );
                  toast.success("3 file Markdown diunduh");
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Unduh Semua (.md)
              </Button>
            </CardBody>
          </Card>

          {/* Danger zone */}
          <Card className="border-danger/25">
            <CardHeader>
              <CardTitle className="text-danger">Zona Berbahaya</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-xs text-muted">
                Menghapus project bersifat permanen dan tidak bisa dikembalikan.
              </p>
              <Button
                variant="danger"
                size="sm"
                className="w-full"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus Project
              </Button>
            </CardBody>
          </Card>
          </div>
        )}

        {/* Main content tabs — full width (4 kolom) saat mode fokus prototype */}
        <div className={cn("min-w-0", tab === "prototype" ? "lg:col-span-4" : "lg:col-span-3")}>
          <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface/60 p-1">
            {tabs.map((tabItem) => {
              const Icon = tabItem.icon;
              const iconBusy =
                (tabItem.id === "prd" && busy === "prd") ||
                (tabItem.id === "tasks" && busy === "tasks") ||
                (tabItem.id === "style" && busy === "style");
              return (
                <button
                  key={tabItem.id}
                  onClick={() => {
                    if (tabItem.locked) {
                      if (tabItem.reason === "paid") {
                        upgrade.open({
                          title: "Berlangganan untuk melanjutkan",
                          message:
                            "PRD, Task Breakdown, dan Style Guide tersedia untuk paket berbayar.",
                        });
                      } else if (tabItem.reason === "pro") {
                        upgrade.open({
                          title: "Prototype Design khusus PRO",
                          message:
                            "Generate prototype HTML dari PRD & Style Guide tersedia mulai paket PRO.",
                        });
                      } else {
                        toast.info(
                          tabItem.reason === "mindmap"
                            ? "Generate mindmap terlebih dahulu."
                            : tabItem.reason === "prd"
                              ? "Selesaikan PRD terlebih dahulu untuk membuka Task Breakdown."
                              : tabItem.reason === "style"
                                ? "Selesaikan Style Guide terlebih dahulu untuk membuka Prototype."
                                : "Selesaikan Task Breakdown terlebih dahulu untuk membuka Style Guide."
                        );
                      }
                      return;
                    }
                    setTab(tabItem.id);
                  }}
                  disabled={false}
                  className={cn(
                    "flex min-h-9 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                    tab === tabItem.id
                      ? "bg-surface-2 text-foreground"
                      : tabItem.locked
                        ? "text-muted/40 hover:text-muted/60"
                        : "text-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tabItem.label}
                  {tabItem.has && !iconBusy && <CheckCircle2 className="h-3 w-3 text-success" />}
                  {iconBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                  {tabItem.locked && !iconBusy && <Lock className="h-3 w-3" />}
                </button>
              );
             })}
          </div>

          {/* Toggle panel tema (khusus tab Prototype) */}
          {tab === "prototype" && workspace.prototypeHtml && (
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setThemePanelOpen((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  themePanelOpen
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border-strong bg-surface-2 text-foreground hover:bg-surface"
                )}
              >
                <Palette className="h-3.5 w-3.5" />
                {themePanelOpen ? "Sembunyikan panel tema" : "Tampilkan panel tema"}
              </button>
            </div>
          )}

          <Card>
            <CardBody className={cn(tab === "prototype" && "p-3 sm:p-3")}>
              {tab === "prd" &&
                (workspace.fullPrdMd ? (
                  <MarkdownRenderer markdown={workspace.fullPrdMd} storageKey={`${id}-prd`} />
                ) : (
                  <EmptyPanel
                    label={L.projPrdEmpty}
                    onGenerate={() => generate("prd")}
                    busy={busy === "prd"}
                    cta={L.projGenPrd}
                    generatingLabel={L.projGenerating}
                  />
                ))}

              {tab === "tasks" &&
                (workspace.tasksJson?.length ? (
                  <TaskList groups={workspace.tasksJson} />
                ) : (
                  <EmptyPanel
                    label={L.projTasksEmpty}
                    onGenerate={() => generate("tasks")}
                    busy={busy === "tasks"}
                    cta={L.projGenTasks}
                    generatingLabel={L.projGenerating}
                  />
                ))}

              {tab === "style" &&
                (workspace.styleGuideMd ? (
                  <MarkdownRenderer markdown={workspace.styleGuideMd} storageKey={`${id}-style`} />
                ) : (
                  <EmptyPanel
                    label={L.projStyleEmpty}
                    onGenerate={() => generate("style")}
                    busy={busy === "style"}
                    cta={L.projGenStyle}
                    generatingLabel={L.projGenerating}
                  />
                ))}

              {tab === "prototype" &&
                (workspace.prototypeHtml ? (
                  <div
                    className={cn(
                      "grid min-w-0 gap-4",
                      themePanelOpen
                        ? "lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start"
                        : "lg:grid-cols-1"
                    )}
                  >
                    <div className="min-w-0">
                    <PrototypeCanvas
                      html={applyThemeToHtml(workspace.prototypeHtml, theme)}
                      screens={workspace.prototypeJson?.screens}
                      title={workspace.title}
                      busy={busy === "prototype"}
                      height={themePanelOpen ? "h-[calc(100dvh-13rem)] min-h-[520px]" : "h-[calc(100dvh-11rem)] min-h-[560px]"}
                      onRegenerate={() => generate("prototype")}
                      onRegenerateScreen={(label) => generate("prototype", label)}
                      onRestoreVersion={async (versionId) => {
                        try {
                          const res = await fetch("/api/workspace/versions/restore", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ versionId }),
                          });
                          if (!res.ok) throw new Error();
                          const d = await res.json();
                          setWorkspace((prev) =>
                            prev ? { ...prev, prototypeHtml: d.prototypeHtml } : null
                          );
                          toast.success("Versi dipulihkan");
                          return d.prototypeHtml as string;
                        } catch {
                          toast.error("Gagal memulihkan versi");
                          return null;
                        }
                      }}
                     />
                    </div>
                    {themePanelOpen && (
                    <ThemeEditor
                      className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto"
                      value={theme}
                      resetTarget={styleGuideTheme}
                      onReset={async (t) => {
                        // Reset harus bertahan: simpan ke DB agar regenerate &
                        // reload tidak mengembalikan tema lama.
                        setWorkspace((prev) =>
                          prev ? { ...prev, themeTokensJson: t } : null
                        );
                        const res = await fetch("/api/workspace/update", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id, themeTokensJson: t }),
                        });
                        if (!res.ok) {
                          toast.error("Gagal menyimpan reset tema");
                          return;
                        }
                        toast.success("Tema di-reset ke token Style Guide");
                      }}
                      onChange={setTheme}
                      canSaveLibrary={canSaveThemes}
                      onApplySaved={(t) => {
                        // Terapkan tema dari library ke project ini, lalu
                        // simpan otomatis agar tidak hilang saat render ulang.
                        setWorkspace((prev) =>
                          prev ? { ...prev, themeTokensJson: t } : null
                        );
                        void fetch("/api/workspace/update", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id, themeTokensJson: t }),
                        });
                        toast.success("Tema dari library diterapkan");
                      }}
                      onSave={async (t) => {
                        const res = await fetch("/api/workspace/update", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id, themeTokensJson: t }),
                        });
                        if (!res.ok) {
                          const d = await res.json().catch(() => ({}));
                          toast.error(d.error || "Gagal menyimpan tema");
                          throw new Error("save failed");
                        }
                        // Simpan ke state lokal agar tidak hilang saat render ulang.
                        setWorkspace((prev) =>
                          prev ? { ...prev, themeTokensJson: t } : null
                        );
                        toast.success("Tema tersimpan");
                      }}
                    />
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <MonitorSmartphone className="h-6 w-6 text-muted" />
                    <p className="text-sm text-muted">
                      Belum ada prototype. AI akan menyusun design dari PRD dan Style Guide.
                    </p>
                    <Button onClick={() => generate("prototype")} disabled={busy === "prototype"}>
                      {busy === "prototype" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {busy === "prototype" ? L.projGenerating : "Generate Prototype"}
                    </Button>
                    <p className="text-[11px] text-muted">
                      {prototypeQuotaLeft === null
                        ? "Kuota tidak terbatas"
                        : `Sisa kuota bulan ini: ${prototypeQuotaLeft}`}
                    </p>
                  </div>
                ))}

              {tab === "mindmap" &&
                (nodeCount > 0 ? (
                  <MindmapCanvas
                    nodes={workspace.mindmapJson.nodes || []}
                    edges={workspace.mindmapJson.edges || []}
                    height="h-[520px]"
                  />
                ) : (
                  <p className="py-10 text-center text-sm text-muted">{L.projMindmapEmpty}</p>
                ))}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Konfirmasi hapus */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-8 backdrop-blur-sm">
          <div className="my-auto w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/15 text-danger">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">Hapus project?</h2>
                <p className="mt-0.5 text-xs text-muted break-words">
                  &quot;{workspace.title}&quot; akan dihapus permanen.
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
                Batal
              </Button>
              <Button variant="danger" className="flex-1" onClick={handleDelete}>
                Ya, Hapus
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyPanel({
  label,
  onGenerate,
  busy,
  cta,
  generatingLabel = "Generating...",
}: {
  label: string;
  onGenerate: () => void;
  busy: boolean;
  cta: string;
  generatingLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Sparkles className="h-6 w-6 text-muted" />
      <p className="text-sm text-muted">{label}</p>
      <Button onClick={onGenerate} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {busy ? generatingLabel : cta}
      </Button>
    </div>
  );
}

function TaskList({ groups }: { groups: TaskGroup[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
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
            {g.tasks.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setChecked((p) => ({ ...p, [t.id]: !p[t.id] }))}
                  className="flex w-full items-start gap-3 rounded-lg border border-border bg-surface-2/30 p-3 text-left transition-colors hover:bg-surface-2/60"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      checked[t.id] ? "border-accent bg-accent text-white" : "border-border-strong"
                    )}
                  >
                    {checked[t.id] && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", checked[t.id] ? "text-muted line-through" : "text-foreground")}>
                      {t.title}
                    </span>
                    {t.description && (
                      <span className="mt-0.5 block text-xs text-muted">{t.description}</span>
                    )}
                  </span>
                  <Badge tone={prioTone[t.priority]}>{t.priority}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
