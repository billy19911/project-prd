"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Interactive Task Checklist (PRD §7A).
 * Menyimpan state centang di localStorage per-kunci sehingga tetap tersimpan
 * saat halaman di-refresh, tanpa memerlukan autentikasi.
 */
export function TaskChecklist({ storageKey, tasks }: { storageKey: string; tasks: string[] }) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // Baca localStorage di luar render; setState dijadwalkan asinkron agar
    // tidak memicu cascading render (react-hooks/set-state-in-effect).
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(`xynn:tasks:${storageKey}`);
    } catch {
      // ignore
    }
    if (!raw) return;

    queueMicrotask(() => {
      try {
        setChecked(JSON.parse(raw as string));
      } catch {
        // ignore
      }
    });
  }, [storageKey]);

  const toggle = (index: number) => {
    setChecked((prev) => {
      const next = { ...prev, [index]: !prev[index] };
      try {
        localStorage.setItem(`xynn:tasks:${storageKey}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const doneCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="my-4 rounded-lg border border-border bg-surface/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Task Checklist
        </p>
        <span className="font-mono text-xs text-muted">
          {doneCount}/{tasks.length}
        </span>
      </div>
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${tasks.length ? (doneCount / tasks.length) * 100 : 0}%` }}
        />
      </div>
      <ul className="space-y-1">
        {tasks.map((task, i) => (
          <li key={i}>
            <button
              onClick={() => toggle(i)}
              className="flex w-full items-start gap-3 rounded px-2 py-1.5 text-left transition-colors hover:bg-surface-2/60"
            >
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  checked[i]
                    ? "border-accent bg-accent text-white"
                    : "border-border-strong bg-surface-2"
                )}
              >
                {checked[i] && <Check className="h-3 w-3" />}
              </span>
              <span
                className={cn(
                  "text-sm",
                  checked[i] ? "text-muted line-through" : "text-foreground"
                )}
              >
                {task}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
