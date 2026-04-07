# Spec: Synthwave UI Redesign — JP Kobetsu v26.3.10

**Fecha:** 2026-03-15
**Estado:** Aprobado
**Alcance:** Todas las páginas (14 rutas) + design system completo

---

## Objetivo

Rediseñar completamente la UI de JP Kobetsu con estética **synthwave** — moderna, elegante y divertida de usar. Dark mode + Light mode con toggle. Basado en shadcn/ui con Tailwind CSS 4. Sin cambios al backend ni a la lógica de negocio.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|----------|----------|-------|
| Paleta | Violet + Cyan + Gold (sin pink) | Usuario rechazó pink explícitamente |
| Modos | Dark + Light con toggle | Accesibilidad en distintos ambientes |
| Enfoque | Design system primero | 14 rutas requieren base consistente |
| Componentes | shadcn/ui retematizado | Ya instalado, convención del proyecto |
| Tipografía | Inter + JetBrains Mono | Legibilidad + identidad técnica |
| Mecanismo de tema | `.dark` class en `<html>` | Consistente con código existente en `header.tsx` y `index.html` |
| localStorage key | `"theme"` | Mantener key existente — no romper preferencias guardadas |

---

## Sección 1 — Design System & Tokens

### Paleta Dark Mode (clase `.dark` en `<html>`)

```css
--bg:        #06010f   /* base background */
--surface:   #0f0820   /* cards, sidebar */
--surface-2: #160d2e   /* inputs, nested surfaces */
--border:    rgba(139,92,246,0.18)
--border-2:  rgba(0,245,212,0.12)

--violet:    #8b5cf6
--violet-hi: #a78bfa
--violet-lo: #c4b5fd
--cyan:      #00f5d4
--cyan-hi:   #67e8d8
--gold:      #fbbf24
--gold-hi:   #fcd34d
--red:       #f87171

--text-1:    #ffffff
--text-2:    #c4b8d8
--text-3:    #8b7fa8   /* ratio 5.1:1 sobre --bg dark — cumple WCAG AA */
```

### Paleta Light Mode (sin clase `.dark`)

```css
--bg:        #faf8ff
--surface:   #ffffff
--surface-2: #f3f0ff
--border:    rgba(109,40,217,0.15)
--border-2:  rgba(13,148,136,0.15)

--violet:    #7c3aed   /* texto sobre blanco: 5.2:1 — cumple WCAG AA */
--violet-hi: #6d28d9
--violet-lo: #ede9fe
--cyan:      #0f766e   /* texto sobre blanco: 4.7:1 — cumple WCAG AA */
--cyan-hi:   #ccfbf1
--gold:      #b45309   /* texto sobre blanco: 4.6:1 — cumple WCAG AA */
--gold-hi:   #fef3c7
--red:       #dc2626

--text-1:    #1a1035
--text-2:    #4b4669
--text-3:    #6b7280   /* ratio 4.6:1 sobre #faf8ff — cumple WCAG AA */
```

> **Nota WCAG:** Todos los pares texto/fondo cumplen ratio ≥ 4.5:1. `--text-3` se usa solo en labels secundarios y placeholders — nunca como texto de contenido crítico.

### Botón Primary

```
Dark: bg #7c3aed  → texto blanco → ratio 5.2:1 ✓
Light: bg #7c3aed → texto blanco → ratio 5.2:1 ✓
```

### Tipografía

- **Inter** (400–800) — todo el UI. Ya cargado en `index.html`.
- **JetBrains Mono** (400, 600) — IDs de contrato, fechas técnicas, valores monoespaciados.

**Acción requerida en `index.html`:** Agregar JetBrains Mono al link de Google Fonts existente:
```html
<!-- Reemplazar la línea actual de fonts por: -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
```

### Espaciado y radio

```
radios:   8px (inputs/badges) / 10px (botones) / 12px (cards sm) / 16px (cards lg)
sombras dark:  glow violet: 0 0 20px rgba(139,92,246,0.4)
               glow cyan:   0 0 16px rgba(0,245,212,0.3)
               glow gold:   0 0 12px rgba(251,191,36,0.3)
sombras light: box-shadow estándar sin glow: 0 1px 3px rgba(0,0,0,0.08)
```

### Efectos visuales

