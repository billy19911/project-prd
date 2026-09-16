"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export type SubInfo = {
  planType: string;
  status: string;
  isActive: boolean;
  daysLeft: number | null;
  validUntil: string | null;
  prdLimit: number;
  prdUsedThisMonth: number;
  prototypeLimit?: number;
  prototypeUsedThisMonth?: number;
};

const EMPTY: SubInfo = {
  planType: "FREE",
  status: "INACTIVE",
  isActive: false,
  daysLeft: null,
  validUntil: null,
  prdLimit: 1,
  prdUsedThisMonth: 0,
  prototypeLimit: 0,
  prototypeUsedThisMonth: 0,
};

/**
 * Sumber kebenaran status langganan di sisi klien (via API, bukan JWT yang
 * bisa usang). Gate UI harus memakai ini, bukan `session.user.plan`.
 */
export function useSubscription() {
  const { status } = useSession();
  const [sub, setSub] = useState<SubInfo>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") {
      queueMicrotask(() => setLoading(false));
      return;
    }
    let active = true;
    fetch("/api/user/subscription")
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((d) => {
        if (active) setSub({ ...EMPTY, ...d });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status]);

  // ⚠️ Jaga tetap selaras dengan `getAccessTier()` di lib/access.ts.
  // Fallback-nya "free", jadi planType yang tidak dikenal (mis. ENTERPRISE
  // bila lupa ditambahkan) membuat pengguna berbayar kehilangan akses di UI.
  const tier = !sub.isActive
    ? "free"
    : sub.planType === "ENTERPRISE"
      ? "enterprise"
      : sub.planType === "PRO" || sub.planType === "PRO_YEARLY"
        ? "pro"
        : sub.planType === "STARTER"
          ? "starter"
          : "free";

  const isProOrAbove = tier === "pro" || tier === "enterprise";
  const protoLimit = sub.prototypeLimit ?? 0;
  const protoUsed = sub.prototypeUsedThisMonth ?? 0;

  return {
    sub,
    loading,
    tier,
    isPaid: tier !== "free",
    canFork: isProOrAbove,
    canExport: tier !== "free",
    /** Paket mendukung Prototype Design (PRO ke atas). */
    canUsePrototype: isProOrAbove,
    /** Paket mendukung DAN kuota bulan ini masih ada. */
    canGeneratePrototype:
      isProOrAbove && (protoLimit < 0 || protoUsed < protoLimit),
    /** Sisa kuota prototype; null = unlimited. */
    prototypeQuotaLeft:
      protoLimit < 0 ? null : Math.max(0, protoLimit - protoUsed),
    /** Library tema tersimpan — khusus Enterprise. */
    canSaveThemes: tier === "enterprise",
  };
}
