import { prisma } from "@/lib/prisma";

/** Jumlah versi PRD yang disimpan per workspace (sisakan terbaru). */
export const MAX_PRD_VERSIONS = 10;

/**
 * Simpan versi PRD lama ke riwayat SEBELUM ditimpa, lalu pangkas agar tidak
 * tumbuh tanpa batas. Pola sama seperti PrototypeVersion.
 *
 * Idempoten bila `previous` null/kosong (tidak ada yang disimpan).
 */
export async function savePrdVersion(
  workspaceId: string,
  previous: string | null | undefined,
  note: string
) {
  if (!previous || !previous.trim()) return;

  await prisma.prdVersion.create({
    data: { workspaceId, fullPrdMd: previous, note },
  });

  // Pangkas: sisakan MAX_PRD_VERSIONS terbaru.
  const old = await prisma.prdVersion.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    skip: MAX_PRD_VERSIONS,
    select: { id: true },
  });
  if (old.length > 0) {
    await prisma.prdVersion.deleteMany({
      where: { id: { in: old.map((v) => v.id) } },
    });
  }
}
