"use client";

import { useState } from "react";
import { Palette, RotateCcw, Save, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_THEME, type ThemeTokens } from "@/lib/theme";

// Token & sanitasi tinggal di `@/lib/theme` agar dapat diuji tanpa JSX.
export { DEFAULT_THEME, applyThemeToHtml, sanitizeThemeTokens } from "@/lib/theme";
export type { ThemeTokens } from "@/lib/theme";

const FONTS = [
  "Geist",
  "Inter",
  "Sora",
  "Space Grotesk",
  "Playfair Display",
  "Fraunces",
  "IBM Plex Sans",
  "DM Sans",
];

const COLOR_ROLES: { key: keyof ThemeTokens; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "surface", label: "Surface" },
  { key: "text", label: "Text" },
  { key: "border", label: "Border" },
];

/**
 * Panel Theme Editor — mengubah TOKEN, bukan pixel.
 *
 * Hasilnya disimpan sebagai token (`themeTokensJson`) sehingga bisa dipakai
 * ulang dan di-export sebagai CSS variables. Pengeditan per-elemen (tab
 * "Selection") sengaja belum diimplementasikan: itu menimpa token dan
 * membuat konsistensi design system sulit dijaga.
 */
export function ThemeEditor({
  value,
  onChange,
  onSave,
  canSave = false,
  className,
}: {
  value: ThemeTokens;
  onChange: (next: ThemeTokens) => void;
  onSave?: (next: ThemeTokens) => void;
  canSave?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    color: true,
    type: true,
    shape: true,
  });

  const set = <K extends keyof ThemeTokens>(key: K, v: ThemeTokens[K]) =>
    onChange({ ...value, [key]: v });

  const group = (id: string) => (
    <button
      type="button"
      onClick={() => setOpen((p) => ({ ...p, [id]: !p[id] }))}
      className="flex w-full items-center gap-2 border-b border-border pb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground"
    >
      <ChevronRight
        className={cn("h-3 w-3 text-muted transition-transform", open[id] && "rotate-90")}
      />
      {id === "color" ? "Warna" : id === "type" ? "Tipografi" : "Bentuk"}
    </button>
  );

  return (
    <aside
      className={cn(
        "flex w-full flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface/70 p-4",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-accent" />
        <span className="text-sm font-semibold text-foreground">Theme</span>
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_THEME })}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      {group("color")}
      {open.color && (
        <div className="flex flex-col gap-2.5">
          {COLOR_ROLES.map((r) => (
            <div key={r.key} className="flex items-center gap-2">
              <span className="w-[68px] shrink-0 text-[11px] text-muted">{r.label}</span>
              <label
                className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border-strong"
                style={{ background: String(value[r.key]) }}
              >
                <input
                  type="color"
                  value={String(value[r.key])}
                  onChange={(e) => set(r.key, e.target.value as ThemeTokens[typeof r.key])}
                  className="absolute inset-[-6px] h-[150%] w-[150%] cursor-pointer border-0 bg-transparent p-0"
                />
              </label>
              <span className="min-w-0 flex-1 truncate rounded-md border border-border-strong bg-surface-2 px-2 py-1 font-mono text-[10px] text-foreground">
                {String(value[r.key]).toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}

      {group("type")}
      {open.type && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-muted">Font heading</span>
            <select
              value={value.fontHeading}
              onChange={(e) => set("fontHeading", e.target.value)}
              className="w-full appearance-none rounded-md border border-border-strong bg-surface-2 px-2 py-1.5 text-[11px] text-foreground"
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-muted">Font body</span>
            <select
              value={value.fontBody}
              onChange={(e) => set("fontBody", e.target.value)}
              className="w-full appearance-none rounded-md border border-border-strong bg-surface-2 px-2 py-1.5 text-[11px] text-foreground"
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="flex justify-between text-[11px] text-muted">
              <span>Ukuran dasar</span>
              <span className="font-mono text-foreground">{value.baseSize}px</span>
            </span>
            <input
              type="range"
              min={13}
              max={20}
              value={value.baseSize}
              onChange={(e) => set("baseSize", Number(e.target.value))}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border-strong accent-[var(--accent)]"
            />
          </label>
        </div>
      )}

      {group("shape")}
      {open.shape && (
        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-[11px] text-muted">
            <span>Radius</span>
            <span className="font-mono text-foreground">{value.radius}px</span>
          </span>
          <input
            type="range"
            min={0}
            max={24}
            value={value.radius}
            onChange={(e) => set("radius", Number(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border-strong accent-[var(--accent)]"
          />
        </label>
      )}

      <button
        type="button"
        disabled={!canSave || !onSave}
        title={canSave ? undefined : "Library tema tersimpan khusus paket ENTERPRISE"}
        onClick={() => onSave?.(value)}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Save className="h-3.5 w-3.5" />
        Simpan tema{canSave ? "" : " (Enterprise)"}
      </button>

      <p className="text-[10px] leading-relaxed text-muted">
        Perubahan disimpan sebagai token CSS, bukan pixel — aman di-export dan
        dipakai ulang.
      </p>
    </aside>
  );
}

