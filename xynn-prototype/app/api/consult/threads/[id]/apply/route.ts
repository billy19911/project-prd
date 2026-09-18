import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPaid, canUsePrototype, canGeneratePrototype, getAccessTier } from "@/lib/access";
import { guardFeature } from "@/lib/feature-guard";
import {
  regenerateSingleScreenWithAI,
  fixPrdSectionWithAI,
  extractScreens,
  hasScreenMarkers,
} from "@/lib/ai";
import { recordAiUsage } from "@/lib/ai-usage";
import { savePrdVersion } from "@/lib/prd-version";
import { sanitizeThemeTokens, themeFromStyleGuide } from "@/lib/theme";

interface SessionUser {
  id: string;
}

const MAX_VERSIONS = 10;

/**
 * Jalankan AKSI terarah dari Konsultasi AI ke project yang tertaut.
 *
 * Body: { kind: "regen-screen"|"fix-prd", target: string, reason?: string }
 *
 * - regen-screen → regenerate SATU screen prototype (butuh kuota prototype).
 * - fix-prd      → perbaiki SATU section PRD (simpan versi lama dulu).
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
    select: { id: true, workspaceId: true },
  });
  if (!thread) {
    return NextResponse.json({ error: "Konsultasi tidak ditemukan" }, { status: 404 });
  }
  if (!thread.workspaceId) {
    return NextResponse.json(
      { error: "Konsultasi ini belum tertaut ke project." },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    kind?: string;
    target?: string;
    reason?: string;
  };
  const kind = body.kind;
  const target = (body.target || "").trim();
  const reason = (body.reason || "").trim();

  if (!target) return NextResponse.json({ error: "target wajib diisi" }, { status: 400 });

  const workspaceId = thread.workspaceId;
  const aiConfig = await prisma.aiConfig.findFirst();
  const model = aiConfig?.prdModel || "OpenCodeCombo";
  const systemPrompt = aiConfig?.systemPrompt || undefined;

  if (kind === "fix-prd") {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { fullPrdMd: true },
    });
    if (!workspace?.fullPrdMd) {
      return NextResponse.json(
        { error: "Project ini belum punya PRD untuk diperbaiki." },
        { status: 400 }
      );
    }

    const { prd, usage } = await fixPrdSectionWithAI(
      workspace.fullPrdMd,
      target,
      reason,
      model,
      systemPrompt,
      "id"
    );
    if (!prd) {
      return NextResponse.json({ error: "Gagal memperbaiki PRD. Coba lagi." }, { status: 502 });
    }

    // Simpan versi lama dulu agar bisa dibatalkan.
    await savePrdVersion(workspaceId, workspace.fullPrdMd, `Sebelum perbaikan section "${target}"`);
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { fullPrdMd: prd },
    });
    await recordAiUsage(userId, "prd", usage);

    return NextResponse.json({
      kind: "fix-prd",
      workspaceId,
      message: `Section "${target}" diperbarui.`,
    });
  }

  if (kind === "regen-screen") {
    if (!canUsePrototype(subscription)) {
      return NextResponse.json(
        { error: "Prototype Design tersedia untuk paket PRO ke atas." },
        { status: 402 }
      );
    }
    if (!canGeneratePrototype(subscription)) {
      return NextResponse.json(
        { error: "Kuota generate Prototype bulan ini habis." },
        { status: 429 }
      );
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        title: true,
        fullPrdMd: true,
        styleGuideMd: true,
        techStack: true,
        locale: true,
        themeTokensJson: true,
        prototypeHtml: true,
        prototypeJson: true,
      },
    });
    if (!workspace?.prototypeHtml) {
      return NextResponse.json(
        { error: "Project ini belum punya prototype untuk di-regenerate." },
        { status: 400 }
      );
    }
    if (!hasScreenMarkers(workspace.prototypeHtml)) {
      return NextResponse.json(
        {
          error:
            "Prototype belum punya penanda screen. Regenerate penuh dulu dari tab Prototype.",
        },
        { status: 409 }
      );
    }

    const existingScreens = extractScreens(workspace.prototypeHtml);
    const idx = existingScreens.findIndex(
      (s) => s.label.toLowerCase() === target.toLowerCase()
    );
    if (idx < 0) {
      return NextResponse.json(
        { error: `Screen "${target}" tidak ditemukan di prototype saat ini.` },
        { status: 409 }
      );
    }

    const theme = workspace.themeTokensJson
      ? sanitizeThemeTokens(workspace.themeTokensJson)
      : themeFromStyleGuide(workspace.styleGuideMd || "");
    const locale = (workspace.locale as "id" | "en") || "id";

    const result = await regenerateSingleScreenWithAI(
      workspace.title,
      target,
      idx,
      Math.max(1, existingScreens.length),
      workspace.prototypeHtml,
      model,
      systemPrompt,
      locale,
      theme
    );

    const { html, screens, usage } = result;
    if (html && html !== workspace.prototypeHtml) {
      // Simpan versi lama sebelum ditimpa.
      await prisma.prototypeVersion.create({
        data: {
          workspaceId,
          html: workspace.prototypeHtml,
          screens: workspace.prototypeJson ?? undefined,
          note: `Sebelum regenerate screen "${target}" (dari Konsultasi)`,
        },
      });
      const old = await prisma.prototypeVersion.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        skip: MAX_VERSIONS,
        select: { id: true },
      });
      if (old.length) {
        await prisma.prototypeVersion.deleteMany({ where: { id: { in: old.map((v) => v.id) } } });
      }
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          prototypeHtml: html,
          prototypeJson: { screens, generatedAt: new Date().toISOString() },
        },
      });
      await prisma.subscription.update({
        where: { userId },
        data: { prototypeUsedThisMonth: { increment: 1 } },
      });
    }
    await recordAiUsage(userId, "prototype", usage);

    return NextResponse.json({
      kind: "regen-screen",
      workspaceId,
      message: `Screen "${target}" diperbarui.`,
      tier: getAccessTier(subscription),
    });
  }

  return NextResponse.json({ error: "kind tidak dikenal" }, { status: 400 });
}
