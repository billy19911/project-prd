import { prisma } from "@/lib/prisma";
import type { UsageInfo } from "@/lib/ai";

/**
 * Catat pemakaian token AI untuk Admin Cost & Margin Health (PRD §7B).
 */
export async function recordAiUsage(
  userId: string | null | undefined,
  kind: "mindmap" | "prd" | "questions" | "tasks" | "styleguide" | "techstack" | "prototype",
  usage: UsageInfo | null
) {
  if (!usage) return;
  try {
    await prisma.aiUsage.create({
      data: {
        userId: userId ?? null,
        kind,
        model: usage.model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        costUsd: usage.costUsd,
      },
    });
  } catch {
    // jangan sampai kegagalan logging memblokir respons utama
  }
}
