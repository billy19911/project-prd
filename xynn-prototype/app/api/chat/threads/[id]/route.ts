import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUsePrototype } from "@/lib/access";
import { guardFeature } from "@/lib/feature-guard";

interface SessionUser {
  id: string;
}

/** GET: satu thread beserta pesannya. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = await guardFeature("chat");
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as SessionUser).id;
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!canUsePrototype(subscription)) {
    return NextResponse.json(
      { error: "Chat Prototype tersedia untuk paket PRO ke atas." },
      { status: 402 }
    );
  }

  const { id } = await params;

  const thread = await prisma.chatThread.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      workspaceId: true,
      createdAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, createdAt: true },
      },
    },
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(thread);
}
