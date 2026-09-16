import { cn } from "@/lib/utils";

export function StepIndicator({
  current,
  steps,
  className,
}: {
  current: number; // 1-indexed
  steps: string[];
  className?: string;
}) {
  return (
    <ol className={cn("flex items-center gap-2", className)}>
      {steps.map((label, i) => {
        const index = i + 1;
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium",
                  done && "border-accent/40 bg-accent/15 text-accent",
                  active && "border-accent bg-accent text-white",
                  !done && !active && "border-border-strong text-muted"
                )}
              >
                {index}
              </span>
              <span
                className={cn(
                  "hidden text-xs sm:block",
                  active ? "text-foreground" : "text-muted"
                )}
              >
                {label}
              </span>
            </div>
            {index < steps.length && (
              <span
                className={cn(
                  "h-px w-5 sm:w-8",
                  done ? "bg-accent/40" : "bg-border-strong"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
