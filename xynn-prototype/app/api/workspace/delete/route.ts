import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceAccess } from "@/lib/workspace-access";

/**
 * Hapus project milik creator. Hanya pemilik yang bisa menghapus.
 */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { id } = await req.json();

  if (!id) return NextResponse.json({ error: "Missing workspace id" }, { status: 400 });

  const access = await getWorkspaceAccess(id, userId);
  if (!access.canView) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }
  if (!access.canManage) {
    return NextResponse.json(
      { error: "Hanya pemilik yang dapat menghapus workspace." },
      { status: 403 }
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace tidak ditemukan" }, { status: 404 });
  }
  if (workspace.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.workspace.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
