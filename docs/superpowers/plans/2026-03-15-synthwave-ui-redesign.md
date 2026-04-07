# Synthwave UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar toda la UI de JP Kobetsu con estética synthwave (violet + cyan + gold), dark/light mode toggle, shadcn/ui retematizado, Inter + JetBrains Mono, efectos visuales modernos — sin tocar backend ni lógica de negocio.

**Architecture:** Design system primero (tokens CSS en `@theme`, hook de tema, componentes base), luego layout (sidebar/header/root), luego páginas en 3 fases por prioridad de uso. Todo controlado por la clase `.dark` en `<html>`, mecanismo ya existente. Light mode = default (sin clase), dark mode = clase `.dark` activa.

**Tech Stack:** React 19.2, Tailwind CSS 4 (`@theme` nativa), shadcn/ui + CVA, Framer Motion, Lucide React, TanStack Router

---

## Chunk 1: Design System Foundation

### Task 1: Actualizar Google Fonts en index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Reemplazar el link de Google Fonts**

En `index.html` línea 10, reemplazar:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lexend:wght@400;500;600;700&display=swap" rel="stylesheet">
```
Por:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Verificar que el servidor carga la fuente**

```bash
npm run dev:client
```
Abrir http://localhost:3026, DevTools → Network → buscar `JetBrains+Mono`. Debe aparecer status 200.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore(fonts): agregar JetBrains Mono, quitar Lexend"
```

---

### Task 2: Reemplazar tokens CSS en src/index.css

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Leer src/index.css completo**

Leer el archivo para identificar:
- El bloque `@theme { }` (empieza en línea ~8)
- El bloque `.dark { }` (buscar `\.dark\s*\{`)
- Las clases custom al final (`.btn-press`, `.transitioning`, etc.) — NO tocar estas

- [ ] **Step 2: Reemplazar el bloque @theme completo**

Reemplazar **todo** el bloque `@theme { ... }` (desde `@theme {` hasta el `}` que lo cierra) por:

```css
@theme {
  /* ── Synthwave Palette ─────────────────────────────────── */
  --color-violet:        #8b5cf6;
  --color-violet-hi:     #a78bfa;
  --color-violet-lo:     #c4b5fd;
  --color-violet-dark:   #7c3aed;
  --color-cyan:          #00f5d4;
  --color-cyan-hi:       #67e8d8;
  --color-gold:          #fbbf24;
  --color-gold-hi:       #fcd34d;
  --color-red:           #f87171;

  /* ── shadcn/ui semantic tokens — Light Mode (default) ──── */
  --color-background:           #faf8ff;
  --color-foreground:           #1a1035;
  --color-card:                 #ffffff;
  --color-card-foreground:      #1a1035;
  --color-popover:              #ffffff;
  --color-popover-foreground:   #1a1035;
  --color-primary:              #7c3aed;
  --color-primary-foreground:   #ffffff;
  --color-secondary:            #f3f0ff;
  --color-secondary-foreground: #4b4669;
  --color-muted:                #f3f0ff;
  --color-muted-foreground:     #6b7280;
  --color-accent:               #0f766e;
  --color-accent-foreground:    #ffffff;
  --color-destructive:          #dc2626;
  --color-destructive-foreground: #ffffff;
  --color-border:               rgba(109,40,217,0.15);
  --color-input:                rgba(109,40,217,0.12);
  --color-ring:                 #7c3aed;

  /* ── Sidebar — Light ───────────────────────────────────── */
  --color-sidebar:            #ffffff;
  --color-sidebar-foreground: #1a1035;
  --color-sidebar-accent:     #f3f0ff;
  --color-sidebar-muted:      #6b7280;

  /* ── Radii ──────────────────────────────────────────────── */
  --radius-sm:  0.5rem;
  --radius-md:  0.625rem;
  --radius-lg:  0.75rem;
  --radius-xl:  1rem;
  --radius-2xl: 1.25rem;

  /* ── Shadows — Light ────────────────────────────────────── */
  --shadow-xs:   0 1px 2px rgba(0,0,0,0.06);
  --shadow-card: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md:   0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-lg:   0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.05);

  /* ── Glow — Dark Mode ───────────────────────────────────── */
  --glow-violet: 0 0 20px rgba(139,92,246,0.4);
  --glow-cyan:   0 0 16px rgba(0,245,212,0.3);
  --glow-gold:   0 0 12px rgba(251,191,36,0.3);
  --glow-red:    0 0 12px rgba(248,113,113,0.3);

  /* ── Motion ─────────────────────────────────────────────── */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast:   120ms;
  --duration-normal: 200ms;
  --duration-slow:   300ms;

  /* ── Fonts ───────────────────────────────────────────────── */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;
}
```

- [ ] **Step 3: Reemplazar el bloque .dark { } con tokens synthwave dark**

Buscar el bloque `.dark { ... }` y reemplazarlo por:

```css
.dark {
  --color-background:           #06010f;
  --color-foreground:           #ffffff;
  --color-card:                 #0f0820;
  --color-card-foreground:      #ffffff;
  --color-popover:              #0f0820;
  --color-popover-foreground:   #ffffff;
  --color-primary:              #8b5cf6;
  --color-primary-foreground:   #ffffff;
  --color-secondary:            #160d2e;
  --color-secondary-foreground: #c4b8d8;
  --color-muted:                #160d2e;
  --color-muted-foreground:     #8b7fa8;
  --color-accent:               #00f5d4;
  --color-accent-foreground:    #06010f;
  --color-destructive:          #f87171;
  --color-destructive-foreground: #ffffff;
  --color-border:               rgba(139,92,246,0.18);
  --color-input:                rgba(139,92,246,0.15);
  --color-ring:                 #8b5cf6;

  --color-sidebar:            #0f0820;
  --color-sidebar-foreground: #ffffff;
  --color-sidebar-accent:     #160d2e;
  --color-sidebar-muted:      #8b7fa8;

  --shadow-xs:   0 1px 2px rgba(0,0,0,0.4);
  --shadow-card: 0 1px 3px rgba(0,0,0,0.5);
  --shadow-md:   0 4px 6px rgba(0,0,0,0.5);
  --shadow-lg:   0 10px 15px rgba(0,0,0,0.6);
}
```

- [ ] **Step 4: Agregar animaciones synthwave al final del archivo**

Agregar **al final** de `src/index.css`, después de todas las clases existentes:

