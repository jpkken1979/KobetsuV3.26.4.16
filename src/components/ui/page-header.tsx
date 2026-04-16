import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  tag?: string;
  tagColor?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  tag,
  tagColor = "text-primary/70",
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-[1.5rem] border border-border/60 bg-card/80 p-4 shadow-[var(--shadow-card)] md:flex-row md:items-start md:justify-between md:p-5", className)}>
      <div className="min-w-0 flex-1">
        {tag && (
          <div className="mb-3">
            <span className={cn("inline-flex items-center rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]", tagColor)}>
              {tag}
            </span>
          </div>
        )}
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground md:text-[2rem]" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 md:max-w-[54%] md:justify-end md:self-start">
          {children}
        </div>
      )}
    </div>
  );
}
