import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPaid } from "@/lib/access";
import { guardFeature } from "@/lib/feature-guard";
import { generatePrdFromChat } from "@/lib/ai";
import { recordAiUsage } from "@/lib/ai-usage";

interface SessionUser {
  id: string;
}

/**
 * POST /api/consult/threads/[id]/to-project
 *
 * Fase 5 — chat sebagai pintu ide: susun PRD dari riwayat percakapan,
 * buat workspace baru dengan PRD itu, dan kembalikan id-nya agar UI bisa
 * loncat ke wizard (step mindmap → PRD → task → style).
 *
 * Body: { title?: string }
 * Balasan: { id: workspaceId, messageCount }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const thread = await prisma.consultThread.findFirst({
    where: { id, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true },
      },
    },
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread tidak ditemukan" }, { status: 404 });
  }

  const history = thread.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));

  if (history.length === 0) {
    return NextResponse.json(
      { error: "Percakapan masih kosong — ajukan dulu kebutuhan Anda ke AI." },
      { status: 400 }
    );
  }

  const { title } = await req.json().catch(() => ({}));
  const finalTitle =
    typeof title === "string" && title.trim()
      ? title.trim().slice(0, 120)
      : thread.title
        ? thread.title.slice(0, 120)
        : "Project dari konsultasi";

  // Paywall Free: 1 draft — sama seperti jalur wizard normal.
  if (!isPaid(subscription)) {
    const existingCount = await prisma.workspace.count({
      where: { userId },
    });
    if (existingCount >= 1) {
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

  const aiConfig = await prisma.aiConfig.findFirst();
  // Locale output PRD mengikuti workspace yang ditautkan (bila ada).
  let currentLocale = "id";
  if (thread.workspaceId) {
    const linked = await prisma.workspace.findUnique({
      where: { id: thread.workspaceId },
      select: { locale: true },
    });
    if (linked?.locale === "en") currentLocale = "en";
  }
  const { prd, usage } = await generatePrdFromChat(history, {
    model: aiConfig?.prdModel || "OpenCodeCombo",
    systemPrompt: aiConfig?.systemPrompt || undefined,
    // Bahasa output mengikuti workspace yang sudah ditautkan (bila ada);
    // bila belum, default "id".
    locale: thread.workspaceId ? (currentLocale === "en" ? "en" : "id") : "id",
  });

  if (!prd) {
    return NextResponse.json(
      { error: "Gagal menyusun PRD dari percakapan. Coba lagi." },
      { status: 502 }
    );
  }

  await recordAiUsage(userId, "consult", usage);

  const workspace = await prisma.workspace.create({
    data: {
      userId,
      title: finalTitle,
      // Simpan jejak sumber agar bisa diaudit ("dari thread konsultasi mana").
      description: `Dibuat dari Konsultasi AI (thread ${thread.id}).`,
      locale: thread.workspaceId ? (currentLocale === "en" ? "en" : "id") : "id",
      techStack: [],
      mindmapJson: { nodes: [], edges: [] },
      fullPrdMd: prd,
    },
    select: { id: true },
  });

  // Tautkan thread ke workspace agar percakapan tetap nyambung.
  await prisma.consultThread
    .update({ where: { id: thread.id }, data: { workspaceId: workspace.id } })
    .catch(() => {});

  return NextResponse.json({ id: workspace.id, messageCount: history.length });
}
