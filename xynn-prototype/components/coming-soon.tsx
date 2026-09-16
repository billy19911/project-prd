import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

export function ComingSoon({
  title,
  description,
  bullets,
}: {
  title: string;
  description: string;
  bullets?: string[];
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">
        <Sparkles className="h-6 w-6" />
      </div>
      <span className="mb-3 rounded-full border border-border bg-surface-2/60 px-3 py-0.5 text-[11px] font-medium text-muted">
        Segera Hadir
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-3 max-w-md text-sm text-muted">{description}</p>

      {bullets && bullets.length > 0 && (
        <ul className="mt-6 w-full space-y-2 text-left">
          {bullets.map((b) => (
            <li
              key={b}
              className="rounded-xl border border-border bg-surface/30 px-4 py-3 text-sm text-muted"
            >
              {b}
            </li>
          ))}
        </ul>
      )}

      <Link href="/" className={buttonClasses({ variant: "secondary", size: "md", className: "mt-8" })}>
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Produk
      </Link>
    </div>
  );
}
