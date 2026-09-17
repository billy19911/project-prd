"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { useFeatureStatus } from "@/lib/use-feature";
import type { FeatureKey } from "@/lib/feature-flags-core";

/**
 * Gerbang rilis fitur.
 *
 * - LIVE  → render `children` (fitur penuh).
 * - SOON  → tampilkan halaman "Segera Hadir" (fitur tetap ada di baliknya).
 * - HIDDEN→ alihkan ke dashboard (tidak boleh diakses lewat URL).
 *
 * Selama status dimuat, tidak merender apa pun agar tidak berkedip antara
 * "Segera Hadir" dan fitur penuh.
 */
export function ComingSoonGate({
  feature,
  title,
  description,
  bullets,
  children,
}: {
  feature: FeatureKey;
  title: string;
  description: string;
  bullets?: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { status, loading } = useFeatureStatus(feature);

  useEffect(() => {
    if (status === "HIDDEN") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  if (loading || status === undefined) {
    // Fail-safe: selama status belum diketahui, tampilkan "Segera Hadir"
    // (bukan fitur penuh). Lebih aman bila dibiarkan terbuka karena gagal
    // memuat status, dan menghindari kedipan kosong saat SSR.
    return (
      <div className="mx-auto max-w-5xl">
        <ComingSoon title={title} description={description} bullets={bullets} />
      </div>
    );
  }

  if (status === "HIDDEN") return null;

  if (status === "SOON") {
    return (
      <div className="mx-auto max-w-5xl">
        <ComingSoon title={title} description={description} bullets={bullets} />
      </div>
    );
  }

  return <>{children}</>;
}
