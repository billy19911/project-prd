import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUsePrototype } from "@/lib/access";
import { generateChatReplyStream } from "@/lib/ai";
import { deriveThreadTitle } from "@/lib/ai";
import { guardFeature } from "@/lib/feature-guard";

interface SessionUser {
  id: string;
}

const MAX_MESSAGE = 4000;

/**
 * Chat Prototype — versi STREAMING (Server-Sent Events).
 *
 * Mengirim delta teks saat AI menulisnya (event `data: {"delta":"..."}`),
 * lalu event `data: {"done":true}` di akhir. Pesan user & balasan tetap
 * disimpan ke DB seperti endpoint non-stream.
 *
 * Format SSE dipilih agar kompatibel lebar & mudah dibaca klien.
 */
export async function POST(req: Request) {
  const blocked = await guardFeature("chat");
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const userId = (session.user as SessionUser).id;
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!canUsePrototype(subscription)) {
    return new Response(
      JSON.stringify({ error: "Chat Prototype tersedia untuk paket PRO ke atas." }),
      { status: 402 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const threadId = typeof body?.threadId === "string" ? body.threadId : null;
  const rawMessage = typeof body?.message === "string" ? body.message.trim() : "";

  if (!threadId) return new Response(JSON.stringify({ error: "Missing threadId" }), { status: 400 });
  if (!rawMessage) return new Response(JSON.stringify({ error: "Pesan kosong" }), { status: 400 });
  if (rawMessage.length > MAX_MESSAGE) {
    return new Response(
      JSON.stringify({ error: `Pesan terlalu panjang (maks ${MAX_MESSAGE} karakter).` }),
      { status: 400 }
    );
  }

  const thread = await prisma.chatThread.findFirst({
    where: { id: threadId, userId },
    include: {
      workspace: {
        select: { id: true, title: true, fullPrdMd: true, styleGuideMd: true, prototypeHtml: true },
      },
      messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } },
    },
  });
  if (!thread) {
    return new Response(JSON.stringify({ error: "Thread tidak ditemukan" }), { status: 404 });
  }

  // Simpan pesan user lebih dulu — supaya tidak hilang bila AI gagal.
  await prisma.chatMessage.create({ data: { threadId, role: "user", content: rawMessage } });

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
        thread.workspace.fullPrdMd ? `PRD excerpt:\n${thread.workspace.fullPrdMd.slice(0, 2500)}` : "",
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      let full = "";
      try {
        for await (const delta of generateChatReplyStream(history, {
          projectContext,
          hasPrototype: !!thread.workspace?.prototypeHtml,
          hasProject: !!thread.workspaceId,
          model,
          systemPrompt,
          locale: "id",
        })) {
          full += delta;
          send({ delta });
        }
      } catch (e) {
        send({ error: (e as Error).message || "Gagal streaming" });
      }

      const reply = full.replace(/^\s*Assistant:\s*/i, "").trim();
      if (reply) {
        try {
          await prisma.chatMessage.create({
            data: { threadId, role: "assistant", content: reply },
          });
          const count = await prisma.chatMessage.count({ where: { threadId } });
          await prisma.chatThread.update({
            where: { id: threadId },
            data: {
              updatedAt: new Date(),
              ...(count <= 2 ? { title: deriveThreadTitle(rawMessage) } : {}),
            },
          });
        } catch {
          /* simpan gagal: biarkan, user tetap melihat teksnya */
        }
      }

      send({ done: true, reply });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
