# UI/UX Modernización KobetsuV3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir 8 bugs de dark/light mode, estandarizar tokens semánticos en componentes base, y agregar stagger animations + skeleton loaders + hover states refinados en las pantallas de mayor impacto.

**Architecture:** Fase 1 corrige los cimientos (CSS keyframes + componentes base) para que el sistema de tokens sea 100% consistente. Fase 2 mejora el Dashboard con skeletons específicos y hover con scale. Fase 3 agrega stagger animations en tablas de Contratos y Empleados, y corrige accesibilidad en el bulk action bar.

**Tech Stack:** React 19, Tailwind CSS v4 (`@theme`), `motion/react` (no `framer-motion`), Vitest 4, TypeScript strict. Todos los variants de motion FUERA de los componentes. `useReducedMotion()` obligatorio en todo componente con animación.

---

## File Map

| Archivo | Acción | Tareas |
|---------|--------|--------|
| `src/index.css` | Modify | T1 |
| `src/components/layout/sidebar.tsx` | Modify | T2 |
| `src/components/ui/button.tsx` | Modify | T3 |
| `src/routes/-dashboard-stats.tsx` | Modify | T3, T8, T9 |
| `src/components/ui/badge.tsx` | Modify | T4 |
| `src/components/ui/confirm-dialog.tsx` | Modify | T5 |
| `src/components/ui/input.tsx` | Modify | T6 |
| `src/components/ui/skeleton.tsx` | Modify | T7 |
| `src/routes/index.tsx` | Modify | T7 |
| `src/routes/-dashboard-alerts.tsx` | Modify | T10 |
| `src/routes/contracts/index.tsx` | Modify | T11, T12 |
| `src/routes/employees/index.tsx` | Modify | T13 |

---

## Task 1: Fix CSS keyframes hardcodeados en emerald (B1)

**Files:**
- Modify: `src/index.css:299-322`

- [ ] **Step 1: Reemplazar los 3 keyframes hardcodeados**

Abrir `src/index.css`. Reemplazar las líneas 299-322 con el siguiente bloque completo:

```css
/* ── Pulse ring for important buttons ── */
@keyframes pulse-ring {
  0%   { box-shadow: 0 0 0 0   color-mix(in srgb, var(--color-primary) 40%, transparent); }
  70%  { box-shadow: 0 0 0 8px transparent; }
  100% { box-shadow: 0 0 0 0   transparent; }
}

.animate-pulse-ring {
  animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* ── Glow effect for cards on hover ── */
.card-glow {
  transition: box-shadow var(--duration-normal) ease, transform var(--duration-normal) ease;
}
.card-glow:hover {
  box-shadow: 0 0 20px color-mix(in srgb, var(--color-primary) 15%, transparent), var(--shadow-md);
  transform: translateY(-2px);
}

/* ── Row highlight animation for tables ── */
@keyframes row-highlight {
  0%   { background-color: color-mix(in srgb, var(--color-primary) 8%, transparent); }
  100% { background-color: transparent; }
}

.row-new {
  animation: row-highlight 2s ease-out;
}
```

- [ ] **Step 2: Verificar que el build no falla**

```bash
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 3: Verificar visualmente**

```bash
npm run dev
```

Abrir http://localhost:3026. En dark mode: cualquier elemento con `.animate-pulse-ring` o `.card-glow` debe mostrar un glow neon green (`#00ff88`) en lugar de emerald oscuro. Alternar light/dark con el botón de tema.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "fix(css): keyframes pulse-ring/card-glow/row-highlight usan color-mix con var(--color-primary)"
```

---

## Task 2: Fix tokens hardcodeados en sidebar (B2, B4, B5)

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Fix B4 — hover del botón de cierre invisible en light**

Buscar la línea que contiene `hover:bg-white/10 hover:text-foreground lg:hidden`.
Cambiar `hover:bg-white/10` por `hover:bg-muted/50`:

```tsx
// ANTES (línea ~137):
className="ml-auto rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-white/10 hover:text-foreground lg:hidden cursor-pointer"

