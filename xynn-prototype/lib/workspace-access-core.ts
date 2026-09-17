/**
 * Logika akses workspace yang MURNI (tanpa Prisma).
 *
 * Dipisah dari `workspace-access.ts` supaya keputusan hak akses bisa diuji
 * unit tanpa database. `workspace-access.ts` mengambil data (Prisma) lalu
 * memanggil fungsi-fungsi di sini untuk memutuskan.
 */

export type OrgRole = "OWNER" | "EDITOR" | "VIEWER";

export type WorkspaceAccess = {
  /** Boleh melihat & membaca. */
  canView: boolean;
  /** Boleh mengubah / generate (mengubah data). */
  canEdit: boolean;
  /** Boleh mengelola anggota, seat, dan menghapus workspace. */
  canManage: boolean;
  /** Peran efektif pengguna pada workspace ini. */
  role: OrgRole | "OWNER_PERSONAL";
  /** Apakah workspace ini milik organisasi. */
  isOrgWorkspace: boolean;
};

/** Akses kosong — dipakai saat workspace tidak ada atau tidak berhak. */
export const NO_ACCESS: WorkspaceAccess = {
  canView: false,
  canEdit: false,
  canManage: false,
  role: "VIEWER",
  isOrgWorkspace: false,
};

/** Peran yang boleh mengubah data. */
export function roleCanEdit(role: OrgRole): boolean {
  return role === "OWNER" || role === "EDITOR";
}

/** Peran yang boleh mengelola anggota & seat. */
export function roleCanManage(role: OrgRole): boolean {
  return role === "OWNER";
}

/**
 * Hitung hak akses dari data mentah (tanpa I/O).
 *
 * @param ws         kepemilikan workspace: { userId, organizationId }
 * @param userId     pengguna yang meminta
 * @param memberRole peran keanggotaan pengguna di org pemilik workspace,
 *                   atau null bila bukan anggota
 */
export function resolveWorkspaceAccess(
  ws: { userId: string; organizationId: string | null },
  userId: string,
  memberRole: OrgRole | null
): WorkspaceAccess {
  // Pemilik pribadi — akses penuh walau workspace-nya milik organisasi.
  if (ws.userId === userId) {
    return {
      canView: true,
      canEdit: true,
      canManage: true,
      role: "OWNER_PERSONAL",
      isOrgWorkspace: !!ws.organizationId,
    };
  }

  // Bukan pemilik dan bukan workspace organisasi => tidak ada akses.
  if (!ws.organizationId) return NO_ACCESS;

  // Workspace organisasi: butuh keanggotaan.
  if (!memberRole) return NO_ACCESS;

  return {
    canView: true,
    canEdit: roleCanEdit(memberRole),
    canManage: roleCanManage(memberRole),
    role: memberRole,
    isOrgWorkspace: true,
  };
}

/** Apakah peran ini boleh membuat workspace baru di dalam organisasi. */
export function roleCanCreateWorkspace(role: OrgRole): boolean {
  return roleCanEdit(role);
}
