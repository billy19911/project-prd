import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePlanQuota } from "@/lib/plans";
import { computeValidUntil } from "@/lib/billing";
import crypto from "crypto";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-payment-signature") || "";

  const gateway = await prisma.paymentConfig.findFirst({
    where: { isActive: true },
  });

  if (!gateway?.webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not set" }, { status: 500 });
  }

  const expected = crypto
    .createHmac("sha256", gateway.webhookSecret)
    .update(body)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);
  const { transactionId, status } = payload;

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (transaction.status === "SUCCESS") {
    return NextResponse.json({ message: "Already processed" });
  }

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: status === "SUCCESS" ? "SUCCESS" : "FAILED" },
  });

  if (status === "SUCCESS") {
    const now = new Date();
    // Masa aktif berbasis kalender + kuota dari Plan di DB — sama seperti
    // jalur checkout/confirm, agar webhook tidak menghasilkan langganan yang
    // kuotanya berbeda atau masa aktifnya meleset.
    const validUntil = computeValidUntil(now, transaction.billingCycle);
    const { planType, prdLimit, prototypeLimit } = await resolvePlanQuota(
      transaction.planType
    );

    await prisma.subscription.upsert({
      where: { userId: transaction.userId },
      create: {
        userId: transaction.userId,
        planType,
        status: "ACTIVE",
        billingCycle: transaction.billingCycle,
        prdLimit,
        prototypeLimit,
        chatLimit: 0,
        startedAt: now,
        validUntil,
      },
      update: {
        planType,
        status: "ACTIVE",
        billingCycle: transaction.billingCycle,
        prdLimit,
        prototypeLimit,
        prdUsedThisMonth: 0,
        startedAt: now,
        validUntil,
      },
    });
  }

  return NextResponse.json({ success: true });
}