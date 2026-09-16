import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchAvailableModels } from "@/lib/ai";
import { withDbRetry } from "@/lib/db";

function isAdmin(session: { user?: { role?: string } }) {
  return session?.user?.role === "ADMIN";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Fetch models dari 9router endpoint
  const availableModels = await fetchAvailableModels();

  try {
    let config = await withDbRetry(() => prisma.aiConfig.findFirst());
    if (!config) {
      const defaultModel =
        process.env.AI_MODELS?.split(",")[0]?.trim() ||
        availableModels[0]?.id ||
        "OpenCodeCombo";
      config = await withDbRetry(() =>
        prisma.aiConfig.create({
          data: {
            mindmapModel: defaultModel,
            prdModel: defaultModel,
            systemPrompt: "You are an expert product architect.",
          },
        })
      );
    }
    return NextResponse.json({ config, availableModels });
  } catch (error) {
    const code = (error as { code?: string })?.code ?? "unknown";
    console.warn(`[admin/ai-config] DB unavailable (${code}); returning defaults.`);
    return NextResponse.json({
      config: {
        mindmapModel: availableModels[0]?.id || "OpenCodeCombo",
        prdModel: availableModels[0]?.id || "OpenCodeCombo",
        systemPrompt: "You are an expert product architect.",
      },
      availableModels,
    });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { mindmapModel, prdModel, systemPrompt } = await req.json();

  try {
    const existing = await withDbRetry(() => prisma.aiConfig.findFirst());
    const config = existing
      ? await withDbRetry(() =>
          prisma.aiConfig.update({
            where: { id: existing.id },
            data: { mindmapModel, prdModel, systemPrompt },
          })
        )
      : await withDbRetry(() =>
          prisma.aiConfig.create({
            data: { mindmapModel, prdModel, systemPrompt },
          })
        );
    return NextResponse.json(config);
  } catch (error) {
    const code = (error as { code?: string })?.code ?? "unknown";
    console.warn(`[admin/ai-config] DB unavailable (${code}).`);
    return NextResponse.json({ error: "Database tidak tersedia, coba lagi." }, { status: 503 });
  }
}