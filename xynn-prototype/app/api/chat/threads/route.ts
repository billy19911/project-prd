import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUsePrototype } from "@/lib/access";

interface SessionUser {
  id: string;
}

/**
 * Daftar & pembuatan thread chat.
 *
 * Chat Prototype adalah fitur PRO ke atas (sama seperti Prototype Design),
 * karena ia mengarah ke generate prototype.
 */

/** GET: daftar thread milik pengguna (tanpa isi pesan, agar ringan). */
export async function GET() {
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

  const threads = await prisma.chatThread.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      workspaceId: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
    take: 50,
  });

  return NextResponse.json(
    threads.map((t) => ({
      id: t.id,
      title: t.title,
      workspaceId: t.workspaceId,
      updatedAt: t.updatedAt,
      messageCount: t._count.messages,
    }))
  );
}

/** POST: buat thread baru. */
export async function POST(req: Request) {
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

  const body = await req.json().catch(() => ({}));
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : null;

  // Bila workspace ditautkan, pastikan milik pengguna.
  if (workspaceId) {
    const owned = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Workspace tidak ditemukan" }, { status: 404 });
    }
  }

  const thread = await prisma.chatThread.create({
    data: { userId, workspaceId },
  });

  return NextResponse.json(thread);
}

/** DELETE: hapus thread (dan pesannya via cascade). */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as SessionUser).id;
  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const deleted = await prisma.chatThread.deleteMany({ where: { id, userId } });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Thread tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
