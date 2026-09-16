import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request) {
  const { apiKey } = await req.json();
  if (!apiKey?.startsWith("xynn_live_")) {
    return NextResponse.json({ error: "Invalid API key format" }, { status: 400 });
  }

  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");

  const apiKeyRecord = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    include: { user: true },
  });

  if (!apiKeyRecord) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  // Update lastUsedAt
  await prisma.apiKey.update({
    where: { id: apiKeyRecord.id },
    data: { lastUsedAt: new Date() },
  });

  return NextResponse.json({
    userId: apiKeyRecord.userId,
    user: {
      id: apiKeyRecord.user.id,
      email: apiKeyRecord.user.email,
      name: apiKeyRecord.user.name,
      avatarUrl: apiKeyRecord.user.avatarUrl,
    },
  });
}
