import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceAccess } from "@/lib/workspace-access";
import { savePrdVersion } from "@/lib/prd-version";

interface SessionUser {
  id: string;
}

/**
 * Pulihkan versi PRD lama.
 *
 * Versi saat ini disimpan lebih dulu ke riwayat, sehingga restore juga dapat
 * dibatalkan — bukan jalan satu arah.
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

  const version = await prisma.prdVersion.findUnique({
    where: { id: versionId },
    include: { workspace: { select: { id: true, fullPrdMd: true } } },
  });
  if (!version) {
    return NextResponse.json({ error: "Versi tidak ditemukan" }, { status: 404 });
  }

  const access = await getWorkspaceAccess(version.workspace.id, userId);
  if (!access.canView) {
    return NextResponse.json({ error: "Versi tidak ditemukan" }, { status: 404 });
  }
  if (!access.canEdit) {
    return NextResponse.json(
      { error: "Anda hanya punya akses lihat pada workspace ini." },
      { status: 403 }
    );
  }

  // Simpan kondisi SEKARANG dulu agar restore bisa dibatalkan.
  await savePrdVersion(
    version.workspace.id,
    version.workspace.fullPrdMd,
    "Sebelum memulihkan versi PRD lama"
  );

  await prisma.workspace.update({
    where: { id: version.workspace.id },
    data: { fullPrdMd: version.fullPrdMd },
  });

  return NextResponse.json({ success: true, fullPrdMd: version.fullPrdMd });
}
