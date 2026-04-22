import { forwardRef, useCallback, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "elevated" | "hero" | "glass";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Habilita spotlight cursor-follow (solo en elevated/hero) */
  spotlight?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", spotlight = false, onMouseMove, ...props }, ref) => {
    const handleMouseMove = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (spotlight) {
          const target = event.currentTarget;
          const rect = target.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 100;
          const y = ((event.clientY - rect.top) / rect.height) * 100;
          target.style.setProperty("--mx", `${x}%`);
          target.style.setProperty("--my", `${y}%`);
        }
        onMouseMove?.(event);
      },
      [spotlight, onMouseMove],
    );

    const base = "relative rounded-lg border text-card-foreground transition-all duration-200";
    const variants: Record<CardVariant, string> = {
      default: cn(
        "border-border/60 bg-card/90 shadow-[var(--shadow-card)] backdrop-blur-sm",
      ),
      elevated: cn(
        "border-border/60 bg-card shadow-[var(--shadow-md)]",
        "hover:-translate-y-[2px] hover:shadow-[var(--shadow-lg)]",
        "hover:border-[color-mix(in_srgb,var(--color-primary)_22%,var(--color-border))]",
        spotlight && "spotlight",
      ),
      hero: cn(
        "aurora-border overflow-hidden",
        "shadow-[var(--shadow-lg)]",
        spotlight && "spotlight",
      ),
      glass: "glass rounded-lg",
    };

    return (
      <div
        ref={ref}
        onMouseMove={handleMouseMove}
        data-variant={variant}
        className={cn(base, variants[variant], className)}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

export { Card };
export type { CardVariant, CardProps };
