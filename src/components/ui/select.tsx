import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 cursor-pointer rounded-xl border border-border/60 bg-card px-3 py-2.5 text-sm shadow-xs transition-all",
        "focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 dark:focus:ring-primary/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = "Select";

export { Select };
