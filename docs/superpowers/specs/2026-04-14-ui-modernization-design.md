# Spec: UI/UX Modernización KobetsuV3

**Fecha:** 2026-04-14  
**Estado:** Aprobado por usuario  
**Alcance:** Cirugía + Polish completo (Enfoque 3, Animaciones A3)

---

## 1. Objetivo

Corregir todos los bugs de dark/light mode, estandarizar el sistema de tokens semánticos en todo el codebase, y agregar micro-animaciones completas (skeleton loaders, animated counters, stagger lists, hover states refinados). El design system LUNARIS v2 se mantiene — se refina, no se reemplaza.

---

## 2. Alcance

### Fuera de alcance
- Cambio de paleta de colores
- Nuevos layouts o rediseño estructural de pantallas
- Nuevas funcionalidades de negocio
- Migración de librerías

---

## 3. Arquitectura del sistema de temas (estado actual + target)

### Estado actual
- Toggle: `localStorage` + `matchMedia` fallback + clase `dark` en `<html>` — **correcto, se mantiene**
- Design tokens: `@theme {}` (light) + `.dark {}` (overrides) en `src/index.css` — **correcto, se mantiene**
- Problema: tokens semánticos bien definidos pero NO usados consistentemente en componentes

### Target
- Todos los componentes base (`button`, `badge`, `input`, `confirm-dialog`) usan exclusivamente tokens semánticos
- Cero colores Tailwind hardcodeados en componentes de `src/components/ui/`
- Keyframes usan `color-mix()` con variables CSS en lugar de valores hex fijos

---

## 4. Bugs a corregir (Fase 1)

| ID | Severidad | Archivo | Problema | Fix |
|----|-----------|---------|----------|-----|
| B1 | Alta | `src/index.css` | 3 keyframes (`pulse-ring`, `card-glow`, `row-highlight`) hardcodeados en `rgba(5,150,105,...)` — emerald light | Reemplazar con `color-mix(in srgb, var(--color-primary) 40%, transparent)` |
| B2 | Media | `sidebar.tsx:212` | `bg-emerald-500` hardcodeado en status dot | → `bg-primary` |
| B3 | Media | `button.tsx:26` | Variante `success`: `bg-emerald-600 hover:bg-emerald-700` sin dark mode | → `bg-success text-success-foreground hover:bg-success/90` |
| B4 | Media | `sidebar.tsx:137` | `hover:bg-white/10` invisible en light mode | → `hover:bg-muted/50` |
| B5 | Media | `sidebar.tsx:199` | `bg-white/[0.03]` cero contraste en light | → `bg-muted/30` |
| B6 | Baja | `badge.tsx` | Variante `destructive`: paleta `red-*` hardcodeada | → `bg-destructive/10 text-destructive border-destructive/20` |
| B7 | Baja | `confirm-dialog.tsx:37` | `bg-red-100 dark:bg-red-900/50` + `text-red-600 dark:text-red-400` | → `bg-destructive/10 text-destructive` |
| B8 | Baja | `input.tsx` | Sin `aria-invalid` cuando hay error de validación | Agregar `aria-invalid={!!error}` al `<input>` nativo |

---

## 5. Animaciones nuevas (Fases 2 y 3)

### 5.1 Skeleton Loaders
- **Qué:** Reemplazar `<Skeleton>` genérico y spinners por skeletons específicos a cada pantalla
- **Dónde:** Dashboard cards (4 stat cards + chart area), tabla de contratos (5 rows), tabla de empleados (8 rows), sidebar nav items
- **Cómo:** Componentes `DashboardSkeleton`, `TableRowSkeleton`, `StatCardSkeleton` usando el `<Skeleton>` base existente
- **Animación:** shimmer existente en `index.css` — no cambiar, solo usarlo más

### 5.2 Animated Counters (Dashboard)
- **Qué:** Métricas numéricas del dashboard cuentan desde 0 hasta el valor real al montar
- **Dónde:** Las 4 stat cards del dashboard (`-dashboard-stats.tsx`)
- **Cómo:** Hook `useCountUp(target, duration)` — usa `useMotionValue` + `useSpring` de Framer Motion, respeta `useReducedMotion()`
- **Duración:** 1.2s con easing `easeOut`

