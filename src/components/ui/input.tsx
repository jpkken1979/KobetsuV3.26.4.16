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
      "flex h-10 w-full rounded-md border bg-card/70 text-sm backdrop-blur-sm",
      "transition-[border-color,box-shadow,background-color] duration-200",
      "placeholder:text-muted-foreground/50",
      "focus:outline-none",
      "disabled:cursor-not-allowed disabled:opacity-50",
      error
        ? cn(
            "border-[color-mix(in_srgb,var(--color-destructive)_60%,var(--color-border))]",
            "focus:border-destructive",
            "focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-destructive)_18%,transparent),0_6px_18px_-6px_color-mix(in_srgb,var(--color-destructive)_30%,transparent)]",
          )
        : cn(
            "border-border/70",
            "focus:border-[color-mix(in_srgb,var(--color-primary)_55%,var(--color-border))]",
            "focus:bg-card/90",
            "focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-primary)_18%,transparent),0_6px_18px_-6px_color-mix(in_srgb,var(--color-primary)_25%,transparent)]",
          ),
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
            <p className="mt-1.5 text-xs text-[var(--color-status-error)]">{error}</p>
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
          <p className="mt-1.5 text-xs text-[var(--color-status-error)]">{error}</p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
