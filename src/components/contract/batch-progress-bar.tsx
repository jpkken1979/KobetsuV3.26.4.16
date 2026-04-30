import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useShouldReduceMotion } from "@/lib/hooks/use-reduced-motion";
import { Loader2 } from "lucide-react";

interface BatchProgressBarProps {
  /** Current step count */
  current: number;
  /** Total steps (factories or contracts) */
  total: number;
  /** Optional label override (default: " Procesando {current}/{total}...") */
  label?: string;
  /** Sub-label showing the current phase */
  phase?: string;
  /** Show spinner instead of bar */
  indeterminate?: boolean;
}

const containerVariants = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export function BatchProgressBar({
  current,
  total,
  label,
  phase,
  indeterminate = false,
}: BatchProgressBarProps) {
  const reduceMotion = useShouldReduceMotion();
  const [prevCurrent, setPrevCurrent] = useState(current);
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  // Reset when a new batch starts
  useEffect(() => {
    if (current === 1 && prevCurrent >= total) {
      setPrevCurrent(1);
    } else if (current !== prevCurrent) {
      setPrevCurrent(current);
    }
  }, [current, total, prevCurrent]);

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>
            {label ?? `処理中 ${current} / ${total}`}
          </span>
        </div>
        <span className="mono-tabular text-xs text-muted-foreground">{pct}%</span>
      </div>

      <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
        {indeterminate ? (
          <div className="absolute inset-0 -translate-x-1/3 animate-pulse rounded-full bg-primary/60" />
        ) : (
          <motion.div
            className="h-full rounded-full bg-primary transition-none"
            style={{ width: `${pct}%` }}
            animate={
              reduceMotion
                ? {}
                : {
                    width: `${pct}%`,
                    transition: { duration: 0.3, ease: "easeOut" },
                  }
            }
          />
        )}
      </div>

      {phase && (
        <p className="mt-1.5 text-xs text-muted-foreground">{phase}</p>
      )}
    </motion.div>
  );
}