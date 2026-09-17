"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import Mermaid from "@/components/mermaid";
import { TaskChecklist } from "@/components/task-checklist";
import { slugifyHeading, childrenToText } from "@/lib/utils";

/**
 * Ekstrak fenced code block yang bertag mermaid dari markdown mentah.
 * Dipakai untuk menarik daftar diagram agar bisa dirender terpisah & untuk
 * menyembunyikan blok mermaid dari output react-markdown biasa.
 */
export function extractMermaidBlocks(markdown: string): string[] {
  const regex = /```mermaid\s*([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

/**
 * Ekstrak item checklist markdown (`- [ ]` / `- [x]`) menjadi daftar task.
 */
export function extractTaskLists(markdown: string): string[][] {
  const lists: string[][] = [];
  const lines = markdown.split(/\r?\n/);
  let current: string[] = [];

  const flush = () => {
    if (current.length) {
      lists.push(current);
      current = [];
    }
  };

  for (const line of lines) {
    const m = line.match(/^\s*[-*]\s*\[[ xX]\]\s+(.*)$/);
    if (m) {
      current.push(m[1].trim());
    } else if (current.length && line.trim() && !line.match(/^\s*[-*]\s*\[[ xX]\]/)) {
      // baris non-checklist menandakan daftar berakhir
      if (!/^\s*$/.test(line)) flush();
    }
  }
  flush();

  return lists;
}

/**
 * Hapus blok mermaid dan daftar checklist dari markdown agar tidak
 * dirender dua kali (kita render dengan komponen interaktif).
 */
function stripSpecialBlocks(markdown: string): string {
  return markdown
    .replace(/```mermaid\s*[\s\S]*?```/g, "")
    .replace(/^\s*[-*]\s*\[[ xX]\].*$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}

export function MarkdownRenderer({ markdown, storageKey }: { markdown: string; storageKey: string }) {
  const mermaidBlocks = extractMermaidBlocks(markdown);
  const taskLists = extractTaskLists(markdown);
  const cleaned = stripSpecialBlocks(markdown);

  const components: Components = {
    h1: ({ children }) => (
      <h1
        id={slugifyHeading(childrenToText(children))}
        className="mt-8 mb-4 scroll-mt-24 border-b border-border pb-2 text-2xl font-bold text-foreground"
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        id={slugifyHeading(childrenToText(children))}
        className="mt-7 mb-3 scroll-mt-24 text-xl font-semibold text-foreground"
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        id={slugifyHeading(childrenToText(children))}
        className="mt-5 mb-2 scroll-mt-24 text-lg font-semibold text-foreground"
      >
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="my-3 leading-relaxed text-muted">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="my-3 list-disc space-y-1 pl-6 text-muted">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-3 list-decimal space-y-1 pl-6 text-muted">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    a: ({ href, children }) => (
      <a href={href} className="text-accent underline hover:text-accent-hover">
        {children}
      </a>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-4 border-l-2 border-accent/50 bg-surface/40 py-1 pl-4 italic text-muted">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="my-4 min-w-0 overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="border-b border-border-strong text-left text-foreground">
        {children}
      </thead>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 font-semibold">{children}</th>
    ),
    td: ({ children }) => (
      <td className="border-b border-border px-3 py-2 text-muted break-words">
        {children}
      </td>
    ),
    code: ({ className, children }) => {
      const isBlock = /language-/.test(className || "");
      if (isBlock) {
        return (
          <code className="block overflow-x-auto text-xs text-muted">
            {children}
          </code>
        );
      }
      return (
        <code className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-accent">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="my-4 overflow-x-auto rounded-lg border border-border bg-background/80 p-4">
        {children}
      </pre>
    ),
  };

  return (
    <div className="min-w-0 max-w-full break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {cleaned}
      </ReactMarkdown>

      {mermaidBlocks.map((chart, i) => (
        <Mermaid key={i} chart={chart} />
      ))}

      {taskLists.map((tasks, i) => (
        <TaskChecklist key={i} storageKey={`${storageKey}:${i}`} tasks={tasks} />
      ))}
    </div>
  );
}