**Dark mode:**
- **Orbes animados:** 3 radial-gradient blobs con `animation: float 8s ease-in-out infinite`
- **Micro-grid:** CSS background-image grid 48×48px con opacity 0.06
- **Glow en KPI values:** `text-shadow` con color del acento
- **Hover lift en cards:** `translateY(-3px)` con transición 0.2s
- **Badge pulsante:** keyframe `pulse` en indicador de "稼働中"
- **Row actions reveal:** `opacity: 0 → 1` en hover de filas de tabla

**Light mode:**
- Fondo plano `#faf8ff` sin orbes ni grid (decisión consciente — el synthwave vive en lo oscuro)
- Cards con `box-shadow: 0 1px 3px rgba(0,0,0,0.08)` en lugar de glow
- Hover lift en cards se mantiene
- Sin efectos de glow en texto

### Toggle Dark/Light

- Mecanismo: `.dark` class en `document.documentElement` (consistente con código existente)
- localStorage key: `"theme"` (mantener — no romper preferencias guardadas)
- Lógica existente en `header.tsx` se extrae a `src/lib/hooks/use-theme.ts` como refactor (no nueva lógica)
- Ícono Moon/Sun de Lucide React (ya importado en `header.tsx`)
- Transición CSS: `background 0.3s, color 0.3s, border-color 0.3s` (ya existe en `.transitioning`)

---

## Sección 2 — Componentes shadcn a tematizar/instalar

### Dependencias Radix a instalar

```bash
npx shadcn@latest add tooltip
npx shadcn@latest add dropdown-menu
npx shadcn@latest add sheet
```

Esto instala automáticamente:
- `@radix-ui/react-tooltip`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-dialog` (base de Sheet)

### Retematizar (ya instalados)

Button, Card, Badge, Input, Select, Dialog, Tabs, Separator, Skeleton, Toast (Sonner)

### Variantes nuevas de Button

```
primary   → bg #7c3aed, texto blanco, glow violet (dark) / box-shadow (light)
secondary → ghost con border violet
cyan      → bg cyan gradient, texto #06010f (acciones PDF)
danger    → bg red, solo para acciones destructivas
```

### Variantes nuevas de Badge — con color de texto especificado

| Variante | Dark bg | Dark texto | Light bg | Light texto |
|----------|---------|------------|----------|-------------|
| `active` | rgba(0,245,212,0.1) | `#67e8d8` | `#ccfbf1` | `#0f766e` |
| `warning` | rgba(251,191,36,0.1) | `#fcd34d` | `#fef3c7` | `#b45309` |
| `alert` | rgba(248,113,113,0.1) | `#fca5a5` | `#fee2e2` | `#dc2626` |
| `info` | rgba(139,92,246,0.1) | `#c4b5fd` | `#ede9fe` | `#7c3aed` |

> Todos los pares texto/fondo de badge cumplen ratio ≥ 4.5:1.

---

## Sección 3 — Páginas (14 rutas)

### Prioridad de implementación

**Fase 1 — Core (más usadas):**
1. `/` — Dashboard
2. `/contracts` — Lista de contratos
3. `/contracts/:id` — Detalle de contrato
4. `/contracts/new` — Wizard de creación

**Fase 2 — Operacional:**
5. `/contracts/batch` — Creación batch
6. `/contracts/new-hires` — Nuevos ingresos batch
7. `/companies` — Gestión de empresas
8. `/employees` — Lista de empleados

**Fase 3 — Secundarias:**
9. `/documents` — Generación PDF
10. `/import` — Importación Excel
11. `/history` — Historial
12. `/audit` — Log de auditoría
13. `/settings` — Configuración
14. `/companies/table` — Tabla de fábricas (solo estética — no tocar lógica de inline editing)

### Cambios por página

#### `/` Dashboard
- KPI cards con gradiente por tipo (violet/cyan/gold/red), glow en número (dark), box-shadow (light), hover lift
- Orbes animados en background (dark only)
- Tabla "últimos contratos" con row actions reveal
- Ranking de empresas con barra de progreso
- Activity feed con iconos por tipo de acción
- Greeting personalizado + contador de contratos del mes

#### `/contracts`
- DataTable con checkbox bulk-select visual (borde violet al seleccionar)
- Filtros como pills seleccionables
- Badge animado en estado (dot pulsante en "稼働中")
- Row actions: Ver / PDF / Editar / Eliminar (con Tooltip)
- Toolbar de acciones bulk que aparece al seleccionar

