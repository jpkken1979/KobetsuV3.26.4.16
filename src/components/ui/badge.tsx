import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "outline"
  | "active"
  | "alert"
  | "info"
  | "pending";

export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  dotColor?: string;
  pulse?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-primary border border-[color-mix(in_srgb,var(--color-primary)_28%,transparent)]",
  secondary:
    "bg-muted/70 text-muted-foreground border border-border/60",
  success:
    "bg-[var(--color-status-ok-muted)] text-[var(--color-status-ok)] border border-[color-mix(in_srgb,var(--color-status-ok)_28%,transparent)]",
  warning:
    "bg-[var(--color-status-warning-muted)] text-[var(--color-status-warning)] border border-[color-mix(in_srgb,var(--color-status-warning)_28%,transparent)]",
  destructive:
    "bg-[var(--color-status-error-muted)] text-[var(--color-status-error)] border border-[color-mix(in_srgb,var(--color-status-error)_28%,transparent)]",
  outline:
    "border border-border/70 text-muted-foreground bg-transparent",
  active:
    "bg-[var(--color-status-ok-muted)] text-[var(--color-status-ok)] border border-[color-mix(in_srgb,var(--color-status-ok)_32%,transparent)]",
  alert:
    "bg-[var(--color-status-error-muted)] text-[var(--color-status-error)] border border-[color-mix(in_srgb,var(--color-status-error)_32%,transparent)]",
  info:
    "bg-[var(--color-status-info-muted)] text-[var(--color-status-info)] border border-[color-mix(in_srgb,var(--color-status-info)_28%,transparent)]",
  pending:
    "bg-[var(--color-status-pending-muted)] text-[var(--color-status-pending)] border border-[color-mix(in_srgb,var(--color-status-pending)_28%,transparent)]",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-primary",
  secondary: "bg-muted-foreground",
  success: "bg-[var(--color-status-ok)]",
  warning: "bg-[var(--color-status-warning)]",
  destructive: "bg-[var(--color-status-error)]",
  outline: "bg-muted-foreground",
  active: "bg-[var(--color-status-ok)]",
  alert: "bg-[var(--color-status-error)]",
  info: "bg-[var(--color-status-info)]",
  pending: "bg-[var(--color-status-pending)]",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-[0.6875rem] gap-1 rounded-xs",
  md: "px-2.5 py-1 text-xs gap-1.5 rounded-md",
};

export function Badge({
  variant = "default",
  size = "md",
  dot = false,
  dotColor,
  pulse = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      role={pulse ? "status" : undefined}
      className={cn(
        "mono-tabular inline-flex items-center font-semibold tracking-[0.01em]",
        sizeStyles[size],
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "relative inline-block h-1.5 w-1.5 rounded-full",
            dotColor || dotColors[variant],
            pulse && "live-dot",
          )}
          style={pulse ? { color: "currentColor" } : undefined}
        />
      )}
      {children}
    </span>
  );
}
