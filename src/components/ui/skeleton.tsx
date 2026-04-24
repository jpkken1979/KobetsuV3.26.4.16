import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        "skeleton relative overflow-hidden rounded-md",
        className
      )}
      style={style}
    />
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 8, columns = 6, className }: SkeletonTableProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/60 bg-card shadow-[var(--shadow-card)]",
        className
      )}
    >
      {/* Header */}
      <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
      </div>
      {/* Rows con fade progresivo */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="border-b border-border/20 last:border-0 px-4 py-3.5"
          style={{ opacity: 1 - i * 0.07 }}
        >
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton
                key={j}
                className="h-4 flex-1"
                style={{ maxWidth: j === 0 ? "60px" : j === 1 ? "180px" : undefined }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-16" />
        </div>
        <Skeleton className="h-10 w-10 rounded-md" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-lg border border-border/40 bg-card p-6 shadow-[var(--shadow-card)]">
      <Skeleton className="mb-4 h-5 w-32" />
      <Skeleton className="h-[220px] w-full rounded-md" />
    </div>
  );
}

/** Skeleton para cards hero con aurora-border (Path B) */
export function HeroSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("aurora-border overflow-hidden p-6", className)}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-14 w-40" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
  );
}
