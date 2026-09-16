import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/dashboard",
  showText = true,
}: {
  className?: string;
  href?: string;
  showText?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 font-semibold tracking-tight",
        className
      )}
    >
      <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-inset ring-accent/30">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-accent transition-transform group-hover:rotate-45" />
      </span>
      {showText && (
        <span className="text-foreground">
          Xynn<span className="text-accent">PRD</span>
        </span>
      )}
    </Link>
  );
}