```css
/* ── Synthwave Animations ────────────────────────────────── */
@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50%       { transform: translateY(-24px) scale(1.04); }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.dark .bg-orb {
  position: fixed;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
  animation: float 8s ease-in-out infinite;
  z-index: 0;
}

.dark .bg-grid {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(139,92,246,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(139,92,246,0.06) 1px, transparent 1px);
  background-size: 48px 48px;
  pointer-events: none;
  z-index: 0;
}

.hover-lift {
  transition: transform var(--duration-normal) var(--ease-out-expo),
              box-shadow var(--duration-normal) var(--ease-out-expo);
}
.hover-lift:hover { transform: translateY(-3px); }

.animate-in { animation: fade-in-up 0.3s var(--ease-out-expo) both; }
```

- [ ] **Step 5: Verificar typecheck y build**

```bash
npm run typecheck
```
Resultado esperado: sin errores.

```bash
npm run build
```
Resultado esperado: build exitoso.

- [ ] **Step 6: Verificar tests no regresionan**

```bash
npm run test:run
```
Resultado esperado: 146 tests pasan.

- [ ] **Step 7: Commit**

```bash
git add src/index.css
git commit -m "feat(design-system): implementar paleta synthwave en tokens CSS"
```

---

### Task 3: Crear hook use-theme

**Files:**
- Create: `src/lib/hooks/use-theme.ts`
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Leer src/components/layout/header.tsx completo**

Identificar las líneas exactas a remover:
- `useState` importado (línea 1, junto con `useCallback`, `useEffect`)
- El bloque `const [isDark, setIsDark] = useState(...)` (línea ~13)
- El bloque `const toggleTheme = useCallback(...)` (líneas ~18-27)
- El bloque `useEffect(...)` de restauración de tema (líneas ~29-38)
- El uso de `isDark` en el JSX (usar `isDark` desde el nuevo hook)

- [ ] **Step 2: Crear src/lib/hooks/use-theme.ts**

```typescript
import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.add("transitioning");
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(STORAGE_KEY, theme);
  setTimeout(() => {
    document.documentElement.classList.remove("transitioning");
  }, 300);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme, isDark: theme === "dark" };
}
```

- [ ] **Step 3: Actualizar header.tsx**

En `src/components/layout/header.tsx`:

**a) Modificar los imports de React** (línea 1) — quitar `useCallback`, `useEffect`, `useState`, conservar solo los que siguen usándose:
```typescript
// Antes:
import { Moon, Sun, Search, Menu, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { LayoutAlign } from "./root-layout";

// Después:
import { Moon, Sun, Search, Menu, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/hooks/use-theme";
import type { LayoutAlign } from "./root-layout";
```

**b) Reemplazar las líneas 13-38** (los tres hooks de tema) con:
```typescript
const { isDark, toggleTheme } = useTheme();
```

**c) El botón del toggle ya usa `isDark` y `toggleTheme` — verificar que las referencias en el JSX siguen funcionando igual.**

- [ ] **Step 4: Verificar typecheck**

```bash
npm run typecheck
```
Resultado esperado: sin errores. Si hay "unused import" de `useCallback`/`useEffect`/`useState`, confirmar que se quitaron en el paso anterior.

- [ ] **Step 5: Verificar toggle funciona en browser**

```bash
npm run dev
```
Abrir http://localhost:3026, hacer click en el toggle. Verificar:
1. Clase `.dark` se agrega/quita en `<html>` (DevTools → Elements)
2. `localStorage.getItem("theme")` retorna el valor correcto (DevTools → Console)
3. Al recargar la página el tema se mantiene

- [ ] **Step 6: Commit**

```bash
git add src/lib/hooks/use-theme.ts src/components/layout/header.tsx
git commit -m "refactor(theme): extraer lógica de tema a hook use-theme"
```

---

### Task 4: Instalar nuevos componentes shadcn

**Files:**
- Create: `src/components/ui/tooltip.tsx`
- Create: `src/components/ui/dropdown-menu.tsx`
- Create: `src/components/ui/sheet.tsx`

- [ ] **Step 1: Instalar tooltip**

```bash
npx shadcn@latest add tooltip
```
Resultado esperado: `src/components/ui/tooltip.tsx` creado, `@radix-ui/react-tooltip` en package.json.

- [ ] **Step 2: Instalar dropdown-menu**

```bash
npx shadcn@latest add dropdown-menu
```
Resultado esperado: `src/components/ui/dropdown-menu.tsx` creado, `@radix-ui/react-dropdown-menu` en package.json.

- [ ] **Step 3: Instalar sheet**

```bash
npx shadcn@latest add sheet
```
Resultado esperado: `src/components/ui/sheet.tsx` creado, `@radix-ui/react-dialog` en package.json.

- [ ] **Step 4: Verificar typecheck**

