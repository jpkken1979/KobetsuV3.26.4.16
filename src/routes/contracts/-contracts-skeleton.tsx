export function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-card/80 shadow-[var(--shadow-card)] backdrop-blur-sm">
      <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex gap-6">
          {["w-28", "w-36", "w-16", "w-44", "w-16"].map((w, i) => (
            <div key={i} className={`skeleton h-3 ${w} rounded-xs`} />
          ))}
        </div>
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="border-b border-border/30 px-4 py-3 last:border-0"
          style={{ opacity: 1 - i * 0.06 }}
        >
          <div className="flex items-center gap-6">
            <div className="skeleton h-4 w-28 rounded-xs" />
            <div className="skeleton h-4 w-36 rounded-xs" />
            <div className="skeleton h-4 w-16 rounded-md" />
            <div className="skeleton h-4 w-44 rounded-xs" />
            <div className="skeleton h-5 w-16 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
