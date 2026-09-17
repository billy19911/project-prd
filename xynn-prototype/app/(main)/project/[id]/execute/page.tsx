"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Download, Terminal, FileCode2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  downloadPrd,
  downloadTasks,
  downloadStyle,
  downloadAllBundle,
  type TaskGroup,
} from "@/lib/export";

type Workspace = {
  id: string;
  title: string;
  fullPrdMd: string | null;
  tasksJson: TaskGroup[] | null;
  styleGuideMd: string | null;
  techStack: string[];
};

export default function ExecutePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/workspace")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((workspaces: Workspace[]) => {
        if (!active) return;
        const ws = workspaces.find((w) => w.id === id);
        setWorkspace(ws || null);
      })
      .catch(() => toast.error("Gagal memuat workspace"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const cliCommand = `xynn connect --workspace ${id}`;

  const copyCommand = () => {
    navigator.clipboard.writeText(cliCommand);
    setCopied(true);
    toast.success("Perintah disalin");
    setTimeout(() => setCopied(false), 2000);
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
        <p className="text-sm">Workspace tidak ditemukan.</p>
        <Button variant="secondary" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/project/${id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke Project
        </Link>
        <PageHeader
          title="Export & Sync"
          description={`Sinkronkan spesifikasi "${workspace.title}" langsung ke IDE Anda.`}
        />
      </div>

      {/* CLI Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-accent" />
            Sync via CLI
          </CardTitle>
          <Badge tone="accent">Direkomendasikan</Badge>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-muted">
            Jalankan perintah berikut di root folder proyek Anda:
          </p>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border-strong bg-background/80 p-3">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-accent sm:text-sm">
              {cliCommand}
            </code>
            <Button variant="secondary" size="sm" onClick={copyCommand} className="shrink-0">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { name: "PRD.md", desc: "Spesifikasi teknis lengkap." },
              { name: "TASKS.md", desc: "Checklist task implementasi." },
              { name: "STYLEGUIDE.md", desc: "Design system & panduan UI." },
            ].map((f) => (
              <div key={f.name} className="rounded-lg border border-border bg-surface-2/50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <FileCode2 className="h-3.5 w-3.5 text-muted" />
                  {f.name}
                </p>
                <p className="mt-1 text-xs text-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Manual download */}
      <Card>
        <CardHeader>
          <CardTitle>Download Manual</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-muted">
            Tidak memakai CLI? Unduh 3 file Markdown untuk dikerjakan manual.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => downloadPrd(workspace.title, workspace.fullPrdMd)}
            >
              <Download className="h-4 w-4" />
              PRD.md
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => downloadTasks(workspace.title, workspace.tasksJson)}
            >
              <Download className="h-4 w-4" />
              TASKS.md
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => downloadStyle(workspace.title, workspace.styleGuideMd)}
            >
              <Download className="h-4 w-4" />
              STYLEGUIDE.md
            </Button>
          </div>
          <Button
            className="w-full"
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
            <Download className="h-4 w-4" />
            Unduh Semua (.md)
          </Button>
          <div className="border-t border-border pt-3">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                const cursorRules = `# .cursorrules\n# ${workspace.title}\n\nTech Stack: ${workspace.techStack.join(", ")}`;
                const blob = new Blob([cursorRules], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = ".cursorrules";
                a.click();
              }}
            >
              <Download className="h-4 w-4" />
              Download .cursorrules
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