```bash
npm run typecheck
```
Resultado esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/tooltip.tsx src/components/ui/dropdown-menu.tsx src/components/ui/sheet.tsx package.json package-lock.json
git commit -m "feat(ui): agregar componentes shadcn Tooltip, DropdownMenu, Sheet"
```

---

### Task 5: Retematizar Button con variantes synthwave

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: Leer src/components/ui/button.tsx**

Verificar que usa `forwardRef` y CVA — la estructura se mantiene, solo se actualizan las clases.

- [ ] **Step 2: Reemplazar buttonVariants**

Reemplazar el contenido de `buttonVariants` (solo la parte dentro de `cva(...)`) por:

```typescript
const buttonVariants = cva(
  "btn-press inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 dark:shadow-[0_0_20px_rgba(139,92,246,0.35)] dark:hover:shadow-[0_0_28px_rgba(139,92,246,0.5)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-card hover:bg-muted hover:border-primary/40 text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-muted text-muted-foreground hover:text-foreground",
        link:
          "text-primary underline-offset-4 hover:underline",
        cyan:
          "bg-[#0f766e] text-white font-bold hover:-translate-y-0.5 dark:bg-gradient-to-r dark:from-[#00f5d4] dark:to-[#00c9ae] dark:text-[#06010f] dark:shadow-[0_0_16px_rgba(0,245,212,0.3)]",
        success:
          "bg-emerald-600 text-white hover:bg-emerald-700",
      },
      size: {
        default: "h-10 px-4 py-2 text-sm",
        sm:      "h-8 px-3 py-1.5 text-xs",
        lg:      "h-11 px-6 py-3 text-sm",
        icon:    "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

- [ ] **Step 3: Verificar typecheck y lint**

```bash
npm run typecheck && npm run lint
```
Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat(ui): retematizar Button con variantes synthwave"
```

---

### Task 6: Retematizar Badge con variantes synthwave

**Files:**
- Modify: `src/components/ui/badge.tsx`

- [ ] **Step 1: Leer src/components/ui/badge.tsx completo**

Identificar:
- Si tiene props `dot`, `pulse`, `dotColor` u otras props custom
- El elemento HTML que usa (`<span>` o `<div>`)
- Si usa `ring-1 ring-inset` en alguna variante

- [ ] **Step 2: Buscar usos de props custom en el codebase**

```bash
grep -r "dot=" src/routes/ src/components/ --include="*.tsx" | head -20
grep -r "pulse=" src/routes/ src/components/ --include="*.tsx" | head -20
grep -r "dotColor=" src/routes/ src/components/ --include="*.tsx" | head -20
```

Si algún grep retorna resultados, las variantes nuevas deben mantener esas props (no eliminarlas). Agregar las nuevas variantes synthwave al `cva` existente en lugar de reemplazar.

- [ ] **Step 3: Agregar variantes synthwave al Badge existente**

En el bloque `variants: { variant: { ... } }` del Badge, **agregar** (no reemplazar) estas variantes:

```typescript
// Variantes light mode por defecto, dark: para dark mode
active:
  "bg-[#ccfbf1] text-[#0f766e] border border-[rgba(15,118,110,0.3)] dark:bg-[rgba(0,245,212,0.1)] dark:text-[#67e8d8] dark:border-[rgba(0,245,212,0.2)]",
warning:
  "bg-[#fef3c7] text-[#b45309] border border-[rgba(180,83,9,0.3)] dark:bg-[rgba(251,191,36,0.1)] dark:text-[#fcd34d] dark:border-[rgba(251,191,36,0.2)]",
alert:
  "bg-[#fee2e2] text-[#dc2626] border border-[rgba(220,38,38,0.3)] dark:bg-[rgba(248,113,113,0.1)] dark:text-[#fca5a5] dark:border-[rgba(248,113,113,0.2)]",
info:
  "bg-[#ede9fe] text-[#7c3aed] border border-[rgba(124,58,237,0.3)] dark:bg-[rgba(139,92,246,0.1)] dark:text-[#c4b5fd] dark:border-[rgba(139,92,246,0.2)]",
```

- [ ] **Step 4: Verificar typecheck**

```bash
npm run typecheck
```
Resultado esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "feat(ui): agregar variantes synthwave al Badge"
```

---

## Chunk 2: Layout Synthwave

### Task 7: Agregar orbes y grid al root-layout

**Files:**
- Modify: `src/components/layout/root-layout.tsx`

- [ ] **Step 1: Leer src/components/layout/root-layout.tsx completo**

Identificar:
- El elemento raíz más externo del componente (probablemente `<div className="flex h-screen overflow-hidden bg-background">`)
- Si tiene `AnimatePresence` u otros wrappers de Framer Motion
- Si tiene `overflow-hidden` — los orbes usan `position: fixed` y NO son afectados por `overflow-hidden` en el padre, así que no hay conflicto

- [ ] **Step 2: Agregar orbes y grid como primer hijo del elemento raíz**

Dentro del elemento raíz del layout, agregar como **primer hijo** (antes del sidebar y del contenido principal):

```tsx
{/* Background effects — rendered via CSS classes, visible only in dark mode */}
<div aria-hidden="true" className="pointer-events-none">
  <div className="bg-grid" />
  <div
    className="bg-orb"
    style={{
      width: 600,
      height: 600,
      background: "radial-gradient(circle, rgba(139,92,246,0.25), transparent)",
      top: -200,
      left: -100,
      animationDelay: "0s",
    }}
  />
  <div
    className="bg-orb"
    style={{
      width: 500,
      height: 500,
      background: "radial-gradient(circle, rgba(0,245,212,0.18), transparent)",
      top: "30vh",
      right: -150,
      animationDelay: "-3s",
    }}
  />
  <div
    className="bg-orb"
    style={{
      width: 400,
      height: 400,
      background: "radial-gradient(circle, rgba(251,191,36,0.12), transparent)",
      bottom: -100,
      left: "35%",
      animationDelay: "-5s",
    }}
  />
</div>
```

> **Nota:** Las clases `.bg-orb` y `.bg-grid` definidas en `index.css` ya tienen `position: fixed` y usan `.dark .bg-orb` como selector, así que en light mode estos elementos no tienen estilo y son invisibles — correcto por diseño.

- [ ] **Step 3: Verificar en browser**

```bash
npm run dev
```
En http://localhost:3026, dark mode: verificar orbes animados visibles en el fondo. Light mode: verificar que no aparecen. El contenido debe estar por encima (z-index del sidebar y main > 0).

- [ ] **Step 4: Verificar typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/root-layout.tsx
git commit -m "feat(layout): agregar orbes y micro-grid synthwave al background"
```

---

### Task 8: Rediseñar Sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Leer src/components/layout/sidebar.tsx completo**

Identificar:
- El nombre del prop de open/close (puede ser `isOpen`, `open`, `onClose`)
- El elemento `<aside>` o `<nav>` raíz y sus clases actuales
- El componente `NavItem` y sus props (`item`, `isActive` u otros nombres)
- El área del logo/branding

- [ ] **Step 2: Actualizar clases del elemento raíz del sidebar**

Reemplazar las clases del `<aside>` o `<nav>` raíz por:
```tsx
className={cn(
  "flex h-full w-60 flex-col bg-sidebar border-r border-border backdrop-blur-xl",
  // mobile: el nombre del prop de visibilidad va aquí
)}
```

- [ ] **Step 3: Reemplazar el área del logo**

Localizar el bloque del logo/branding y reemplazarlo por:
```tsx
<div className="flex items-center gap-3 px-5 py-5 border-b border-border">
  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-violet-500 to-cyan-400 font-black text-base text-[#06010f] dark:shadow-[0_0_24px_rgba(139,92,246,0.45)]">
    U
  </div>
  <div>
    <p className="text-sm font-bold text-foreground leading-tight">UNS System</p>
    <p className="text-[10px] font-semibold tracking-widest uppercase bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
      派遣管理 v26
    </p>
  </div>
</div>
```

- [ ] **Step 4: Actualizar el componente NavItem**

Reemplazar la función `NavItem` (o `NavLink`, según el nombre real encontrado en Step 1) por:
```tsx
function NavItem({ item, isActive }: { item: typeof navigationSections[0]["items"][0]; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.href}
      className={cn(
        "group flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-primary/15 text-primary font-semibold border-l-[3px] border-primary pl-[9px]"
          : "text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-0.5"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.name}</span>
      {isActive && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400 dark:shadow-[0_0_6px_rgba(0,245,212,0.8)]" />
      )}
    </Link>
  );
}
```

> Si los nombres de props son distintos a los del archivo real, adaptar los tipos al nombre correcto.

- [ ] **Step 5: Actualizar labels de secciones de navegación**

```tsx
<p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
  {section.label}
</p>
```

- [ ] **Step 6: Verificar visualmente en dark y light**

```bash
npm run dev
```
Verificar en http://localhost:3026:
- Dark: sidebar `#0f0820`, logo con gradiente y glow, item activo con borde violet y dot cyan
- Light: sidebar blanco, colores violet, sin glow

- [ ] **Step 7: Verificar typecheck y tests**

```bash
npm run typecheck && npm run test:run
```
Resultado esperado: sin errores, 146 tests pasan.

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(layout): rediseñar sidebar con estética synthwave"
```

---

### Task 9: Actualizar Header

**Precondition:** Task 3 debe estar completo (header.tsx ya usa `useTheme`).

**Files:**
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Leer src/components/layout/header.tsx en su estado actual (post Task 3)**

Verificar que ya tiene `const { isDark, toggleTheme } = useTheme()` en lugar de los 3 hooks.

- [ ] **Step 2: Actualizar clases del elemento `<header>`**

Reemplazar las clases del `<header>` por:
```tsx
<header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl transition-all duration-300 md:px-6">
```

- [ ] **Step 3: Reemplazar el botón del toggle de tema**

Localizar el botón de toggle de tema en el JSX y reemplazarlo por:
```tsx
<button
  onClick={toggleTheme}
  className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-border bg-card text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted hover:text-primary"
  aria-label={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
>
  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
</button>
```

- [ ] **Step 4: Verificar typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "feat(layout): actualizar header con tokens synthwave"
```

---

## Chunk 3: Páginas Fase 1 — Core

### Task 10: Rediseñar Dashboard (/)

**Files:**
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Leer src/routes/index.tsx completo**

Identificar:
- Los queries de React Query usados (NO modificar)
- Los componentes de stats/KPI y sus variables (`activeContracts`, `totalEmployees`, etc.)
- La tabla de contratos recientes y su estructura

- [ ] **Step 2: Actualizar KPI cards**

Envolver cada stat card existente con `hover-lift` y aplicar gradiente por tipo. Patrón para la card de contratos (violet):
```tsx
<div className="hover-lift rounded-[var(--radius-xl)] border border-violet-500/30 bg-gradient-to-br from-violet-500/20 to-violet-900/10 p-5 relative overflow-hidden cursor-pointer">
  <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-violet-500/15 blur-xl" />
  <p className="relative text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">アクティブ契約</p>
  <p className="relative text-4xl font-black tracking-tight text-violet-400 dark:drop-shadow-[0_0_12px_rgba(139,92,246,0.6)]">
    {value}
  </p>
  <p className="relative text-xs text-muted-foreground mt-1">{sublabel}</p>
</div>
```

Colores por tipo de card:
- Contratos: `border-violet-500/30`, `from-violet-500/20`, value `text-violet-400`
- Empleados: `border-cyan-500/25`, `from-cyan-500/12`, value `text-cyan-400`
- Warnings: `border-amber-500/25`, `from-amber-500/12`, value `text-amber-400`
- Alertas: `border-red-500/25`, `from-red-500/12`, value `text-red-400`

- [ ] **Step 3: Actualizar tabla de contratos recientes**

```tsx
<table className="w-full text-sm">
  <thead>
    <tr className="border-b border-border">
      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        契約番号
      </th>
      {/* repetir para cada columna */}
    </tr>
  </thead>
  <tbody>
    {contracts.map((c) => (
      <tr key={c.id} className="group border-b border-border/50 transition-colors hover:bg-primary/5">
        <td className="px-4 py-3.5 font-mono text-xs font-semibold text-violet-400 dark:text-violet-300">
          {c.contractNumber}
        </td>
        <td className="px-4 py-3.5 font-medium text-foreground">{c.companyName}</td>
        <td className="px-4 py-3.5 text-muted-foreground">{c.employeeName}</td>
        <td className="px-4 py-3.5">
          <Badge variant={c.status === "active" ? "active" : c.status === "warning" ? "warning" : "alert"}>
            {c.statusLabel}
          </Badge>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

- [ ] **Step 4: Verificar en browser, typecheck y tests**

```bash
npm run dev
```
Verificar KPI cards con gradiente y tabla en http://localhost:3026.

```bash
npm run typecheck && npm run test:run
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat(dashboard): KPI cards synthwave y tabla retematizada"
```

---

### Task 11: Rediseñar lista de contratos (/contracts)

**Files:**
- Modify: `src/routes/contracts/index.tsx`

- [ ] **Step 1: Leer src/routes/contracts/index.tsx completo**

Identificar:
- Los filtros de estado y sus variables de estado
- La tabla y sus columnas
- El mecanismo de bulk-select (checkboxes, estado `selectedIds`)
- Los botones de acción por fila

- [ ] **Step 2: Actualizar pills de filtro**

```tsx
<button
  onClick={() => setFilter(value)}
  className={cn(
    "rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
    activeFilter === value
      ? "bg-primary text-primary-foreground dark:shadow-[0_0_12px_rgba(139,92,246,0.4)]"
      : "border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
  )}
>
  {label}
</button>
```

- [ ] **Step 3: Actualizar tabla — headers y rows**

Headers:
```tsx
<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b border-border">
```

Rows:
```tsx
<tr className="group border-b border-border/50 transition-colors hover:bg-primary/5">
  <td className="px-4 py-3.5 font-mono text-xs font-semibold text-violet-400">
    {contract.contractNumber}
  </td>
```

- [ ] **Step 4: Agregar row actions con Tooltip**

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

{/* Dentro de cada row, en la última celda: */}
<td className="px-4 py-3.5">
  <TooltipProvider>
    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="h-7 w-7 rounded-lg border border-border bg-card flex items-center justify-center text-xs transition-all hover:border-primary/40 hover:bg-primary/10">
            👁
          </button>
        </TooltipTrigger>
        <TooltipContent>詳細を見る</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="h-7 w-7 rounded-lg border border-border bg-card flex items-center justify-center text-xs transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10">
            📄
          </button>
        </TooltipTrigger>
        <TooltipContent>PDF生成</TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
</td>
```

- [ ] **Step 5: Actualizar toolbar de bulk actions**

```tsx
{selectedIds.length > 0 && (
  <div className="animate-in flex items-center gap-3 rounded-[var(--radius-lg)] border border-primary/30 bg-primary/10 px-4 py-2.5">
    <span className="text-sm font-semibold text-primary">{selectedIds.length}件選択中</span>
    <Button variant="destructive" size="sm">一括削除</Button>
    <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>選択解除</Button>
  </div>
)}
```

- [ ] **Step 6: Verificar typecheck y tests**

```bash
npm run typecheck && npm run test:run
```

- [ ] **Step 7: Commit**

```bash
git add src/routes/contracts/index.tsx
git commit -m "feat(contracts): pills de filtro, row actions con Tooltip, bulk toolbar"
```

---

### Task 12: Rediseñar detalle de contrato (/contracts/:id)

**Files:**
- Modify: `src/routes/contracts/$contractId.tsx`

- [ ] **Step 1: Leer src/routes/contracts/$contractId.tsx completo**

Identificar:
- La variable con el número de contrato (`contractNumber` o similar)
- Las secciones de datos (fechas, tarifas, empleados)
- Los botones de generación de PDF y sus handlers
- El botón/acción de soft delete

- [ ] **Step 2: Agregar hero section**

Al inicio del JSX de la página (antes del primer bloque de datos), agregar:
```tsx
<div className="rounded-[var(--radius-xl)] border border-border bg-card p-6 mb-6">
  <div className="flex items-start justify-between gap-4">
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        個別契約書
      </p>
      <h1 className="font-mono text-2xl font-black tracking-tight text-violet-400 dark:drop-shadow-[0_0_16px_rgba(139,92,246,0.5)]">
        {contract.contractNumber}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{contract.companyName}</p>
    </div>
    <div className="flex gap-2 flex-wrap">
      {/* Mover aquí los botones de PDF que ya existen, cambiar a variant="cyan" */}
      <Button variant="cyan" size="sm">📄 個別契約書</Button>
      <Button variant="cyan" size="sm">📋 通知書</Button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Envolver secciones de datos en cards con hover-lift**

```tsx
<div className="hover-lift rounded-[var(--radius-lg)] border border-border bg-card p-4">
  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
    {sectionTitle}
  </p>
  {/* contenido de la sección — NO modificar */}
</div>
```

- [ ] **Step 4: Verificar typecheck y tests**

```bash
npm run typecheck && npm run test:run
```

- [ ] **Step 5: Commit**

```bash
git add "src/routes/contracts/\$contractId.tsx"
git commit -m "feat(contract-detail): hero section synthwave y cards con hover-lift"
```

---

### Task 13: Retematizar wizard de nueva contrato (/contracts/new)

**Files:**
- Modify: `src/routes/contracts/new.tsx`
- Modify: `src/components/contract/cascading-select.tsx`
- Modify: `src/components/contract/date-calculator.tsx`
- Modify: `src/components/contract/rate-preview.tsx`
- Modify: `src/components/contract/employee-selector.tsx`

> **CRÍTICO:** Solo modificar clases CSS/Tailwind en todos estos archivos. NO tocar lógica de negocio, callbacks, stores de Zustand, cálculos de fecha/tarifa ni la lógica de agrupación por tarifa en `employee-selector.tsx`.

- [ ] **Step 1: Leer src/routes/contracts/new.tsx**

Identificar la barra de progreso de pasos, el container del wizard, y cómo se pasa el paso actual.

- [ ] **Step 2: Actualizar progress bar del wizard en new.tsx**

Localizar el componente de steps/progress y reemplazar su JSX por:
```tsx
<div className="flex items-center mb-8">
  {steps.map((step, i) => (
    <div key={i} className="flex items-center flex-1 last:flex-none">
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
        i < currentStep
          ? "bg-gradient-to-br from-violet-500 to-cyan-400 text-[#06010f]"
          : i === currentStep
          ? "bg-primary text-primary-foreground dark:shadow-[0_0_16px_rgba(139,92,246,0.5)]"
          : "border-2 border-border text-muted-foreground"
      )}>
        {i < currentStep ? "✓" : i + 1}
      </div>
      {i < steps.length - 1 && (
        <div className={cn(
          "h-0.5 flex-1 mx-2 transition-all duration-500",
          i < currentStep
            ? "bg-gradient-to-r from-violet-500 to-cyan-400"
            : "bg-border"
        )} />
      )}
    </div>
  ))}
