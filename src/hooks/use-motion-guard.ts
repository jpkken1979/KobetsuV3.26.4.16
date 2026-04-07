/**
 * useMotionGuard — accessibility hook for Framer Motion
 *
 * Returns a reduced-motion-aware configuration for motion components.
 * Use this hook in any component that uses motion elements.
 *
 * Usage:
 *   const guard = useMotionGuard();
 *   if (guard.shouldReduce) return <div>{children}</div>;
 *   return <motion.div animate={guard.shouldReduce ? undefined : { opacity: 1 }} ...>;
 *
 * Or use MotionGuard component for simpler usage:
 *   <MotionGuard animation={{ opacity: 1, y: 0 }}>
 *     <div>Content</div>
 *   </MotionGuard>
 */
import { useReducedMotion } from "motion/react";
import type { Variants, Transition } from "motion/react";

export interface MotionGuardConfig {
  shouldReduce: boolean;
  /** Return undefined variants when reducing, original variants otherwise */
  variants(v: Variants): Variants | undefined;
  /** Return a noop transition when reducing */
  transition(t: Transition): Transition | undefined;
}

export function useMotionGuard(): MotionGuardConfig {
  const shouldReduce = useReducedMotion() ?? false;

  return {
    shouldReduce,
    variants: (v: Variants) => (shouldReduce ? undefined : v),
    transition: (t: Transition) => (shouldReduce ? { duration: 0 } : t),
  };
}
