import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  tag?: string;
  tagColor?: string;
  /** Aplica gradient al title (primary → accent). Útil para rutas hero. */
  gradientTitle?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  tag,
  tagColor,
  gradientTitle = false,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-2">
        {tag && (
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xs border border-border/60 bg-muted/40 px-2 py-0.5",
              "font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em]",
              tagColor ?? "text-muted-foreground",
            )}
          >
            <span className="live-dot text-primary" />
            {tag}
          </div>
        )}
        <h1
          className={cn(
            "text-display text-[2rem] md:text-[2.5rem]",
            gradientTitle &&
              "bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))] bg-clip-text text-transparent",
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 md:max-w-[54%] md:justify-end">
          {children}
        </div>
      )}
    </div>
  );
}
