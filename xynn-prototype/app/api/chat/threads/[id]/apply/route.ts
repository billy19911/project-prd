import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUsePrototype, isPaid } from "@/lib/access";
import { guardFeature } from "@/lib/feature-guard";
import { generateMindmapWithAI } from "@/lib/ai";
import { recordAiUsage } from "@/lib/ai-usage";
import { savePrdVersion } from "@/lib/prd-version";
import { normalizeTechStack } from "@/lib/utils";

interface SessionUser {
  id: string;
}

/**
 * Terapkan DRAF PRD dari Chat Prototype menjadi project nyata.
 *
 * Membuat Workspace baru + mengisi `fullPrdMd` dengan PRD yang disetujui user,
 * lalu men-generate mindmap ringkas dari percakapan (agar tab Mindmap terisi).
 * Thread ditautkan ke workspace baru.
 *
 * Body: { prd: string, title?: string, description?: string }
 */
export async function POST(
  req: Request,
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
    include: { messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } } },
  });
  if (!thread) {
    return NextResponse.json({ error: "Thread tidak ditemukan" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    prd?: string;
    title?: string;
    description?: string;
  };
  const prd = typeof body.prd === "string" ? body.prd.trim() : "";
  if (!prd) {
    return NextResponse.json({ error: "PRD kosong." }, { status: 400 });
  }

  // Paywall pembuatan project: cermin aturan `POST /api/workspace`
  // (Free dibatasi 1 workspace). Bila thread ini sudah punya workspace, apply
  // berarti update PRD — tidak menambah workspace baru.
  let workspaceId = thread.workspaceId;
  let created = false;

  if (!workspaceId) {
    if (!isPaid(subscription)) {
      const count = await prisma.workspace.count({ where: { userId } });
      if (count >= 1) {
        return NextResponse.json(
          {
            error:
              "Free tier dibatasi 1 draft PRD. Upgrade ke STARTER/PRO untuk membuat lebih banyak.",
            upgrade: true,
          },
          { status: 402 }
        );
      }
    }

    const title =
      (typeof body.title === "string" && body.title.trim()) ||
      thread.title ||
      "Project Baru";
    const description =
      (typeof body.description === "string" && body.description.trim()) || "";

    const workspace = await prisma.workspace.create({
      data: {
        userId,
        title: title.slice(0, 120),
        description,
        locale: "id",
        techStack: [],
        mindmapJson: { nodes: [], edges: [] },
        fullPrdMd: prd,
      },
    });
    workspaceId = workspace.id;
    created = true;

    // Tautkan thread ke workspace baru.
    await prisma.chatThread.update({
      where: { id: thread.id },
      data: { workspaceId },
    });
  } else {
    // Update PRD project yang sudah tertaut: simpan versi lama dulu.
    const existing = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { fullPrdMd: true },
    });
    await savePrdVersion(workspaceId, existing?.fullPrdMd, "Sebelum diterapkan dari Chat");
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { fullPrdMd: prd },
    });
  }

  // Generate mindmap ringkas dari percakapan (agar tab Mindmap terisi).
  try {
    const aiConfig = await prisma.aiConfig.findFirst();
    const model = aiConfig?.mindmapModel || "OpenCodeCombo";
    const systemPrompt = aiConfig?.systemPrompt || undefined;

    const transcript = thread.messages
      .slice(-20)
      .map((m) => m.content)
      .join("\n")
      .slice(0, 4000);

    const { mindmap, usage } = await generateMindmapWithAI(
      thread.title,
      transcript,
      [],
      [],
      [],
      model,
      systemPrompt,
      "id"
    );
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { mindmapJson: mindmap as unknown as object, techStack: normalizeTechStack([]) },
    });
    await recordAiUsage(userId, "mindmap", usage);
  } catch {
    // Mindmap opsional — jangan gagalkan apply bila AI mindmap bermasalah.
  }

  return NextResponse.json({ workspaceId, created });
}
