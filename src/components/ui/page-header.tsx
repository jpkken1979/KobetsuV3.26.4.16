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
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-start md:justify-between", className)}>
      <div className="min-w-0 flex-1">
        {tag && (
          <div className="mb-1">
            <span className={cn("font-mono text-[11px] font-bold uppercase tracking-[0.08em]", tagColor)}>
              // {tag}
            </span>
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 md:max-w-[50%] md:justify-end md:self-start">
          {children}
        </div>
      )}
    </div>
  );
}
