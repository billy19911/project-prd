"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Heading = { level: number; text: string; id: string };

type Section = {
  key: string;
  text: string;
  id: string;
  children: Heading[];
};

/** Susun heading datar menjadi seksi: level tertinggi jadi grup, sisanya anak. */
function buildSections(headings: Heading[]): Section[] {
  if (headings.length === 0) return [];
  const minLevel = Math.min(...headings.map((h) => h.level));
  const sections: Section[] = [];

  for (const h of headings) {
    if (h.level === minLevel) {
      sections.push({ key: h.id, text: h.text, id: h.id, children: [] });
    } else if (sections.length > 0) {
      sections[sections.length - 1].children.push(h);
    } else {
      // heading sebelum grup pertama
      sections.push({ key: h.id, text: h.text, id: h.id, children: [] });
    }
  }
  return sections;
}

export function TableOfContents({
  headings,
  emptyLabel,
  className,
}: {
  headings: Heading[];
  emptyLabel: string;
  className?: string;
}) {
  const sections = useMemo(() => buildSections(headings), [headings]);
  const [activeId, setActiveId] = useState<string>("");
  // Hanya satu seksi terbuka (akordeon). Default: seksi pertama.
  const [openKey, setOpenKey] = useState<string | null>(
    sections[0]?.key ?? null
  );

  // Scroll-spy: tandai heading yang sedang terlihat + buka seksi terkait.
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const id = visible[0]?.target.id;
        if (!id) return;
        setActiveId(id);
        // Buka seksi yang memuat heading aktif (akordeon).
        const parent = sections.find(
          (s) => s.id === id || s.children.some((c) => c.id === id)
        );
        if (parent) setOpenKey(parent.key);
      },
      { rootMargin: "-72px 0px -70% 0px", threshold: 0 }
    );

    const els = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => !!el);
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings, sections]);

  if (headings.length === 0) {
    return <p className="text-xs text-muted">{emptyLabel}</p>;
  }

  return (
    <nav className={cn("space-y-0.5", className)}>
      {sections.map((s) => {
        const hasChildren = s.children.length > 0;
        const isOpen = openKey === s.key;
        const isActive =
          activeId === s.id || s.children.some((c) => c.id === activeId);

        return (
          <div key={s.key}>
            <div className="flex items-center">
              <a
                href={`#${s.id}`}
                className={cn(
                  "min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-xs transition-colors",
                  isActive
                    ? "text-accent"
                    : "text-muted hover:text-foreground"
                )}
                title={s.text}
              >
                {s.text}
              </a>
              {hasChildren && (
                <button
                  onClick={() => setOpenKey(isOpen ? null : s.key)}
                  aria-label={isOpen ? "Tutup" : "Buka"}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted/70 transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      isOpen && "rotate-90"
                    )}
                  />
                </button>
              )}
            </div>

            {/* Sub-heading dengan transisi tinggi halus */}
            {hasChildren && (
              <div
                className={cn(
                  "grid transition-all duration-300 ease-out",
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <ul className="ml-2 overflow-hidden border-l border-border pl-2">
                  {s.children.map((c) => (
                    <li key={c.id}>
                      <a
                        href={`#${c.id}`}
                        className={cn(
                          "block truncate rounded-md px-2 py-1 text-[11px] transition-colors",
                          activeId === c.id
                            ? "text-accent"
                            : "text-muted hover:text-foreground"
                        )}
                        title={c.text}
                      >
                        {c.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
