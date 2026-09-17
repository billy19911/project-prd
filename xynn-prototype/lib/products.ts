import {
  FileText,
  MessagesSquare,
  LayoutTemplate,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type ProductStatus = "active" | "soon";

export type Product = {
  id: string;
  icon: LucideIcon;
  title: string;
  tagline: string;
  description: string;
  href: string;
  status: ProductStatus;
  /** Perlu login untuk membuka. */
  requiresAuth: boolean;
  /** Perlu langganan berbayar. */
  requiresPaid: boolean;
  accent: string;
};

/**
 * Katalog produk Xynn. Sumber kebenaran tunggal untuk halaman `/` dan navigasi.
 * Tambah produk baru cukup di sini.
 */
export const PRODUCTS: Product[] = [
  {
    id: "prd",
    icon: FileText,
    title: "Bikin Project",
    tagline: "Ide → PRD siap-kode",
    description:
      "Tulis idemu, pilih preferensi teknologi, dan hasilkan mindmap, PRD lengkap, task breakdown, hingga style guide.",
    href: "/projects",
    status: "active",
    requiresAuth: true,
    requiresPaid: false,
    accent: "from-accent/25",
  },
  {
    id: "chat",
    icon: MessagesSquare,
    title: "Chat PRD",
    tagline: "Ngobrol langsung jadi PRD",
    description:
      "Antarmuka chat untuk menyusun PRD dengan pilihan model AI premium. Akses model sesuai paket langgananmu.",
    href: "/chat",
    status: "soon",
    requiresAuth: true,
    requiresPaid: true,
    accent: "from-purple-500/25",
  },
  {
    id: "template",
    icon: LayoutTemplate,
    title: "Template PRD",
    tagline: "Mulai dari template",
    description:
      "Gunakan template PRD siap pakai dari database untuk menghemat token. Eksklusif untuk pelanggan berbayar.",
    href: "/templates",
    status: "active",
    requiresAuth: true,
    requiresPaid: true,
    accent: "from-emerald-500/25",
  },
  {
    id: "consult",
    icon: Sparkles,
    title: "Konsultasi AI",
    tagline: "Tanya arsitektur",
    description:
      "Diskusikan arsitektur, tech stack, dan roadmap eksekusi bersama AI konsultan.",
    href: "/consult",
    status: "soon",
    requiresAuth: true,
    requiresPaid: true,
    accent: "from-amber-500/25",
  },
];
