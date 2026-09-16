import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { chatCompletion } from "@/lib/ai";

function isAdmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "ADMIN";
}

/**
 * Live System Prompt Sandbox (PRD §7B).
 * Menguji systemPrompt + model tanpa menyimpan / re-deploy.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { prompt, systemPrompt, model } = await req.json();

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Test prompt wajib diisi" }, { status: 400 });
  }

  try {
    const result = await chatCompletion(
      model || "OpenCodeCombo",
      systemPrompt || "",
      prompt
    );

    return NextResponse.json({
      text: result.content,
      usage: {
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal menjalankan sandbox" },
      { status: 500 }
    );
  }
}
