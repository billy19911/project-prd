"use client";

import { useState } from "react";
import { Palette, RotateCcw, Save, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_THEME, sanitizeThemeTokens, type ThemeTokens } from "@/lib/theme";

// Token & sanitasi tinggal di `@/lib/theme` agar dapat diuji tanpa JSX.
export {
  DEFAULT_THEME,
  applyThemeToHtml,
  sanitizeThemeTokens,
  themeFromStyleGuide,
} from "@/lib/theme";
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
  canSaveLibrary = false,
  onApplySaved,
  resetTarget,
  onReset,
  className,
}: {
  value: ThemeTokens;
  onChange: (next: ThemeTokens) => void;
  onSave?: (next: ThemeTokens) => void | Promise<void>;
  /**
   * Apakah pengguna boleh menyimpan tema sebagai LIBRARY lintas-project
   * (fitur ENTERPRISE). Menyimpan tema untuk project ini sendiri SELALU
   * boleh untuk PRO ke atas, sehingga tombol tidak dikunci oleh flag ini.
   */
  canSaveLibrary?: boolean;
  /** Dipanggil saat pengguna memilih tema dari library (ENTERPRISE). */
  onApplySaved?: (tokens: ThemeTokens) => void;
  /**
   * Token "kembali ke awal" saat Reset. Idealnya token yang diekstrak dari
   * Style Guide, agar Reset tidak meloncat ke tema aplikasi yang tak
   * berhubungan. Bila kosong → DEFAULT_THEME.
   */
  resetTarget?: ThemeTokens;
  /** Bila diberikan, Reset memanggil ini (mis. untuk menyimpan ke DB). */
  onReset?: (tokens: ThemeTokens) => void | Promise<void>;
  className?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<
    { id: string; name: string; tokens: ThemeTokens }[]
  >([]);
  const [libraryState, setLibraryState] = useState<"idle" | "loading" | "error">("idle");
  const [saveName, setSaveName] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({
    color: true,
    type: true,
    shape: true,
  });

  /** Muat library tema (ENTERPRISE saja). */
  const loadLibrary = async () => {
    setLibraryState("loading");
    try {
      const res = await fetch("/api/themes");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLibrary(
        (data as Array<{ id: string; name: string; tokens: unknown }>).map((t) => ({
          id: t.id,
          name: t.name,
          tokens: sanitizeThemeTokens(t.tokens),
        }))
      );
      setLibraryState("idle");
    } catch {
      setLibraryState("error");
    }
  };

  const toggleLibrary = () => {
    const next = !libraryOpen;
    setLibraryOpen(next);
    if (next) void loadLibrary();
  };

  const saveToLibrary = async () => {
    const name = saveName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tokens: value }),
      });
      if (!res.ok) throw new Error();
      setSaveName("");
      setSaved(true);
      await loadLibrary();
    } catch {
      setLibraryState("error");
    } finally {
      setSaving(false);
    }
  };

  const deleteFromLibrary = async (id: string) => {
    try {
      const res = await fetch("/api/themes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      await loadLibrary();
    } catch {
      setLibraryState("error");
    }
  };

  const set = <K extends keyof ThemeTokens>(key: K, v: ThemeTokens[K]) => {
    onChange({ ...value, [key]: v });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!onSave || saving) return;
    setSaving(true);
    try {
      await onSave(value);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

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
          onClick={() => {
            const target = resetTarget ?? DEFAULT_THEME;
            onChange({ ...target });
            // Bila parent menyediakan onReset, panggil agar tersimpan ke DB
            // (mencegah tampilan "meloncat" setelah reload/regenerate).
            if (onReset) void onReset({ ...target });
          }}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-foreground"
          title="Kembalikan ke token dari Style Guide"
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
        disabled={!onSave || saving}
        title={
          canSaveLibrary
            ? undefined
            : "Tersimpan di project ini. Library tema lintas-project khusus ENTERPRISE."
        }
        onClick={handleSave}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        {saving ? "Menyimpan..." : saved ? "Tersimpan" : "Simpan tema"}
      </button>

      {!canSaveLibrary && (
        <p className="text-[10px] leading-relaxed text-muted">
          Tema tersimpan di project ini. Menyimpan tema sebagai{" "}
          <b className="text-foreground">library lintas-project</b> tersedia di
          paket ENTERPRISE.
        </p>
      )}

      {/* Library tema lintas-project — ENTERPRISE */}
      {canSaveLibrary && (
        <>
          <button
            type="button"
            onClick={toggleLibrary}
            className="flex w-full items-center gap-2 border-b border-border pb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground"
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted transition-transform",
                libraryOpen && "rotate-90"
              )}
            />
            Library Tema
            <span className="ml-auto font-mono text-[9px] font-normal normal-case text-accent">
              Enterprise
            </span>
          </button>

          {libraryOpen && (
            <div className="flex flex-col gap-2.5">
              {libraryState === "loading" && (
                <p className="flex items-center gap-2 text-[11px] text-muted">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Memuat...
                </p>
              )}
              {libraryState === "error" && (
                <p className="text-[10px] text-danger">
                  Gagal memuat library.{" "}
                  <button onClick={() => void loadLibrary()} className="underline">
                    Coba lagi
                  </button>
                </p>
              )}

              {libraryState === "idle" && library.length === 0 && (
                <p className="text-[10px] leading-relaxed text-muted">
                  Belum ada tema tersimpan. Simpan tema di bawah untuk memakainya
                  lagi di project lain.
                </p>
              )}

              {library.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface-2/50 p-2"
                >
                  <span className="flex shrink-0 gap-0.5" aria-hidden>
                    {[
                      t.tokens.primary,
                      t.tokens.secondary,
                      t.tokens.accent,
                      t.tokens.surface,
                    ].map((c, i) => (
                      <span
                        key={i}
                        className="h-4 w-2.5 rounded-sm border border-border-strong"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                    {t.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(t.tokens);
                      onApplySaved?.(t.tokens);
                      setSaved(false);
                    }}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-accent transition-colors hover:bg-accent/10"
                  >
                    Pakai
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteFromLibrary(t.id)}
                    aria-label={`Hapus tema ${t.name}`}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-muted transition-colors hover:text-danger"
                  >
                    Hapus
                  </button>
                </div>
              ))}

              <div className="flex gap-1.5 pt-1">
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveToLibrary();
                  }}
                  placeholder="Nama tema..."
                  maxLength={60}
                  className="min-w-0 flex-1 rounded-md border border-border-strong bg-surface-2 px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted"
                />
                <button
                  type="button"
                  disabled={!saveName.trim() || saving}
                  onClick={() => void saveToLibrary()}
                  className="shrink-0 rounded-md border border-border-strong bg-surface-2 px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Simpan ke Library
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