// DESPUÉS:
className="ml-auto rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground lg:hidden cursor-pointer"
```

- [ ] **Step 2: Fix B5 — footer card sin contraste en light**

Buscar la línea que contiene `bg-white/[0.03]`.
Cambiar `bg-white/[0.03]` por `bg-muted/30`:

```tsx
// ANTES (línea ~199):
<div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-border/20 dark:ring-white/[0.05]">

// DESPUÉS:
<div className="flex items-center gap-3 rounded-xl bg-muted/30 px-3 py-2.5 ring-1 ring-border/20">
```

Nota: quitar el `dark:ring-white/[0.05]` también — el token `ring-border/20` ya tiene override dark correcto.

- [ ] **Step 3: Fix B2 — status dot siempre emerald**

Buscar la línea que contiene `bg-emerald-500 animate-pulse`.
Cambiar `bg-emerald-500` por `bg-primary`:

```tsx
// ANTES (línea ~212):
<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />

// DESPUÉS:
<span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
```

- [ ] **Step 4: Verificar**

```bash
npm run typecheck
```

Esperado: sin errores.

Verificar visualmente en light mode: el botón X de cierre del sidebar debe tener hover visible. El footer card debe tener fondo tenue. El dot verde debe ser neon green en dark.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "fix(sidebar): reemplazar colores hardcodeados por tokens semánticos (B2 B4 B5)"
```

---

## Task 3: Fix button success variant + trend badge (B3)

**Files:**
- Modify: `src/components/ui/button.tsx:26`
- Modify: `src/routes/-dashboard-stats.tsx:78-81`

- [ ] **Step 1: Fix button success variant**

En `src/components/ui/button.tsx`, reemplazar la variante `success`:

```tsx
// ANTES (línea ~26):
success:
  "bg-emerald-600 text-white hover:bg-emerald-700",

// DESPUÉS:
success:
  "bg-success text-success-foreground hover:bg-success/90",
```

- [ ] **Step 2: Fix trend badge en dashboard-stats**

En `src/routes/-dashboard-stats.tsx`, buscar el bloque del trend badge (línea ~78). Reemplazar:

```tsx
// ANTES:
<span
  className={cn(
    "flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold",
    trend === "up"
      ? "bg-emerald-500/10 text-emerald-500"
      : "bg-muted/50 text-muted-foreground",
  )}
>

// DESPUÉS:
<span
  className={cn(
    "flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold",
    trend === "up"
      ? "bg-primary/10 text-primary"
      : "bg-muted/50 text-muted-foreground",
  )}
>
```

- [ ] **Step 3: Verificar**

```bash
npm run typecheck
```

Verificar en dark mode: el botón `variant="success"` debe verse verde neon (`#34d399` según token `--color-success` en dark). El trend badge "↑" en las stat cards del dashboard debe usar el color primario del tema activo.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/button.tsx src/routes/-dashboard-stats.tsx
git commit -m "fix(button): variante success usa token semántico bg-success; fix trend badge en dashboard"
```

---

## Task 4: Fix badge destructive variant (B6)

**Files:**
- Modify: `src/components/ui/badge.tsx`

- [ ] **Step 1: Reemplazar la variante destructive y su dot color**

En `src/components/ui/badge.tsx`, reemplazar en el objeto `variantStyles`:

```tsx
// ANTES:
destructive:
  "bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-700/50",

// DESPUÉS:
destructive:
  "bg-destructive/10 text-destructive ring-destructive/20",
```

En el mismo archivo, reemplazar en el objeto `dotColors`:

```tsx
// ANTES:
destructive: "bg-red-500",

// DESPUÉS:
destructive: "bg-destructive",
```

- [ ] **Step 2: Verificar**

```bash
npm run typecheck
```

Verificar en dark mode: badges con `variant="destructive"` deben mostrar `#ff5c33` (el token `--color-destructive` en dark) en lugar del rojo de Tailwind.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "fix(badge): variante destructive usa tokens semánticos en lugar de red-* de Tailwind (B6)"
```

---

## Task 5: Fix confirm-dialog tokens (B7)

**Files:**
- Modify: `src/components/ui/confirm-dialog.tsx:34-37`

- [ ] **Step 1: Reemplazar colores hardcodeados del ícono de advertencia**

En `src/components/ui/confirm-dialog.tsx`, buscar el bloque del ícono de alerta destructiva:

```tsx
// ANTES (líneas ~34-37):
{variant === "destructive" && (
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/50">
    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
  </div>
)}

