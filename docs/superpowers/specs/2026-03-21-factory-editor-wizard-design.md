# Factory Editor — Wizard Redesign

**Fecha:** 2026-03-21
**Problema:** El editor de fábricas actual (4 tabs, ~40 campos en dialog modal) es confuso, feo, y tedioso.
**Solución:** Reemplazar tabs por un wizard progresivo de 5 pasos con diseño LUNARIS, tabla compacta para personnel, y smart features anti-tediosidad.

---

## Archivo principal a modificar

`src/routes/companies/-factory-drawer.tsx` (709 líneas) — se reescribe completamente.

Archivos secundarios:
- `src/routes/companies/-shared.tsx` — se actualizan `DRAWER_TABS` → `WIZARD_STEPS`, se agregan tipos nuevos
- `src/routes/companies/-shift-manager.tsx` — se mantiene, se integra en paso 3

---

## Estructura del Wizard — 5 Pasos

### Paso 1: 識別 (Identidad)
**Campos:** 3
| Campo | Key | Tipo | Requerido |
|-------|-----|------|-----------|
| 工場名 | `factoryName` | text | Sí |
| 配属先 | `department` | text | No |
| ライン名 | `lineName` | text | No |

**Feature:** Botón "別のラインからコピー" — abre selector de líneas existentes de la misma empresa, copia todos los campos de la línea seleccionada al formulario.

**Hint:** "工場名 + 配属先 + ライン の組み合わせがユニークIDになります"

### Paso 2: 所在地・仕事 (Ubicación y trabajo)
**Campos:** 4
| Campo | Key | Tipo | Requerido |
|-------|-----|------|-----------|
| 住所 | `address` | text | No |
| 電話番号 | `phone` | text | No |
| 基本単価（時給） | `hourlyRate` | number | No |
| 仕事内容 | `jobDescription` | textarea | No |

**Display:** `hourlyRate` formateado como `¥X,XXX` con font monospace.

### Paso 3: 勤務条件 (Condiciones de trabajo)
**Campos:** Variables (depende de shifts)
| Campo | Key | Tipo |
|-------|-----|------|
| 勤務日 | `workDays` | text |
| 残業上限 | `overtimeHours` | text |
| 就業日外労働 | `overtimeOutsideDays` | textarea |
| カレンダー | `calendar` | textarea |
| シフト・休憩 | (via ShiftManager) | componente |
| 産業用ロボット特別教育 | `hasRobotTraining` | checkbox |

**Features:**
- **Shift presets inline:** 3 botones (日勤のみ / 2交替 / 3交替) que cargan shifts pre-configurados con un clic. El preset activo se destaca con `bg-primary/8 border-primary/20 text-primary`.
- **Shift templates:** Dropdown para cargar templates guardados + botón para guardar como template.
- **Auto-gen calendario:** Botón "✨ 自動生成" genera texto de calendario Toyota-style.
- **ShiftManager:** Se mantiene el componente existente dentro de un card con borde `border-border/40`.

### Paso 4: 担当者 (Responsables)
**Campos:** 5 personas × 3 campos = 15 campos, organizados en tabla compacta agrupada.

**Layout: Dos tablas agrupadas**

**Grupo 1: 派遣先（客先側）**
| Rol | Name key | Dept key | Phone key |
|-----|----------|----------|-----------|
| 派遣先責任者 | `hakensakiManagerName` | `hakensakiManagerDept` | `hakensakiManagerPhone` |
| 指揮命令者 | `supervisorName` | `supervisorDept` | `supervisorPhone` |
| 苦情処理 | `complaintClientName` | `complaintClientDept` | `complaintClientPhone` |

**Grupo 2: 派遣元（UNS側）**
| Rol | Name key | Dept key | Phone key |
|-----|----------|----------|-----------|
| 派遣元責任者 | `managerUnsName` | `managerUnsDept` | `managerUnsPhone` |
| 苦情処理 | `complaintUnsName` | `complaintUnsDept` | `complaintUnsPhone` |

**Diseño de tabla:**
- Header: 4 columnas (役職 110px | 氏名 1fr | 部署 1fr | 電話番号 130px)
- Cada fila tiene un dot de estado: verde `bg-primary` si tiene datos, `bg-muted/20` si vacío
- Filas vacías muestran "未設定" en `text-muted-foreground`
- Clic en fila → inline edit: los textos se convierten en inputs dentro de la misma fila
- Labels de grupo: `text-[9px] font-bold text-muted-foreground uppercase tracking-[1.5px]`

**Feature: "全ラインに適用"** — Botón que aplica los responsables actuales a todas las líneas de la misma fábrica (llama bulk-roles API existente).

**Sección adicional: 派遣元 所在地**
- 2 campos (managerUnsAddress, complaintUnsAddress) debajo de las tablas
- Checkbox "同上" sincroniza complaintUnsAddress con managerUnsAddress

