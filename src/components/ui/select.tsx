import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 cursor-pointer appearance-none rounded-md border border-border/70 bg-card/70 pl-3 pr-9 py-2.5 text-sm backdrop-blur-sm",
        "transition-[border-color,box-shadow,background-color] duration-200",
        "focus:outline-none",
        "focus:border-[color-mix(in_srgb,var(--color-primary)_55%,var(--color-border))]",
        "focus:bg-card/90",
        "focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-primary)_18%,transparent),0_6px_18px_-6px_color-mix(in_srgb,var(--color-primary)_25%,transparent)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Chevron SVG custom en data URL, color-aware via CSS filter
        "[background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")]",
        "[background-repeat:no-repeat]",
        "[background-position:right_0.75rem_center]",
        "[background-size:0.75rem_0.75rem]",
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = "Select";

export { Select };
