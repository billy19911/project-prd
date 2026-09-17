import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPaid } from "@/lib/access";
import { guardFeature } from "@/lib/feature-guard";
import { getWorkspaceAccess } from "@/lib/workspace-access";

interface SessionUser {
  id: string;
}

/**
 * Daftar & pembuatan thread Konsultasi AI.
 *
 * Fitur berbayar (STARTER ke atas). Selain gate paket, route ini juga dijaga
 * `guardFeature("consult")` sehingga backend ikut terkunci bila fitur masih
 * berstatus SOON — bukan hanya halamannya.
 */

/** GET: daftar thread konsultasi milik pengguna (ringkas). */
export async function GET() {
  const blocked = await guardFeature("consult");
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as SessionUser).id;
  const subscription = await prisma.subscription.findUnique({ where: { userId } });

  if (!isPaid(subscription)) {
    return NextResponse.json(
      { error: "Konsultasi AI tersedia untuk paket berbayar." },
      { status: 402 }
    );
  }

  const threads = await prisma.consultThread.findMany({
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

/** POST: buat thread konsultasi baru. */
export async function POST(req: Request) {
  const blocked = await guardFeature("consult");
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as SessionUser).id;
  const subscription = await prisma.subscription.findUnique({ where: { userId } });

  if (!isPaid(subscription)) {
    return NextResponse.json(
      { error: "Konsultasi AI tersedia untuk paket berbayar." },
      { status: 402 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : null;

  // Bila workspace ditautkan, pastikan pengguna boleh mengeditnya.
  if (workspaceId) {
    const access = await getWorkspaceAccess(workspaceId, userId);
    if (!access.canEdit) {
      return NextResponse.json({ error: "Workspace tidak ditemukan" }, { status: 404 });
    }
  }

  const thread = await prisma.consultThread.create({
    data: { userId, workspaceId },
  });

  return NextResponse.json(thread);
}

/** DELETE: hapus thread konsultasi (pesan via cascade). */
export async function DELETE(req: Request) {
  const blocked = await guardFeature("consult");
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as SessionUser).id;
  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const deleted = await prisma.consultThread.deleteMany({ where: { id, userId } });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Thread tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
