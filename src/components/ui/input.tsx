import { forwardRef, type InputHTMLAttributes, type ComponentType } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ComponentType<{ className?: string }>;
  suffix?: React.ReactNode;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon: Icon, suffix, error, ...props }, ref) => {
    const baseInputClass = cn(
      "flex h-10 w-full rounded-full border bg-card/80 text-sm shadow-xs transition-all backdrop-blur-sm",
      "placeholder:text-muted-foreground/45",
      "focus:outline-none focus:ring-2 focus:shadow-md focus:shadow-primary/10",
      "disabled:cursor-not-allowed disabled:opacity-50",
      error
        ? "border-destructive/70 focus:border-destructive focus:ring-destructive/25"
        : "border-border/70 focus:border-primary/45 focus:ring-primary/25",
    );

    if (Icon || suffix) {
      return (
        <div className="relative">
          {Icon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <input
            ref={ref}
            aria-invalid={error ? true : undefined}
            className={cn(
              baseInputClass,
              Icon ? "pl-10 pr-3 py-2.5" : "px-3 py-2.5",
              suffix ? "pr-16" : "",
              className,
            )}
            {...props}
          />
          {suffix && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {suffix}
            </div>
          )}
          {error && (
            <p className="mt-1 text-xs text-destructive">{error}</p>
          )}
        </div>
      );
    }

    return (
      <div className="w-full">
        <input
          ref={ref}
          aria-invalid={error ? true : undefined}
          className={cn(baseInputClass, "px-3 py-2.5", className)}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
