import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { Logo } from "@/components/ui/logo";
import { buttonClasses } from "@/components/ui/button";
import { PRODUCTS, PRODUCT_FEATURE_KEY, type Product } from "@/lib/products";
import { getFeatureStates } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

function ProductCard({ product, loggedIn }: { product: Product; loggedIn: boolean }) {
  const Icon = product.icon;
  const soon = product.status === "soon";

  const href = soon
    ? undefined
    : product.requiresAuth && !loggedIn
      ? `/login?callbackUrl=${encodeURIComponent(product.href)}`
      : product.href;

  const inner = (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent opacity-0 transition-opacity duration-500",
          !soon && "group-hover:opacity-100"
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute -bottom-16 -right-12 h-36 w-36 rounded-full bg-gradient-to-tl to-transparent blur-3xl transition-transform duration-700",
          product.accent,
          !soon && "group-hover:scale-125"
        )}
      />

      <div className="relative flex items-start justify-between">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 ring-1 ring-inset ring-border-strong transition-transform duration-300",
            !soon && "text-accent group-hover:scale-105"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        {soon ? (
          <span className="rounded-full border border-border bg-surface-2/60 px-2.5 py-0.5 text-[10px] font-medium text-muted">
            Segera
          </span>
        ) : (
          product.requiresPaid && <Lock className="h-3.5 w-3.5 text-muted" />
        )}
      </div>

      <h3 className="relative mt-4 text-[15px] font-semibold leading-tight text-foreground">
        {product.title}
      </h3>
      <p className="relative mt-1 text-xs font-medium text-accent">
        {product.tagline}
      </p>
      <p className="relative mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-muted">
        {product.description}
      </p>

      <span
        className={cn(
          "relative mt-4 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors",
          soon ? "text-muted" : "text-foreground group-hover:text-accent"
        )}
      >
        {soon ? "Segera hadir" : "Buka"}
        {!soon && (
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
        )}
      </span>
    </>
  );

  const baseClass = cn(
    "group relative flex h-full min-h-[168px] flex-col overflow-hidden rounded-xl border border-border bg-surface/30 p-5",
    !soon && "transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40",
    soon && "opacity-60"
  );

  if (soon) return <div className={baseClass}>{inner}</div>;
  return (
    <Link href={href!} className={baseClass}>
      {inner}
    </Link>
  );
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const firstName = session?.user?.name?.split(" ")[0];
  const greeting = firstName ? `Halo, ${firstName}` : "Halo";

  // Terapkan status rilis dari sistem flag: produk yang punya kunci fitur
  // mengikuti status DB (LIVE→active, SOON/HIDDEN→soon/tak tampil).
  const featureStates = await getFeatureStates();
  const products = PRODUCTS.map((p): Product => {
    const key = PRODUCT_FEATURE_KEY[p.id];
    if (!key) return p;
    const status = featureStates[key].status;
    return { ...p, status: status === "LIVE" ? "active" : "soon" };
  }).filter((p) => {
    const key = PRODUCT_FEATURE_KEY[p.id];
    if (!key) return true;
    // Fitur HIDDEN tidak ditampilkan sama sekali.
    return featureStates[key].status !== "HIDDEN";
  });

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.2]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col px-5 sm:px-8">
        <header className="flex h-16 items-center justify-between">
          <Logo href="/" />
          {session ? (
            <Link href="/dashboard" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Sign in
            </Link>
          )}
        </header>

        <section className="flex flex-1 flex-col justify-center py-10">
          <div className="xynn-rise mb-7">
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {greeting} 👋
            </h1>
            <p className="mt-2 max-w-lg text-sm text-muted">
              Mau bikin apa hari ini? Pilih salah satu untuk memulai.
            </p>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            {products.map((product) => (
              <div key={product.id} className="xynn-rise">
                <ProductCard product={product} loggedIn={!!session} />
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-border py-5 text-xs text-muted">
          Xynn — AI Product &amp; Architecture Generator
        </footer>
      </div>
    </main>
  );
}