</div>
```

- [ ] **Step 3: Envolver cada paso en card con animate-in**

```tsx
<div className="animate-in rounded-[var(--radius-xl)] border border-border bg-card p-6 shadow-card">
  {/* contenido del paso actual — NO modificar */}
</div>
```

- [ ] **Step 4: Retematizar cascading-select.tsx**

Leer `src/components/contract/cascading-select.tsx`. Actualizar:
- Labels de sección → `text-xs font-semibold uppercase tracking-wider text-muted-foreground`
- Selects → verificar que usan el componente `Select` de shadcn/ui (ya retematizado)
- NO tocar los callbacks `onCompanyChange`, `onFactoryChange` ni la lógica de carga en cascada

- [ ] **Step 5: Retematizar date-calculator.tsx**

Leer `src/components/contract/date-calculator.tsx`. Actualizar:
- Fechas calculadas mostradas → `font-mono text-sm font-semibold text-cyan-400`
- Labels → `text-xs font-semibold uppercase tracking-wider text-muted-foreground`
- NO tocar `calculateEndDate`, `calculateContractDate`, `calculateNotificationDate` ni sus llamadas

- [ ] **Step 6: Retematizar rate-preview.tsx**

Leer `src/components/contract/rate-preview.tsx`. Actualizar:
- Valores monetarios (tarifas base y multiplicadas) → `font-mono font-bold text-violet-400`
- Labels de multiplicador (OT, holiday, etc.) → `text-xs text-muted-foreground`
- NO tocar los cálculos de multiplicadores (125%, 135%, 150%, etc.)

- [ ] **Step 7: Retematizar employee-selector.tsx**

Leer `src/components/contract/employee-selector.tsx`. Actualizar:
- Headers de grupo por tarifa → `font-mono text-sm font-bold text-violet-400`
- Nombres de empleados → `text-sm text-foreground`
- Checkboxes y selección visual → border violet al seleccionar
- **NO tocar**: `selectedByRate`, `billingRate || hourlyRate || data.hourlyRate`, la lógica de agrupación, ni `employeeAssignments`

- [ ] **Step 8: Verificar wizard completo funciona end-to-end**

```bash
npm run dev
```
Navegar a http://localhost:3026/contracts/new y completar los 5 pasos:
1. Step 1: Seleccionar empresa → fábrica → dept → línea
2. Step 2: Verificar fechas calculadas automáticamente
3. Step 3: Verificar rate preview con multiplicadores
4. Step 4: Seleccionar empleados — verificar agrupación por tarifa
5. Step 5: Crear contrato — verificar que se crea correctamente

- [ ] **Step 9: Verificar typecheck y tests**

```bash
npm run typecheck && npm run test:run
```
Resultado esperado: sin errores, 146 tests pasan.

- [ ] **Step 10: Commit**

```bash
git add src/routes/contracts/new.tsx src/components/contract/
git commit -m "feat(contract-wizard): progress bar synthwave, wizard retematizado"
```

---

## Chunk 4: Páginas Fase 2 — Operacional

### Task 14: Rediseñar batch y new-hires

**Files:**
- Modify: `src/routes/contracts/batch.tsx`
- Modify: `src/routes/contracts/new-hires.tsx`

- [ ] **Step 1: Leer src/routes/contracts/batch.tsx completo**

Identificar:
- Las cards de preview por grupo de tarifa y sus variables
- El estado de loading/progreso durante creación
- Los botones de acción (crear, cancelar)

- [ ] **Step 2: Actualizar cards de grupo de tarifa en batch.tsx**

```tsx
<div className="hover-lift rounded-[var(--radius-lg)] border border-border bg-card p-4">
  <div className="flex items-center justify-between mb-3">
    <span className="font-mono text-sm font-bold text-violet-400">¥{rate}/h</span>
    <Badge variant="info">{count}名</Badge>
  </div>
  <ul className="space-y-1">
    {employees.map((emp) => (
      <li key={emp.id} className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 dark:shadow-[0_0_4px_rgba(0,245,212,0.8)]" />
        {emp.name}
      </li>
    ))}
  </ul>
