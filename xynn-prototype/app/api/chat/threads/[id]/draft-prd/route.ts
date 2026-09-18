import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUsePrototype } from "@/lib/access";
import { guardFeature } from "@/lib/feature-guard";
import { generatePrdFromChat } from "@/lib/ai";
import { recordAiUsage } from "@/lib/ai-usage";

interface SessionUser {
  id: string;
}

/**
 * Simpulkan DRAF PRD dari transkrip Chat Prototype.
 *
 * TIDAK menyimpan ke workspace — hanya mengembalikan teks PRD agar user bisa
 * review/edit dulu, lalu menekan "Terapkan" (endpoint `apply`) untuk menyimpan.
 */
export async function POST(
  _req: Request,
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

  const history = thread.messages.map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    content: m.content,
  }));
  if (history.length === 0) {
    return NextResponse.json(
      { error: "Belum ada percakapan untuk disimpulkan." },
      { status: 400 }
    );
  }

  const aiConfig = await prisma.aiConfig.findFirst();
  const model = aiConfig?.prdModel || "OpenCodeCombo";
  const systemPrompt = aiConfig?.systemPrompt || undefined;

  const { prd, usage } = await generatePrdFromChat(history, {
    model,
    systemPrompt,
    locale: "id",
  });

  if (!prd) {
    return NextResponse.json(
      { error: "Gagal menyusun PRD. Coba lagi." },
      { status: 502 }
    );
  }

  await recordAiUsage(userId, "prd", usage);

  return NextResponse.json({ prd });
}
