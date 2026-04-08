# Enhanced Mid-Hires (途中入社者) — Auto-Period + Scope Selector

## Goal

Mejorar el flujo `/contracts/mid-hires` para que calcule automáticamente el período de búsqueda desde la 抵触日 de la empresa, respete la jerarquía de 抵触日 (empresa → fábrica → override manual), y muestre un preview agrupado por fábrica/línea antes de crear los contratos.

## Architecture

- **DB:** Agregar `conflict_date` y `contract_period` a `client_companies`
- **Backend:** Extender `analyzeMidHires()` para calcular `periodStart` automáticamente y retornar grupos con `effectiveConflictDate` por fábrica/línea
- **Frontend:** Rediseñar `/contracts/mid-hires` con step 1 (selección + parámetros) y step 2 (preview agrupado, 抵触日 editable por fábrica)

## Tech Stack

TypeScript, Drizzle ORM, Hono, React 19, Zod 4, TanStack Query, Zustand, Tailwind CSS 4

---

## Jerarquía de 抵触日 efectiva

```
company.conflictDate          ← default para todas las fábricas
  └── factory.conflictDate    ← override si la fábrica tiene su propia fecha
        └── override manual   ← el usuario puede editar en el preview (per fábrica/línea)
```

El `periodStart` se calcula como:
```
periodStart  = effectiveConflictDate - company.contractPeriod meses
periodEnd    = today (fecha actual)
contractEnd  = effectiveConflictDate - 1 día  ← convención del dominio
```

Ejemplo: conflictDate=2026/10/1, contractPeriod=12 → periodStart=2025/10/1, contractEnd=2026/09/30

> **Nota de dominio:** La 抵触日 es el primer día NO permitido. El `endDate` del contrato siempre es `conflictDate - 1 día`. Esta lógica ya existe en `server/services/contract-dates.ts` y se reutiliza aquí.

---

## File Structure

**Archivos a modificar:**

| Archivo | Cambio |
|---------|--------|
| `server/db/schema.ts` | Agregar `conflictDate`, `contractPeriod` a `clientCompanies` |
| `server/db/seed.ts` | Agregar columnas al CREATE TABLE manual |
| `server/routes/companies.ts` | Exponer nuevos campos en GET/PUT |
| `server/routes/contracts-batch.ts` | Extender `midHiresSchema` + handler preview |
| `server/services/batch-contracts.ts` | Reescribir `analyzeMidHires()` |
| `src/lib/api-types.ts` | Agregar campos a `ClientCompany` interface |
| `src/routes/contracts/mid-hires.tsx` | Rediseño completo del flujo |
| `src/routes/companies/index.tsx` | Agregar campos al formulario de edición de empresa |

**Archivos a crear:**

| Archivo | Propósito |
|---------|-----------|
| `src/routes/contracts/-mid-hires-preview.tsx` | Componente de preview agrupado (extraído de mid-hires.tsx) |

---

## Task 1: Schema — agregar conflictDate y contractPeriod a client_companies

**Files:**
- Modify: `server/db/schema.ts`
- Modify: `server/db/seed.ts`

Agregar a la tabla `clientCompanies` en schema.ts:
```typescript
conflictDate: text("conflict_date"),           // nullable, ISO date string
contractPeriod: integer("contract_period"),    // nullable, meses (ej: 12)
```

En seed.ts, agregar al CREATE TABLE manual de `client_companies`:
```sql
conflict_date TEXT,
contract_period INTEGER
```

Aplicar con `ALTER TABLE` directo (Drizzle Kit tiene bug con índices existentes):
```sql
ALTER TABLE client_companies ADD COLUMN conflict_date TEXT;
ALTER TABLE client_companies ADD COLUMN contract_period INTEGER;
```

---

## Task 2: API types — ClientCompany

**Files:**
- Modify: `src/lib/api-types.ts`

En la interface `ClientCompany`, agregar:
```typescript
conflictDate: string | null;
contractPeriod: number | null;
```

---

## Task 3: Companies route — exponer nuevos campos

**Files:**
- Modify: `server/routes/companies.ts`
- Modify: `server/validation.ts` (o donde esté el schema Zod de company)

En el schema Zod de create/update company:
```typescript
conflictDate: z.string().nullable().optional(),
contractPeriod: z.number().int().min(1).max(60).nullable().optional(),
```

Los campos fluyen automáticamente via spread en INSERT/UPDATE (misma convención que `conflictDateOverride` en contracts).

---

## Task 4: Companies form — campos de edición

**Files:**
- Modify: `src/routes/companies/index.tsx` (o el componente de edición de empresa)

Agregar al formulario de edición de empresa:
- Campo `conflict_date`: date input, label "抵触日 (会社)", nullable
- Campo `contract_period`: number input (meses), label "契約期間 (ヶ月)", nullable, placeholder "12"

Estos campos solo se muestran en el formulario de edición, no en la tabla principal.

---

## Task 5: Backend — analyzeMidHires() mejorado

**Files:**
- Modify: `server/services/batch-contracts.ts`
- Modify: `server/routes/contracts-batch.ts`

### Schema Zod extendido (contracts-batch.ts):

```typescript
const midHiresSchema = z.object({
  companyId: z.number().int(),
  factoryIds: z.array(z.number().int()).optional(),  // vacío = todas
  conflictDateOverrides: z.record(z.string(), z.string()).optional(), // factoryId → date
  startDateOverride: z.string().optional(), // override manual de periodStart
});
```

### analyzeMidHires() reescrito (batch-contracts.ts):

