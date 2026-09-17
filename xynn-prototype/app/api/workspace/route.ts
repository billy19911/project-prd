import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTechStack } from "@/lib/utils";
import { isPaid } from "@/lib/access";
import {
  canCreateWorkspaceInOrg,
  getWorkspaceAccess,
  workspaceAccessFilter,
} from "@/lib/workspace-access";

interface SessionUser {
  id: string;
  email: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const { title, description, techStack, techPreferences, locale, organizationId } =
    await req.json().catch(() => ({}));

  if (!title?.trim()) {
    return Response.json({ error: "Judul proyek wajib diisi" }, { status: 400 });
  }

  // Bila workspace dibuat untuk sebuah organisasi, pastikan user benar-benar
  // anggotanya dan punya hak menambah (bukan VIEWER). Tanpa ini, siapa pun
  // bisa menempelkan workspace ke organisasi orang lain.
  let orgId: string | null = null;
  if (typeof organizationId === "string" && organizationId) {
    if (!(await canCreateWorkspaceInOrg(organizationId, user.id))) {
      return Response.json(
        { error: "Anda tidak punya hak menambah proyek di tim ini." },
        { status: 403 }
      );
    }
    orgId = organizationId;
  }

  // Paywall guard: Free tier dibatasi 1 draft PRD (PRD §3.1 & §3.4).
  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
  });

  if (!isPaid(subscription)) {
    const existingCount = await prisma.workspace.count({
      where: { userId: user.id },
    });
    if (existingCount >= 1) {
      return Response.json(
        {
          error:
            "Free tier dibatasi 1 draft PRD. Upgrade ke STARTER/PRO untuk membuat lebih banyak.",
          upgrade: true,
        },
        { status: 402 }
      );
    }
  }

  const workspace = await prisma.workspace.create({
    data: {
      userId: user.id,
      organizationId: orgId,
      title: title.trim(),
      description: description ?? "",
      locale: locale === "en" ? "en" : "id",
      techStack: normalizeTechStack(techStack),
      techPreferences: techPreferences ?? undefined,
      mindmapJson: { nodes: [], edges: [] },
    },
  });

  return Response.json({
    ...workspace,
    techStack: normalizeTechStack(workspace.techStack),
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;

  // Tampilkan workspace milik sendiri ATAU milik organisasi tempat user
  // menjadi anggota — supaya kolaborasi tim benar-benar berfungsi.
  const accessFilter = await workspaceAccessFilter(user.id);
  const workspaces = await prisma.workspace.findMany({
    where: accessFilter,
    orderBy: { updatedAt: "desc" },
  });

  // Hitung hak akses untuk tiap workspace agar UI bisa menonaktifkan aksi
  // yang tidak diizinkan (mis. viewer tidak boleh mengubah).
  const access = await Promise.all(
    workspaces.map((w) => getWorkspaceAccess(w.id, user.id))
  );

  return Response.json(
    workspaces.map((w, i) => ({
      ...w,
      techStack: normalizeTechStack(w.techStack),
      access: {
        canEdit: access[i].canEdit,
        canManage: access[i].canManage,
        role: access[i].role,
        isOrgWorkspace: access[i].isOrgWorkspace,
      },
    }))
  );
}
