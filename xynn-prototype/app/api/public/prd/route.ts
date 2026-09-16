import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeTechStack } from "@/lib/utils";

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const workspace = await prisma.workspace.findUnique({
    where: { shareSlug: slug, isPublic: true },
    select: {
      id: true,
      title: true,
      description: true,
      techStack: true,
      fullPrdMd: true,
      tasksJson: true,
      styleGuideMd: true,
      category: true,
      locale: true,
      user: { select: { name: true, avatarUrl: true } },
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { viewsCount: { increment: 1 } },
  });

  return NextResponse.json({
    ...workspace,
    techStack: normalizeTechStack(workspace.techStack),
  });
}

