import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuestionsWithAI } from "@/lib/ai";
import { normalizeTechStack } from "@/lib/utils";

interface SessionUser {
  id: string;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const id = new URL(req.url).searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Missing workspace id" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id, userId: user.id },
  });

  if (!workspace) {
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  }

  const aiConfig = await prisma.aiConfig.findFirst();
  const model = aiConfig?.mindmapModel || "OpenCodeCombo";
  const systemPrompt = aiConfig?.systemPrompt || undefined;

  const { questions } = await generateQuestionsWithAI(
    workspace.title,
    workspace.description || "",
    normalizeTechStack(workspace.techStack),
    model,
    systemPrompt,
    (workspace.locale as "id" | "en") || "id"
  );

  return Response.json({ questions });
}
