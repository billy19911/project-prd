import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTechStack } from "@/lib/utils";
import { canAccessVault } from "@/lib/access";

interface SessionUser {
  id: string;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });

  // Gudang PRD penuh hanya untuk Starter & Pro; Free melihat blur (PRD §3.4).
  if (!canAccessVault(subscription)) {
    return NextResponse.json(
      { error: "Upgrade ke STARTER/PRO untuk akses Gudang PRD" },
      { status: 402 }
    );
  }

  const searchParams = new URL(req.url).searchParams;
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";

  const where: Record<string, unknown> = { isPublic: true };
  if (query) {
    // Cari lintas judul, deskripsi, dan kategori (PRD §3.2 Browse & Search)
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { category: { contains: query, mode: "insensitive" } },
    ];
  }
  if (category) where.category = category;

  const workspaces = await prisma.workspace.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      techStack: true,
      category: true,
      viewsCount: true,
      forksCount: true,
      shareSlug: true,
      isAnonymous: true,
      user: { select: { name: true, avatarUrl: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const normalized = workspaces.map((w) => ({
    ...w,
    techStack: normalizeTechStack(w.techStack),
  }));

  return NextResponse.json(normalized);
}
