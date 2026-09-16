import { ComingSoon } from "@/components/coming-soon";

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <ComingSoon
        title="Template PRD"
        description="Mulai dari template PRD siap pakai untuk menghemat token. Eksklusif untuk pelanggan berbayar."
        bullets={[
          "Template dari database: SaaS, e-commerce, mobile app, dll",
          "Hemat token karena struktur dasar sudah tersedia",
          "Bisa dikustomisasi sesuai kebutuhan produkmu",
        ]}
      />
    </div>
  );
}
