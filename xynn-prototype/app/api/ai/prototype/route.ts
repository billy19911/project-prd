import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePrototypeWithAI } from "@/lib/ai";
import { recordAiUsage } from "@/lib/ai-usage";
import {
  canGeneratePrototype,
  canUsePrototype,
  getAccessTier,
} from "@/lib/access";
import { NextResponse } from "next/server";
import { normalizeTechStack } from "@/lib/utils";

/**
 * Generate Prototype Design (HTML) dari PRD + Style Guide. Khusus PRO ke atas.
 *
 * Gate berlapis, sengaja dibedakan agar UI bisa memberi pesan tepat:
 *   401 - belum login
 *   402 - paket tidak mendukung (bukan PRO/Enterprise)
 *   429 - kuota bulan ini habis
 *   400 - prasyarat data belum ada (PRD / Style Guide)
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { id } = await req.json();

  if (!id) return NextResponse.json({ error: "Missing workspace id" }, { status: 400 });

  const subscription = await prisma.subscription.findUnique({ where: { userId } });

  // 402: paket tidak mendukung fitur ini sama sekali.
  if (!canUsePrototype(subscription)) {
    return NextResponse.json(
      { error: "Prototype Design tersedia untuk paket PRO ke atas. Upgrade untuk melanjutkan." },
      { status: 402 }
    );
  }

  // 429: paket mendukung, tetapi kuota bulan ini habis.
  if (!canGeneratePrototype(subscription)) {
    return NextResponse.json(
      {
        error:
          "Kuota generate Prototype bulan ini habis. Upgrade paket atau tunggu bulan berikutnya.",
      },
      { status: 429 }
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id, userId },
    select: {
      title: true,
      fullPrdMd: true,
      styleGuideMd: true,
      techStack: true,
      locale: true,
    },
  });

  if (!workspace) return NextResponse.json({ error: "Workspace tidak ditemukan" }, { status: 404 });

  // Prasyarat: prototype dibangun dari PRD + Style Guide.
  if (!workspace.fullPrdMd) {
    return NextResponse.json({ error: "Generate PRD terlebih dahulu" }, { status: 400 });
  }
  if (!workspace.styleGuideMd) {
    return NextResponse.json(
      { error: "Generate Style Guide terlebih dahulu" },
      { status: 400 }
    );
  }

  const aiConfig = await prisma.aiConfig.findFirst();
  // Ikut model PRD yang ada (keputusan: satu model, bisa diubah dari /admin/ai-config).
  const model = aiConfig?.prdModel || "OpenCodeCombo";
  const systemPrompt = aiConfig?.systemPrompt || undefined;

  const { html, screens, usage } = await generatePrototypeWithAI(
    workspace.title,
    workspace.fullPrdMd,
    workspace.styleGuideMd,
    normalizeTechStack(workspace.techStack),
    model,
    systemPrompt,
    (workspace.locale as "id" | "en") || "id"
  );

  await prisma.workspace.update({
    where: { id, userId },
    data: {
      prototypeHtml: html,
      prototypeJson: { screens, generatedAt: new Date().toISOString() },
    },
  });

  // Naikkan pemakaian hanya bila benar-benar menghasilkan prototype.
  await prisma.subscription.update({
    where: { userId },
    data: { prototypeUsedThisMonth: { increment: 1 } },
  });

  await recordAiUsage(userId, "prototype", usage);

  return NextResponse.json({
    prototypeHtml: html,
    screens,
    tier: getAccessTier(subscription),
  });
}
