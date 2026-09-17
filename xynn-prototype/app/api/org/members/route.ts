import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canSaveThemes } from "@/lib/access";
import { seatUsage, hasEnterpriseViaOrg } from "@/lib/workspace-access";

interface SessionUser {
  id: string;
}

const ROLES = ["OWNER", "EDITOR", "VIEWER"] as const;
type Role = (typeof ROLES)[number];

/** Cek hak ENTERPRISE: sendiri ATAU lewat organisasi yang diikuti. */
async function canUseTeam(userId: string): Promise<boolean> {
  return hasEnterpriseViaOrg(userId, (sub) =>
    canSaveThemes(
      sub
        ? { planType: sub.planType, status: sub.status, validUntil: sub.validUntil }
        : null
    )
  );
}

function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

/**
 * Kelola anggota & undangan organisasi.
 *
 * Body:
 *   POST   { orgId, email, role }  -> undang anggota (pending bila belum ada)
 *   PATCH  { orgId, userId, role } -> ubah peran anggota
 *   DELETE { orgId, userId }       -> keluarkan anggota
 *
 * Hanya OWNER yang boleh. OWNER terakhir tidak boleh diturunkan/dihapus,
 * agar organisasi tidak kehilangan pemiliknya.
 */

async function requireOwner(orgId: string, userId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, ownerId: true },
  });
  if (!org) return { ok: false as const, status: 404, error: "Tim tidak ditemukan" };
  if (org.ownerId !== userId) {
    return { ok: false as const, status: 403, error: "Hanya pemilik tim yang dapat mengelola anggota." };
  }
  return { ok: true as const, org };
}

/** POST: undang anggota lewat email. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as SessionUser).id;

  if (!(await canUseTeam(userId))) {
    return NextResponse.json({ error: "Kolaborasi tim tersedia untuk paket ENTERPRISE." }, { status: 402 });
  }

  const body = await req.json().catch(() => ({}));
  const orgId = typeof body?.orgId === "string" ? body.orgId : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role: Role = isRole(body?.role) ? body.role : "VIEWER";

  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
  }

  const guard = await requireOwner(orgId, userId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  // Sudah anggota?
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    const already = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: existingUser.id } },
    });
    if (already) {
      return NextResponse.json({ error: "Orang ini sudah menjadi anggota tim." }, { status: 400 });
    }
  }

  // Kuota seat: anggota terpakai + undangan pending tidak boleh melebihi batas.
  const usage = await seatUsage(orgId);
  if (usage.used + usage.pending >= usage.limit) {
    return NextResponse.json(
      {
        error: `Seat penuh (${usage.used + usage.pending}/${usage.limit}). Tambah seat atau hapus undangan yang menggantung.`,
      },
      { status: 400 }
    );
  }

  const invite = await prisma.organizationInvite.upsert({
    where: { organizationId_email: { organizationId: orgId, email } },
    update: { role, status: "PENDING", respondedAt: null },
    create: { organizationId: orgId, email, role, invitedById: userId },
  });

  return NextResponse.json(invite);
}

/** PATCH: ubah peran anggota. */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as SessionUser).id;

  if (!(await canUseTeam(userId))) {
    return NextResponse.json({ error: "Kolaborasi tim tersedia untuk paket ENTERPRISE." }, { status: 402 });
  }

  const body = await req.json().catch(() => ({}));
  const orgId = typeof body?.orgId === "string" ? body.orgId : "";
  const targetUserId = typeof body?.userId === "string" ? body.userId : "";
  const role = body?.role;

  if (!orgId || !targetUserId || !isRole(role)) {
    return NextResponse.json({ error: "Parameter tidak lengkap." }, { status: 400 });
  }

  const guard = await requireOwner(orgId, userId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  // Jangan menurunkan OWNER (pemilik) — tim harus selalu punya pemilik.
  if (targetUserId === guard.org.ownerId && role !== "OWNER") {
    return NextResponse.json(
      { error: "Pemilik tim tidak dapat diturunkan perannya." },
      { status: 400 }
    );
  }

  const updated = await prisma.membership.updateMany({
    where: { organizationId: orgId, userId: targetUserId },
    data: { role },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Anggota tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

/** DELETE: keluarkan anggota (atau batalkan undangan). */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as SessionUser).id;

  if (!(await canUseTeam(userId))) {
    return NextResponse.json({ error: "Kolaborasi tim tersedia untuk paket ENTERPRISE." }, { status: 402 });
  }

  const body = await req.json().catch(() => ({}));
  const orgId = typeof body?.orgId === "string" ? body.orgId : "";
  const targetUserId = typeof body?.userId === "string" ? body.userId : "";
  const inviteId = typeof body?.inviteId === "string" ? body.inviteId : "";

  if (!orgId || (!targetUserId && !inviteId)) {
    return NextResponse.json({ error: "Parameter tidak lengkap." }, { status: 400 });
  }

  const guard = await requireOwner(orgId, userId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  // Batalkan undangan yang belum diterima.
  if (inviteId) {
    const deleted = await prisma.organizationInvite.deleteMany({
      where: { id: inviteId, organizationId: orgId, status: "PENDING" },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Undangan tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }

  // Pemilik tidak dapat dikeluarkan dari timnya sendiri.
  if (targetUserId === guard.org.ownerId) {
    return NextResponse.json(
      { error: "Pemilik tim tidak dapat dikeluarkan." },
      { status: 400 }
    );
  }

  const removed = await prisma.membership.deleteMany({
    where: { organizationId: orgId, userId: targetUserId },
  });
  if (removed.count === 0) {
    return NextResponse.json({ error: "Anggota tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
