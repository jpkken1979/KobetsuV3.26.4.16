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
          })}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/40 bg-card/30 py-20",
        className,
      )}
    >
      <div className="rounded-2xl bg-muted/50 p-4">
        <Icon className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
      </div>
      <p className="mt-4 text-base font-semibold text-muted-foreground">{title}</p>
      {description && (
        <p className="mt-2 max-w-[240px] text-center text-xs text-muted-foreground/70 leading-relaxed">
          {description}
        </p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </motion.div>
  );
}
