import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" | "active" | "alert" | "info";
  dot?: boolean;
  dotColor?: string;
  pulse?: boolean;
}

const variantStyles: Record<string, string> = {
  default:
    "bg-primary/10 text-primary ring-primary/20 dark:bg-primary/20",
  secondary:
    "bg-muted text-muted-foreground ring-border",
  success:
    "bg-success-muted text-success-foreground border border-success/30",
  warning:
    "bg-warning-muted text-warning-foreground border border-warning/30",
  destructive:
    "bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-700/50",
  outline:
    "border border-border/60 text-muted-foreground bg-transparent ring-0",
  active:
    "bg-success-muted text-success-foreground border border-success/30",
  alert:
    "bg-alert-muted text-alert-foreground border border-alert/30",
  info:
    "bg-info-muted text-info-foreground border border-info/30",
};

const dotColors: Record<string, string> = {
  default: "bg-primary",
  secondary: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning-foreground",
  destructive: "bg-red-500",
  outline: "bg-muted-foreground",
  active: "bg-success",
  alert: "bg-alert-foreground",
  info: "bg-info-foreground",
};

export function Badge({
  variant = "default",
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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            dotColor || dotColors[variant],
            pulse && "animate-pulse",
          )}
        />
      )}
      {children}
    </span>
  );
}
