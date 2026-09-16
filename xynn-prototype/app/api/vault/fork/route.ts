import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTechStack } from "@/lib/utils";
import { canFork } from "@/lib/access";

interface SessionUser {
  id: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;

  // Fork hanya untuk PRO & PRO Tahunan (PRD §3.4).
  const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (!canFork(subscription)) {
    return NextResponse.json(
      { error: "Fork hanya tersedia untuk paket PRO." },
      { status: 402 }
    );
  }

  const { workspaceId } = await req.json();

  const original = await prisma.workspace.findUnique({
    where: { id: workspaceId, isPublic: true },
  });

  if (!original) {
    return NextResponse.json({ error: "Workspace tidak ditemukan" }, { status: 404 });
  }

  const forked = await prisma.workspace.create({
    data: {
      userId: user.id,
      title: `${original.title} (Fork)`,
      description: original.description,
      techStack: normalizeTechStack(original.techStack),
      mindmapJson: JSON.parse(JSON.stringify(original.mindmapJson)),
      fullPrdMd: original.fullPrdMd,
      forkedFromId: original.id,
    },
  });

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { forksCount: { increment: 1 } },
  });

  return NextResponse.json({ id: forked.id });
}
