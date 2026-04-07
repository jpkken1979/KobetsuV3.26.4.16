import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/40",
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
    <div className={cn("rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)] overflow-hidden", className)}>
      {/* Header */}
      <div className="border-b border-border/60 bg-muted/20 px-4 py-3.5">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="border-b border-border/20 last:border-0 px-4 py-4"
          style={{ opacity: 1 - i * 0.08 }}
        >
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton
                key={j}
                className="h-4 flex-1"
                // Vary widths for realism
                style={{ maxWidth: j === 0 ? "60px" : j === 1 ? "180px" : undefined }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

