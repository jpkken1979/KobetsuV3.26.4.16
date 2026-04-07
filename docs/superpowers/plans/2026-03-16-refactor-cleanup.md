# Refactor & Cleanup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar código muerto, corregir tipos, extraer lógica duplicada, y dividir `companies/index.tsx` (2027 LOC) en sub-componentes mantenibles.

**Architecture:** 4 tareas independientes ordenadas de menor a mayor riesgo. Cada tarea termina con `npm run typecheck && npm run test:run` antes del commit.

**Tech Stack:** TypeScript strict, React 19, Vitest, TanStack Router, Tailwind CSS 4

---

## Chunk 1: Cambios de bajo riesgo

### Task 1: Fix `employees?: any[]` en api.ts

**Files:**
- Modify: `src/lib/api.ts:149`

- [ ] **Step 1: Cambiar el tipo**

```typescript
// src/lib/api.ts, línea 149
// ANTES:
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- API returns Employee[] from list, ContractEmployee[] from detail
employees?: any[];

// DESPUÉS:
employees?: (Employee | ContractEmployee)[];
```

- [ ] **Step 2: Verificar que typecheck pasa**

```bash
npm run typecheck
```
Expected: sin errores nuevos

- [ ] **Step 3: Verificar tests**

```bash
npm run test:run
```
Expected: 163/163 ✅

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "fix(api): reemplazar any[] con union type (Employee | ContractEmployee)[]"
```

---

### Task 2: Eliminar servicios dead code

**Files:**
- Delete: `server/services/contract-logic.ts`
- Delete: `server/services/rate-calculator.ts`
- Modify: `server/__tests__/services.test.ts` — eliminar los 2 describe blocks de rate-calculator y contract-logic

Los tests a eliminar en `services.test.ts` son:
- `describe("calculateRates", ...)` (líneas ~293-370)
- `describe("determineEmploymentType", ...)` (líneas ~370+)
- `describe("checkCompliance", ...)` (líneas que importan de contract-logic)
- Los imports en líneas 19-25: `import { calculateRates, determineEmploymentType } from "../services/rate-calculator"` y `import { checkCompliance, REQUIRED_LEGAL_FIELDS } from "../services/contract-logic"`

- [ ] **Step 1: Eliminar los describe blocks de rate-calculator y contract-logic en services.test.ts**

Localizar y eliminar:
1. Las líneas de import de `rate-calculator` y `contract-logic` al inicio del archivo
2. Todo el bloque `describe("calculateRates", ...)`
3. Todo el bloque `describe("determineEmploymentType", ...)`
4. Todo el bloque `describe("checkCompliance", ...)` / `describe("REQUIRED_LEGAL_FIELDS", ...)`

- [ ] **Step 2: Verificar que los tests restantes siguen pasando**

```bash
npm run test:run -- server/__tests__/services.test.ts
```
Expected: todos pasan, solo se eliminaron tests de dead code

- [ ] **Step 3: Eliminar los archivos**

```bash
rm server/services/contract-logic.ts
rm server/services/rate-calculator.ts
```

- [ ] **Step 4: Verificar typecheck y tests completos**

```bash
npm run typecheck && npm run test:run
```
Expected: sin errores, 163 tests menos los eliminados ≈ 151 tests ✅

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(services): eliminar contract-logic y rate-calculator (código no integrado en producción)"
```

---

## Chunk 2: Refactor contracts.ts (batch logic)

### Task 3: Extraer lógica común de analyzeBatch / analyzeNewHires

**Files:**
- Modify: `server/routes/contracts.ts`
- Modify: `server/services/batch-helpers.ts` (agregar función base)

**Nota:** `analyzeBatch` (línea ~251) y `analyzeNewHires` (línea ~501) hacen casi lo mismo. La diferencia es la fecha de entrada y el nombre de los campos. Extraer la inicialización común.

- [ ] **Step 1: Identificar el código común entre las dos funciones**

Leer ambas funciones completas (líneas 251-500 y 501-700 aprox de contracts.ts) y anotar qué líneas son idénticas.

- [ ] **Step 2: Agregar `buildBatchContext()` en batch-helpers.ts**

