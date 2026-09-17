import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTasksWithAI } from "@/lib/ai";
import { recordAiUsage } from "@/lib/ai-usage";
import { canGenerateAdvanced } from "@/lib/access";
import { NextResponse } from "next/server";
import { normalizeTechStack } from "@/lib/utils";
import { getWorkspaceAccess } from "@/lib/workspace-access";

/**
 * Generate task breakdown dari PRD workspace. Khusus paket berbayar.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { id } = await req.json().catch(() => ({}));

  if (!id) return NextResponse.json({ error: "Missing workspace id" }, { status: 400 });

  // Paywall: Task Breakdown hanya untuk Starter/Pro.
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!canGenerateAdvanced(subscription)) {
    return NextResponse.json(
      { error: "Task Breakdown tersedia untuk paket berbayar. Upgrade untuk melanjutkan." },
      { status: 402 }
    );
  }

  const access = await getWorkspaceAccess(id, userId);
  if (!access.canView) {
    return NextResponse.json({ error: "Workspace tidak ditemukan" }, { status: 404 });
  }
  if (!access.canEdit) {
    return NextResponse.json(
      { error: "Anda hanya punya akses lihat pada workspace ini." },
      { status: 403 }
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: {
      title: true,
      fullPrdMd: true,
      locale: true,
      techStack: true,
      mindmapJson: true,
    },
  });

  if (!workspace) return NextResponse.json({ error: "Workspace tidak ditemukan" }, { status: 404 });
  if (!workspace.fullPrdMd) {
    return NextResponse.json({ error: "Generate PRD terlebih dahulu" }, { status: 400 });
  }

  const aiConfig = await prisma.aiConfig.findFirst();
  const model = aiConfig?.prdModel || "OpenCodeCombo";
  const systemPrompt = aiConfig?.systemPrompt || undefined;

  const { groups, usage } = await generateTasksWithAI(
    workspace.title,
    workspace.fullPrdMd,
    workspace.mindmapJson,
    normalizeTechStack(workspace.techStack),
    model,
    systemPrompt,
    (workspace.locale as "id" | "en") || "id"
  );

  await prisma.workspace.update({
    where: { id },
    data: { tasksJson: groups },
  });

  await recordAiUsage(userId, "tasks", usage);

  return NextResponse.json({ groups });
}
