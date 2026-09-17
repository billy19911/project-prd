"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Copy,
  ArrowRight,
  ArrowUpRight,
  Clock,
  FolderOpen,
  Sparkles,
  Globe,
  Lock,
  Trash2,
  LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type Workspace = {
  id: string;
  title: string;
  description: string | null;
  techStack: string[];
  fullPrdMd: string | null;
  updatedAt: string;
  isPublic: boolean;
  isAnonymous?: boolean;
};

export default function ProjectsHubPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workspace")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setProjects(d))
      .catch(() => toast.error("Gagal memuat riwayat project"))
      .finally(() => setLoading(false));
  }, []);

  const copyPrompt = async (ws: Workspace) => {
    const prompt = ws.fullPrdMd
      ? ws.fullPrdMd
      : `# ${ws.title}\n\n${ws.description ?? ""}\n\nTech Stack: ${ws.techStack.join(", ")}`;
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt disalin");
    } catch {
      toast.error("Gagal menyalin");
    }
  };

  const togglePublish = async (ws: Workspace) => {
    try {
      const res = await fetch("/api/workspace/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ws.id, isPublic: !ws.isPublic, isAnonymous: ws.isAnonymous }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProjects((prev) =>
        prev.map((p) => (p.id === ws.id ? { ...p, isPublic: data.isPublic } : p))
      );
      toast.success(data.isPublic ? "Dipublikasikan" : "Diset ke privat");
    } catch {
      toast.error("Gagal mengubah status");
    }
  };

  const removeProject = async (id: string) => {
    try {
      const res = await fetch("/api/workspace/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setConfirmId(null);
      toast.success("Project dihapus");
    } catch {
      toast.error("Gagal menghapus project");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {/* Hero tile: new project */}
      <button
        onClick={() => router.push("/new-project")}
        className="group relative block w-full overflow-hidden rounded-3xl border border-border bg-surface/30 p-8 text-left transition-all duration-300 hover:border-accent/40 sm:p-12"
      >
        {/* kinetic gradient line */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl transition-transform duration-700 group-hover:scale-125" />

        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-lg">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white transition-transform duration-300 group-hover:rotate-90">
              <Plus className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Project Baru
            </h2>
            <p className="mt-2 text-sm text-muted">
              Tulis idemu, pilih preferensi teknologi, dan biarkan AI menyusun
              PRD, task breakdown, hingga style guide.
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
              Mulai Wizard
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </div>
          <Sparkles className="hidden h-16 w-16 shrink-0 text-accent/20 sm:block" />
        </div>
      </button>

      {/* Alternatif: mulai dari template */}
      <Link
        href="/templates"
        className="group flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted transition-colors hover:border-accent/40 hover:text-foreground"
      >
        <LayoutTemplate className="h-4 w-4" />
        Atau mulai dari template siap pakai
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>

      {/* History */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">Riwayat Project</h2>
          {!loading && projects.length > 0 && (
            <span className="text-xs text-muted">{projects.length} project</span>
          )}
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="h-5 w-5" />}
            title="Belum ada project"
            description="Project yang Anda buat akan muncul di sini sebagai riwayat."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((ws) => (
              <div
                key={ws.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface/30 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/project/${ws.id}`}
                    className="line-clamp-1 text-sm font-medium text-foreground transition-colors group-hover:text-accent"
                  >
                    {ws.title}
                  </Link>
                  {ws.isPublic && <Badge tone="success">Publik</Badge>}
                </div>

                <p className="mt-1.5 line-clamp-2 flex-1 text-xs text-muted">
                  {ws.description || "Tidak ada deskripsi"}
                </p>

                {ws.techStack.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {ws.techStack.slice(0, 3).map((s) => (
                      <Badge key={s} tone="outline">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between text-[11px] text-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(ws.updatedAt).toLocaleDateString("id-ID")}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => togglePublish(ws)}
                      title={ws.isPublic ? "Jadikan privat (unpublish)" : "Publikasikan"}
                      className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-surface-2 hover:text-foreground"
                    >
                      {ws.isPublic ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                    </button>
                    <button
                      onClick={() => copyPrompt(ws)}
                      title="Salin prompt"
                      className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-surface-2 hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setConfirmId(ws.id)}
                      title="Hapus project"
                      className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <Link
                      href={`/project/${ws.id}`}
                      title="Buka project"
                      className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-surface-2 hover:text-accent"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Konfirmasi hapus */}
      {confirmId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/15 text-danger">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Hapus project?</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Tindakan ini permanen dan tidak bisa dikembalikan.
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmId(null)}
                className="h-10 flex-1 rounded-lg border border-border-strong bg-surface-2 text-sm text-foreground hover:bg-surface"
              >
                Batal
              </button>
              <button
                onClick={() => removeProject(confirmId)}
                className="h-10 flex-1 rounded-lg bg-danger text-sm font-medium text-white hover:opacity-90"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