// DESPUÉS:
{variant === "destructive" && (
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
    <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
  </div>
)}
```

- [ ] **Step 2: Verificar**

```bash
npm run typecheck
```

Verificar en dark mode: el ícono de triángulo de advertencia debe usar el color `--color-destructive` del tema activo (`#ff5c33` en dark, `#dc2626` en light).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/confirm-dialog.tsx
git commit -m "fix(confirm-dialog): ícono destructive usa tokens semánticos en lugar de red-* (B7)"
```

---

## Task 6: Agregar aria-invalid a Input (B8)

**Files:**
- Modify: `src/components/ui/input.tsx`

- [ ] **Step 1: Agregar aria-invalid a ambas ramas del componente**

En `src/components/ui/input.tsx`, hay dos ramas: una con icon/suffix y una simple. Agregar `aria-invalid={error ? true : undefined}` al elemento `<input>` nativo en **ambas** ramas.

```tsx
// Rama con icon/suffix (línea ~33 del bloque con Icon):
<input
  ref={ref}
  aria-invalid={error ? true : undefined}
  className={cn(
    baseInputClass,
    Icon ? "pl-10 pr-3 py-2.5" : "px-3 py-2.5",
    suffix ? "pr-16" : "",
    className,
  )}
  {...props}
/>

// Rama simple (línea ~50 del bloque sin Icon):
<input
  ref={ref}
  aria-invalid={error ? true : undefined}
  className={cn(baseInputClass, "px-3 py-2.5", className)}
  {...props}
/>
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run typecheck
```

Esperado: sin errores. `aria-invalid` acepta `boolean | "true" | "false" | "grammar" | "spelling"` — `true` es válido.

- [ ] **Step 3: Verificar en el navegador**

```bash
npm run dev
```

Ir a cualquier formulario con validación (ej: `/contracts/new`). Activar un error de validación. Inspeccionar el `<input>` en DevTools → debe tener `aria-invalid="true"`.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/input.tsx
git commit -m "fix(input): agregar aria-invalid cuando hay error de validación (B8)"
```

---

## Task 7: Skeleton loaders específicos para Dashboard

**Files:**
- Modify: `src/components/ui/skeleton.tsx`
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Agregar StatCardSkeleton y DashboardSkeleton a skeleton.tsx**

Al final de `src/components/ui/skeleton.tsx`, agregar los dos componentes nuevos:

```tsx
export function StatCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-16" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-lg">
      <Skeleton className="mb-4 h-5 w-32" />
      <Skeleton className="h-[220px] w-full rounded-xl" />
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar los Loader2 spinners en routes/index.tsx**

En `src/routes/index.tsx`:

1. Agregar el import de los nuevos skeleton components al inicio del archivo:

```tsx
import { ChartSkeleton } from "@/components/ui/skeleton";
```

2. Reemplazar el `pendingComponent` del Route (spinner genérico):

```tsx
// ANTES:
pendingComponent: () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
),

// DESPUÉS:
pendingComponent: () => (
  <div className="relative space-y-8 pb-12">
    <div className="h-12 w-48 rounded-xl bg-muted/40 animate-pulse" />
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-muted/40" />
              <div className="h-9 w-16 animate-pulse rounded bg-muted/40" />
            </div>
            <div className="h-10 w-10 animate-pulse rounded-xl bg-muted/40" />
          </div>
        </div>
      ))}
    </div>
  </div>
),
```

3. Reemplazar el `chartFallback` (Loader2 en Suspense del chart):

```tsx
// ANTES:
const chartFallback = (
  <div className="flex h-[220px] items-center justify-center rounded-2xl border border-border/40 bg-card p-6 shadow-lg">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
  </div>
);

// DESPUÉS:
const chartFallback = <ChartSkeleton />;
```

4. Reemplazar el segundo Suspense fallback (QuickActions):

```tsx
// ANTES:
fallback={
  <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]">
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
    </div>
  </div>
}

