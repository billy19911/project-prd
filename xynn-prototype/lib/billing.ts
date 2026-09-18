/**
 * Perhitungan masa aktif langganan (billing) — helper murni tanpa dependensi DB
 * agar mudah diuji dan tidak terikat Prisma.
 *
 * Masa aktif dihitung berbasis KALENDER (bukan fix 30/90/365 hari):
 *   - 1 tahun dari 1 Jan = 1 Jan tahun berikutnya (tidak meleset lintas
 *     tahun kabisat),
 *   - 1 bulan dari 31 Jan = 28/29 Feb (clamp ke akhir bulan), bukan 2/3 Mar.
 */

import type { BillingCycle } from "@prisma/client";

/**
 * Jumlah bulan per siklus billing.
 */
export function monthsForCycle(cycle: BillingCycle): number {
  if (cycle === "YEARLY") return 12;
  if (cycle === "QUARTERLY") return 3;
  return 1;
}

/**
 * Tambah `months` bulan ke sebuah tanggal dengan penyesuaian kalender.
 *
 * Menangani quirk JS `Date.setMonth` yang "meluber" ke bulan berikutnya
 * (mis. 31 Jan + 1 bulan menjadi 3 Mar). Helper ini meng-clamp ke hari
 * terakhir bulan tujuan, sehingga hasilnya 28/29 Feb.
 */
export function addMonths(from: Date, months: number): Date {
  const result = new Date(from.getTime());
  const day = result.getDate();
  // Set ke hari ke-1 dulu agar tidak meluber saat menambah bulan.
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  // Hari terakhir bulan tujuan pada tahun yang tepat.
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

/**
 * Hitung tanggal berakhir langganan berdasarkan siklus billing (berbasis
 * kalender). Satu sumber kebenaran agar checkout/confirm, webhook, dan assign
 * admin menghitung masa aktif dengan cara yang sama.
 */
export function computeValidUntil(from: Date, cycle: BillingCycle): Date {
  return addMonths(from, monthsForCycle(cycle));
}
