"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Copy,
  Download,
  GitFork,
  Eye,
  Code2,
  FileText,
  Lock,
  List,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, slugifyHeading } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useUpgrade } from "@/components/upgrade-provider";
import { useSubscription } from "@/lib/use-subscription";
import { TableOfContents } from "@/components/table-of-contents";
import { tasksToMarkdown, type TaskGroup } from "@/lib/export";

type Workspace = {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  fullPrdMd: string | null;
  tasksJson: TaskGroup[] | null;
  styleGuideMd: string | null;
  category: string;
  locale: string;
  user: { name: string; avatarUrl: string | null };
};

type ViewMode = "visual" | "prompt";

function extractHeadings(markdown: string) {
  const out: { level: number; text: string; id: string }[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const m = line.match(/^(#{1,3})\s+(.*)$/);
    if (m) {
      const text = m[2].trim();
      out.push({
        level: m[1].length,
        text,
        id: slugifyHeading(text),
      });
    }
  }
  return out;
}

export default function PublicPRDPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const slug = params.shareSlug as string;
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("visual");
  const [tocOpen, setTocOpen] = useState(false);
  const [section, setSection] = useState<"prd" | "tasks" | "style">("prd");

  const { canExport, canFork } = useSubscription();
  const L = t(workspace?.locale);
  const upgrade = useUpgrade();

  useEffect(() => {
    let active = true;
    fetch(`/api/public/prd?slug=${slug}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (active) setWorkspace(data);
      })
      .catch(() => toast.error("PRD tidak ditemukan"))      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const activeMarkdown = useMemo(() => {
    if (!workspace) return "";
    if (section === "prd") return workspace.fullPrdMd || "";
    if (section === "tasks")
      return workspace.tasksJson?.length
        ? tasksToMarkdown(workspace.title, workspace.tasksJson)
        : "";
    return workspace.styleGuideMd || "";
  }, [workspace, section]);

  const headings = useMemo(
    () => extractHeadings(activeMarkdown),
    [activeMarkdown]
  );

  const handleFork = async () => {
    if (!session) {
      router.push("/login");
      return;
    }
    if (!canFork) {
      upgrade.open({
        title: "Fork khusus paket PRO",
        message: "Fork PRD dari Gudang hanya tersedia untuk paket PRO.",
      });
      return;
    }
    try {
      const res = await fetch("/api/vault/fork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace?.id }),
      });
      if (!res.ok) throw new Error("Fork gagal");
      const data = await res.json();
      router.push(`/project/${data.id}`);
    } catch {
      toast.error("Gagal fork");
    }
  };

  const copySpecs = () => {
    if (!canExport) {
      upgrade.open({
        title: "Upgrade untuk menyalin",
        message: "Copy Specs tersedia untuk paket STARTER ke atas.",
      });
      return;
    }
    navigator.clipboard.writeText(workspace?.fullPrdMd || "");
    toast.success("PRD disalin!");
  };

  const downloadMd = () => {
    if (!canExport) {
      upgrade.open({
        title: "Upgrade untuk mengunduh",
        message: "Export Markdown tersedia untuk paket STARTER ke atas.",
      });
      return;
    }
    const blob = new Blob([workspace?.fullPrdMd || ""], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workspace?.title}.md`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        PRD tidak ditemukan.
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/vault"
            className="shrink-0 text-sm text-muted transition-colors hover:text-foreground"
          >
            ← <span className="hidden sm:inline">{L.pubBack}</span>
          </Link>

          {/* Dual-view toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface/60 p-1">
            <button
              onClick={() => setView("visual")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                view === "visual"
                  ? "bg-surface-2 text-foreground"
                  : "text-muted hover:text-foreground"
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              {L.pubVisual}
            </button>
            <button
              onClick={() => setView("prompt")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                view === "prompt"
                  ? "bg-surface-2 text-foreground"
                  : "text-muted hover:text-foreground"
              )}
            >
              <Code2 className="h-3.5 w-3.5" />
              {L.pubPrompt}
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setTocOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted lg:hidden"
              aria-label="Daftar isi"
            >
              <List className="h-4 w-4" />
            </button>
            <span className="hidden text-xs text-muted sm:block">
              {workspace.category}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[200px_1fr_220px] lg:py-8">
        {/* TOC desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-[--radius-card] border border-border bg-surface/40 p-3">
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {L.pubToc}
            </p>
            <TableOfContents headings={headings} emptyLabel={L.pubNoContent} />
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {workspace.title}
          </h1>
          <p className="mt-2 text-sm text-muted sm:text-base">
            {workspace.description}
          </p>

          {workspace.techStack.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {workspace.techStack.map((s) => (
                <Badge key={s} tone="outline" className="font-mono">
                  {s}
                </Badge>
              ))}
            </div>
          )}

          {/* Section tabs — artefak saling terkait: PRD → Task → Style */}
          <div className="mt-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface/40 p-1">
            {(
              [
                { id: "prd" as const, label: L.tabPrd },
                { id: "tasks" as const, label: L.tabTasks },
                { id: "style" as const, label: L.tabStyle },
              ] as const
            ).map((sItem) => (
              <button
                key={sItem.id}
                onClick={() => setSection(sItem.id)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  section === sItem.id
                    ? "bg-surface-2 text-foreground"
                    : "text-muted hover:text-foreground"
                )}
              >
                {sItem.label}
              </button>
            ))}
          </div>

          <div className="relative mt-4 sm:mt-6">
            {view === "visual" ? (
              <article
                className={cn(
                  "rounded-[--radius-card] border border-border bg-surface/40 p-4 sm:p-6",
                  !canExport && "pointer-events-none select-none blur-sm"
                )}
              >
                {section === "prd" && (
                  workspace.fullPrdMd ? (
                    <MarkdownRenderer markdown={workspace.fullPrdMd} storageKey={workspace.id} />
                  ) : (
                    <p className="text-muted">{L.pubPrdNotGen}</p>
                  )
                )}
                {section === "tasks" && (
                  workspace.tasksJson?.length ? (
                    <MarkdownRenderer
                      markdown={tasksToMarkdown(workspace.title, workspace.tasksJson)}
                      storageKey={`${workspace.id}-tasks`}
                    />
                  ) : (
                    <p className="text-muted">{L.tasksEmpty}</p>
                  )
                )}
                {section === "style" && (
                  workspace.styleGuideMd ? (
                    <MarkdownRenderer markdown={workspace.styleGuideMd} storageKey={`${workspace.id}-style`} />
                  ) : (
                    <p className="text-muted">{L.styleEmpty}</p>
                  )
                )}
              </article>
            ) : (
              <article
                className={cn(
                  "rounded-[--radius-card] border border-border bg-background/80 p-4 sm:p-6",
                  !canExport && "pointer-events-none select-none blur-sm"
                )}
              >
                <div className="mb-3 flex items-center gap-2 text-xs text-muted">
                  <FileText className="h-3.5 w-3.5" />
                  {L.pubRawHint}
                </div>
                <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap font-mono text-xs text-muted">
                  {section === "prd"
                    ? workspace.fullPrdMd || L.pubPrdNotGen
                    : section === "tasks"
                      ? workspace.tasksJson?.length
                        ? tasksToMarkdown(workspace.title, workspace.tasksJson)
                        : L.tasksEmpty
                      : workspace.styleGuideMd || L.styleEmpty}
                </pre>
              </article>
            )}

            {!canExport && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[--radius-card] bg-background/30 px-4 text-center">
                <Lock className="h-6 w-6 text-accent" />
                <p className="text-sm font-medium text-foreground">
                  {L.pubLocked}
                </p>
                <Button size="sm" onClick={() => upgrade.open()}>
                  {L.pubUpgrade}
                </Button>
              </div>
            )}
          </div>
        </main>

        {/* Action panel desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-2 rounded-[--radius-card] border border-border bg-surface/40 p-4">
            <Button variant="secondary" size="sm" className="w-full" onClick={copySpecs}>
              <Copy className="h-3.5 w-3.5" />
              {L.pubCopy}
            </Button>
            <Button variant="secondary" size="sm" className="w-full" onClick={downloadMd}>
              <Download className="h-3.5 w-3.5" />
              {L.pubDownload}
            </Button>
            <Button size="sm" className="w-full" onClick={handleFork}>
              <GitFork className="h-3.5 w-3.5" />
              {L.pubFork}
            </Button>
            {!canFork && (
              <p className="pt-1 text-center text-[11px] text-muted">
                {L.pubGateHint}
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile action bar */}
      <div className="sticky bottom-0 z-20 flex gap-2 border-t border-border bg-background/90 p-3 backdrop-blur lg:hidden">
        <Button variant="secondary" size="sm" className="flex-1" onClick={copySpecs}>
          <Copy className="h-3.5 w-3.5" />
          {L.pubCopy}
        </Button>
        <Button variant="secondary" size="sm" className="flex-1" onClick={downloadMd}>
          <Download className="h-3.5 w-3.5" />
          {L.pubDownload}
        </Button>
        <Button size="sm" className="flex-1" onClick={handleFork}>
          <GitFork className="h-3.5 w-3.5" />
          {L.pubFork}
        </Button>
      </div>

      {/* Mobile TOC drawer */}
      {tocOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setTocOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col border-r border-border bg-background">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="text-sm font-medium text-foreground">{L.pubToc}</span>
              <button
                onClick={() => setTocOpen(false)}
                className="text-muted"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              className="overflow-y-auto p-3"
              onClick={() => setTocOpen(false)}
            >
              <TableOfContents headings={headings} emptyLabel={L.pubNoContent} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