// DESPUÉS:
fallback={
  <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]">
    <div className="space-y-3">
      <div className="h-4 w-32 animate-pulse rounded bg-muted/40" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
    </div>
  </div>
}
```

5. Si `Loader2` ya no se usa en el archivo después de estos cambios, eliminar su import de lucide-react.

- [ ] **Step 3: Verificar**

```bash
npm run typecheck
```

- [ ] **Step 4: Verificar visualmente**

```bash
npm run dev
```

Ir a http://localhost:3026. En DevTools Network, throttle a "Slow 3G". Recargar. Debe verse un skeleton de 6 cards pulsando antes de que aparezcan los datos reales.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/skeleton.tsx src/routes/index.tsx
git commit -m "feat(skeleton): agregar StatCardSkeleton/DashboardSkeleton/ChartSkeleton y reemplazar spinners en dashboard"
```

---

## Task 8: Verificar que NumberTicker funciona y documentar

**Files:**
- Read: `src/components/ui/animated.tsx` (verificación)

> **Nota:** `NumberTicker` ya existe en `src/components/ui/animated.tsx` y ya está en uso en `src/routes/-dashboard-stats.tsx` línea 68. Los animated counters **ya están implementados**. Esta tarea es de verificación.

- [ ] **Step 1: Confirmar que NumberTicker usa useReducedMotion**

Abrir `src/components/ui/animated.tsx`. Verificar que `NumberTicker` llama a `useReducedMotion()` y que si está activo, muestra el valor directamente sin animación.

Si `useReducedMotion()` NO está implementado en `NumberTicker`, agregar el check:

```tsx
// Patrón correcto para NumberTicker:
export function NumberTicker({ value }: { value: number }) {
  const shouldReduceMotion = useReducedMotion()
  // ... si shouldReduceMotion es true, retornar value directamente
}
```

- [ ] **Step 2: Verificar en browser**

```bash
npm run dev
```

Ir al dashboard. Los números de las 6 stat cards deben animar (count-up desde 0) al cargar la página. Si ya funcionan correctamente, la tarea está completa.

- [ ] **Step 3: Commit si hubo cambios**

Solo si se modificó `animated.tsx`:

```bash
git add src/components/ui/animated.tsx
git commit -m "fix(animated): NumberTicker respeta useReducedMotion"
```

---

## Task 9: Hover states con scale en stat cards

**Files:**
- Modify: `src/routes/-dashboard-stats.tsx`

- [ ] **Step 1: Agregar whileHover y whileTap al motion.div del StatCard**

En `src/routes/-dashboard-stats.tsx`, el `StatCard` ya usa `motion.div` (líneas ~103-117). Agregar `whileHover` y `whileTap`:

```tsx
// ANTES:
return (
  <motion.div
    initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
    transition={shouldReduceMotion ? undefined : { duration: 0.35, delay }}
  >

// DESPUÉS:
return (
  <motion.div
    initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
    transition={shouldReduceMotion ? undefined : { duration: 0.35, delay }}
    whileHover={shouldReduceMotion ? undefined : { scale: 1.02, y: -2 }}
    whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
  >
```

- [ ] **Step 2: Verificar**

```bash
npm run typecheck
```

Verificar en browser: hover sobre cualquier stat card → debe haber un scale sutil + elevación. Click → micro-bounce.

- [ ] **Step 3: Commit**

```bash
git add src/routes/-dashboard-stats.tsx
git commit -m "feat(dashboard): hover scale + tap feedback en stat cards via motion"
```

---

## Task 10: Stagger animation en DashboardAlerts

**Files:**
- Modify: `src/routes/-dashboard-alerts.tsx`

- [ ] **Step 1: Agregar variants de stagger FUERA del componente**

Al inicio de `src/routes/-dashboard-alerts.tsx`, antes de cualquier componente o función, agregar:

```tsx
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

// Variants fuera del componente (regla LUNARIS)
const alertListVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const alertItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" } },
};
```

- [ ] **Step 2: Envolver la lista de alertas con motion.div**

Dentro del componente que renderiza la lista de alertas, envolver el contenedor padre con:

```tsx
const shouldReduceMotion = useReducedMotion();

// El wrapper de la lista:
<motion.div
  variants={alertListVariants}
  initial={shouldReduceMotion ? false : "hidden"}
  animate="visible"
>
  {alerts.map((alert, index) => (
    <motion.div
      key={alert.id ?? index}
      variants={alertItemVariants}
    >
      {/* contenido del alert existente sin cambios */}
    </motion.div>
  ))}
</motion.div>
```

