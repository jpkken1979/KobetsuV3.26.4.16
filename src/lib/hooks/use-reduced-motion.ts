import { useReducedMotion } from "motion/react";

/**
 * Centralizado hook para verificar si el usuario prefiere reducir el movimiento.
 * Retorna `true` si `prefers-reduced-motion: reduce` está activo en las preferencias del SO.
 *
 * **Uso en componentes con `motion.*`:**
 *
 * ```tsx
 * const shouldReduce = useShouldReduceMotion();
 * if (shouldReduce) return <div>{children}</div>;
 * return <motion.div {...animationProps}>{children}</motion.div>;
 * ```
 *
 * O de forma inline en motion props:
 *
 * ```tsx
 * const shouldReduce = useShouldReduceMotion();
 * const motionProps = shouldReduce ? {} : { animate: "visible", ... };
 * ```
 *
 * **Referencia:** Audit C-001 — 23 archivos requieren esta guardia.
 */
export function useShouldReduceMotion(): boolean {
  return useReducedMotion() ?? false;
}
