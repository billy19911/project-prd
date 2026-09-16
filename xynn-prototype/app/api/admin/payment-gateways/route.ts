import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret, isEncrypted } from "@/lib/crypto";
import { withDbRetry } from "@/lib/db";

function isAdmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "ADMIN";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const gateways = await withDbRetry(() => prisma.paymentConfig.findMany());

    // Jangan pernah kirim serverKey (terenkripsi) ke client (PRD §8).
    return NextResponse.json(
      gateways.map(({ serverKeyEncrypted, webhookSecret, ...rest }) => ({
        ...rest,
        hasServerKey: Boolean(serverKeyEncrypted),
        hasWebhookSecret: Boolean(webhookSecret),
      }))
    );
  } catch (error) {
    const code = (error as { code?: string })?.code ?? "unknown";
    console.warn(`[admin/payment-gateways] DB unavailable (${code}); returning empty list.`);
    return NextResponse.json([]);
  }
}

interface UpsertPayload {
  id?: string;
  provider?: string;
  isActive?: boolean;
  isProduction?: boolean;
  merchantId?: string;
  clientKey?: string;
  serverKey?: string;
  webhookSecret?: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: UpsertPayload = await req.json();

  // Mode toggle-only (aktif/nonaktif gateway yang sudah ada).
  if (body.id && body.serverKey === undefined && body.clientKey === undefined) {
    const updated = await prisma.paymentConfig.update({
      where: { id: body.id },
      data: { isActive: body.isActive },
    });
    return NextResponse.json({
      id: updated.id,
      provider: updated.provider,
      isActive: updated.isActive,
    });
  }

  if (!body.provider || !body.clientKey) {
    return NextResponse.json(
      { error: "provider dan clientKey wajib diisi" },
      { status: 400 }
    );
  }

  // serverKey dienkripsi AES-256-GCM sebelum masuk DB (PRD §8).
  const serverKeyEncrypted = body.serverKey
    ? encryptSecret(body.serverKey)
    : undefined;

  const data = {
    provider: body.provider,
    isActive: body.isActive ?? false,
    isProduction: body.isProduction ?? false,
    merchantId: body.merchantId ?? null,
    clientKey: body.clientKey,
    ...(serverKeyEncrypted ? { serverKeyEncrypted } : {}),
    ...(body.webhookSecret !== undefined
      ? { webhookSecret: body.webhookSecret }
      : {}),
  };

  const saved = body.id
    ? await prisma.paymentConfig.update({ where: { id: body.id }, data })
    : await prisma.paymentConfig.create({ data: { ...data, serverKeyEncrypted: serverKeyEncrypted ?? "" } });

  return NextResponse.json({
    id: saved.id,
    provider: saved.provider,
    isActive: saved.isActive,
    hasServerKey: isEncrypted(saved.serverKeyEncrypted),
  });
}
