import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const keys = await prisma.apiKey.findMany({
    where: { userId },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(keys);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { name } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Nama token wajib diisi" }, { status: 400 });
  }

  // Generate plain live key: xynn_live_...
  const rawKey = `xynn_live_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const created = await prisma.apiKey.create({
    data: {
      userId,
      name: name.trim(),
      keyHash,
    },
  });

  // rawKey hanya dikembalikan sekali ini ke client
  return NextResponse.json({
    id: created.id,
    name: created.name,
    rawKey,
    createdAt: created.createdAt,
  });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { id } = await req.json();

  await prisma.apiKey.deleteMany({
    where: { id, userId },
  });

  return NextResponse.json({ success: true });
}
