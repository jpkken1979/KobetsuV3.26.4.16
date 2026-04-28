import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

interface HeroStat {
  label: string;
  value: number;
  format?: (n: number) => string;
}

interface BatchPageShellProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  breadcrumb?: readonly string[];
  badge?: string;
  stats?: readonly HeroStat[];
  children?: ReactNode;
}

const heroVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
} as const;

const iconVariants = {
  rest: { rotate: 0, scale: 1 },
  hover: { rotate: -6, scale: 1.06, transition: { type: "spring" as const, stiffness: 280, damping: 16 } },
} as const;

export function BatchPageShell({
  title,
  subtitle,
  icon: Icon,
  breadcrumb,
  badge = "BATCH MODE",
  stats,
  children,
}: BatchPageShellProps) {
  const shouldReduceMotion = useReducedMotion();
  const [spotlight, setSpotlight] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (shouldReduceMotion) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setSpotlight({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    [shouldReduceMotion],
  );

  const handleMouseLeave = useCallback(() => setSpotlight(null), []);

  return (
    <div className="flex flex-col gap-6">
      <motion.section
        variants={shouldReduceMotion ? undefined : heroVariants}
        initial={shouldReduceMotion ? undefined : "hidden"}
        animate={shouldReduceMotion ? undefined : "visible"}
        whileHover={shouldReduceMotion ? undefined : "hover"}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "group relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-6",
          "shadow-[var(--shadow-card)] backdrop-blur-xl",
        )}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background: spotlight
              ? `radial-gradient(420px circle at ${spotlight.x}px ${spotlight.y}px, color-mix(in srgb, var(--color-primary) 14%, transparent), transparent 55%)`
              : undefined,
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -bottom-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-5">
          {breadcrumb && breadcrumb.length > 0 && (
            <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
              {breadcrumb.map((crumb, idx) => (
                <span key={`${crumb}-${idx}`} className="flex items-center gap-1.5">
                  <span className={cn(idx === breadcrumb.length - 1 && "font-semibold text-foreground/80")}>{crumb}</span>
                  {idx < breadcrumb.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                </span>
              ))}
            </nav>
          )}

          <div className="flex items-start gap-5">
            <motion.div
              variants={shouldReduceMotion ? undefined : iconVariants}
              initial="rest"
              className={cn(
                "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
                "bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))]",
                "shadow-[0_8px_28px_-6px_color-mix(in_srgb,var(--color-primary)_55%,transparent)]",
              )}
            >
              <Icon className="h-7 w-7 text-primary-foreground" strokeWidth={2.2} />
              <span className="absolute -inset-1 -z-10 rounded-2xl bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))] opacity-40 blur-md" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5",
                    "font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary",
                  )}
                >
                  <span className="live-dot text-primary" />
                  {badge}
                </span>
              </div>
              <h1
                className={cn(
                  "text-display text-2xl md:text-3xl",
                  "bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))] bg-clip-text text-transparent",
                )}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>

          {stats && stats.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border/40 pt-4">
              {stats.map((stat) => (
                <div key={stat.label} className="flex items-baseline gap-2">
                  <AnimatedNumber
                    value={stat.value}
                    format={stat.format}
                    className="text-display text-xl font-bold tabular-nums text-foreground"
                  />
                  <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.section>

      {children}
    </div>
  );
}
