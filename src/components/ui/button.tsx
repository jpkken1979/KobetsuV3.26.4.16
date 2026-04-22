import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "btn-press focus-premium shine-hover relative inline-flex cursor-pointer items-center justify-center gap-2",
    "rounded-md font-semibold tracking-[-0.005em]",
    "transition-[transform,background-color,border-color,box-shadow,color] duration-200",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary: gradient rojo → naranja con glow doble ring + shine permanente
        default: cn(
          "text-primary-foreground border border-transparent",
          "bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))]",
          "shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--color-primary)_55%,transparent),0_0_0_1px_color-mix(in_srgb,var(--color-primary)_30%,transparent)]",
          "hover:-translate-y-[1px]",
          "hover:shadow-[0_12px_32px_-6px_color-mix(in_srgb,var(--color-primary)_60%,transparent),0_0_0_1px_color-mix(in_srgb,var(--color-primary)_45%,transparent)]",
          "active:translate-y-0",
        ),
        // Destructive: rojo sólido puro, sin naranja
        destructive: cn(
          "bg-destructive text-destructive-foreground border border-transparent",
          "shadow-[0_8px_20px_-6px_color-mix(in_srgb,var(--color-destructive)_55%,transparent)]",
          "hover:-translate-y-[1px]",
          "hover:shadow-[0_12px_28px_-4px_color-mix(in_srgb,var(--color-destructive)_60%,transparent)]",
        ),
        // Outline: border gradient sutil, bg card translúcida
        outline: cn(
          "bg-card/60 text-foreground border border-border/70 backdrop-blur-sm",
          "hover:border-[color-mix(in_srgb,var(--color-primary)_45%,var(--color-border))]",
          "hover:bg-card/80",
          "hover:shadow-[0_4px_14px_-4px_color-mix(in_srgb,var(--color-primary)_25%,transparent)]",
        ),
        // Secondary: neutro con hover primary hint
        secondary: cn(
          "bg-secondary text-secondary-foreground border border-border/50",
          "hover:bg-[color-mix(in_srgb,var(--color-secondary)_85%,var(--color-primary))]",
          "hover:border-[color-mix(in_srgb,var(--color-primary)_30%,var(--color-border))]",
        ),
        // Ghost: invisible hasta hover
        ghost: cn(
          "text-muted-foreground border border-transparent",
          "hover:bg-muted/60 hover:text-foreground",
        ),
        // Link: inline text con underline animado
        link: "text-primary underline-offset-4 hover:underline border-none shadow-none",
        // Legacy aliases — redirigen al default para mantener compatibilidad
        cyan: cn(
          "text-primary-foreground border border-transparent",
          "bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))]",
          "shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--color-primary)_55%,transparent)]",
          "hover:-translate-y-[1px]",
        ),
        success: cn(
          "bg-[color-mix(in_srgb,var(--color-status-ok)_95%,black)] text-white border border-transparent",
          "shadow-[0_8px_20px_-6px_color-mix(in_srgb,var(--color-status-ok)_55%,transparent)]",
          "hover:-translate-y-[1px]",
        ),
      },
      size: {
        default: "h-10 px-4 py-2 text-sm",
        sm: "h-8 px-3 py-1.5 text-xs",
        lg: "h-11 px-6 py-2.5 text-sm",
        icon: "h-9 w-9 p-0 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
