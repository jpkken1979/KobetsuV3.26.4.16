import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)] transition-colors",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";


export { Card };
