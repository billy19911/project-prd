import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canSaveThemes } from "@/lib/access";
import { sanitizeThemeTokens } from "@/lib/theme";

interface SessionUser {
  id: string;
}

/**
 * Library tema lintas-project — fitur ENTERPRISE.
 *
 * Berbeda dari `Workspace.themeTokensJson` (tema untuk satu project), tema di
 * sini dapat diterapkan ulang ke project mana pun milik pengguna.
 *
 * Gate:
 *   401 - belum login
 *   402 - bukan ENTERPRISE
 */

const MAX_NAME = 60;
const MAX_THEMES = 50;

function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (!name || name.length > MAX_NAME) return null;
  return name;
}

/** GET: daftar tema tersimpan milik pengguna. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as SessionUser).id;
  const subscription = await prisma.subscription.findUnique({ where: { userId } });

  if (!canSaveThemes(subscription)) {
    return NextResponse.json(
      { error: "Library tema tersimpan khusus paket ENTERPRISE." },
      { status: 402 }
    );
  }

  const themes = await prisma.savedTheme.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(themes);
}

/** POST: simpan tema. Nama sama akan memperbarui tema yang ada (upsert). */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as SessionUser).id;
  const subscription = await prisma.subscription.findUnique({ where: { userId } });

  if (!canSaveThemes(subscription)) {
    return NextResponse.json(
      { error: "Library tema tersimpan khusus paket ENTERPRISE." },
      { status: 402 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = cleanName(body?.name);
  if (!name) {
    return NextResponse.json(
      { error: `Nama tema wajib diisi (maks. ${MAX_NAME} karakter).` },
      { status: 400 }
    );
  }

  // Sanitasi sebelum simpan — nilai ini kelak disuntikkan ke dalam <style>.
  const tokens = sanitizeThemeTokens(body?.tokens);

  const count = await prisma.savedTheme.count({ where: { userId } });
  const existing = await prisma.savedTheme.findUnique({
    where: { userId_name: { userId, name } },
  });

  // Batasi jumlah tema agar tidak tumbuh tanpa batas. Memperbarui yang sudah
  // ada selalu diizinkan.
  if (!existing && count >= MAX_THEMES) {
    return NextResponse.json(
      { error: `Maksimal ${MAX_THEMES} tema tersimpan. Hapus beberapa terlebih dahulu.` },
      { status: 400 }
    );
  }

  const saved = await prisma.savedTheme.upsert({
    where: { userId_name: { userId, name } },
    update: { tokens },
    create: { userId, name, tokens },
  });

  return NextResponse.json(saved);
}

/** DELETE: hapus tema berdasarkan id (atau `name`). */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as SessionUser).id;
  const subscription = await prisma.subscription.findUnique({ where: { userId } });

  if (!canSaveThemes(subscription)) {
    return NextResponse.json(
      { error: "Library tema tersimpan khusus paket ENTERPRISE." },
      { status: 402 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;
  const name = cleanName(body?.name);

  if (!id && !name) {
    return NextResponse.json({ error: "Sertakan id atau name." }, { status: 400 });
  }

  // Selalu batasi dengan userId agar tidak bisa menghapus milik orang lain.
  const deleted = await prisma.savedTheme.deleteMany({
    where: { userId, ...(id ? { id } : { name: name! }) },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Tema tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ success: true, deleted: deleted.count });
}
