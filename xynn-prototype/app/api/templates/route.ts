import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPaid } from "@/lib/access";

interface SessionUser {
  id: string;
}

/**
 * Template PRD siap pakai — fitur berbayar (STARTER ke atas).
 *
 * GET: daftar template aktif untuk galeri `/templates`.
 * Endpoint tidak mengembalikan `idea` mentah demi payload ringan? Tidak —
 * `idea` memang dibutuhkan wizard, tapi wizard memanggilnya lewat
 * `?slug=` saat dipilih. Untuk daftar, kita kembalikan ringkas.
 *
 * `?slug=<slug>` mengembalikan SATU template lengkap (termasuk `idea`)
 * untuk prefill wizard.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as SessionUser).id;

  // Paywall: template eksklusif untuk pelanggan berbayar.
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!isPaid(subscription)) {
    return NextResponse.json(
      { error: "Template tersedia untuk paket berbayar. Upgrade untuk melanjutkan." },
      { status: 402 }
    );
  }

  const slug = new URL(req.url).searchParams.get("slug");

  // Satu template lengkap (untuk prefill wizard).
  if (slug) {
    const tpl = await prisma.template.findFirst({
      where: { slug, isActive: true },
      select: {
        slug: true,
        title: true,
        description: true,
        category: true,
        icon: true,
        idea: true,
        techStack: true,
        locale: true,
      },
    });
    if (!tpl) {
      return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(tpl);
  }

  // Daftar ringkas untuk galeri (tanpa `idea` yang panjang).
  const templates = await prisma.template.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      slug: true,
      title: true,
      description: true,
      category: true,
      icon: true,
      techStack: true,
    },
  });

  return NextResponse.json(templates);
}
