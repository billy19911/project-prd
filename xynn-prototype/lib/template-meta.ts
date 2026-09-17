import {
  Sparkles,
  Building2,
  ShoppingCart,
  Smartphone,
  LayoutDashboard,
  Store,
  KanbanSquare,
  type LucideIcon,
} from "lucide-react";

/**
 * Peta nama-ikon → komponen lucide untuk kartu template.
 *
 * Data template di DB menyimpan NAMA ikon (string), bukan komponen — supaya
 * aman disimpan sebagai data. Di sini nama itu diterjemahkan ke komponen.
 * Nama yang tidak dikenal jatuh ke `Sparkles` agar kartu tidak pernah kosong.
 */
const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Building2,
  ShoppingCart,
  Smartphone,
  LayoutDashboard,
  Store,
  KanbanSquare,
};

export function templateIcon(name: string): LucideIcon {
  return ICONS[name] ?? Sparkles;
}

/** Label kategori yang ramah untuk badge (kunci = nilai di DB). */
const CATEGORY_LABELS: Record<string, string> = {
  saas: "SaaS",
  ecommerce: "E-commerce",
  mobile: "Mobile",
  internal: "Internal",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}