</div>
```

- [ ] **Step 3: Leer src/routes/contracts/new-hires.tsx completo**

Identificar las cards de preview de nuevos ingresos y su estructura.

- [ ] **Step 4: Aplicar el mismo patrón de cards en new-hires.tsx**

Usar el mismo snippet del Step 2 adaptado a las variables reales del archivo `new-hires.tsx`. El patrón visual es idéntico: card con `hover-lift`, tarifa en `font-mono text-violet-400`, badge de count, lista de empleados con dot cyan.

- [ ] **Step 5: Verificar typecheck y tests**

```bash
npm run typecheck && npm run test:run
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/contracts/batch.tsx src/routes/contracts/new-hires.tsx
git commit -m "feat(batch): retematizar páginas de creación batch con cards synthwave"
```

---

### Task 15: Rediseñar Companies con Sheet drawer

**Files:**
- Modify: `src/routes/companies/index.tsx`

> Este archivo tiene ~2144 LOC. Leer en secciones antes de editar.

- [ ] **Step 1: Localizar el estado del drawer**

```bash
grep -n "Drawer\|drawer\|isOpen\|open\|Sheet\|panel" src/routes/companies/index.tsx | head -30
```
Identificar el nombre exacto de la variable de estado del drawer (ej. `isDrawerOpen`, `showPanel`, etc.).

- [ ] **Step 2: Leer las primeras 150 líneas del archivo**

Identificar: imports, interfaces, estado del componente.

- [ ] **Step 3: Agregar imports de Sheet**

```typescript
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
```

- [ ] **Step 4: Reemplazar el drawer/panel vanilla por Sheet**

Localizar el JSX del drawer/panel lateral (usando el nombre encontrado en Step 1) y reemplazar la estructura exterior por:
```tsx
<Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
  <SheetContent side="right" className="w-[480px] overflow-y-auto bg-card border-l border-border">
    <SheetHeader className="pb-4 border-b border-border mb-4">
      <SheetTitle className="text-foreground font-bold">
        {editingItem ? "編集" : "新規追加"}
      </SheetTitle>
    </SheetHeader>
    {/* contenido del formulario — NO modificar */}
  </SheetContent>
