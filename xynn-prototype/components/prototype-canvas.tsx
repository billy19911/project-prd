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
export function PrototypeCanvas({
  html,
  screens,
  title,
  busy = false,
  onRegenerate,
  className,
}: {
  html: string;
  screens?: PrototypeScreen[];
  title: string;
  busy?: boolean;
  onRegenerate?: () => void;
  className?: string;
}) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [mode, setMode] = useState<Mode>("preview");

  const sandbox = useMemo(() => "allow-scripts", []);

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
      </div>

      {/* Screen navigator */}
      {screens && screens.length > 0 && mode === "preview" && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {screens.map((s, i) => (
            <span
              key={s.id}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] text-muted"
              title={`Screen ${i + 1}`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded bg-surface-2 font-mono text-[9px]">
                {i + 1}
              </span>
              {s.label}
            </span>
          ))}
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
