import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTechStack } from "@/lib/utils";
import { sanitizeThemeTokens } from "@/lib/theme";

interface SessionUser {
  id: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const {
    id,
    title,
    description,
    category,
    mindmapJson,
    techStack,
    techPreferences,
    themeTokensJson,
  } = await req.json();

  if (!id) {
    return Response.json({ error: "Missing workspace id" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof title === "string" && title.trim()) data.title = title.trim();
  if (typeof description === "string") data.description = description;
  if (typeof category === "string") data.category = category || null;
  if (mindmapJson !== undefined) data.mindmapJson = mindmapJson;
  if (techStack !== undefined) data.techStack = normalizeTechStack(techStack);
  if (techPreferences !== undefined) data.techPreferences = techPreferences;
  // Token tema prototype (theme editor).
  // Nilai ini kelak disuntikkan ke dalam HTML prototype, jadi divalidasi
  // di sini — jangan percaya bentuk objek dari klien.
  if (themeTokensJson !== undefined && themeTokensJson !== null) {
    data.themeTokensJson = sanitizeThemeTokens(themeTokensJson);
  }

  const updated = await prisma.workspace.updateMany({
    where: { id, userId: user.id },
    data,
  });

  if (updated.count === 0) {
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id, userId: user.id },
  });

  return Response.json({
    success: true,
    workspace: workspace
      ? { ...workspace, techStack: normalizeTechStack(workspace.techStack) }
      : null,
  });
}
