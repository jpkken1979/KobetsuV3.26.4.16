/**
 * Colores para charts (Recharts) — bridge a los tokens semánticos `--color-chart-N`.
 *
 * Los hex resuelven a tokens CSS variables. Recharts no puede leer CSS vars directamente,
 * así que exportamos los strings `var(--color-chart-N)` y los componentes los pasan como
 * `fill` / `stroke` — Recharts serializa a inline style que SÍ resuelve variables.
 *
 * Orden semántico (1=primary/accent más prominente → 8=neutral):
 *   1 rojo primary · 2 naranja accent · 3 dorado · 4 emerald · 5 azul · 6 violeta · 7 rosa · 8 gris
 */
export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
] as const;
