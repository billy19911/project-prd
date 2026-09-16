import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface SessionUser {
  id: string;
}

function generateSlug(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const { id, isPublic, isAnonymous, category } = await req.json();

  const workspace = await prisma.workspace.findUnique({
    where: { id, userId: user.id },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace tidak ditemukan" }, { status: 404 });
  }

  let shareSlug = workspace.shareSlug;
  if (isPublic && !shareSlug) {
    shareSlug = generateSlug();
  }

  const updated = await prisma.workspace.update({
    where: { id, userId: user.id },
    data: {
      isPublic,
      isAnonymous: isPublic ? isAnonymous : false,
      shareSlug,
      category,
    },
  });

  return NextResponse.json({
    id: updated.id,
    isPublic: updated.isPublic,
    shareSlug: updated.shareSlug,
  });
}