**Feature: Auto-fill UNS** — Al crear nueva fábrica, pre-llenar campos UNS con datos default de la empresa (si están configurados).

### Paso 5: 契約・支払 (Contrato y pagos)
**Campos:** 5
| Campo | Key | Tipo |
|-------|-----|------|
| 抵触日 | `conflictDate` | date |
| 契約期間パターン | `contractPeriod` | select |
| 締め日 | `closingDayText` | text |
| 支払日 | `paymentDayText` | text |
| 時間単位 | `timeUnit` | toggle buttons (15分/30分/1時間) |

**Display:** `timeUnit` como toggle button group, no como select dropdown. El activo usa `bg-primary/8 border-primary/20 text-primary`.

---

## Navegación del Wizard

### Barra de progreso (sticky, arriba del contenido)
- 5 círculos numerados conectados por líneas
- **Completado:** Círculo filled `bg-primary text-primary-foreground`, línea `bg-primary`
- **Actual:** Círculo con borde `border-2 border-primary text-primary`, fondo transparente
- **Pendiente:** Círculo con borde `border-2 border-border text-muted-foreground`
- Cada círculo tiene label debajo (識別, 所在地, 勤務, 担当者, 契約)
- **En modo edición:** Clic en cualquier paso salta directamente (no forzar lineal)
- **En modo crear:** Navegación lineal con skip opcional

### Footer de navegación (sticky, abajo del modal)
- Izquierda: "← 前へ" (disabled en paso 1)
- Centro: "ステップ X / 5"
- Derecha: "スキップ" (outline) + "次へ →" (primary) / "保存" (primary, en paso 5)

### Comportamiento
- `スキップ` avanza sin validar (solo disponible en pasos sin campos requeridos)
- Paso 1 es el único con campo requerido (`factoryName`), no se puede skipear
- En modo edición, todos los pasos son clickeables en la barra (jump directo)
- Zustand o useState para estado del formulario (mantener patrón existente de `FormRecord`)

---

## Estilo Visual — LUNARIS

**Todos los colores usan CSS custom properties del theme:**
- Fondos de input: `bg-card` con `border-border/60`
- Labels: `text-xs font-medium text-muted-foreground`
- Cards/secciones: `border border-border/40 rounded-xl bg-card/50`
- Botones primary: `bg-primary text-primary-foreground`
- Botones outline: `border border-border text-muted-foreground hover:bg-muted`
- Toggle activo: `bg-primary/8 border-primary/20 text-primary`
- Dot de estado: `bg-primary` (lleno), `bg-muted-foreground/20` (vacío)
- Hints: `text-[11px] text-muted-foreground bg-primary/5 border-l-3 border-primary rounded-lg p-3`
- Transiciones: `transition-all duration-fast` (120ms)
- Animación entre pasos: Framer Motion `opacity + x` (como el actual, 150ms)

**No usar colores hardcodeados.** Todo via `var(--color-*)` o clases Tailwind que respeten el theme.

**Light mode:** Funciona automáticamente si se usan tokens semánticos.

---

## Estado del formulario

Mantener el patrón actual:
```typescript
const [form, setForm] = useState<FormRecord>({});
const [shifts, setShifts] = useState<ShiftEntry[]>([...]);
const [currentStep, setCurrentStep] = useState(1);
```

- `FormRecord` = `Record<string, FormValue>` (ya existe en -shared.tsx)
- Al cargar factory existente, popular form + shifts desde query data (patrón actual)
- `isDirty` tracking con `useUnsavedWarning` (patrón actual)
- Submit recompone shifts → DB fields (lógica actual de `handleSubmit`)

---

## Componentes a crear/modificar

| Componente | Acción |
|------------|--------|
| `-factory-drawer.tsx` | **Reescribir** — de tabs a wizard con 5 pasos |
| `-factory-wizard-steps.tsx` | **Nuevo** — los 5 step components extraídos |
| `-personnel-table.tsx` | **Nuevo** — tabla compacta agrupada con inline edit |
| `-wizard-progress.tsx` | **Nuevo** — barra de progreso reutilizable |
| `-shared.tsx` | **Modificar** — agregar WIZARD_STEPS, tipos para inline edit |
| `-shift-manager.tsx` | **Sin cambios** — se usa tal cual en paso 3 |

---

## Interacción: Inline Edit en tabla de personnel

Cuando el usuario hace clic en una fila de la tabla:
1. La fila se expande ligeramente (padding extra)
2. Los textos se convierten en inputs con `autoFocus` en el primer campo
3. Borde de la fila cambia a `border-primary/30`
4. Clic fuera o Tab fuera del último input cierra el inline edit
5. Los cambios se aplican inmediatamente al form state (no hay "confirm")

