import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
    const days =
      transaction.billingCycle === "YEARLY"
        ? 365
        : transaction.billingCycle === "QUARTERLY"
          ? 90
          : 30;
    const validUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const prdLimit =
      transaction.planType === "PRO" || transaction.planType === "PRO_YEARLY" ? -1 : 5;

    await prisma.subscription.upsert({
      where: { userId: transaction.userId },
      create: {
        userId: transaction.userId,
        planType: transaction.planType,
        status: "ACTIVE",
        billingCycle: transaction.billingCycle,
        prdLimit,
        chatLimit: 0,
        startedAt: now,
        validUntil,
      },
      update: {
        planType: transaction.planType,
        status: "ACTIVE",
        billingCycle: transaction.billingCycle,
        prdLimit,
        prdUsedThisMonth: 0,
        startedAt: now,
        validUntil,
      },
    });
  }

  return NextResponse.json({ success: true });
}