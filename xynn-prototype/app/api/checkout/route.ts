import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret, isEncrypted } from "@/lib/crypto";
import { basePrice, computePrice, mapCodeToPlanType } from "@/lib/plans";
import { buildInstruction, type PaymentMethodId } from "@/lib/payments";
import { NextResponse } from "next/server";
import type { BillingCycle } from "@prisma/client";

interface SessionUser {
  id: string;
}

interface CheckoutRequest {
  planCode: string; // 'STARTER' | 'PRO'
  billingCycle: BillingCycle;
  voucherCode?: string;
  method?: PaymentMethodId;
}

/**
 * Ambil server key gateway dari DB (terenkripsi AES-256-GCM) dan dekripsi.
 * Fallback ke environment variable bila belum dikonfigurasi di DB.
 */
async function resolveServerKey(provider: string): Promise<string | null> {
  const config = await prisma.paymentConfig.findFirst({
    where: { provider, isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  if (config?.serverKeyEncrypted && isEncrypted(config.serverKeyEncrypted)) {
    try {
      return decryptSecret(config.serverKeyEncrypted);
    } catch {
      // jatuh ke env fallback di bawah
    }
  }

  return provider === "midtrans"
    ? process.env.MIDTRANS_SERVER_KEY ?? null
    : process.env.XENDIT_SECRET_KEY ?? null;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const { planCode, billingCycle = "MONTHLY", voucherCode, method }: CheckoutRequest =
    await req.json();

  if (!planCode || planCode === "FREE") {
    return NextResponse.json({ error: "Plan tidak valid" }, { status: 400 });
  }

  const plan = await prisma.plan.findUnique({ where: { code: planCode.toUpperCase() } });
  if (!plan || !plan.isActive) {
    return NextResponse.json({ error: "Plan tidak tersedia" }, { status: 400 });
  }

  const subtotal = basePrice(plan, billingCycle);

  // Voucher (opsional).
  let voucher: { discountPercent: number | null; discountAmount: number | null } | null = null;
  let appliedVoucher: string | null = null;
  if (voucherCode?.trim()) {
    const v = await prisma.voucher.findUnique({
      where: { code: voucherCode.trim().toUpperCase() },
    });
    if (!v) return NextResponse.json({ error: "Voucher tidak ditemukan" }, { status: 400 });
    if (v.validUntil && v.validUntil < new Date())
      return NextResponse.json({ error: "Voucher sudah kedaluwarsa" }, { status: 400 });
    if (v.usedCount >= v.maxUses)
      return NextResponse.json({ error: "Voucher sudah habis" }, { status: 400 });
    voucher = { discountPercent: v.discountPercent, discountAmount: v.discountAmount };
    appliedVoucher = v.code;
  }

  const pricing = computePrice({
    basePrice: subtotal,
    planDiscountPercent: plan.discountPercent,
    voucher: voucher ?? undefined,
  });

  const planType = mapCodeToPlanType(planCode.toUpperCase());

  const transaction = await prisma.transaction.create({
    data: {
      userId: user.id,
      amount: pricing.total,
      planType,
      billingCycle,
      status: "PENDING",
    },
  });

  if (appliedVoucher) {
    await prisma.voucher.update({
      where: { code: appliedVoucher },
      data: { usedCount: { increment: 1 } },
    });
  }

  const paymentMode = process.env.PAYMENT_MODE || "dummy";

  // --- Gateway (Midtrans/Xendit) bila dipilih & terkonfigurasi ---
  if (method === "gateway") {
    const provider = paymentMode === "xendit" ? "xendit" : "midtrans";
    const serverKey = await resolveServerKey(provider);

    if (serverKey) {
      const authString = Buffer.from(`${serverKey}:`).toString("base64");
      try {
        if (provider === "midtrans") {
          const res = await fetch("https://app.midtrans.com/snap/v1/transactions", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Basic ${authString}`,
            },
            body: JSON.stringify({
              transaction_details: { order_id: transaction.id, gross_amount: pricing.total },
              customer_details: {
                email: session.user?.email,
                first_name: session.user?.name,
              },
            }),
          });
          const data = (await res.json()) as { redirect_url?: string };
          if (data.redirect_url) {
            return NextResponse.json({
              transactionId: transaction.id,
              pricing,
              paymentUrl: data.redirect_url,
              mode: "gateway",
            });
          }
        } else {
          const res = await fetch("https://api.xendit.co/v2/invoices", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Basic ${authString}`,
            },
            body: JSON.stringify({
              external_id: transaction.id,
              amount: pricing.total,
              customer: { email: session.user?.email, given_names: session.user?.name },
            }),
          });
          const data = (await res.json()) as { invoice_url?: string };
          if (data.invoice_url) {
            return NextResponse.json({
              transactionId: transaction.id,
              pricing,
              paymentUrl: data.invoice_url,
              mode: "gateway",
            });
          }
        }
      } catch {
        // jatuh ke instruksi manual di bawah
      }
    }
  }

  // --- Pembayaran manual (VA/QRIS/E-wallet) → kembalikan instruksi ---
  const chosen = method && method !== "gateway" ? method : "qris";
  const instruction = buildInstruction(
    chosen,
    pricing.total,
    transaction.id.slice(0, 8).toUpperCase()
  );

  return NextResponse.json({
    transactionId: transaction.id,
    pricing,
    mode: "instruction",
    instruction,
    // Penanda bahwa pembayaran belum lunas.
    paid: false,
  });
}