```typescript
// server/services/batch-helpers.ts — agregar al final

export interface BatchContext {
  targetFactories: Factory[];
  startDate: string;
}

/**
 * Builds the common context needed by both analyzeBatch and analyzeNewHires.
 * Fetches active factories and validates the start date.
 */
export async function buildBatchContext(
  companyId: number,
  startDate: string,
  factoryIds?: number[]
): Promise<BatchContext> {
  const targetFactories = await getTargetFactories(companyId, factoryIds);
  return { targetFactories, startDate };
}
```

- [ ] **Step 3: Escribir test para buildBatchContext**

```typescript
// server/__tests__/batch-helpers.test.ts — agregar al final
describe("buildBatchContext", () => {
  it("returns targetFactories and startDate", async () => {
    // Este test requiere DB mock — si es demasiado acoplado, skip y testear indirectamente
  });
});
```

- [ ] **Step 4: Refactorizar analyzeBatch y analyzeNewHires para usar el contexto común**

- [ ] **Step 5: Verificar typecheck y tests**

```bash
npm run typecheck && npm run test:run
```
Expected: 163 tests (o N tras task 2) ✅

- [ ] **Step 6: Commit**

```bash
git commit -m "refactor(contracts): extraer buildBatchContext para unificar analyzeBatch y analyzeNewHires"
```

---

## Chunk 3: Split companies/index.tsx

### Mapa de archivos a crear

| Archivo nuevo | Componente(s) | LOC aprox |
|--------------|---------------|-----------|
| `-factory-card.tsx` | `QuickEditField`, `FactoryCard` | 230 |
| `-shift-manager.tsx` | `ShiftManager` | 190 |
| `-company-card.tsx` | `CompanyCard` | 130 |
| `-bulk-edit-modal.tsx` | `BulkEditModal` | 235 |
| `-factory-drawer.tsx` | `FactoryDrawer` | 555 |
| `-factory-panel.tsx` | `FactoryPanel` | 300 |
| `index.tsx` (resultado) | `CompaniesList`, `CompanySkeleton`, tipos | ~350 |

**Estrategia:** Extraer de adentro hacia afuera. Primero los componentes hoja (sin dependencias a otros componentes del mismo archivo), luego los contenedores.

**Orden correcto:**
1. `-factory-card.tsx` (solo depende de -shared)
2. `-shift-manager.tsx` (solo depende de shift-utils)
3. `-company-card.tsx` (solo depende de -shared)
4. `-bulk-edit-modal.tsx` (solo depende de -shared)
5. `-factory-drawer.tsx` (depende de -shift-manager)
6. `-factory-panel.tsx` (depende de -factory-card, -factory-drawer, -bulk-edit-modal)
7. `index.tsx` — limpiar importaciones

### Task 4: Extraer `-factory-card.tsx`

**Files:**
- Create: `src/routes/companies/-factory-card.tsx`
- Modify: `src/routes/companies/index.tsx` (eliminar QuickEditField y FactoryCard, agregar import)

Contenido: `QuickEditField` (líneas 278-328) + `FactoryCard` (líneas 1847-2027)

Imports necesarios para el nuevo archivo:
```typescript
import { useState, useRef, useEffect } from "react";
import { Pencil, Trash2, Clock, Users, MapPin, JapaneseYen, AlertTriangle, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useDeleteFactory, useUpdateFactory } from "@/lib/hooks/use-factories";
import type { Factory as FactoryType } from "@/lib/api";
import { getConflictDateStatus, INPUT_SM_CLS } from "./-shared";
```

- [ ] **Step 1: Crear el archivo con QuickEditField y FactoryCard**
- [ ] **Step 2: En index.tsx, reemplazar definiciones con import**
- [ ] **Step 3: Verificar que la app renderiza correctamente**

```bash
npm run typecheck
```

### Task 5: Extraer `-shift-manager.tsx`

**Files:**
- Create: `src/routes/companies/-shift-manager.tsx`
- Modify: `src/routes/companies/index.tsx`

Contenido: `ShiftManager` (líneas 83-272)

