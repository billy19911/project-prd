import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { workspaceAccessFilter } from "@/lib/workspace-access";
import { authenticateCli } from "@/lib/cli-auth";

/**
 * GET /api/cli/workspaces — daftar workspace yang bisa diakses API key ini.
 *
 * Dipakai CLI untuk:
 *  - auto-deteksi workspace (bila hanya ada satu, tidak perlu `--workspace`), dan
 *  - perintah `xynn workspaces`.
 */
export async function GET(req: Request) {
  const auth = await authenticateCli(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const filter = await workspaceAccessFilter(auth.userId);
  const workspaces = await prisma.workspace.findMany({
    where: filter,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      fullPrdMd: true,
      tasksJson: true,
      styleGuideMd: true,
      cliSyncJson: true,
    },
  });

  return NextResponse.json(
    workspaces.map((w) => ({
      id: w.id,
      title: w.title,
      hasPrd: !!w.fullPrdMd,
      hasTasks: !!w.tasksJson,
      hasStyle: !!w.styleGuideMd,
      cliSync: w.cliSyncJson,
    }))
  );
}
