import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateMindmapWithAI } from "@/lib/ai";
import { normalizeTechStack } from "@/lib/utils";
import { NextResponse } from "next/server";

interface SessionUser {
  id: string;
  role?: string;
  plan?: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;

  // `id` boleh datang dari query (?id=...) maupun body untuk kompatibilitas.
  const urlId = new URL(req.url).searchParams.get("id");
  const body = await req.json().catch(() => ({}));
  const id: string | null = urlId || body.id || null;
  const questions: string[] = Array.isArray(body.questions) ? body.questions : [];
  const answers: string[] = Array.isArray(body.answers) ? body.answers : [];

  if (!id) {
    return NextResponse.json({ error: "Missing workspace id" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id, userId: user.id },
    select: {
      title: true,
      description: true,
      techStack: true,
      mindmapJson: true,
      locale: true,
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Get AI config from DB
  const aiConfig = await prisma.aiConfig.findFirst();
  const mindmapModel = aiConfig?.mindmapModel || "OpenCodeCombo";
  const systemPrompt = aiConfig?.systemPrompt || undefined;

  const { mindmap, usage } = await generateMindmapWithAI(
    workspace.title,
    workspace.description || "",
    normalizeTechStack(workspace.techStack),
    questions,
    answers,
    mindmapModel,
    systemPrompt,
    (workspace.locale as "id" | "en") || "id"
  );

  await prisma.workspace.update({
    where: { id, userId: user.id },
    data: { mindmapJson: mindmap },
  });

  await prisma.aiUsage.create({
    data: {
      userId: user.id,
      kind: "mindmap",
      model: usage.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      costUsd: usage.costUsd,
    },
  });

  return NextResponse.json(mindmap);
}

export async function GET() {
  return NextResponse.json({ message: "Use POST" });
}