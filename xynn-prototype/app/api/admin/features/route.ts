import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";
import {
  ensureFeatureFlagsSeeded,
  getFeatureStates,
} from "@/lib/feature-flags";
import { isFeatureKey } from "@/lib/feature-flags-core";

function isAdmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "ADMIN";
}

const VALID_STATUS = ["LIVE", "SOON", "HIDDEN"] as const;
type StatusValue = (typeof VALID_STATUS)[number];

function isStatus(v: unknown): v is StatusValue {
  return typeof v === "string" && (VALID_STATUS as readonly string[]).includes(v);
}

/** GET: daftar status semua fitur (di-seed otomatis bila kosong). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await withDbRetry(() => ensureFeatureFlagsSeeded());
    const states = await getFeatureStates();
    return NextResponse.json(Object.values(states));
  } catch (error) {
    const code = (error as { code?: string })?.code ?? "unknown";
    console.warn(`[admin/features] DB unavailable (${code}); memakai default.`);
    const states = await getFeatureStates();
    return NextResponse.json(Object.values(states));
  }
}

/** POST: ubah status satu fitur. Body: { key, status, label? }. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const key = typeof body?.key === "string" ? body.key : "";
  const status = body?.status;
  const label = typeof body?.label === "string" ? body.label : undefined;

  if (!isFeatureKey(key)) {
    return NextResponse.json({ error: "Fitur tidak dikenal." }, { status: 400 });
  }
  if (!isStatus(status)) {
    return NextResponse.json(
      { error: "Status harus LIVE, SOON, atau HIDDEN." },
      { status: 400 }
    );
  }

  const saved = await prisma.featureFlag.upsert({
    where: { key },
    update: { status, ...(label ? { label } : {}) },
    create: { key, status, label: label ?? key },
  });

  return NextResponse.json(saved);
}
