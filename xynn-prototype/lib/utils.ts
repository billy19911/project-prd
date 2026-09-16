import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Workspace.techStack disimpan sebagai JSONB (PRD §5) sehingga tipenya
 * `Prisma.JsonValue`. Helper ini menormalkan nilai apa pun menjadi
 * array of string yang aman dirender di UI / dikonsumsi AI.
 */
export function normalizeTechStack(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** Slug id untuk heading markdown (harus identik antara TOC & heading yang dirender). */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Ekstrak teks dari React children (untuk slug heading). */
export function childrenToText(node: React.ReactNode): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(childrenToText).join("");
  const el = node as { props?: { children?: React.ReactNode } };
  if (el.props?.children) return childrenToText(el.props.children);
  return "";
}