**Nota:** Identificar el elemento correcto leyendo el archivo. Buscar el `.map()` que renderiza la lista de alertas y envolver con los motion.div. El contenido interno NO debe cambiar.

- [ ] **Step 3: Verificar**

```bash
npm run typecheck && npm run dev
```

En el dashboard, las alertas deben aparecer en cascada (cada una con un delay de 60ms respecto a la anterior). Con `prefers-reduced-motion: reduce`, todas deben aparecer simultáneamente.

- [ ] **Step 4: Commit**

```bash
git add src/routes/-dashboard-alerts.tsx
git commit -m "feat(dashboard): stagger animation en lista de alertas con useReducedMotion"
```

---

## Task 11: Stagger + skeleton en tabla de Contratos

**Files:**
- Modify: `src/routes/contracts/index.tsx`

- [ ] **Step 1: Agregar variants de stagger FUERA del componente**

Al inicio de `src/routes/contracts/index.tsx`, agregar:

```tsx
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

// Variants fuera del componente (regla LUNARIS)
const tableBodyVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const tableRowVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" } },
};
```

- [ ] **Step 2: Aplicar stagger al tbody de contratos**

Buscar el `<tbody>` o el equivalente que renderiza las filas de contratos. Si el elemento es `<tbody>`, convertirlo en `motion.tbody`. Si es un `<div>`, convertirlo en `motion.div`. Cada fila (`<tr>` o `<div>` de fila) se convierte en `motion.tr` / `motion.div` con `variants={tableRowVariants}`.

```tsx
// Dentro del componente, obtener shouldReduceMotion:
const shouldReduceMotion = useReducedMotion();

// El tbody:
<motion.tbody
  variants={tableBodyVariants}
  initial={shouldReduceMotion ? false : "hidden"}
  animate="visible"
>
  {contracts.map((contract) => (
    <motion.tr
      key={contract.id}
      variants={tableRowVariants}
      className="..." // mantener todas las clases existentes
    >
      {/* contenido de la fila sin cambios */}
    </motion.tr>
  ))}
</motion.tbody>
```

**Si la tabla usa `<div>` en lugar de `<table>`**, adaptar con `motion.div` en lugar de `motion.tbody`/`motion.tr`.

- [ ] **Step 3: Reemplazar el skeleton de carga de la tabla**

Buscar dónde se muestra el loading state de la tabla de contratos (spinner o skeleton genérico). Reemplazar con `SkeletonTable` del componente existente:

```tsx
import { SkeletonTable } from "@/components/ui/skeleton";

// En lugar del spinner/skeleton genérico:
{isLoading ? (
  <SkeletonTable rows={8} columns={6} />
) : (
  // tabla real
)}
```

- [ ] **Step 4: Verificar**

```bash
npm run typecheck
```

Verificar que `motion.tbody` y `motion.tr` no causan errores de TypeScript. Si `motion.tbody` no está disponible, usar `motion.create("tbody")` o wrappear cada `<tr>` con `motion.div` externo.

```bash
npm run test:run
```

Esperado: tests existentes pasan sin cambios.

- [ ] **Step 5: Commit**

```bash
git add src/routes/contracts/index.tsx
git commit -m "feat(contracts): stagger animation en filas de tabla + SkeletonTable durante carga"
```

---

## Task 12: Fix aria-live en bulk action bar de Contratos

**Files:**
- Modify: `src/routes/contracts/index.tsx`

- [ ] **Step 1: Agregar aria-live al floating bulk action bar**

En `src/routes/contracts/index.tsx`, buscar el bulk action bar flotante (el componente que aparece cuando se seleccionan contratos). Agregar `role="region"` y `aria-live="polite"` al contenedor principal:

```tsx
// Buscar el elemento que contiene el bulk action bar.
// Puede ser un AnimatePresence > motion.div o similar.
// Agregar al div contenedor externo:

<div
  role="region"
  aria-live="polite"
  aria-label="一括操作"
>
  {/* AnimatePresence y motion.div existentes sin cambios */}
  <AnimatePresence>
    {selectedIds.length > 0 && (
      <motion.div ...>
        {/* contenido del bulk bar sin cambios */}
      </motion.div>
    )}
  </AnimatePresence>
</div>
```

