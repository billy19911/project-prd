# XynnPrototype — Design System

Imported from the live codebase (`xynn-prototype/app/globals.css` + `components/ui/*`)
on 2026-02-14. This is not an invented system — it is what the shipped
product already renders.

## Identity

AI-Driven PRD & Architecture Generator. The interface reads as a
developer tool: dark, quiet, dense with information but never noisy.
The PRD calls it **anti-slop** — one accent, flat surfaces, hairline
borders, no decorative flourish.

## Temperature

**Cool.** Base `#080b12` is a blue-black (chroma well under 0.02).
Foreground `#e5e9f0` is a cool near-white. Nothing warm in the
neutrals.

## Accent

Exactly one: `--accent: #4f7cff`. Used for the active nav bar, primary
buttons, focus rings, selected step, and links. Success / warning /
danger are status-only and never decorative.

## Type

Geist Sans for everything; Geist Mono for technical strings (tech-stack
chips, API keys, the CLI command, code panes). Weights are 400/500/600.
No 700+, no display sizes.

## Surfaces

Three steps only: `#080b12` → `#0d1220` → `#111827`, separated by 1px
borders rather than shadows. Elevation is expressed with
`backdrop-blur` + a lighter fill, not a drop shadow.

## Signature patterns

- **Left-edge accent bar** on the active sidebar item and tab.
- **Locked + blurred** gated content with a centered unlock overlay.
- **Monospace chips** for anything a developer would copy.
- **Ring spinner** for loading — never a shimmer skeleton in content
  areas. A determinate generation progress bar is the one exception;
  it animates an accent segment, not placeholder content.

See `colors_and_type.css` for tokens and the full usage rules.
