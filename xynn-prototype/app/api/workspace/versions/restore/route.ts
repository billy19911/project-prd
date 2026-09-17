import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface SessionUser {
  id: string;
}

/** Batas riwayat yang disimpan (harus sama dengan endpoint prototype). */
const MAX_VERSIONS = 10;

/**
 * Pulihkan versi prototype lama.
 *
 * Versi saat ini disimpan lebih dulu ke riwayat, sehingga restore juga
 * dapat dibatalkan — bukan jalan satu arah.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as SessionUser).id;
  const body = await req.json().catch(() => ({}));
  const versionId = typeof body?.versionId === "string" ? body.versionId : null;
  if (!versionId) {
    return NextResponse.json({ error: "Missing versionId" }, { status: 400 });
  }

  const version = await prisma.prototypeVersion.findUnique({
    where: { id: versionId },
    include: { workspace: { select: { id: true, userId: true, prototypeHtml: true, prototypeJson: true } } },
  });

  if (!version || version.workspace.userId !== userId) {
    return NextResponse.json({ error: "Versi tidak ditemukan" }, { status: 404 });
  }

  const ws = version.workspace;

  // Simpan kondisi SEKARANG dulu agar restore bisa dibatalkan.
  if (ws.prototypeHtml && ws.prototypeHtml !== version.html) {
    await prisma.prototypeVersion.create({
      data: {
        workspaceId: ws.id,
        html: ws.prototypeHtml,
        screens: ws.prototypeJson ?? undefined,
        note: "Sebelum memulihkan versi lama",
      },
    });

    const excess = await prisma.prototypeVersion.findMany({
      where: { workspaceId: ws.id },
      orderBy: { createdAt: "desc" },
      skip: MAX_VERSIONS,
      select: { id: true },
    });
    if (excess.length > 0) {
      await prisma.prototypeVersion.deleteMany({
        where: { id: { in: excess.map((v) => v.id) } },
      });
    }
  }

  await prisma.workspace.update({
    where: { id: ws.id },
    data: {
      prototypeHtml: version.html,
      prototypeJson: version.screens ?? undefined,
    },
  });

  return NextResponse.json({ success: true, prototypeHtml: version.html });
}
