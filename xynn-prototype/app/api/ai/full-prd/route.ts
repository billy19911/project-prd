import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePRDWithAI } from "@/lib/ai";
import { normalizeTechStack } from "@/lib/utils";
import { canGeneratePrd, isPaid } from "@/lib/access";
import { NextResponse } from "next/server";
import { recordAiUsage } from "@/lib/ai-usage";

interface SessionUser {
  id: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const { id } = await req.json();

  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
  });

  // Paywall: Full PRD terkunci untuk Free (PRD §3.4). Wajib paket berbayar.
  if (!isPaid(subscription)) {
    return NextResponse.json(
      { error: "Generate Full PRD terkunci. Upgrade ke STARTER/PRO untuk melanjutkan." },
      { status: 402 }
    );
  }

  // Kuota per paket (Starter 5/bln, Pro unlimited).
  if (!canGeneratePrd(subscription)) {
    return NextResponse.json(
      { error: "Kuota PRD bulan ini habis. Upgrade untuk generate lebih banyak." },
      { status: 402 }
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id, userId: user.id },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace tidak ditemukan" }, { status: 404 });
  }

  // Get AI config from DB
  const aiConfig = await prisma.aiConfig.findFirst();
  const prdModel = aiConfig?.prdModel || "OpenCodeCombo";
  const systemPrompt = aiConfig?.systemPrompt || undefined;

  const { prd, usage } = await generatePRDWithAI(
    workspace.title,
    workspace.description || "",
    normalizeTechStack(workspace.techStack),
    workspace.mindmapJson,
    prdModel,
    systemPrompt,
    (workspace.locale as "id" | "en") || "id"
  );

  await prisma.workspace.update({
    where: { id, userId: user.id },
    data: { fullPrdMd: prd },
  });

  await prisma.subscription.update({
    where: { userId: user.id },
    data: { prdUsedThisMonth: { increment: 1 } },
  });

  // Pakai recordAiUsage agar `usage` yang null (saat AI gagal) tidak
  // menyebabkan crash saat mengakses usage.model.
  await recordAiUsage(user.id, "prd", usage);

  return NextResponse.json({ prd });
}
