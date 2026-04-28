import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import type { LucideIcon } from "lucide-react";

export interface BentoStat {
  label: string;
  value: number;
  hint?: string;
  icon: LucideIcon;
  accent?: "primary" | "accent" | "ok" | "info";
  format?: (n: number) => string;
}

interface BentoStatsGridProps {
  stats: readonly BentoStat[];
  className?: string;
}

const ACCENT_TOKENS: Record<NonNullable<BentoStat["accent"]>, { fg: string; ring: string; glow: string }> = {
  primary: {
    fg: "text-primary",
    ring: "ring-primary/25",
    glow: "from-primary/15 via-primary/5 to-transparent",
  },
  accent: {
    fg: "text-[color:var(--color-accent)]",
    ring: "ring-[color-mix(in_srgb,var(--color-accent)_25%,transparent)]",
    glow: "from-[color-mix(in_srgb,var(--color-accent)_18%,transparent)] via-[color-mix(in_srgb,var(--color-accent)_5%,transparent)] to-transparent",
  },
  ok: {
    fg: "text-[var(--color-status-ok)]",
    ring: "ring-[color-mix(in_srgb,var(--color-status-ok)_25%,transparent)]",
    glow: "from-[color-mix(in_srgb,var(--color-status-ok)_18%,transparent)] via-[color-mix(in_srgb,var(--color-status-ok)_5%,transparent)] to-transparent",
  },
  info: {
    fg: "text-[var(--color-info)]",
    ring: "ring-[color-mix(in_srgb,var(--color-info)_25%,transparent)]",
    glow: "from-[color-mix(in_srgb,var(--color-info)_18%,transparent)] via-[color-mix(in_srgb,var(--color-info)_5%,transparent)] to-transparent",
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  }),
} as const;

export function BentoStatsGrid({ stats, className }: BentoStatsGridProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {stats.map((stat, i) => {
        const tokens = ACCENT_TOKENS[stat.accent ?? "primary"];
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            custom={i}
            variants={shouldReduceMotion ? undefined : cardVariants}
            initial={shouldReduceMotion ? undefined : "hidden"}
            animate={shouldReduceMotion ? undefined : "visible"}
            whileHover={shouldReduceMotion ? undefined : { y: -3 }}
            transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-border/60 bg-card/90 p-4",
              "shadow-[var(--shadow-card)] backdrop-blur-sm",
              "hover:border-primary/30 hover:ring-1",
              tokens.ring,
            )}
          >
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-radial blur-2xl",
                "bg-gradient-to-br opacity-50 transition-opacity duration-500 group-hover:opacity-90",
                tokens.glow,
              )}
            />

            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
                  {stat.label}
                </p>
                <AnimatedNumber
                  value={stat.value}
                  format={stat.format}
                  className={cn("text-display block text-2xl font-bold tabular-nums", tokens.fg)}
                />
                {stat.hint && (
                  <p className="text-[11px] text-muted-foreground/70">{stat.hint}</p>
                )}
              </div>

              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card ring-1 transition-transform duration-300 group-hover:scale-110",
                  tokens.ring,
                )}
              >
                <Icon className={cn("h-5 w-5", tokens.fg)} strokeWidth={2} />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
