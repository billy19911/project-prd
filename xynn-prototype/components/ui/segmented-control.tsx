"use client";

import { cn } from "@/lib/utils";

export type SegmentItem<T extends string> = {
  value: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  title?: string;
};

/**
 * Segmented control bersama — satu pola untuk toggle/segmen di seluruh app.
 *
 * Tujuan: menyatukan 6+ implementasi segmented yang tadinya ditulis tangan
 * dengan ukuran & radius berbeda-beda. Semua di sini memakai tap target
 * minimal 36px (`min-h-9`) agar nyaman di sentuh, dan dapat menggulir
 * horizontal di layar sempit alih-alih memaksa overflow halaman.
 */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  className,
  size = "md",
  ariaLabel,
}: {
  items: SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const pad = size === "sm" ? "px-2.5 text-[11px]" : "px-3 text-xs";
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface/60 p-1",
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            title={item.title}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex min-h-9 shrink-0 items-center gap-1.5 rounded-md font-medium transition-colors",
              pad,
              active
                ? "bg-surface-2 text-foreground"
                : item.disabled
                  ? "cursor-not-allowed text-muted/40"
                  : "text-muted hover:text-foreground"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
