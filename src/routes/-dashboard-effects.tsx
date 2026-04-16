import { cn } from "@/lib/utils";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import {
  useCallback,
  useRef,
  type ReactNode,
} from "react";

const hoverTransition = {
  type: "spring" as const,
  stiffness: 220,
  damping: 24,
};

const ambientToneClass = {
  emerald:
    "bg-[radial-gradient(circle_at_top_left,rgba(214,31,42,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,122,24,0.10),transparent_42%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,77,79,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,176,0,0.08),transparent_42%)]",
  cyan:
    "bg-[radial-gradient(circle_at_top_right,rgba(8,145,178,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.10),transparent_40%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.13),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(45,212,191,0.10),transparent_40%)]",
  amber:
    "bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.10),transparent_40%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.13),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.09),transparent_40%)]",
  rose:
    "bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(248,113,113,0.10),transparent_40%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(248,113,113,0.08),transparent_40%)]",
} as const;

const spotlightTone = {
  emerald: "rgba(214, 31, 42, 0.22)",
  cyan: "rgba(34, 211, 238, 0.22)",
  amber: "rgba(251, 191, 36, 0.22)",
  rose: "rgba(244, 63, 94, 0.18)",
} as const;

interface SpotlightPanelProps {
  children: ReactNode;
  className?: string;
  tone?: keyof typeof ambientToneClass;
  spotlightSize?: number;
  spotlightClassName?: string;
}

export function SpotlightPanel({
  children,
  className,
  tone = "cyan",
  spotlightSize = 240,
  spotlightClassName,
}: SpotlightPanelProps) {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const spotlightX = useMotionValue(0);
  const spotlightY = useMotionValue(0);
  const spotlightOpacity = useMotionValue(0);
  const spotlightBackground = useMotionTemplate`radial-gradient(${spotlightSize}px circle at ${spotlightX}px ${spotlightY}px, ${spotlightTone[tone]}, transparent 62%)`;

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (shouldReduceMotion || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      spotlightX.set(event.clientX - rect.left);
      spotlightY.set(event.clientY - rect.top);
      spotlightOpacity.set(1);
    },
    [shouldReduceMotion, spotlightOpacity, spotlightX, spotlightY],
  );

  const handlePointerLeave = useCallback(() => {
    spotlightOpacity.set(0);
  }, [spotlightOpacity]);

  return (
    <motion.div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      whileHover={shouldReduceMotion ? undefined : { y: -4, scale: 1.01 }}
      transition={shouldReduceMotion ? undefined : hoverTransition}
      className={cn(
        "group relative overflow-hidden rounded-[1.85rem] border border-border/60 bg-card/78 shadow-[var(--shadow-lg)] backdrop-blur-xl",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-90",
          ambientToneClass[tone],
        )}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_24%,transparent_68%,rgba(255,255,255,0.08))] opacity-70 dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.07),transparent_24%,transparent_68%,rgba(255,255,255,0.04))]" />
      <motion.div
        aria-hidden="true"
        style={
          shouldReduceMotion
            ? undefined
            : { opacity: spotlightOpacity, background: spotlightBackground }
        }
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-300",
          spotlightClassName,
        )}
      />
      <div className="pointer-events-none absolute inset-px rounded-[1.75rem] border border-white/10 opacity-70 dark:border-white/6" />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

