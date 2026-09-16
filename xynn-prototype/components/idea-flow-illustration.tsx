"use client";

import { cn } from "@/lib/utils";

/**
 * Ilustrasi animasi alur: Ide 💡 → Mindmap → PRD → Task.
 * Murni SVG + animasi CSS (ringan, tanpa dependency).
 */
export function IdeaFlowIllustration({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox="0 0 360 200"
        className="h-full w-full"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="flowGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--success)" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Connector path */}
        <path
          d="M60 100 H140 M200 100 H280"
          stroke="url(#flowGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="6 8"
          className="xynn-flow-dash"
        />

        {/* Stage 1 — Idea */}
        <g className="xynn-float-a">
          <circle cx="40" cy="100" r="20" fill="var(--accent)" fillOpacity="0.12" stroke="var(--accent)" strokeOpacity="0.4" />
          <text x="40" y="106" textAnchor="middle" fontSize="16">💡</text>
        </g>

        {/* Stage 2 — Mindmap nodes */}
        <g className="xynn-float-b">
          <circle cx="170" cy="60" r="7" fill="var(--accent)" fillOpacity="0.5" />
          <circle cx="145" cy="100" r="6" fill="var(--accent)" fillOpacity="0.4" />
          <circle cx="195" cy="100" r="6" fill="var(--accent)" fillOpacity="0.4" />
          <circle cx="170" cy="140" r="7" fill="var(--accent)" fillOpacity="0.5" />
          <path
            d="M170 60 L145 100 M170 60 L195 100 M145 100 L170 140 M195 100 L170 140"
            stroke="var(--accent)"
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />
        </g>

        {/* Stage 3 — PRD doc */}
        <g className="xynn-float-c">
          <rect x="270" y="72" width="56" height="56" rx="8" fill="var(--surface-2)" stroke="var(--border-strong)" />
          <rect x="280" y="84" width="36" height="4" rx="2" fill="var(--muted)" />
          <rect x="280" y="94" width="28" height="4" rx="2" fill="var(--muted)" opacity="0.7" />
          <rect x="280" y="104" width="32" height="4" rx="2" fill="var(--muted)" opacity="0.5" />
          <circle cx="316" cy="120" r="9" fill="var(--success)" />
          <path d="M312 120 l3 3 l5 -6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}
