import { prisma } from "@/lib/prisma";
import {
  NO_ACCESS,
  resolveWorkspaceAccess,
  roleCanCreateWorkspace,
  type OrgRole,
  type WorkspaceAccess,
} from "@/lib/workspace-access-core";

/**
 * Akses workspace berbasis keanggotaan organisasi.
 *
 * MASALAH YANG DISELESAIKAN: sebelumnya hampir semua query memakai
 * `where: { id, userId }`, sehingga hanya PEMILIK yang bisa mengakses
 * workspace. Setelah ada organisasi, anggota tim harus bisa mengakses
 * workspace milik organisasi mereka.
 *
 * Semua akses workspace sebaiknya lewat helper ini agar aturannya satu tempat
 * dan tidak tersebar (dan tidak mudah lupa).
 *
 * Logika keputusan murni ada di `workspace-access-core.ts` (bisa diuji tanpa
 * database); modul ini hanya menjembatani Prisma → keputusan.
 */

// Re-ekspor agar pemanggil lama tetap bekerja.
export type { OrgRole, WorkspaceAccess };
export { roleCanEdit, roleCanManage } from "@/lib/workspace-access-core";

/**
 * Apakah user boleh membuat workspace baru di dalam organisasi ini.
 * VIEWER tidak boleh — hanya OWNER/EDITOR yang boleh menambah workspace,
 * supaya seat "lihat saja" tidak diam-diam bisa mengubah data tim.
 */
export async function canCreateWorkspaceInOrg(
  organizationId: string,
  userId: string
): Promise<boolean> {
  const membership = await prisma.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true },
  });
  return !!membership && roleCanCreateWorkspace(membership.role as OrgRole);
}

/**
 * Hitung hak akses satu workspace untuk satu user.
 *
 * Aturan:
 *  - Pemilik pribadi (userId) selalu punya akses penuh.
 *  - Workspace organisasi: anggota org mendapat akses sesuai perannya.
 *  - Bukan keduanya: tidak ada akses.
 */
export async function getWorkspaceAccess(
  workspaceId: string,
  userId: string
): Promise<WorkspaceAccess> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, userId: true, organizationId: true },
  });
  if (!ws) return NO_ACCESS;

  // Pemilik pribadi — akses penuh walau workspace-nya milik organisasi.
  if (ws.userId === userId) {
    return resolveWorkspaceAccess(ws, userId, null);
  }

  if (!ws.organizationId) return NO_ACCESS;

  const membership = await prisma.membership.findUnique({
    where: {
      organizationId_userId: { organizationId: ws.organizationId, userId },
    },
    select: { role: true },
  });

  return resolveWorkspaceAccess(
    ws,
    userId,
    (membership?.role as OrgRole) ?? null
  );
}

/**
 * Daftar id organisasi tempat user menjadi anggota.
 * Dipakai untuk menampilkan workspace organisasi di daftar workspace.
 */
export async function getMemberOrganizationIds(userId: string): Promise<string[]> {
  const rows = await prisma.membership.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  return rows.map((r) => r.organizationId);
}

/** Sumber data Workspace untuk pengguna: milik sendiri ATAU milik org-nya. */
export async function workspaceAccessFilter(userId: string) {
  const orgIds = await getMemberOrganizationIds(userId);
  return {
    OR: [
      { userId },
      ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : []),
    ],
  };
}

/**
 * Apakah pengguna punya hak ENTERPRISE — baik dari langganannya sendiri,
 * ATAU karena ia anggota organisasi yang pemiliknya berlangganan ENTERPRISE.
 *
 * INI PENTING: tanpa ini, setiap anggota tim harus berlangganan Enterprise
 * sendiri, yang membuat fitur kolaborasi tidak masuk akal.
 *
 * @param checkSubscription fungsi yang mengecek langganan satu userId
 *   (disuntikkan agar modul ini tidak mengimpor lib/access secara melingkar)
 */
export async function hasEnterpriseViaOrg(
  userId: string,
  checkSubscription: (sub: {
    planType: string;
    status: string | null;
    validUntil: Date | null;
  } | null) => boolean
): Promise<boolean> {
  // Cek langganan sendiri dulu.
  const own = await prisma.subscription.findUnique({ where: { userId } });
  if (checkSubscription(
    own ? { planType: own.planType, status: own.status, validUntil: own.validUntil } : null
  )) {
    return true;
  }

  // Kalau bukan, cek apakah pemilik salah satu organisasi kita berlangganan.
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { organization: { select: { ownerId: true } } },
  });
  const ownerIds = memberships.map((m) => m.organization.ownerId);
  if (ownerIds.length === 0) return false;

  const owners = await prisma.subscription.findMany({
    where: { userId: { in: ownerIds } },
  });
  return owners.some((o) =>
    checkSubscription({
      planType: o.planType,
      status: o.status,
      validUntil: o.validUntil,
    })
  );
}

/** Jumlah anggota terpakai vs batas seat. */
export async function seatUsage(organizationId: string): Promise<{
  used: number;
  limit: number;
  pending: number;
}> {
  const [members, org, pending] = await Promise.all([
    prisma.membership.count({ where: { organizationId } }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { seatLimit: true },
    }),
    prisma.organizationInvite.count({
      where: { organizationId, status: "PENDING" },
    }),
  ]);
  return { used: members, limit: org?.seatLimit ?? 0, pending };
}
