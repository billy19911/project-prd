"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, Sparkles, ArrowLeft, Lock } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { useSubscription } from "@/lib/use-subscription";

/**
 * Chat Prototype — pintu masuk kedua untuk fitur Prototype Design.
 *
 * CATATAN IMPLEMENTASI: ini RANGKA UI (split view chat + kanvas), bukan chat
 * yang sudah terhubung AI. Untuk mengaktifkannya perlu endpoint percakapan
 * tersendiri beserta manajemen riwayat — di luar cakupan pekerjaan ini.
 * Yang sudah nyata di sini: gate PRO dan tata letak dua kolom.
 */
export default function ChatPage() {
  const { canUsePrototype, loading } = useSubscription();
  const [draft, setDraft] = useState("");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-accent" />
        <h1 className="text-sm font-semibold text-foreground">Chat Prototype</h1>
        <span className="ml-auto rounded-full border border-border bg-surface-2/60 px-2.5 py-0.5 text-[10px] font-medium text-muted">
          Fase berikutnya
        </span>
      </div>

      {!loading && !canUsePrototype ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface/60 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">
            Chat Prototype khusus PRO
          </h2>
          <p className="max-w-md text-xs text-muted">
            Susun prototype sambil mengobrol: kanvas pratinjau di sisi kanan
            diperbarui setiap kali AI membalas. Tersedia mulai paket PRO.
          </p>
          <Link
            href="/settings/plan"
            className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-1" })}
          >
            Lihat Plan
          </Link>
        </div>
      ) : (
        <div className="grid min-h-[560px] overflow-hidden rounded-[var(--radius-card)] border border-border lg:grid-cols-[340px_1fr]">
          {/* Kolom chat */}
          <div className="flex flex-col border-b border-border bg-surface/40 lg:border-b-0 lg:border-r">
            <div className="flex h-11 items-center gap-2 border-b border-border px-4">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-medium text-foreground">Percakapan</span>
            </div>

            <div className="flex-1 space-y-3 overflow-auto p-4">
              <div className="max-w-[90%] rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">
                Belum ada percakapan. Endpoint chat belum tersedia — ini rangka
                antarmuka. Untuk sekarang, generate prototype lewat tab{" "}
                <span className="font-mono text-foreground">Prototype</span> di
                halaman project.
              </div>
              <div className="max-w-[90%] rounded-xl bg-accent px-3 py-2 text-xs leading-relaxed text-white">
                Desain kanvas di kanan akan muncul di sini setelah endpoint chat
                aktif.
              </div>
            </div>

            <div className="flex items-end gap-2 border-t border-border p-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={1}
                disabled
                placeholder="Belum aktif"
                className="min-h-[38px] flex-1 resize-none rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-xs text-muted disabled:opacity-60"
              />
              <button
                disabled
                className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                Kirim
              </button>
            </div>
          </div>

          {/* Kolom kanvas */}
          <div className="flex flex-col">
            <div className="flex h-11 items-center gap-2 border-b border-border px-4">
              <span className="text-xs font-medium text-foreground">Canvas</span>
              <span className="ml-auto rounded-md border border-border-strong px-2 py-0.5 text-[10px] text-muted">
                menunggu endpoint chat
              </span>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-background/40 p-6 text-center">
              <MessageSquare className="h-6 w-6 text-muted" />
              <p className="max-w-sm text-xs text-muted">
                Kanvas pratinjau akan merender prototype di sini, seperti pada
                tab Prototype di halaman project.
              </p>
              <Link
                href="/prototype"
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Buka galeri Prototype
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
