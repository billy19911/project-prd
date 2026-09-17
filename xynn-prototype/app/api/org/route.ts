import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canSaveThemes } from "@/lib/access";
import { seatUsage, hasEnterpriseViaOrg } from "@/lib/workspace-access";

interface SessionUser {
  id: string;
}

/**
 * Cek hak ENTERPRISE: milik sendiri ATAU lewat organisasi yang kita ikuti.
 * Tanpa ini, anggota tim harus berlangganan Enterprise sendiri — yang
 * membuat kolaborasi tidak masuk akal.
 */
async function canUseTeam(userId: string): Promise<boolean> {
  return hasEnterpriseViaOrg(userId, (sub) =>
    canSaveThemes(
      sub
        ? { planType: sub.planType, status: sub.status, validUntil: sub.validUntil }
        : null
    )
  );
}

/**
 * Organisasi tim — fitur ENTERPRISE.
 *
 * Satu pengguna boleh menjadi OWNER di satu organisasi dan anggota di
 * organisasi lain. Endpoint ini mengembalikan organisasi tempat pengguna
 * menjadi anggota (OWNER atau bukan), beserta pemakaian seat.
 */

/**
 * GET: organisasi milik/anggota pengguna + pemakaian seat.
 *
 * `?lite=1` mengembalikan daftar ringkas yang hanya boleh dipakai untuk
 * MEMBUAT workspace (hanya org yang perannya OWNER/EDITOR). Dipakai wizard
 * "project baru" agar tidak menarik seluruh data anggota hanya untuk dropdown.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as SessionUser).id;

  if (!(await canUseTeam(userId))) {
    return NextResponse.json(
      { error: "Kolaborasi tim tersedia untuk paket ENTERPRISE." },
      { status: 402 }
    );
  }

  const lite = new URL(req.url).searchParams.get("lite") === "1";
  if (lite) {
    const memberships = await prisma.membership.findMany({
      where: { userId, role: { in: ["OWNER", "EDITOR"] } },
      select: { role: true, organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(
      memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        myRole: m.role,
      }))
    );
  }

  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          members: {
            include: {
              user: { select: { id: true, email: true, name: true, avatarUrl: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          invites: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  const result = await Promise.all(
    memberships.map(async (m) => {
      const org = m.organization;
      const usage = await seatUsage(org.id);
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        myRole: m.role,
        isOwner: org.ownerId === userId,
        seat: usage,
        members: org.members.map((mm) => ({
          membershipId: mm.id,
          userId: mm.user.id,
          email: mm.user.email,
          name: mm.user.name,
          avatarUrl: mm.user.avatarUrl,
          role: mm.role,
        })),
        invites: org.invites.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          createdAt: i.createdAt,
        })),
      };
    })
  );

  return NextResponse.json(result);
}

/** POST: buat organisasi (pengguna otomatis jadi OWNER). */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as SessionUser).id;

  if (!(await canUseTeam(userId))) {
    return NextResponse.json(
      { error: "Kolaborasi tim tersedia untuk paket ENTERPRISE." },
      { status: 402 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 60) {
    return NextResponse.json(
      { error: "Nama tim wajib diisi (maks. 60 karakter)." },
      { status: 400 }
    );
  }

  // Batasi jumlah organisasi yang dimiliki agar tidak menyalahgunakan.
  const owned = await prisma.organization.count({ where: { ownerId: userId } });
  if (owned >= 5) {
    return NextResponse.json(
      { error: "Maksimal 5 tim yang dapat Anda buat." },
      { status: 400 }
    );
  }

  // Slug unik dari nama + suffix pendek.
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "tim";
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.organization.findUnique({ where: { slug } });
    if (!exists) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      ownerId: userId,
      // Default 3 seat sesuai janji paket Enterprise.
      seatLimit: 3,
      members: { create: { userId, role: "OWNER" } },
    },
  });

  return NextResponse.json(org);
}
