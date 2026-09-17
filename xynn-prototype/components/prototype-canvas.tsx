"use client";

import { useMemo, useState } from "react";
import {
  Monitor,
  Smartphone,
  Code2,
  Eye,
  RefreshCw,
  Download,
  Layers,
  History,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PrototypeScreen = { id: string; label: string };

type Viewport = "desktop" | "mobile";
type Mode = "preview" | "code";

/**
 * Kanvas prototype.
 *
 * Keamanan: output AI dirender di <iframe> dengan `srcDoc`, dan sandbox
 * sengaja TIDAK menyertakan `allow-same-origin`. Akibatnya dokumen di dalam
 * iframe tidak bisa mengakses cookie, localStorage, atau DOM aplikasi —
 * batas ini bukan detail opsional, karena HTML-nya dihasilkan model.
 *
 * Konsekuensi: `allow-scripts` tetap diperlukan agar navigasi antar-screen
 * di dalam prototype berfungsi, tetapi tanpa same-origin script itu tidak
 * dapat menyentuh konteks aplikasi induk.
 */
export type PrototypeVersionItem = {
  id: string;
  note: string | null;
  createdAt: string;
  screens: unknown;
};

export function PrototypeCanvas({
  html,
  screens,
  title,
  busy = false,
  onRegenerate,
  onRegenerateScreen,
  onRestoreVersion,
  className,
}: {
  html: string;
  screens?: PrototypeScreen[];
  title: string;
  busy?: boolean;
  onRegenerate?: () => void;
  /** Regenerate satu screen saja — lebih hemat biaya AI. */
  onRegenerateScreen?: (screenLabel: string) => void;
  /**
   * Pulihkan versi lama. Diberikan `versionId`; kembalikan HTML hasil
   * pemulihan bila berhasil (untuk memperbarui pratinjau), atau null bila gagal.
   */
  onRestoreVersion?: (versionId: string) => Promise<string | null>;
  className?: string;
}) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [mode, setMode] = useState<Mode>("preview");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<PrototypeVersionItem[]>([]);
  const [historyState, setHistoryState] = useState<"idle" | "loading" | "error">("idle");
  const [restoring, setRestoring] = useState<string | null>(null);

  const sandbox = useMemo(() => "allow-scripts", []);

  const loadHistory = async () => {
    setHistoryState("loading");
    try {
      const wsId = typeof window !== "undefined"
        ? window.location.pathname.split("/").filter(Boolean).pop()
        : "";
      const res = await fetch(`/api/workspace/versions?id=${wsId}`);
      if (!res.ok) throw new Error();
      setHistory(await res.json());
      setHistoryState("idle");
    } catch {
      setHistoryState("error");
    }
  };

  const toggleHistory = async () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) await loadHistory();
  };

  const handleRestore = async (versionId: string) => {
    if (!onRestoreVersion || restoring) return;
    setRestoring(versionId);
    try {
      const restored = await onRestoreVersion(versionId);
      if (restored) await loadHistory();
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface/60 p-1">
          <button
            onClick={() => setMode("preview")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              mode === "preview" ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
          <button
            onClick={() => setMode("code")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              mode === "code" ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
            )}
          >
            <Code2 className="h-3.5 w-3.5" />
            Code
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface/60 p-1">
          <button
            onClick={() => setViewport("desktop")}
            aria-label="Desktop"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              viewport === "desktop" ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
            )}
          >
            <Monitor className="h-3.5 w-3.5" />
            Desktop
          </button>
          <button
            onClick={() => setViewport("mobile")}
            aria-label="Mobile"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              viewport === "mobile" ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
            )}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Mobile
          </button>
        </div>

        <span className="flex-1" />

        {screens && screens.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md border border-border-strong px-2 py-1 text-[11px] text-muted">
            <Layers className="h-3 w-3" />
            {screens.length} screen
          </span>
        )}

        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
            Regenerate
          </button>
        )}

        <a
          href={`data:text/html;charset=utf-8,${encodeURIComponent(html)}`}
          download={`${title.replace(/[^\w.-]+/g, "-")}-prototype.html`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
        >
          <Download className="h-3.5 w-3.5" />
          HTML
        </a>

        {onRestoreVersion && (
          <button
            type="button"
            onClick={() => void toggleHistory()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              historyOpen
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border-strong bg-surface-2 text-foreground hover:bg-surface"
            )}
          >
            <History className="h-3.5 w-3.5" />
            Riwayat
          </button>
        )}
      </div>

      {/* Riwayat versi */}
      {historyOpen && onRestoreVersion && (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface/60 p-3">
          {historyState === "loading" && (
            <p className="flex items-center gap-2 text-[11px] text-muted">
              <Loader2 className="h-3 w-3 animate-spin" />
              Memuat riwayat...
            </p>
          )}
          {historyState === "error" && (
            <p className="text-[11px] text-danger">Gagal memuat riwayat versi.</p>
          )}
          {historyState === "idle" && history.length === 0 && (
            <p className="text-[11px] text-muted">
              Belum ada riwayat. Versi lama tersimpan otomatis setiap kali
              prototype di-regenerate (maksimal 10 terakhir).
            </p>
          )}
          {history.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {history.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface-2/40 px-2.5 py-1.5"
                >
                  <span className="text-[10px] text-muted">
                    {new Date(v.createdAt).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                    {v.note || "Versi tersimpan"}
                  </span>
                  <button
                    type="button"
                    disabled={restoring === v.id}
                    onClick={() => void handleRestore(v.id)}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
                  >
                    {restoring === v.id ? "..." : "Pulihkan"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Screen navigator */}
      {screens && screens.length > 0 && mode === "preview" && (
        <div className="flex flex-wrap gap-2 pb-1">
          {screens.map((s, i) => (
            <span
              key={s.id}
              className="group inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] text-muted"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded bg-surface-2 font-mono text-[9px]">
                {i + 1}
              </span>
              {s.label}
              {onRegenerateScreen && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRegenerateScreen(s.label)}
                  title={`Regenerate "${s.label}" saja (hemat kuota)`}
                  aria-label={`Regenerate screen ${s.label}`}
                  className="ml-0.5 rounded p-0.5 text-muted transition-colors hover:text-accent disabled:opacity-40"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {onRegenerateScreen && (
            <span className="inline-flex items-center text-[10px] text-muted">
              klik ikon untuk regenerate 1 screen
            </span>
          )}
        </div>
      )}

      {/* Render */}
      {mode === "preview" ? (
        <div className="flex justify-center overflow-hidden rounded-[var(--radius-card)] border border-border bg-background/60 p-3">
          <iframe
            title={`Prototype — ${title}`}
            srcDoc={html}
            sandbox={sandbox}
            className={cn(
              "h-[560px] rounded-xl border border-border-strong bg-white transition-[width] duration-300",
              viewport === "desktop" ? "w-full" : "w-[390px]"
            )}
          />
        </div>
      ) : (
        <pre className="max-h-[560px] overflow-auto rounded-[var(--radius-card)] border border-border bg-background/80 p-4 font-mono text-[11px] leading-relaxed text-muted whitespace-pre-wrap">
          {html}
        </pre>
      )}
    </div>
  );
}
