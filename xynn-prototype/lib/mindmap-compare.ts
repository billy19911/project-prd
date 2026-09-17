/**
 * Perbandingan node mindmap — MURNI (tanpa React).
 *
 * Dipakai MindmapCanvas/parent untuk memutus "Maximum update depth exceeded":
 * setState hanya dijalankan bila data benar-benar berubah, sehingga
 * sinkronisasi parent↔canvas tidak memicu render berantai tanpa akhir.
 */

export type MindmapNodeLike = {
  id: string;
  data?: { label?: string };
  position?: { x: number; y: number };
};

/**
 * Apakah dua daftar node identik (id, label, posisi x/y)?
 * Urutan ikut diperhitungkan.
 */
export function sameNodes(a: MindmapNodeLike[], b: MindmapNodeLike[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.id !== y.id) return false;
    if ((x.data?.label ?? "") !== (y.data?.label ?? "")) return false;
    if ((x.position?.x ?? null) !== (y.position?.x ?? null)) return false;
    if ((x.position?.y ?? null) !== (y.position?.y ?? null)) return false;
  }
  return true;
}