</Sheet>
```
> Adaptar `isDrawerOpen`, `setIsDrawerOpen`, y el título al nombre real de las variables del archivo.

- [ ] **Step 5: Actualizar cards de empresa**

```tsx
<div className="hover-lift rounded-[var(--radius-xl)] border border-border bg-card p-5 cursor-pointer transition-all hover:border-primary/30">
  <div className="flex items-center gap-3 mb-4">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-black text-[#06010f] dark:shadow-[0_0_16px_rgba(139,92,246,0.35)]">
      {company.name[0]}
    </div>
    <div>
      <p className="font-bold text-foreground text-sm leading-tight">{company.name}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{factoryCount}工場</p>
    </div>
  </div>
</div>
```

- [ ] **Step 6: Verificar Sheet drawer funciona**

```bash
npm run dev
```
Ir a http://localhost:3026/companies, abrir el drawer de edición, llenar un campo y guardar. Verificar que la edición funciona correctamente.

- [ ] **Step 7: Typecheck y tests**

```bash
npm run typecheck && npm run test:run
```

- [ ] **Step 8: Commit**

```bash
git add src/routes/companies/index.tsx
git commit -m "feat(companies): Sheet drawer, cards con avatar, retematizar"
```

---

### Task 16: Rediseñar Employees

**Files:**
- Modify: `src/routes/employees/index.tsx`

- [ ] **Step 1: Leer src/routes/employees/index.tsx completo**

Identificar:
- La estructura de la tabla/lista de empleados
- Los campos disponibles (name, visaExpiry, visaType, etc.)
- Los filtros existentes

- [ ] **Step 2: Agregar helper EmployeeAvatar**

Agregar esta función **antes** del componente principal (no dentro):
```typescript
const AVATAR_GRADIENTS = [
  "from-violet-500 to-violet-700",
  "from-cyan-500 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
];

function EmployeeAvatar({ name }: { name: string }) {
  const idx = (name.codePointAt(0) ?? 0) % AVATAR_GRADIENTS.length;
  return (
    <div className={cn(
      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white",
      AVATAR_GRADIENTS[idx]
    )}>
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}
```

- [ ] **Step 3: Agregar helper VisaBadge**

```typescript
import { differenceInDays } from "date-fns";

function VisaBadge({ expiryDate }: { expiryDate: string | null | undefined }) {
  if (!expiryDate) return null;
  const daysLeft = differenceInDays(new Date(expiryDate), new Date());
  const variant =
    daysLeft < 30 ? "alert" : daysLeft < 90 ? "warning" : "active";
  return <Badge variant={variant}>{expiryDate}</Badge>;
}
```

- [ ] **Step 4: Usar los helpers en la tabla**

En cada fila de empleado, agregar el avatar y el visa badge:
```tsx
<td className="px-4 py-3.5">
  <div className="flex items-center gap-2.5">
    <EmployeeAvatar name={employee.name} />
    <span className="font-medium text-foreground">{employee.name}</span>
  </div>
</td>
{/* ... otras columnas ... */}
<td className="px-4 py-3.5">
  <VisaBadge expiryDate={employee.visaExpiry} />
</td>
```

- [ ] **Step 5: Typecheck y tests**

```bash
npm run typecheck && npm run test:run
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/employees/index.tsx
git commit -m "feat(employees): avatar por inicial, visa badge por vencimiento, retematizar"
```

---

## Chunk 5: Páginas Fase 3 — Secundarias

### Task 17: Rediseñar Documents

**Files:**
- Modify: `src/routes/documents/index.tsx`

- [ ] **Step 1: Leer src/routes/documents/index.tsx completo**

Identificar:
- Los tipos de PDF disponibles y cómo se renderizan (array map, botones individuales, etc.)
- Los nombres reales de los handlers (¿`handleGenerate`? ¿`onGenerate`?)
- El estado de loading/generación (¿`isGenerating`? ¿`isPending`?)

- [ ] **Step 2: Actualizar botones de PDF**

Usando los nombres reales encontrados en Step 1:
```tsx
<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
  {pdfTypes.map((type) => (
    <button
      key={type.id}
      onClick={() => handleGenerate(type.id)}  // usar nombre real del handler
      className="hover-lift flex flex-col items-center gap-3 rounded-[var(--radius-xl)] border border-border bg-card p-6 text-center transition-all hover:border-cyan-500/40 dark:hover:shadow-[0_0_20px_rgba(0,245,212,0.1)]"
    >
      <span className="text-3xl">{type.icon}</span>
      <span className="text-sm font-semibold text-foreground">{type.label}</span>
    </button>
  ))}
</div>
```

- [ ] **Step 3: Agregar spinner de generación**

Usando el nombre real del estado de loading:
```tsx
{isGenerating && (  // usar nombre real del estado
  <div className="flex items-center gap-2 text-violet-400 dark:drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]">
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
    <span className="text-sm font-medium">生成中...</span>
  </div>
)}
```

- [ ] **Step 4: Typecheck y tests**

```bash
npm run typecheck && npm run test:run
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/documents/index.tsx
git commit -m "feat(documents): botones PDF grid con hover cyan, spinner violet"
```

---

### Task 18: Rediseñar Import

**Files:**
- Modify: `src/routes/import/index.tsx`

- [ ] **Step 1: Leer src/routes/import/index.tsx completo**

Identificar:
- Los handlers de drag/drop y sus nombres reales (`onDragOver`, `onDrop`, etc.)
- El estado de dragging (`isDragging` u otro nombre)
- La tabla de diff y su estructura de datos

- [ ] **Step 2: Actualizar drop zone**

Usando los nombres reales de handlers y estado:
```tsx
<div
  onDragOver={onDragOver}  // usar nombre real
  onDrop={onDrop}          // usar nombre real
  className={cn(
    "flex flex-col items-center justify-center rounded-[var(--radius-xl)] border-2 border-dashed p-12 text-center transition-all",
    isDragging  // usar nombre real del estado
      ? "border-cyan-400 bg-cyan-500/5 dark:shadow-[0_0_30px_rgba(0,245,212,0.08)]"
      : "border-border hover:border-primary/40 hover:bg-primary/5"
  )}
>
  <span className="text-4xl mb-4">📥</span>
  <p className="font-semibold text-foreground">Excelファイルをドロップ</p>
  <p className="text-xs text-muted-foreground mt-1">または クリックして選択</p>
</div>
```

- [ ] **Step 3: Actualizar tabla de diff**

```tsx
{/* Fila nueva → borde cyan izquierdo */}
<tr className="border-l-2 border-cyan-400 bg-cyan-500/5">

{/* Fila modificada → borde gold izquierdo */}
<tr className="border-l-2 border-amber-400 bg-amber-500/5">

{/* Fila eliminada → borde red izquierdo, opacidad reducida */}
<tr className="border-l-2 border-red-400 bg-red-500/5 opacity-60">
```

- [ ] **Step 4: Typecheck y tests**

```bash
npm run typecheck && npm run test:run
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/import/index.tsx
git commit -m "feat(import): drop zone animada y diff table con colores synthwave"
```

---

### Task 19: Rediseñar History y Audit

**Files:**
- Modify: `src/routes/history/index.tsx`
- Modify: `src/routes/audit/index.tsx`

- [ ] **Step 1: Leer src/routes/history/index.tsx**

Identificar la estructura de datos del log: nombres reales de campos como tipo de acción, descripción y timestamp.

- [ ] **Step 2: Leer src/routes/audit/index.tsx**

Identificar si comparte la misma estructura de datos o si usa campos distintos.

- [ ] **Step 3: Agregar helper ACTION_COLORS usando los nombres reales de tipo**

```typescript
// Adaptar los keys al valor real del campo "type" de la API
const ACTION_COLORS: Record<string, string> = {
  create: "bg-cyan-400 dark:shadow-[0_0_6px_rgba(0,245,212,0.8)]",
  update: "bg-violet-400 dark:shadow-[0_0_6px_rgba(139,92,246,0.8)]",
  delete: "bg-red-400 dark:shadow-[0_0_6px_rgba(248,113,113,0.8)]",
  export: "bg-amber-400 dark:shadow-[0_0_6px_rgba(251,191,36,0.8)]",
};
```

- [ ] **Step 4: Actualizar filas del log en ambos archivos**

```tsx
<div className="flex gap-3 border-b border-border/50 px-4 py-3.5 transition-colors hover:bg-primary/5">
  <div className={cn(
    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
    ACTION_COLORS[entry.type] ?? "bg-muted"  // usar nombre real del campo
  )} />
  <div>
    <p className="text-sm text-foreground">{entry.description}</p>
    <p className="text-xs text-muted-foreground mt-0.5">{entry.timestamp}</p>
  </div>
</div>
```

- [ ] **Step 5: Typecheck y tests**

```bash
npm run typecheck && npm run test:run
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/history/index.tsx src/routes/audit/index.tsx
git commit -m "feat(history,audit): timeline con puntos de color por tipo de acción"
```

---

### Task 20: Rediseñar Settings

**Files:**
- Modify: `src/routes/settings/index.tsx`

- [ ] **Step 1: Leer src/routes/settings/index.tsx completo**

Identificar:
- Las secciones actuales y su estructura
- El label del bulk calendar tool (buscar "ワーカー" o "カレンダー")
- El estado del `conflictWarningDays`

- [ ] **Step 2: Agregar toggle de tema prominente al inicio**

```typescript
import { useTheme } from "@/lib/hooks/use-theme";

// Dentro del componente:
const { isDark, toggleTheme } = useTheme();
```

```tsx
{/* Primera card de la página */}
<div className="hover-lift rounded-[var(--radius-xl)] border border-border bg-card p-5 mb-6">
  <div className="flex items-center justify-between">
    <div>
      <p className="font-semibold text-foreground">テーマ</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {isDark ? "ダークモード（Synthwave）" : "ライトモード"}
      </p>
    </div>
    <button
      onClick={toggleTheme}
      className={cn(
        "relative h-7 w-12 rounded-full transition-all duration-300",
        isDark ? "bg-primary" : "bg-muted"
      )}
      aria-label="テーマ切り替え"
    >
      <span className={cn(
        "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-300",
        isDark ? "left-6" : "left-0.5"
      )} />
    </button>
  </div>
</div>
```

- [ ] **Step 3: Clarificar el label del bulk calendar tool**

Localizar el texto del bulk calendar tool y reemplazarlo por:
```tsx
<p className="font-semibold text-foreground">工場カレンダー一括更新</p>
<p className="text-xs text-muted-foreground mt-0.5">
  factories.calendar フィールドを更新します
</p>
```

- [ ] **Step 4: Typecheck y tests**

```bash
npm run typecheck && npm run test:run
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/settings/index.tsx
git commit -m "feat(settings): toggle tema visual y clarificación del bulk calendar"
```

---

### Task 21: Retematizar Companies Table (solo estética)

**Files:**
- Modify: `src/routes/companies/table.tsx`

> **CRÍTICO:** Archivo de ~1300 LOC con inline editing complejo. Solo cambiar clases CSS de la capa de presentación. Nunca modificar los handlers de celda, el estado de edición, ni la lógica de guardado.

- [ ] **Step 1: Leer las primeras 80 líneas para entender imports y estructura**

- [ ] **Step 2: Buscar los elementos de tabla**

```bash
grep -n "thead\|tbody\|<th\|<td\|<tr" src/routes/companies/table.tsx | head -40
```
Identificar los elementos y sus clases actuales.

- [ ] **Step 3: Actualizar clases del `<thead>` y `<th>`**

```tsx
// thead:
<thead className="sticky top-0 z-10 bg-card">

// th:
className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border"
```

- [ ] **Step 4: Actualizar clases de `<tr>` en tbody**

```tsx
// tr:
className="border-b border-border/50 hover:bg-primary/5 transition-colors"
```

- [ ] **Step 5: Actualizar celdas de ID**

En celdas que muestran IDs o valores numéricos técnicos:
```tsx
className="px-3 py-2.5 font-mono text-xs text-violet-400"
```

- [ ] **Step 6: Verificar que el inline editing sigue funcionando**

```bash
npm run dev
```
Ir a http://localhost:3026/companies/table, hacer doble click en una celda editable. Verificar que el editor inline abre y guarda correctamente.

- [ ] **Step 7: Typecheck y tests**

```bash
npm run typecheck && npm run test:run
```

- [ ] **Step 8: Commit**

```bash
git add src/routes/companies/table.tsx
git commit -m "feat(companies-table): actualizar estética sin tocar inline editing"
```

---

## Chunk 6: Verificación Final

### Task 22: Criterio de éxito completo

- [ ] **Step 1: Typecheck**

```bash
npm run typecheck
```
Resultado esperado: **0 errores**.

- [ ] **Step 2: Lint**

```bash
npm run lint
```
Resultado esperado: **0 errores, 0 warnings**.

- [ ] **Step 3: Tests**

```bash
npm run test:run
```
Resultado esperado: **146 tests pasan, 0 fallan**.

- [ ] **Step 4: Build de producción**

```bash
npm run build
```
Resultado esperado: build exitoso. Los warnings de chunk size (exceljs, main bundle) son pre-existentes y se ignoran.

- [ ] **Step 5: Verificar que server/ no tiene cambios**

```bash
git status -- server/
```
Resultado esperado: `nothing to commit` — no debe aparecer ningún archivo de `server/`.

- [ ] **Step 6: Smoke test dark mode**

Con `npm run dev`, verificar en dark mode:
- `/` — KPI cards con gradiente violet/cyan/gold/red, orbes animados visibles, tabla con IDs en violet
- `/contracts` — pills de filtro, row actions en hover, badges con dot pulsante
- `/contracts/new` — progress bar violet→cyan entre pasos
- `/companies` — Sheet drawer abre al hacer click en una empresa
- `/employees` — avatares con gradiente de color por nombre

- [ ] **Step 7: Smoke test light mode**

Hacer click en el toggle ☀️ en el header o settings y verificar:
- Sin orbes ni grid en el background
- Todos los textos legibles (foreground oscuro sobre background claro)
- Colores violet/teal visibles con buen contraste
- Preferencia persiste al recargar (F5)

- [ ] **Step 8: Commit del plan**

```bash
git add docs/superpowers/plans/2026-03-15-synthwave-ui-redesign.md docs/superpowers/specs/2026-03-15-synthwave-ui-redesign.md
git commit -m "docs: plan y spec de synthwave UI redesign"
```
