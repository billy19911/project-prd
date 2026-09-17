import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPaid } from "@/lib/access";
import { generateConsultReplyWithAI, deriveConsultTitle } from "@/lib/ai";
import { recordAiUsage } from "@/lib/ai-usage";
import { guardFeature } from "@/lib/feature-guard";

interface SessionUser {
  id: string;
}

/** Batas panjang satu pesan pengguna. */
const MAX_MESSAGE = 4000;

/**
 * Kirim pesan ke Konsultasi AI dan dapatkan balasan.
 *
 * Body: { threadId: string, message: string }
 * Balasan: { reply } — pesan pengguna & balasan disimpan ke riwayat.
 */
export async function POST(req: Request) {
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

  const body = await req.json().catch(() => ({}));
  const threadId = typeof body?.threadId === "string" ? body.threadId : null;
  const rawMessage = typeof body?.message === "string" ? body.message.trim() : "";

  if (!threadId) return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
  if (!rawMessage) return NextResponse.json({ error: "Pesan kosong" }, { status: 400 });
  if (rawMessage.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `Pesan terlalu panjang (maks ${MAX_MESSAGE} karakter).` },
      { status: 400 }
    );
  }

  // Pastikan thread milik pengguna + ambil konteks project sekaligus.
  const thread = await prisma.consultThread.findFirst({
    where: { id: threadId, userId },
    include: {
      workspace: {
        select: { id: true, title: true, fullPrdMd: true, styleGuideMd: true },
      },
      messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } },
    },
  });
  if (!thread) {
    return NextResponse.json({ error: "Thread tidak ditemukan" }, { status: 404 });
  }

  // Simpan pesan pengguna lebih dulu — supaya tidak hilang bila AI gagal.
  await prisma.consultMessage.create({
    data: { threadId, role: "user", content: rawMessage },
  });

  const history = [
    ...thread.messages.map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: rawMessage },
  ];

  const projectContext = thread.workspace
    ? [
        `Project: ${thread.workspace.title}`,
        thread.workspace.fullPrdMd
          ? `PRD excerpt:\n${thread.workspace.fullPrdMd.slice(0, 2500)}`
          : "",
        thread.workspace.styleGuideMd
          ? `Style Guide excerpt:\n${thread.workspace.styleGuideMd.slice(0, 1500)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n")
    : null;

  const aiConfig = await prisma.aiConfig.findFirst();
  const model = aiConfig?.prdModel || "OpenCodeCombo";
  const systemPrompt = aiConfig?.systemPrompt || undefined;

  const { reply, usage } = await generateConsultReplyWithAI(history, {
    projectContext,
    model,
    systemPrompt,
    locale: "id",
  });

  if (!reply) {
    return NextResponse.json(
      { error: "Gagal mendapat balasan. Coba lagi." },
      { status: 502 }
    );
  }

  await prisma.consultMessage.create({
    data: { threadId, role: "assistant", content: reply },
  });

  // Perbarui judul thread dari pesan pertama, dan waktu update.
  const messageCount = await prisma.consultMessage.count({ where: { threadId } });
  await prisma.consultThread.update({
    where: { id: threadId },
    data: {
      updatedAt: new Date(),
      ...(messageCount <= 2 ? { title: deriveConsultTitle(rawMessage) } : {}),
    },
  });

  await recordAiUsage(userId, "consult", usage);

  return NextResponse.json({ reply });
}
