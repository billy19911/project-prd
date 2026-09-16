import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const users = await withDbRetry(() =>
      prisma.user.findMany({
        include: { subscription: true },
        orderBy: { createdAt: "desc" },
      })
    );
    return NextResponse.json(users);
  } catch (error) {
    const code = (error as { code?: string })?.code ?? "unknown";
    console.warn(`[admin/users] DB unavailable (${code}); returning empty list.`);
    return NextResponse.json([]);
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ message: "Use specific endpoint to change user role." });
}