### 5.3 Stagger Lists
- **Qué:** Items aparecen en cascada con delay incremental
- **Dónde:** Alertas del dashboard, rows de tabla de contratos y empleados, cards de empresas
- **Cómo:** `containerVariants` + `itemVariants` con `staggerChildren: 0.05` — variants FUERA de los componentes
- **Respeta:** `useReducedMotion()` — si está activo, sin stagger (todos aparecen juntos)

### 5.4 Hover States Refinados
- **Qué:** Feedback visual consistente en elementos interactivos
- **Dónde:** Stat cards dashboard (`scale(1.01)` + shadow-lg), rows de tabla (highlight más suave), botones (micro-bounce en click `whileTap`)
- **Cómo:** `whileHover` y `whileTap` en componentes que ya usan `motion.*`, `transition-all duration-150` en los que usan Tailwind

### 5.5 Page Transitions consistentes
- **Qué:** Todas las rutas usan `<AnimatedPage>` existente
- **Dónde:** Rutas que actualmente no tienen wrapper de animación
- **Auditar:** Verificar que `/contracts/new`, `/contracts/:id`, `/import`, `/data-check`, `/audit`, `/history`, `/settings`, `/admin` usan `<AnimatedPage>`

---

## 6. Orden de implementación

### Fase 1 — Cimientos (componentes base + CSS)
1. `src/index.css` — Fix B1: 3 keyframes con `color-mix()`
2. `src/components/ui/button.tsx` — Fix B3: variante success
3. `src/components/ui/badge.tsx` — Fix B6: variante destructive
4. `src/components/ui/confirm-dialog.tsx` — Fix B7: tokens semánticos
5. `src/components/ui/input.tsx` — Fix B8: `aria-invalid`
6. `src/components/layout/sidebar.tsx` — Fix B2, B4, B5

### Fase 2 — Dashboard
7. Hook `useCountUp` en `src/lib/hooks/use-count-up.ts`
8. Skeleton `StatCardSkeleton` + `DashboardSkeleton`
9. Aplicar animated counters en `-dashboard-stats.tsx`
10. Stagger en alertas de `-dashboard-alerts.tsx`
11. Hover states en stat cards

### Fase 3 — Contratos + Empleados
12. `TableRowSkeleton` en `src/components/ui/skeleton.tsx`
13. Stagger en tabla de contratos (`contracts/index.tsx`)
14. Stagger en tabla de empleados (`employees/index.tsx`)
15. `aria-live` en floating bulk action bar (contratos)
16. Auditoría y fix de page transitions en rutas faltantes

---

## 7. Restricciones técnicas

- **`motion`** (NOT `framer-motion`) — el package está importado como `motion` en este proyecto
- **Variants SIEMPRE fuera de componentes** — no definir en el body del componente
- **`useReducedMotion()`** en TODO componente que use animaciones — patrón establecido en `animated.tsx`
- **Cero `any`** — TypeScript strict
- **Cero inline styles** salvo los ya existentes en `animated.tsx` para gradients
- **`p-4` o `p-6`** — prohibido `p-5`
- **Tests**: las animaciones no rompen los tests existentes (son puramente presentacionales)

---

## 8. Criterios de éxito

- [ ] Todos los componentes base (`button`, `badge`, `input`, `confirm-dialog`, `sidebar`) usan tokens semánticos exclusivamente
- [ ] En dark mode: neon green (`#00ff88`) visible en todos los elementos que antes mostraban emerald
- [ ] En light mode: ningún texto invisible por bajo contraste en componentes base
- [ ] Dashboard: métricas animan al montar, skeleton visible durante carga
- [ ] Contratos/Empleados: rows aparecen en stagger suave al cargar
- [ ] `useReducedMotion()` aplicado en todos los componentes nuevos con animación
- [ ] `npm run lint && npm run typecheck && npm run test:run` pasa sin errores nuevos
