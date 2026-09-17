"use client";

import { useEffect, useState } from "react";
import type { FeatureKey, FeatureStatusValue } from "@/lib/feature-flags-core";

type FeatureState = {
  key: string;
  label: string;
  description: string;
  status: FeatureStatusValue;
};

/**
 * Baca status rilis fitur dari API publik `/api/features`.
 *
 * Dipakai halaman untuk memutuskan apakah menampilkan fitur penuh atau
 * menyembunyikannya di balik layar "Segera Hadir". Selama memuat, status
 * `undefined` — pemanggil sebaiknya menahan render agar tidak berkedip.
 */
export function useFeatureStatus(key: FeatureKey) {
  const [status, setStatus] = useState<FeatureStatusValue | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/features")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: FeatureState[]) => {
        if (!active) return;
        const found = Array.isArray(list) ? list.find((f) => f.key === key) : undefined;
        // Fitur tak dikenal di daftar publik → anggap belum rilis (aman).
        setStatus(found?.status ?? "SOON");
      })
      .catch(() => {
        if (active) setStatus("SOON");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key]);

  return {
    status,
    loading,
    isLive: status === "LIVE",
    isSoon: status === "SOON",
    isHidden: status === "HIDDEN",
  };
}

/**
 * Baca status SEMUA fitur sekaligus (satu request). Dipakai navigasi agar
 * cukup satu panggilan untuk banyak entri.
 */
export function useAllFeatureStates() {
  const [states, setStates] = useState<Record<string, FeatureStatusValue>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/features")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: FeatureState[]) => {
        if (!active) return;
        const map: Record<string, FeatureStatusValue> = {};
        if (Array.isArray(list)) {
          for (const f of list) map[f.key] = f.status;
        }
        setStates(map);
      })
      .catch(() => {
        /* biarkan kosong; pemanggil memakai default */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { states, loading };
}
