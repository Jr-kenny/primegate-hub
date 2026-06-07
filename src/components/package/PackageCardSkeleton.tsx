import { cn } from "@/lib/utils";

export function PackageCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card p-4 shadow-sm", className)}
      aria-hidden="true"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="h-5 w-2/3 rounded bg-muted pg-skeleton" />
        <div className="h-4 w-10 rounded bg-muted pg-skeleton" />
      </div>
      <div className="mt-2 h-3 w-1/3 rounded bg-muted pg-skeleton" />
      <div className="mt-3 h-3 w-full rounded bg-muted pg-skeleton" />
      <div className="mt-1.5 h-3 w-4/5 rounded bg-muted pg-skeleton" />
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
        <div className="h-3 w-20 rounded bg-muted pg-skeleton" />
        <div className="h-3 w-14 rounded bg-muted pg-skeleton" />
      </div>
    </div>
  );
}