---

## Migración del estado actual

La reescritura debe:
1. **Preservar toda la lógica de submit** — `handleSubmit` compone shifts → DB fields
2. **Preservar la lógica de ShiftManager** — solo cambia dónde se renderiza
3. **Preservar unsaved warning** — `useUnsavedWarning(isDirty)`
4. **Preservar query/mutation hooks** — `useCreateFactory`, `useUpdateFactory`
5. **No cambiar API** — mismos endpoints, mismos payloads
6. **No cambiar schema DB** — solo reorganización UI

---

## Campos deliberadamente excluidos del spec original (CORREGIDO)

Los siguientes campos existen en el editor actual y **deben incluirse** en el wizard:

| Campo | Key | Agregar en paso |
|-------|-----|-----------------|
| 口座情報 | `bankAccount` | Paso 5 |
| 締め日（数値） | `closingDay` | Paso 5 (secondary, debajo del text) |
| 支払日（数値） | `paymentDay` | Paso 5 (secondary, debajo del text) |
| 労働者締め日 | `workerClosingDay` | Paso 5 |
| 労働者支払日 | `workerPaymentDay` | Paso 5 |
| 労働者カレンダー | `workerCalendar` | Paso 5 |
| 説明者 | `explainerName` | Paso 4 (debajo de las tablas) |
| 協定期間終了 | `agreementPeriodEnd` | Paso 5 |
| シフトパターン | `shiftPattern` | Paso 3 (set por los preset buttons) |

`jobDescription2` existe en schema pero NO se usa en el editor actual. No incluir.

---

## Validación

### Per-step validation
- **Paso 1:** `factoryName` requerido. No se puede avanzar sin él.
- **Pasos 2-5:** Sin campos requeridos. Se puede skipear.
- **Submit (paso 5):** Validar uniqueness `(companyId, factoryName, department, lineName)` client-side antes de enviar. Si viola constraint, mostrar error inline en paso 1 y navegar ahí.

### Errores de submit
- Error de uniqueness → toast error + navegar a paso 1 con `factoryName` marcado `aria-invalid`
- Error de servidor → toast error genérico con `onMutationError`
- `hourlyRate` negativo → permitir (el servidor lo acepta, no hay regla de negocio contra esto)

---

## Create vs Edit — Comportamiento

| Aspecto | Crear | Editar |
|---------|-------|--------|
| Paso inicial | 1 | 1 (siempre) |
| Navegación | Lineal con skip | Libre (clic en cualquier paso) |
| Progress bar | Solo completados se llenan | Todos se muestran como "con datos" o "vacíos" según contenido |
| Loading state | No hay (form vacío) | Skeleton dentro del dialog mientras `useQuery` carga |
| Pasos no visitados | Se muestran como pending | Se muestran según si tienen datos (dot verde/gris) |

---

## Feature: Copiar de otra línea

- **UI:** Botón en paso 1 → abre dropdown con líneas de la misma empresa (query `factories/cascade/:companyId`)
- **Qué copia:** TODOS los campos excepto `factoryName`, `department`, `lineName` (identidad)
- **Incluye shifts:** Sí, copia `ShiftEntry[]` parseados de la línea fuente
- **Overwrites:** Sí, reemplaza todo el form state (el usuario acaba de empezar, no hay datos previos que perder)
- **Sin líneas:** Botón no aparece si la empresa no tiene otras líneas

---

## Feature: 全ラインに適用 (Apply to all lines)

- **Requiere ConfirmDialog:** Sí, con variant destructive: "この操作で同じ工場の全ラインの担当者が上書きされます"
- **Usa `excludeLineIds`:** No — este botón aplica a TODAS las líneas, sin excepciones
- **API:** `PUT /api/factories/bulk-roles` (endpoint existente)
- **Feedback:** Toast success "X件のラインに適用しました" / toast error si falla

---

## Feature: Auto-fill UNS

**Removida del spec.** No hay fuente de datos definida para "UNS defaults". Esto requeriría backend changes que están fuera de scope. Si se implementa en el futuro, sería tomando datos del factory más reciente de la misma empresa.

---

## Utilidades a reubicar

`HOLIDAY_DB` y `generateCalendarText()` se mueven a `src/lib/shift-utils.ts` (ya tiene funciones de shift/calendario). No quedan inline en el drawer.

---

## Container

Se mantiene `<Dialog>` como container (no Sheet). CLAUDE.md lo especifica explícitamente. El dialog usa `max-w-5xl` como el actual.

---

## Testing

- Los 352 tests existentes deben seguir pasando (no hay cambios de API/lógica)
- Agregar test básico de rendering: wizard muestra 5 pasos, navega entre ellos
- Verificar que el formulario preserva datos entre pasos (state no se pierde)