Imports necesarios:
```typescript
import { cn } from "@/lib/utils";
import { Plus, Minus, X } from "lucide-react";
import { type ShiftEntry, uid, calcMinsBetween, composeWorkHoursText, composeFullBreakText } from "@/lib/shift-utils";
import { INPUT_SM_CLS } from "./-shared";
```

- [ ] **Step 1: Crear el archivo**
- [ ] **Step 2: Actualizar index.tsx**
- [ ] **Step 3: `npm run typecheck`**

### Task 6: Extraer `-company-card.tsx`

**Files:**
- Create: `src/routes/companies/-company-card.tsx`
- Modify: `src/routes/companies/index.tsx`

Contenido: `CompanyCard` (líneas 1420-1548)

Imports necesarios:
```typescript
import { Pencil, Plus, MapPin, Phone, Factory, Layers, AlertTriangle, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Company } from "@/lib/api";
import { AVATAR_COLORS, getCompanyInitial } from "./-shared";
```

- [ ] **Step 1: Crear el archivo**
- [ ] **Step 2: Actualizar index.tsx**
- [ ] **Step 3: `npm run typecheck`**

### Task 7: Extraer `-bulk-edit-modal.tsx`

**Files:**
- Create: `src/routes/companies/-bulk-edit-modal.tsx`
- Modify: `src/routes/companies/index.tsx`

Contenido: `BulkEditModal` (líneas 334-565)

Imports necesarios:
```typescript
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateFactory } from "@/lib/hooks/use-factories";
import type { Factory as FactoryType } from "@/lib/api";
import { BULK_FIELDS, INPUT_CLS, CONTRACT_PERIOD_OPTIONS_FROM_SHIFT_UTILS } from "./-shared";
// Nota: CONTRACT_PERIOD_OPTIONS viene de @/lib/shift-utils
```

- [ ] **Step 1: Crear el archivo**
- [ ] **Step 2: Actualizar index.tsx**
- [ ] **Step 3: `npm run typecheck`**

### Task 8: Extraer `-factory-drawer.tsx`

**Files:**
- Create: `src/routes/companies/-factory-drawer.tsx`
- Modify: `src/routes/companies/index.tsx`

Contenido: `FactoryDrawer` (líneas 571-1122)

Importa: `ShiftManager` desde `./-shift-manager`

- [ ] **Step 1: Crear el archivo con todos los imports y el componente completo**
- [ ] **Step 2: Actualizar index.tsx — eliminar FactoryDrawer, agregar import**
- [ ] **Step 3: `npm run typecheck`**

### Task 9: Extraer `-factory-panel.tsx`

**Files:**
- Create: `src/routes/companies/-factory-panel.tsx`
- Modify: `src/routes/companies/index.tsx`

Contenido: `FactoryPanel` (líneas 1550-1845)

Importa: `FactoryCard` desde `./-factory-card`, `FactoryDrawer` desde `./-factory-drawer`, `BulkEditModal` desde `./-bulk-edit-modal`, `FactoryRolesHeader` desde `./-factory-roles-header`

- [ ] **Step 1: Crear el archivo**
- [ ] **Step 2: Actualizar index.tsx — eliminar FactoryPanel, agregar import**
- [ ] **Step 3: `npm run typecheck`**

### Task 10: Limpiar index.tsx

**Files:**
- Modify: `src/routes/companies/index.tsx`

Después de extraer todos los componentes, index.tsx debe contener solo:
- Imports del route
- Tipos locales (FormRecord, CompanyQuickFilter, CompanySort)
- `CompanySkeleton`
- `CompaniesList`
- Target: ~350 LOC

- [ ] **Step 1: Eliminar imports no usados de index.tsx**
- [ ] **Step 2: Verificar que no queden componentes definidos localmente que deberían estar en otros archivos**
- [ ] **Step 3: Typecheck + lint completo**

```bash
npm run typecheck && npm run lint && npm run test:run
```
Expected: sin errores, todos los tests pasan ✅

- [ ] **Step 4: Commit final**

```bash
git add src/routes/companies/
git commit -m "refactor(companies): dividir index.tsx (2027 LOC) en 6 sub-componentes"
```

---

## Verificación final

```bash
npm run typecheck  # sin errores
npm run lint       # sin errores
npm run test:run   # todos los tests pasan
npm run build      # build exitoso
```