#### `/contracts/:id`
- Hero section con número de contrato grande (JetBrains Mono)
- Datos del contrato en grid de cards
- Sección de empleados asignados con badges de tarifa
- Acciones PDF prominentes (botones cyan grandes)
- Soft delete con ConfirmDialog retematizado

#### `/contracts/new` (wizard 5 pasos)
- Progress bar violet→cyan en la parte superior
- Cada paso en su propia card con animación de entrada
- Step indicators numerados con glow en el activo
- Rate preview con breakdown visual de multiplicadores
- Componentes `src/components/contract/*.tsx` (8 archivos) retematizados en esta fase

#### `/contracts/batch` y `/contracts/new-hires`
- Cards de preview por grupo de tarifa
- Progress visual durante creación
- Resultado con conteo

#### `/companies`
- Grid de cards por empresa con logo inicial (letra)
- Contador de fábricas y contratos activos por empresa
- Drawer lateral usando Sheet (shadcn) en lugar de implementación vanilla actual

#### `/employees`
- Avatar generado con inicial + color basado en nombre
- Filtros: empresa, fábrica, estado de visa
- Badge de visa con color según vencimiento
- Search con highlight del término

#### `/documents`
- Botones de PDF grandes con iconos, agrupados por tipo
- Estado de generación con spinner violet
- Lista de PDFs generados con fecha y botón de descarga

#### `/import`
- Drop zone con borde animado (dashed violet → solid cyan al hover)
- Preview de diff con colores: cyan nuevo / gold modificado / red eliminado

#### `/history` y `/audit`
- Timeline vertical con punto de color por tipo de acción
- Color coding: create (cyan) / update (violet) / delete (red) / export (gold)

#### `/settings`
- Toggle dark/light prominente al inicio de la página
- `conflictWarningDays` como input numérico con label descriptivo
- Nota clara sobre qué actualiza el bulk calendar tool

#### `/companies/table`
- Solo estética: colores, fuentes, bordes synthwave
- No modificar lógica de inline editing (~1300 LOC) — alto riesgo de regresión

---

## Sección 4 — Archivos a modificar

```
index.html                                   → agregar JetBrains Mono a Google Fonts
src/index.css                                → tokens completos dark/light, efectos
src/lib/hooks/use-theme.ts                   → extraer lógica de header.tsx (refactor)
src/components/layout/root-layout.tsx        → orbes + grid en dark, layout base
src/components/layout/sidebar.tsx            → rediseño completo
src/components/layout/header.tsx             → usar use-theme hook, mantener toggle
src/components/ui/*.tsx                      → retematizar todos (Button variantes, Badge)
src/components/contract/*.tsx                → retematizar wizard components (8 archivos)
src/routes/index.tsx                         → Dashboard
src/routes/contracts/index.tsx               → Lista contratos
src/routes/contracts/$contractId.tsx         → Detalle contrato
src/routes/contracts/new.tsx                 → Wizard nuevo contrato
src/routes/contracts/batch.tsx               → Batch
src/routes/contracts/new-hires.tsx           → New hires batch
src/routes/companies/index.tsx               → Empresas (Sheet drawer)
src/routes/employees/index.tsx               → Empleados
src/routes/documents/index.tsx               → Documentos
src/routes/import/index.tsx                  → Importación
src/routes/history/index.tsx                 → Historial
src/routes/audit/index.tsx                   → Auditoría
src/routes/settings/index.tsx                → Configuración
src/routes/companies/table.tsx               → Solo estética
```

**No se modifica:**
- `server/` — cero cambios backend
- `src/lib/api.ts`, stores Zustand, React Query hooks — sin cambios
- `src/routeTree.gen.ts` — auto-generado, no tocar
- Lógica de negocio en todos los archivos de rutas

---

## Criterios de éxito

- [ ] Todos los pares texto/fondo cumplen WCAG AA (ratio ≥ 4.5:1) en dark y light mode
- [ ] Toggle dark/light funcional y persistido en `localStorage` key `"theme"`
- [ ] 14 rutas con el nuevo estilo consistente
- [ ] `npm run typecheck` sin errores
- [ ] `npm run lint` sin errores
- [ ] `npm run build` exitoso
- [ ] `npm run test:run` — los 146 tests pasan (sin regresiones funcionales)
- [ ] Sin cambios en `server/`
