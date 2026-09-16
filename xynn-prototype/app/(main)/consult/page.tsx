import { ComingSoon } from "@/components/coming-soon";

export default function ConsultPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <ComingSoon
        title="Konsultasi AI"
        description="Diskusikan arsitektur, tech stack, dan roadmap eksekusi bersama AI konsultan. Fitur ini sedang disiapkan."
        bullets={[
          "Tanya-jawab arsitektur aplikasi secara mendalam",
          "Review tech stack & rekomendasi perbaikan",
          "Rencana eksekusi bertahap sesuai skala timmu",
        ]}
      />
    </div>
  );
}
