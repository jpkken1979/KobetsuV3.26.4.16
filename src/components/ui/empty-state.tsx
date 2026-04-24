import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, children, className }: EmptyStateProps) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      {...(shouldReduceMotion
        ? {}
        : {
            initial: { opacity: 0, scale: 0.97 },
            animate: { opacity: 1, scale: 1 },
            transition: { duration: 0.25, ease: [0.5, 0, 0, 1] as [number, number, number, number] },
          })}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-card py-16",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex h-16 w-16 items-center justify-center rounded-md",
          "border border-[color-mix(in_srgb,var(--color-primary)_22%,var(--color-border))]",
          "bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)]",
        )}
      >
        <Icon
          className="h-7 w-7"
          style={{ color: "color-mix(in srgb, var(--color-primary) 75%, white)" }}
          aria-hidden="true"
        />
      </div>
      <p className="mt-5 text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-2 max-w-[320px] text-center text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {children && <div className="mt-5">{children}</div>}
    </motion.div>
  );
}
