import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

interface ParticleBurstProps {
  trigger: boolean;
  count?: number;
  radius?: number;
  className?: string;
  colors?: readonly string[];
}

const DEFAULT_COLORS = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-status-ok)",
] as const;

export function ParticleBurst({
  trigger,
  count = 14,
  radius = 96,
  className,
  colors = DEFAULT_COLORS,
}: ParticleBurstProps) {
  const shouldReduceMotion = useReducedMotion();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!trigger || shouldReduceMotion) return;
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), 1100);
    return () => window.clearTimeout(timer);
  }, [trigger, shouldReduceMotion]);

  if (shouldReduceMotion) return null;

  return (
    <div className={cn("pointer-events-none absolute inset-0 z-10 overflow-visible", className)}>
      <AnimatePresence>
        {active && (
          <div className="absolute left-1/2 top-1/2 h-0 w-0">
            {Array.from({ length: count }).map((_, i) => {
              const angle = (i / count) * Math.PI * 2;
              const distance = radius * (0.7 + Math.random() * 0.5);
              const x = Math.cos(angle) * distance;
              const y = Math.sin(angle) * distance;
              const color = colors[i % colors.length];
              const size = 4 + Math.random() * 4;
              return (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: [0, 1, 1, 0],
                    scale: [0, 1, 1, 0.4],
                    x,
                    y,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: 0.95,
                    ease: [0.16, 1, 0.3, 1],
                    delay: i * 0.012,
                  }}
                  style={{
                    width: size,
                    height: size,
                    backgroundColor: color,
                    boxShadow: `0 0 8px ${color}`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                />
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
