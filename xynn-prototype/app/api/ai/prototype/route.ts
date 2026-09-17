import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generatePrototypeWithAI,
  regenerateSingleScreenWithAI,
  extractScreens,
  hasScreenMarkers,
} from "@/lib/ai";
import type { PrototypeResult } from "@/lib/ai";
import { recordAiUsage } from "@/lib/ai-usage";
import {
  canGeneratePrototype,
  canUsePrototype,
  getAccessTier,
} from "@/lib/access";
import { NextResponse } from "next/server";
import { normalizeTechStack } from "@/lib/utils";
import { sanitizeThemeTokens } from "@/lib/theme";
import { getWorkspaceAccess } from "@/lib/workspace-access";

/** Jumlah versi prototype yang disimpan per workspace. */
const MAX_VERSIONS = 10;

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
  const body = await req.json().catch(() => ({}));
  const { id, screenLabel } = body as { id?: string; screenLabel?: string };

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

  const access = await getWorkspaceAccess(id, userId);
  if (!access.canView) {
    return NextResponse.json({ error: "Workspace tidak ditemukan" }, { status: 404 });
  }
  if (!access.canEdit) {
    return NextResponse.json(
      { error: "Anda hanya punya akses lihat pada workspace ini." },
      { status: 403 }
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: {
      title: true,
      fullPrdMd: true,
      styleGuideMd: true,
      techStack: true,
      locale: true,
      // Tema tersimpan ikut dibaca agar regenerate TIDAK mengembalikan
      // warna/font ke default dan menghapus penyesuaian pengguna.
      themeTokensJson: true,
      // Diperlukan untuk mode regenerate satu screen & riwayat versi.
      prototypeHtml: true,
      prototypeJson: true,
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
  const theme = workspace.themeTokensJson
    ? sanitizeThemeTokens(workspace.themeTokensJson)
    : null;
  const locale = (workspace.locale as "id" | "en") || "id";

  const existingScreens = extractScreens(workspace.prototypeHtml ?? "");
  const wantsSingle =
    typeof screenLabel === "string" &&
    screenLabel.trim() !== "" &&
    !!workspace.prototypeHtml;

  // Mode per-screen butuh penanda `<!-- screen: -->` agar penggabungan aman.
  // Bila tidak ada, beri tahu pengguna dengan jelas daripada gagal diam-diam.
  if (wantsSingle && !hasScreenMarkers(workspace.prototypeHtml ?? "")) {
    return NextResponse.json(
      {
        error:
          "Prototype ini belum punya penanda screen, jadi regenerate per-screen belum bisa. Gunakan Regenerate penuh sekali untuk menambahkannya.",
      },
      { status: 409 }
    );
  }

  let result: PrototypeResult;

  if (wantsSingle) {
    // Mode hemat: regenerate SATU screen saja.
    const idx = Math.max(
      0,
      existingScreens.findIndex(
        (s) => s.label.toLowerCase() === screenLabel!.trim().toLowerCase()
      )
    );
    result = await regenerateSingleScreenWithAI(
      workspace.title,
      screenLabel!.trim(),
      idx,
      Math.max(1, existingScreens.length),
      workspace.prototypeHtml!,
      model,
      systemPrompt,
      locale,
      theme
    );
  } else {
    // Mode penuh: borong semua screen.
    result = await generatePrototypeWithAI(
      workspace.title,
      workspace.fullPrdMd,
      workspace.styleGuideMd,
      normalizeTechStack(workspace.techStack),
      model,
      systemPrompt,
      locale,
      theme
    );
  }

  const { html, screens, usage } = result;

  // Simpan versi LAMA ke riwayat sebelum ditimpa, supaya regenerate tidak
  // menghapus pekerjaan pengguna secara permanen.
  if (workspace.prototypeHtml && workspace.prototypeHtml !== html) {
    await prisma.prototypeVersion.create({
      data: {
        workspaceId: id,
        html: workspace.prototypeHtml,
        screens: workspace.prototypeJson ?? undefined,
        note: wantsSingle
          ? `Sebelum regenerate screen "${screenLabel}"`
          : "Sebelum regenerate penuh",
      },
    });

    // Pangkas riwayat agar tidak tumbuh tanpa batas (sisakan 10 terbaru).
    const oldVersions = await prisma.prototypeVersion.findMany({
      where: { workspaceId: id },
      orderBy: { createdAt: "desc" },
      skip: MAX_VERSIONS,
      select: { id: true },
    });
    if (oldVersions.length > 0) {
      await prisma.prototypeVersion.deleteMany({
        where: { id: { in: oldVersions.map((v) => v.id) } },
      });
    }
  }

  await prisma.workspace.update({
    where: { id },
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
