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
        "flex flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border/60 bg-card/70 py-20 shadow-[var(--shadow-card)] backdrop-blur-sm",
        className,
      )}
    >
      <div className="rounded-2xl bg-primary/10 p-4 ring-1 ring-primary/10">
        <Icon className="h-10 w-10 text-primary/45" aria-hidden="true" />
      </div>
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-2 max-w-[280px] text-center text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </motion.div>
  );
}
