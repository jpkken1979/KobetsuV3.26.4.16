# Spec: conflictDate Override por Contrato + 3 Fixes de Auditoría

**Fecha:** 2026-04-08
**Proyecto:** KobetsuV3
**Estado:** Aprobado

---

## Contexto

El sistema está pensado para contratos vigentes. Al registrar contratos históricos (ej. 2022), la 抵触日 que se aplica es la actual de la fábrica, no la histórica. Esto genera endDates incorrectos en el registro retroactivo.

Adicionalmente, una auditoría de los pipelines de importación detectó 3 issues menores que se corrigen en este mismo bloque de trabajo.

---

## Parte 1 — 3 Fixes de Auditoría

### Fix 1: Errores TS pre-existentes en `documents-generate-batch-utils.ts`

**Problema:**
- `Cannot find module 'pdf-lib'` — falta declaración de tipos
- `Parameter 'p' implicitly has an 'any' type`

**Fix:** Agregar tipo explícito al parámetro `p` y verificar la importación de `pdf-lib`.

**Archivos:** `server/routes/documents-generate-batch-utils.ts`

---

### Fix 2: Normalización de `抵触日` en import de empleados

**Problema:** Si la celda viene con formato de fecha nativa de Excel (locale japonés), ExcelJS puede devolver `"2028/12/15"` o `"令和10年12月15日"` en vez de ISO. El server guarda lo que llega sin normalizar.

**Fix:** En `buildEmployeeData` (`server/services/import-employees.ts`), normalizar el valor de `抵触日` a formato `YYYY-MM-DD` antes de guardar. Aceptar: `Date` objects, strings ISO, strings `YYYY/MM/DD`, seriales numéricos.

**Archivos:** `server/services/import-employees.ts`

---

### Fix 3: Validación de sheet antes de importar factories

**Problema:** Si el usuario selecciona por error la hoja `抽出_最新` en el dropdown de import de factories, el import corre silenciosamente con 0 datos sin aviso.

**Fix:** Antes de procesar, verificar que la hoja seleccionada tiene al menos uno de los headers esperados (`派遣先責任者`, `指揮命令者`, `工場名`, `部署名`). Si no matchea, mostrar error claro: `"この シートはインポートに対応していません"` y bloquear el import.

**Archivos:** `src/routes/companies/-import-modal.tsx` (o el componente que maneja la selección de sheet)

---

## Parte 2 — Feature: `conflictDateOverride` por Contrato

### Objetivo

Permitir registrar una 抵触日 distinta a la de la fábrica en un contrato específico. Caso de uso principal: contratos históricos retroactivos donde la 抵触日 vigente en ese momento difiere de la actual.

### Arquitectura

#### DB — tabla `contracts`

Agregar columna nullable:
```sql
conflict_date_override TEXT  -- formato YYYY-MM-DD, nullable
```

Drizzle schema (`server/db/schema.ts`):
```ts
conflictDateOverride: text("conflict_date_override"),
```

Migration via `npm run db:push`.

#### API — `server/routes/contracts.ts`

- `POST /api/contracts` y `PUT /api/contracts/:id` aceptan `conflictDateOverride?: string | null`
- Zod schema: `conflictDateOverride: z.string().nullable().optional()`
- Sin cambios en contratos existentes (campo null por default)

#### Wizard — Step 2 (`src/routes/contracts/new.tsx`)

Bajo la sección de fechas, cuando hay una fábrica seleccionada con `conflictDate`:

```
抵触日 (工場設定): 2028/10/01
[ ] 別の抵触日を使用する
    [date picker — aparece solo si el toggle está activo]
```

Lógica de cálculo:
```ts
const effectiveConflictDate = overrideActive
  ? conflictDateOverride
  : selectedLine?.conflictDate ?? null;

const calculated = calculateEndDate(startDate, period, effectiveConflictDate);
```

El valor del override se persiste en el Zustand store (`contract-form.ts`) y se envía en el payload de creación.

#### PDF — `server/services/pdf-data-builders.ts`

Resolver la 抵触日 efectiva:
```ts
const effectiveConflictDate =
  contract.conflictDateOverride ?? factory.conflictDate ?? null;
```

Los 9 generadores PDF ya reciben el valor resuelto — no requieren cambios.

#### Retrocompatibilidad

- Campo nullable → contratos existentes tienen `conflictDateOverride = null`
- Comportamiento actual preservado 100%: si el override es null, se usa `factory.conflictDate` como siempre

---

### Criterios de aceptación

- [ ] Contrato histórico con `conflictDateOverride = "2022/10/01"` se crea correctamente
- [ ] `endDate` se cappea al override, no al `conflictDate` de la fábrica
- [ ] PDF muestra la 抵触日 del override si está seteado
- [ ] Contrato sin override funciona exactamente igual que antes
- [ ] Campo visible y editable en detalle del contrato (`/contracts/:contractId`)
- [ ] Typecheck pasa sin errores nuevos

---

## Orden de implementación

1. Fix 1 — TS errors (rápido, 1 archivo)
2. Fix 2 — normalización 抵触日 import (rápido, 1 archivo)
3. Fix 3 — sheet validation (moderado, 1 componente)
4. DB migration + Drizzle schema
5. API contracts (POST/PUT)
6. Zustand store update
7. Wizard Step 2 UI
8. pdf-data-builders resolver
9. Detalle contrato `/contracts/:contractId`
10. Tests + typecheck + build

---

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `server/db/schema.ts` | +`conflictDateOverride` column |
| `server/routes/contracts.ts` | Zod schema + INSERT/UPDATE |
| `server/services/pdf-data-builders.ts` | Resolver override ?? factory |
| `src/routes/contracts/new.tsx` | Toggle + date picker en Step 2 |
| `src/routes/contracts/$contractId.tsx` | Campo visible/editable |
| `src/stores/contract-form.ts` | +`conflictDateOverride` en state |
| `src/lib/api-types.ts` | +campo en `Contract` type |
| `server/routes/documents-generate-batch-utils.ts` | Fix TS errors |
| `server/services/import-employees.ts` | Normalizar 抵触日 |
| `src/routes/companies/-import-modal.tsx` | Sheet validation |
