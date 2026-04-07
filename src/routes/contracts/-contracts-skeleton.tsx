export function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
      <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex gap-6">
          {["w-28", "w-36", "w-16", "w-44", "w-16"].map((w, i) => (
            <div key={i} className={`skeleton h-3 ${w} rounded`} />
          ))}
        </div>
      </div>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="border-b border-border/30 px-4 py-3.5 last:border-0">
          <div className="flex items-center gap-6">
            <div className="skeleton h-4 w-28 rounded" />
            <div className="skeleton h-4 w-36 rounded" />
            <div className="skeleton h-4 w-16 rounded-full" />
            <div className="skeleton h-4 w-44 rounded" />
            <div className="skeleton h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
