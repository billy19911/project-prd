import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTechStack } from "@/lib/utils";
import { isPaid } from "@/lib/access";

interface SessionUser {
  id: string;
  email: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const { title, description, techStack, techPreferences, locale } = await req.json();

  if (!title?.trim()) {
    return Response.json({ error: "Judul proyek wajib diisi" }, { status: 400 });
  }

  // Paywall guard: Free tier dibatasi 1 draft PRD (PRD §3.1 & §3.4).
  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
  });

  if (!isPaid(subscription)) {
    const existingCount = await prisma.workspace.count({
      where: { userId: user.id },
    });
    if (existingCount >= 1) {
      return Response.json(
        {
          error:
            "Free tier dibatasi 1 draft PRD. Upgrade ke STARTER/PRO untuk membuat lebih banyak.",
          upgrade: true,
        },
        { status: 402 }
      );
    }
  }

  const workspace = await prisma.workspace.create({
    data: {
      userId: user.id,
      title: title.trim(),
      description: description ?? "",
      locale: locale === "en" ? "en" : "id",
      techStack: normalizeTechStack(techStack),
      techPreferences: techPreferences ?? undefined,
      mindmapJson: { nodes: [], edges: [] },
    },
  });

  return Response.json({
    ...workspace,
    techStack: normalizeTechStack(workspace.techStack),
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const workspaces = await prisma.workspace.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  return Response.json(
    workspaces.map((w) => ({
      ...w,
      techStack: normalizeTechStack(w.techStack),
    }))
  );
}
