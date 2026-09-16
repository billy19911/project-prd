import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateStyleGuideWithAI, summarizeTasks } from "@/lib/ai";
import { recordAiUsage } from "@/lib/ai-usage";
import { canGenerateAdvanced } from "@/lib/access";
import { NextResponse } from "next/server";
import { normalizeTechStack } from "@/lib/utils";

/**
 * Generate style guide (design system) dari PRD workspace. Khusus paket berbayar.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { id } = await req.json();

  if (!id) return NextResponse.json({ error: "Missing workspace id" }, { status: 400 });

  // Paywall: Style Guide hanya untuk Starter/Pro.
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!canGenerateAdvanced(subscription)) {
    return NextResponse.json(
      { error: "Style Guide tersedia untuk paket berbayar. Upgrade untuk melanjutkan." },
      { status: 402 }
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id, userId },
    select: {
      title: true,
      fullPrdMd: true,
      locale: true,
      techStack: true,
      tasksJson: true,
    },
  });

  if (!workspace) return NextResponse.json({ error: "Workspace tidak ditemukan" }, { status: 404 });
  if (!workspace.fullPrdMd) {
    return NextResponse.json({ error: "Generate PRD terlebih dahulu" }, { status: 400 });
  }

  // Style Guide harus konsisten dengan Task Breakdown → wajib task dulu.
  const taskSummary = summarizeTasks(workspace.tasksJson);
  if (!taskSummary) {
    return NextResponse.json(
      { error: "Generate Task Breakdown terlebih dahulu" },
      { status: 400 }
    );
  }

  const aiConfig = await prisma.aiConfig.findFirst();
  const model = aiConfig?.prdModel || "OpenCodeCombo";
  const systemPrompt = aiConfig?.systemPrompt || undefined;

  const { styleGuide, usage } = await generateStyleGuideWithAI(
    workspace.title,
    workspace.fullPrdMd,
    taskSummary,
    normalizeTechStack(workspace.techStack),
    model,
    systemPrompt,
    (workspace.locale as "id" | "en") || "id"
  );

  await prisma.workspace.update({
    where: { id, userId },
    data: { styleGuideMd: styleGuide },
  });

  await recordAiUsage(userId, "styleguide", usage);

  return NextResponse.json({ styleGuide });
}
