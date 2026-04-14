import React, { useEffect, useRef } from "react";
import {
  motion,
  useInView,
  useSpring,
  useMotionValue,
  useReducedMotion,
  type Variants,
  type HTMLMotionProps,
} from "motion/react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Shared spring config used across components
// ─────────────────────────────────────────────
const SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };

// ─────────────────────────────────────────────
// 1. AnimatedPage
//    Wraps page content with fade-in + slide-up entrance
// ─────────────────────────────────────────────

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ...SPRING, duration: 0.4 },
  },
};

interface AnimatedPageProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
}

export function AnimatedPage({
  children,
  className,
  ...props
}: AnimatedPageProps) {
  const shouldReduce = useReducedMotion();
  if (shouldReduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// 2. NumberTicker
//    Animated counting number with spring physics
// ─────────────────────────────────────────────

interface NumberTickerProps {
  value: number;
  /** Format number with locale separators (default: true) */
  format?: boolean;
  /** Decimal places (default: 0) */
  decimals?: number;
  /** Prefix, e.g. "¥" */
  prefix?: string;
  /** Suffix, e.g. "件" */
  suffix?: string;
  className?: string;
  /** Only animate when in view (default: true) */
  inView?: boolean;
}

export function NumberTicker({
  value,
  format = true,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  inView = true,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    stiffness: 120,
    damping: 28,
    mass: 1,
  });

  const shouldAnimate = inView ? isInView : true;

  useEffect(() => {
    if (shouldAnimate && !shouldReduceMotion) {
      motionValue.set(value);
    } else if (shouldReduceMotion && ref.current) {
      // When motion is reduced, set value directly
      const num = decimals > 0 ? value.toFixed(decimals) : Math.round(value);
      const display = format
        ? Number(num).toLocaleString("ja-JP", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : String(num);
      ref.current.textContent = `${prefix}${display}${suffix}`;
    }
  }, [shouldAnimate, value, motionValue, shouldReduceMotion, format, decimals, prefix, suffix]);

  useEffect(() => {
    if (shouldReduceMotion) return;

    const unsubscribe = springValue.on("change", (latest) => {
      if (ref.current) {
        const num = decimals > 0 ? latest.toFixed(decimals) : Math.round(latest);
        const display = format
          ? Number(num).toLocaleString("ja-JP", {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })
          : String(num);
        ref.current.textContent = `${prefix}${display}${suffix}`;
      }
    });
    return unsubscribe;
  }, [springValue, format, decimals, prefix, suffix, shouldReduceMotion]);

  return (
    <span
      ref={ref}
      className={cn("tabular-nums", className)}
    >
      {prefix}0{suffix}
    </span>
  );
}

// ─────────────────────────────────────────────
// 3. GradientText
//    Text with animated shifting gradient
// ─────────────────────────────────────────────

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  as?: "span" | "h1" | "h2" | "h3" | "h4" | "p";
  /** Gradient stops — defaults to primary → accent */
  from?: string;
  to?: string;
}

export function GradientText({
  children,
  className,
  as: Tag = "span",
  from,
  to,
}: GradientTextProps) {
  return (
    <Tag
      className={cn(
        "inline-block bg-clip-text text-transparent",
        "animate-[gradient-shift_4s_ease_infinite]",
        "bg-[length:200%_auto]",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(90deg, ${from || "var(--color-primary)"}, ${to || "var(--color-accent)"}, ${from || "var(--color-primary)"})`,
      }}
    >
      {children}
    </Tag>
  );
}

// gradient-shift keyframes defined in index.css — no runtime injection needed

