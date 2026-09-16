import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { name } = await req.json();

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { name: name?.trim() || undefined },
    select: { id: true, email: true, name: true, avatarUrl: true },
  });

  return NextResponse.json(updated);
}
