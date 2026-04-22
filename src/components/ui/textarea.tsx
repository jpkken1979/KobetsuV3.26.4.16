import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          className={cn(
            "flex min-h-[96px] w-full rounded-md border bg-card/70 px-3 py-2.5 text-sm backdrop-blur-sm",
            "transition-[border-color,box-shadow,background-color] duration-200",
            "placeholder:text-muted-foreground/55",
            "focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "resize-y",
            error
              ? cn(
                  "border-[color-mix(in_srgb,var(--color-destructive)_60%,var(--color-border))]",
                  "focus-visible:border-destructive",
                  "focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-destructive)_18%,transparent)]",
                )
              : cn(
                  "border-border/70",
                  "focus-visible:border-[color-mix(in_srgb,var(--color-primary)_55%,var(--color-border))]",
                  "focus-visible:bg-card/90",
                  "focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-primary)_18%,transparent)]",
                ),
            className
          )}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-[var(--color-status-error)]">{error}</p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
export type { TextareaProps };
