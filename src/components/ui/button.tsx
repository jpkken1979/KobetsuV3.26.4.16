import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "btn-press inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 dark:shadow-[0_0_20px_rgba(0,255,136,0.2)] dark:hover:shadow-[0_0_28px_rgba(0,255,136,0.35)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-card hover:bg-muted hover:border-primary/40 text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-muted text-muted-foreground hover:text-foreground",
        link:
          "text-primary underline-offset-4 hover:underline",
        cyan:
          "bg-cyan-800 text-white font-bold hover:-translate-y-0.5 dark:bg-gradient-to-r dark:from-cyan-400 dark:to-cyan-500 dark:text-foreground dark:shadow-[0_0_16px_rgba(0,245,212,0.3)]",
        success:
          "bg-emerald-600 text-white hover:bg-emerald-700",
      },
      size: {
        default: "h-10 px-4 py-2 text-sm",
        sm:      "h-8 px-3 py-1.5 text-xs",
        lg:      "h-11 px-6 py-3 text-sm",
        icon:    "h-9 w-9 p-0",
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
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
