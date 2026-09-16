import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recommendTechStackWithAI } from "@/lib/ai";
import { recordAiUsage } from "@/lib/ai-usage";
import { NextResponse } from "next/server";

/**
 * Rekomendasi tech stack otomatis (mode "biarkan AI memilih").
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { title, description, locale } = await req.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "Judul wajib diisi" }, { status: 400 });
  }

  const aiConfig = await prisma.aiConfig.findFirst();
  const model = aiConfig?.mindmapModel || "OpenCodeCombo";
  const systemPrompt = aiConfig?.systemPrompt || undefined;

  const { tech, usage } = await recommendTechStackWithAI(
    title,
    description || "",
    model,
    systemPrompt,
    locale === "en" ? "en" : "id"
  );

  await recordAiUsage(userId, "techstack", usage);

  return NextResponse.json(tech);
}