```typescript
export async function analyzeMidHires(params: {
  companyId: number;
  factoryIds?: number[];
  conflictDateOverrides?: Record<string, string>;
  startDateOverride?: string;
}): Promise<MidHiresPreviewResult> {
  const company = await getCompanyById(params.companyId);
  const factories = await getFactoriesForCompany(params.companyId, params.factoryIds);
  const today = toLocalDateStr(new Date());

  const groups: MidHiresGroup[] = [];

  for (const factory of factories) {
    // 1. Determinar 抵触日 efectiva
    const effectiveConflictDate =
      params.conflictDateOverrides?.[String(factory.id)] ??
      factory.conflictDate ??
      company.conflictDate ??
      null;

    if (!effectiveConflictDate) continue; // sin 抵触日 → skip

    // 2. Calcular periodStart
    const contractPeriod = company.contractPeriod ?? 12;
    const periodStart = params.startDateOverride ??
      subtractMonths(effectiveConflictDate, contractPeriod);

    // 3. Filtrar empleados por hireDate en [periodStart, today]
    const employees = await getEmployeesByFactory(factory.id);
    const eligible = employees.filter((emp) => {
      const hireDate = emp.actualHireDate ?? emp.hireDate;
      if (!hireDate) return false;
      return hireDate >= periodStart && hireDate <= today;
    });

    if (eligible.length === 0) continue;

    // 4. Agrupar por línea
    const byLine = groupByLine(eligible, factory, effectiveConflictDate);
    groups.push({ factory, effectiveConflictDate, periodStart, byLine });
  }

  return { groups, today };
}
```

**Tipo de retorno:**
```typescript
type MidHiresGroup = {
  factory: Factory;
  effectiveConflictDate: string;
  periodStart: string;
  byLine: {
    lineName: string;
    employees: Array<{
      id: number;
      name: string;
      hireDate: string;
      contractStart: string;   // = hireDate
      contractEnd: string;     // = effectiveConflictDate
      hourlyRate: number;
      billingRate: number | null;
    }>;
  }[];
};

type MidHiresPreviewResult = {
  groups: MidHiresGroup[];
  today: string;
};
```

---

## Task 6: Frontend — mid-hires.tsx rediseño

**Files:**
- Modify: `src/routes/contracts/mid-hires.tsx`
- Create: `src/routes/contracts/-mid-hires-preview.tsx`

### Step 1 — Selección + parámetros:

```
[Empresa ▼]  →  auto-carga company.conflictDate y contractPeriod

抵触日 (会社):  [2026/10/01 ____]   ← editable, default = company.conflictDate
Período:        [12] ヶ月           ← editable, default = company.contractPeriod
Período de búsqueda:  2025/10/01 〜 今日 (2026/04/09)  ← calculado, read-only

Fábricas: [todas ▼] o multiselect específico

[Preview →]
```

### Step 2 — Preview agrupado (`-mid-hires-preview.tsx`):

```
📋 Takao — 抵触日: 2026/10/01 | Período: 2025/10/01 〜 2026/04/09

  ✅ Takao Honsha > Lift        (3 empleados)  抵触日: [2026/10/01 ▼]
     • Nguyen Van A   入社: 2025/10/25  →  2025/10/25 〜 2026/09/30
     • Tran Thi B     入社: 2026/01/15  →  2026/01/15 〜 2026/09/30
     • Le Van C       入社: 2026/03/01  →  2026/03/01 〜 2026/09/30

  ✅ Takao Honsha > Seizoka     (2 empleados)  抵触日: [2026/10/01 ▼]

  ✅ Takao Branch > Assembly   (1 empleado)   抵触日: [2026/08/01 ▼] ← factory override

[← Volver]              [Crear X contratos →]
```

- Cada fábrica/línea tiene checkbox para incluir/excluir
- 抵触日 por fábrica es editable inline (date input), cambia `contractEnd` en tiempo real
- Botón "Crear X contratos" muestra el total de contratos que se generarán
- Opción checkbox "Generar documentos PDF" (igual que hoy)

---

## Task 7: Utilidad subtractMonths

**Files:**
- Modify: `src/lib/shift-utils.ts` o `server/services/contract-dates.ts`

```typescript
// En server/services/contract-dates.ts (ya existe)
export function subtractMonths(dateStr: string, months: number): string {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split("T")[0];
}
```

---

## Data Flow

```
User selecciona empresa
  → GET /api/companies/:id → company.conflictDate + contractPeriod
  → UI calcula periodStart = conflictDate - contractPeriod meses
  → User ajusta fechas/factories opcionalmente
  → POST /api/contracts/batch/mid-hires/preview
      { companyId, factoryIds?, conflictDateOverrides?, startDateOverride? }
  → analyzeMidHires() filtra hireDate in [periodStart, today]
  → Retorna MidHiresPreviewResult agrupado
  → User revisa preview, ajusta 抵触日 por fábrica si necesita
  → POST /api/contracts/batch/mid-hires/confirm
      { groups con contractStart/contractEnd por empleado }
  → Crea contratos: startDate=hireDate, endDate=effectiveConflictDate
```

---

## Error Handling

- Si `company.conflictDate` es null y ninguna fábrica tiene `conflictDate` → mostrar warning "Esta empresa no tiene 抵触日 configurada. Configurala en la pantalla de empresas."
- Si un empleado no tiene `hireDate` → se omite del preview (no bloquea)
- Si el preview no retorna ningún empleado → mostrar EmptyState "No se encontraron empleados con fecha de entrada en el período especificado"

## Testing

- Test unitario para `analyzeMidHires()` con: fábrica sin conflictDate, fábrica con conflictDate propio, startDateOverride, empleado sin hireDate
- Test unitario para `subtractMonths()` con casos borde: fin de mes, febrero, año bisiesto
- Test de integración: POST preview retorna grupos correctamente agrupados