**Nota:** El `aria-live="polite"` va en el contenedor **siempre presente en el DOM**, no dentro del AnimatePresence. Esto permite que el screen reader anuncie cuando aparece/desaparece.

- [ ] **Step 2: Verificar**

```bash
npm run typecheck
```

Verificar en browser con VoiceOver o NVDA activado: al seleccionar un contrato, el screen reader debe anunciar que el panel de acciones apareció.

- [ ] **Step 3: Commit**

```bash
git add src/routes/contracts/index.tsx
git commit -m "fix(contracts): bulk action bar con aria-live y role=region para accesibilidad"
```

---

## Task 13: Stagger en tabla de Empleados + auditoría page transitions

**Files:**
- Modify: `src/routes/employees/index.tsx`
- Modify: varias rutas (solo si les falta `<AnimatedPage>`)

- [ ] **Step 1: Agregar variants de stagger FUERA del componente en employees**

Al inicio de `src/routes/employees/index.tsx`, agregar (mismos variants que contratos, sin duplicar si ya están en un shared file):

```tsx
import { motion, useReducedMotion } from "motion/react";

// Variants fuera del componente (regla LUNARIS)
const tableBodyVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const tableRowVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" } },
};
```

- [ ] **Step 2: Aplicar stagger al tbody de empleados**

Igual que Task 11 Step 2 pero en `employees/index.tsx`. Buscar el map de empleados y convertir el contenedor + filas en `motion.*`:

```tsx
const shouldReduceMotion = useReducedMotion();

<motion.tbody
  variants={tableBodyVariants}
  initial={shouldReduceMotion ? false : "hidden"}
  animate="visible"
>
  {employees.map((employee) => (
    <motion.tr
      key={employee.id}
      variants={tableRowVariants}
      className="..." // mantener todas las clases existentes
    >
      {/* contenido sin cambios */}
    </motion.tr>
  ))}
</motion.tbody>
```

- [ ] **Step 3: Auditar page transitions**

Buscar todas las rutas que NO tienen `<AnimatedPage>` como wrapper. Ejecutar:

```bash
grep -r "export default\|export function" src/routes --include="*.tsx" -l
```

Para cada archivo de ruta, verificar que el JSX raíz retornado está wrappereado en `<AnimatedPage>`. Si no, agregar:

```tsx
import { AnimatedPage } from "@/components/ui/animated";

// Wrap del return:
return (
  <AnimatedPage className="...clases existentes...">
    {/* contenido existente */}
  </AnimatedPage>
);
```

Rutas a verificar: `/contracts/new`, `/contracts/:contractId`, `/import`, `/data-check`, `/audit`, `/history`, `/settings`, `/admin`.

- [ ] **Step 4: Verificar todo**

```bash
npm run lint && npm run typecheck && npm run test:run
```

Esperado: 0 errores de lint, 0 errores de typecheck, todos los tests existentes pasan.

- [ ] **Step 5: Commit final**

```bash
git add src/routes/employees/index.tsx src/routes/
git commit -m "feat(employees): stagger animation en tabla + auditoría page transitions en todas las rutas"
```

---

## Verificación Final

- [ ] **Smoke test completo**

```bash
npm run lint && npm run typecheck && npm run build && npm run test:run
```

Esperado: build exitoso, 0 errores, todos los tests pasan.

- [ ] **Test manual dark/light mode**

1. Abrir http://localhost:3026 (o preview del build)
2. Alternar entre dark y light mode
3. Verificar en CADA pantalla:
   - [ ] Dashboard: stat cards, trend badges, alerts — todos adaptan colores
   - [ ] Sidebar: status dot verde neon en dark, hover visible en light, footer card con contraste
   - [ ] Contratos: tablas con skeleton al cargar, stagger en rows, bulk action bar
   - [ ] Empleados: stagger en rows, colores consistentes
   - [ ] Cualquier dialog con destructive: ícono rojo correcto en ambos modos
   - [ ] Inputs con error: borde rojo + `aria-invalid="true"` en DOM

- [ ] **Commit de memorias**

```bash
git add .claude/memory/
git commit -m "docs(memory): sincronizar memorias sesión modernización UI 2026-04-14"
```
