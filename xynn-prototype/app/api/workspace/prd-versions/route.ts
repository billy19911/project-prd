import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceAccess } from "@/lib/workspace-access";

interface SessionUser {
  id: string;
}

/**
 * Riwayat versi PRD untuk satu workspace.
 * `?id=<workspaceId>` — hanya metadata (tanpa teks PRD penuh, agar ringan);
 * teks diambil saat restore.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as SessionUser).id;
  const workspaceId = new URL(req.url).searchParams.get("id");
  if (!workspaceId) {
    return NextResponse.json({ error: "Missing workspace id" }, { status: 400 });
  }

  const access = await getWorkspaceAccess(workspaceId, userId);
  if (!access.canView) {
    return NextResponse.json({ error: "Workspace tidak ditemukan" }, { status: 404 });
  }

  const versions = await prisma.prdVersion.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, note: true, createdAt: true },
  });

  return NextResponse.json(versions);
}
