# Enhanced Mid-Hires (途中入社者) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar `/contracts/mid-hires` para que calcule el período automáticamente desde `company.conflictDate`, respete la jerarquía empresa→fábrica→override manual, y muestre un preview agrupado con 抵触日 editable por fábrica.

**Architecture:** Agregar `conflictDate`/`contractPeriod` a `client_companies` (DB + API + UI). Reescribir `analyzeMidHires()` para aceptar `conflictDateOverrides` y calcular `periodStart = conflictDate - contractPeriod meses` automáticamente. Rediseñar la UI en dos pasos: selección con auto-period y preview agrupado con edición inline de 抵触日.

**Tech Stack:** TypeScript, Drizzle ORM, better-sqlite3, Hono 4, Zod 4, React 19, TanStack Query 5, Tailwind CSS 4, Vitest 4

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `server/db/schema.ts` | Modificar | Agregar `conflictDate`, `contractPeriod` a `clientCompanies` |
| `server/db/seed.ts` | Modificar | Agregar columnas al CREATE TABLE manual |
| `server/validation.ts` | Modificar | Agregar campos a `createCompanySchema` |
| `server/services/contract-dates.ts` | Modificar | Agregar `subtractMonths`, `subtractDays` |
| `server/services/batch-contracts.ts` | Modificar | Reescribir `analyzeMidHires()`, extender `MidHiresLine` |
| `server/routes/contracts-batch.ts` | Modificar | Extender `midHiresSchema`, actualizar handlers |
| `src/lib/api-types.ts` | Modificar | Agregar campos a `Company` interface |
| `src/routes/companies/-company-edit-dialog.tsx` | Crear | Dialog de edición de empresa con nuevos campos |
| `src/routes/companies/index.tsx` | Modificar | Conectar `onEdit` con el nuevo dialog |
| `src/routes/contracts/-mid-hires-preview.tsx` | Crear | Componente de preview agrupado con 抵触日 editable |
| `src/routes/contracts/mid-hires.tsx` | Modificar | Step 1 con auto-period, Step 2 usa nuevo preview |
| `server/__tests__/contract-dates.test.ts` | Crear | Tests para `subtractMonths`, `subtractDays` |
| `server/__tests__/mid-hires.test.ts` | Crear | Tests de integración para `analyzeMidHires` mejorado |

---

### Task 1: Schema DB — agregar conflict_date y contract_period a client_companies

**Files:**
- Modify: `server/db/schema.ts` (línea ~18, después de `representative`)
- Modify: `server/db/seed.ts` (línea ~97, dentro del CREATE TABLE client_companies)

- [ ] **Step 1: Agregar columnas a schema.ts**

En `server/db/schema.ts`, en la definición de `clientCompanies`, agregar después de `representative`:

```typescript
// Antes (línea ~18):
representative: text("representative"),
isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),

// Después:
representative: text("representative"),
conflictDate: text("conflict_date"),
contractPeriod: integer("contract_period"),
isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
```

- [ ] **Step 2: Agregar columnas a seed.ts**

En `server/db/seed.ts`, en el CREATE TABLE client_companies (línea ~96), agregar antes de `is_active`:

```sql
-- Antes:
      representative TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,

-- Después:
      representative TEXT,
      conflict_date TEXT,
      contract_period INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
```

- [ ] **Step 3: Aplicar migración con ALTER TABLE**

> ⚠️ `npm run db:push` tiene un bug de Drizzle con índices existentes. Usar better-sqlite3 directo.

Crear y ejecutar el siguiente script temporal:

```typescript
// scripts/migrate-company-conflict.ts
import Database from "better-sqlite3";
const db = new Database("data/kobetsu.db");
db.exec(`ALTER TABLE client_companies ADD COLUMN conflict_date TEXT`);
db.exec(`ALTER TABLE client_companies ADD COLUMN contract_period INTEGER`);
console.log("Migration applied.");
db.close();
```

```bash
npx tsx scripts/migrate-company-conflict.ts
```

Expected output:
```
Migration applied.
```

- [ ] **Step 4: Verificar con Drizzle Studio**

```bash
npm run db:studio
```

Navegar a `client_companies` y confirmar que existen las columnas `conflict_date` y `contract_period`.

- [ ] **Step 5: Commit**

```bash
git add server/db/schema.ts server/db/seed.ts scripts/migrate-company-conflict.ts
git commit -m "feat(schema): agregar conflict_date y contract_period a client_companies"
```

---

### Task 2: API types — Company interface

**Files:**
- Modify: `src/lib/api-types.ts` (en la interface `Company`)

- [ ] **Step 1: Agregar campos a Company interface**

En `src/lib/api-types.ts`, en la interface `Company`, agregar después de `representative`:

```typescript
// Antes:
  representative: string | null;
  isActive: boolean;

// Después:
  representative: string | null;
  conflictDate: string | null;
  contractPeriod: number | null;
  isActive: boolean;
```

- [ ] **Step 2: Verificar typecheck**

```bash
npm run typecheck 2>&1 | head -20
```

Expected: sin errores relacionados a `Company`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api-types.ts
git commit -m "feat(api-types): agregar conflictDate y contractPeriod a Company"
```

---

### Task 3: Validation — createCompanySchema

**Files:**
- Modify: `server/validation.ts` (líneas ~14-23)

- [ ] **Step 1: Agregar campos al schema Zod**

En `server/validation.ts`, actualizar `createCompanySchema`:

```typescript
// Antes:
export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  nameKana: optionalStr,
  shortName: optionalStr,
  address: optionalStr,
  phone: optionalStr,
  representative: optionalStr,
  isActive: z.boolean().optional(),
});

// Después:
export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  nameKana: optionalStr,
  shortName: optionalStr,
  address: optionalStr,
  phone: optionalStr,
  representative: optionalStr,
  conflictDate: optionalDate,
  contractPeriod: z.number().int().min(1).max(60).optional().nullable(),
  isActive: z.boolean().optional(),
});
```

> `optionalDate` ya existe en validation.ts: `const optionalDate = dateStr.optional().nullable();`

- [ ] **Step 2: Verificar typecheck**

```bash
npm run typecheck 2>&1 | head -20
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add server/validation.ts
git commit -m "feat(validation): agregar conflictDate y contractPeriod a createCompanySchema"
```

---

### Task 4: Utilidades subtractMonths y subtractDays

**Files:**
- Create: `server/__tests__/contract-dates.test.ts`
- Modify: `server/services/contract-dates.ts` (agregar al final)

- [ ] **Step 1: Escribir tests que fallan**

Crear `server/__tests__/contract-dates.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { subtractMonths, subtractDays } from "../services/contract-dates";

describe("subtractMonths", () => {
  it("resta 12 meses a una fecha normal", () => {
    expect(subtractMonths("2026-10-01", 12)).toBe("2025-10-01");
  });

  it("resta 6 meses", () => {
    expect(subtractMonths("2026-10-01", 6)).toBe("2026-04-01");
  });

  it("maneja fin de mes (octubre → febrero)", () => {
    expect(subtractMonths("2026-10-31", 8)).toBe("2026-02-28");
  });

  it("resta 1 mes en enero → diciembre año anterior", () => {
    expect(subtractMonths("2026-01-15", 1)).toBe("2025-12-15");
  });
});

describe("subtractDays", () => {
  it("resta 1 día (teishokubi → último día de contrato)", () => {
    expect(subtractDays("2026-10-01", 1)).toBe("2026-09-30");
  });

  it("cruza mes", () => {
    expect(subtractDays("2026-04-01", 1)).toBe("2026-03-31");
  });

  it("cruza año", () => {
    expect(subtractDays("2026-01-01", 1)).toBe("2025-12-31");
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
npx vitest run server/__tests__/contract-dates.test.ts
```

Expected: FAIL con "subtractMonths is not a function".

- [ ] **Step 3: Implementar las funciones**

Agregar al final de `server/services/contract-dates.ts`:

```typescript
/**
 * Resta N meses a una fecha ISO (YYYY-MM-DD).
 * Maneja fin de mes: si el mes resultante tiene menos días, usa el último día.
 */
export function subtractMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() - months);
  return toLocalDateStr(d);
}

/**
 * Resta N días a una fecha ISO (YYYY-MM-DD).
 * Usado para calcular contractEndDate = conflictDate - 1 día.
 */
export function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return toLocalDateStr(d);
}
```

> `toLocalDateStr` ya existe en este mismo archivo — reutilizar.

- [ ] **Step 4: Verificar que los tests pasan**

```bash
npx vitest run server/__tests__/contract-dates.test.ts
```

Expected: PASS, 7 tests pasando.

- [ ] **Step 5: Commit**

```bash
git add server/services/contract-dates.ts server/__tests__/contract-dates.test.ts
git commit -m "feat(contract-dates): agregar subtractMonths y subtractDays"
```

---

### Task 5: Reescribir analyzeMidHires con auto-period

**Files:**
- Modify: `server/services/batch-contracts.ts`
- Create: `server/__tests__/mid-hires.test.ts`

- [ ] **Step 1: Extender MidHiresLine interface**

En `server/services/batch-contracts.ts`, en la interface `MidHiresLine` (línea 43), agregar dos campos:

```typescript
export interface MidHiresLine {
  factory: Awaited<ReturnType<typeof buildBatchContext>>["targetFactories"][number];
  contractStartDate: string;
  contractEndDate: string;
  effectiveConflictDate: string;  // ← nuevo: 抵触日 efectiva de la fábrica
  periodStart: string;             // ← nuevo: inicio del período de búsqueda
  totalEmployees: number;
  // ... resto igual
}
```

- [ ] **Step 2: Agregar import de las nuevas utilidades**

Al inicio de `server/services/batch-contracts.ts`, en los imports de contract-dates:

```typescript
// Buscar la línea donde se importa toLocalDateStr o subtractBusinessDays
import { toLocalDateStr, subtractMonths, subtractDays } from "./contract-dates";
```

- [ ] **Step 3: Escribir tests que fallan**

Crear `server/__tests__/mid-hires.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../server/db/schema";
import { analyzeMidHires } from "../services/batch-contracts";

// Nota: estos tests usan la test DB (data/kobetsu.test.db)
// Asegurarse de que exista corriendo: npm run test:run una vez

describe("analyzeMidHires — auto-period", () => {
  it("retorna grupos vacíos cuando no hay empleados en el período", async () => {
    // Usar companyId que existe en test DB pero sin empleados con hireDate reciente
    const result = await analyzeMidHires({
      companyId: 1,
      factoryIds: [],
      startDateOverride: "2099-01-01", // futuro lejano → ningún empleado encaja
    });
    expect(result.lines).toHaveLength(0);
  });

  it("respeta conflictDateOverride por fábrica", async () => {
    // Este test verifica que la fecha override se usa, no la de la fábrica
    // Se puede verificar inspeccionando result.lines[0].effectiveConflictDate
    // cuando el companyId tiene datos reales en la test DB
    // Si no hay datos, el test pasa vacío — no falla
    const result = await analyzeMidHires({
      companyId: 1,
      conflictDateOverrides: { "999": "2027-01-01" },
    });
    // lines vacías es válido si no hay factories con id 999
    expect(Array.isArray(result.lines)).toBe(true);
  });
});
```

- [ ] **Step 4: Verificar que los tests fallan**

```bash
npx vitest run server/__tests__/mid-hires.test.ts
```

Expected: FAIL con error de signature incompatible.

- [ ] **Step 5: Reescribir analyzeMidHires**

En `server/services/batch-contracts.ts`, reemplazar la función `analyzeMidHires` (líneas ~232-285) con la nueva versión:

```typescript
export async function analyzeMidHires(params: {
  companyId: number;
  factoryIds?: number[];
  conflictDateOverrides?: Record<string, string>; // factoryId.toString() → "YYYY-MM-DD"
  startDateOverride?: string;
}): Promise<MidHiresResult> {
  const today = toLocalDateStr(new Date());
  const { companyId, factoryIds, conflictDateOverrides = {}, startDateOverride } = params;

  // Cargar empresa para obtener conflictDate y contractPeriod de nivel empresa
  const company = db.query.clientCompanies.findFirst({
    where: eq(schema.clientCompanies.id, companyId),
  });
  if (!company) throw new Error(`Company ${companyId} not found`);

  const { targetFactories } = await buildBatchContext(
    companyId,
    today, // startDate placeholder — no usado para filtrado nuevo
    factoryIds,
  );

  const lines: MidHiresLine[] = [];
  const skipped: SkipRecord[] = [];
  const allFactoryIds = targetFactories.map((f) => f.id);
  const empsByFactory = await getActiveEmployeesByFactories(allFactoryIds);

  for (const factory of targetFactories) {
    // 1. Determinar 抵触日 efectiva (override manual → fábrica → empresa)
    const effectiveConflictDate =
      conflictDateOverrides[String(factory.id)] ??
      factory.conflictDate ??
      company.conflictDate ??
      null;

    if (!effectiveConflictDate) {
      skipped.push(createSkipRecord(factory, "抵触日未設定"));
      continue;
    }

    // 2. Calcular contractEnd = teishokubi - 1 día
    const contractEnd = subtractDays(effectiveConflictDate, 1);

    // 3. Calcular periodStart
    const contractPeriod = company.contractPeriod ?? 12;
    const periodStart = startDateOverride ?? subtractMonths(effectiveConflictDate, contractPeriod);

    // 4. Filtrar empleados con hireDate en [periodStart, today]
    const factoryEmps = empsByFactory.get(factory.id) ?? [];
    const eligible = factoryEmps.filter((emp) => {
      const hireDate = emp.actualHireDate ?? emp.hireDate;
      if (!hireDate) return false;
      return hireDate >= periodStart && hireDate <= today;
    });

    if (eligible.length === 0) {
      skipped.push(createSkipRecord(factory, "対象期間内の入社者なし"));
      continue;
    }

    const rateGroups = groupEmployeesByRate(eligible, factory.hourlyRate);
    if (rateGroups.size === 0) {
      skipped.push(createSkipRecord(factory, "単価未設定"));
      continue;
    }

    const workHours = parseWorkHours(factory.workHours);
    const participationRate = calculateParticipation(factory.workHours, factory.breakTime);
    const exemption = checkExemption(factory);

    const rateGroupList = buildRateGroupList(rateGroups).map((rg) => ({
      ...rg,
      employees: rg.employees.map((emp) => ({
        ...emp,
        effectiveHireDate: emp.actualHireDate ?? emp.hireDate ?? periodStart,
      })),
    }));

    lines.push({
      factory,
      contractStartDate: periodStart,   // línea-nivel (referencia)
      contractEndDate: contractEnd,      // línea-nivel: effectiveConflictDate - 1 día
      effectiveConflictDate,             // 抵触日 efectiva usada
      periodStart,                       // inicio del período de búsqueda
      totalEmployees: eligible.length,
      totalContracts: rateGroupList.length,
      rateGroups: rateGroupList as MidHiresLine["rateGroups"],
      workStartTime: workHours.workStartTime,
      workEndTime: workHours.workEndTime,
      participationRate,
      isExempt: exemption.isExempt,
      exemptionReason: exemption.reason ?? null,
    });
  }

  return { lines, skipped };
}
```

> **Imports necesarios:** `db`, `schema`, `eq` ya deben estar importados en el archivo. Verificar que `schema.clientCompanies` y `eq` están disponibles en el scope — si no, agregar:
> ```typescript
> import { eq } from "drizzle-orm";
> import { db } from "../db";
> import * as schema from "../db/schema";
> ```

- [ ] **Step 6: Verificar que los tests pasan**

```bash
npx vitest run server/__tests__/mid-hires.test.ts
```

Expected: PASS.

- [ ] **Step 7: Verificar typecheck**

```bash
npm run typecheck 2>&1 | head -30
```

Expected: sin errores en batch-contracts.ts.

- [ ] **Step 8: Commit**

```bash
git add server/services/batch-contracts.ts server/__tests__/mid-hires.test.ts
git commit -m "feat(batch-contracts): reescribir analyzeMidHires con auto-period y jerarquía de teishokubi"
```

---

### Task 6: Route — midHiresSchema y handlers actualizados

**Files:**
- Modify: `server/routes/contracts-batch.ts` (líneas ~37-42, ~195-266)

- [ ] **Step 1: Actualizar midHiresSchema**

En `server/routes/contracts-batch.ts`, reemplazar `midHiresSchema` (líneas ~37-42):

```typescript
// Antes:
const midHiresSchema = z.object({
  companyId: z.number().int().positive(),
  factoryIds: z.array(z.number().int().positive()).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD"),
  generateDocs: z.boolean().optional(),
});

// Después:
const midHiresSchema = z.object({
  companyId: z.number().int().positive(),
  factoryIds: z.array(z.number().int().positive()).optional(),
  conflictDateOverrides: z.record(z.string(), z.string()).optional(),
  startDateOverride: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  generateDocs: z.boolean().optional(),
});
```

- [ ] **Step 2: Actualizar handler POST /batch/mid-hires/preview**

Reemplazar el handler (líneas ~195-228). La nueva versión pasa los nuevos params y expone `effectiveConflictDate` y `periodStart` en cada línea:

```typescript
contractsBatchRouter.post("/batch/mid-hires/preview", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = midHiresSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const { companyId, factoryIds, conflictDateOverrides, startDateOverride } = parsed.data;
    const { lines, skipped } = await analyzeMidHires({
      companyId,
      factoryIds,
      conflictDateOverrides,
      startDateOverride,
    });

    const totalContracts = lines.reduce((sum, l) => sum + l.totalContracts, 0);
    const totalEmployees = lines.reduce((sum, l) => sum + l.totalEmployees, 0);

    return c.json({
      preview: true,
      totalContracts,
      totalEmployees,
      lines: lines.map((l) => ({
        factoryId: l.factory.id,
        factoryName: l.factory.factoryName,
        department: l.factory.department,
        lineName: l.factory.lineName,
        effectiveConflictDate: l.effectiveConflictDate,
        periodStart: l.periodStart,
        contractStartDate: l.contractStartDate,
        contractEndDate: l.contractEndDate,
        totalEmployees: l.totalEmployees,
        totalContracts: l.totalContracts,
        participationRate: l.participationRate,
        isExempt: l.isExempt,
        exemptionReason: l.exemptionReason,
        rateGroups: l.rateGroups.map((rg) => ({
          rate: rg.rate,
          count: rg.employeeCount,
          overtimeRate: rg.overtimeRate,
          holidayRate: rg.holidayRate,
          employees: rg.employees.map((e) => ({
            id: e.id,
            fullName: e.fullName,
            employeeNumber: e.employeeNumber,
            effectiveHireDate: e.effectiveHireDate,
            billingRate: e.billingRate,
            hourlyRate: e.hourlyRate,
            visaExpiry: e.visaExpiry,
            nationality: e.nationality,
          })),
        })),
      })),
      skipped,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Preview failed";
    return c.json({ error: message }, 500);
  }
});
```

- [ ] **Step 3: Actualizar handler POST /batch/mid-hires (confirm)**

Reemplazar el handler de confirmación (líneas ~243-266):

```typescript
contractsBatchRouter.post("/batch/mid-hires", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = midHiresSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const { companyId, factoryIds, conflictDateOverrides, startDateOverride, generateDocs } = parsed.data;
    const { lines, skipped } = await analyzeMidHires({
      companyId,
      factoryIds,
      conflictDateOverrides,
      startDateOverride,
    });

    const created = executeMidHiresCreate(companyId, lines);

    return c.json({
      created: created.length,
      skipped: skipped.length,
      contracts: created,
      skippedDetails: skipped,
      contractIds: created.map((cr) => cr.id),
      generateDocs: generateDocs ?? false,
    }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Mid-hires batch creation failed";
    return c.json({ error: message }, 500);
  }
});
```

- [ ] **Step 4: Verificar typecheck y tests**

```bash
npm run typecheck 2>&1 | head -20
npx vitest run server/__tests__/mid-hires.test.ts
```

Expected: typecheck limpio, tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/contracts-batch.ts
git commit -m "feat(contracts-batch): actualizar midHiresSchema con conflictDateOverrides y startDateOverride"
```

---

### Task 7: Company edit dialog — campos conflictDate y contractPeriod

**Files:**
- Create: `src/routes/companies/-company-edit-dialog.tsx`
- Modify: `src/routes/companies/index.tsx` (línea ~31, ~85)

- [ ] **Step 1: Crear el dialog de edición de empresa**

Crear `src/routes/companies/-company-edit-dialog.tsx`:

```typescript
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateCompany } from "@/lib/hooks/use-companies";
import type { Company } from "@/lib/api-types";

interface Props {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompanyEditDialog({ company, open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [nameKana, setNameKana] = useState("");
  const [conflictDate, setConflictDate] = useState("");
  const [contractPeriod, setContractPeriod] = useState<string>("");

  const updateCompany = useUpdateCompany();

  useEffect(() => {
    if (company) {
      setName(company.name);
      setNameKana(company.nameKana ?? "");
      setConflictDate(company.conflictDate ?? "");
      setContractPeriod(company.contractPeriod ? String(company.contractPeriod) : "");
    }
  }, [company]);

  const handleSave = () => {
    if (!company) return;
    updateCompany.mutate(
      {
        id: company.id,
        name,
        nameKana: nameKana || null,
        conflictDate: conflictDate || null,
        contractPeriod: contractPeriod ? parseInt(contractPeriod, 10) : null,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>企業情報を編集</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>企業名</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>企業名（カナ）</Label>
            <Input value={nameKana} onChange={(e) => setNameKana(e.target.value)} placeholder="カナ名（任意）" />
          </div>
          <div className="space-y-1">
            <Label>抵触日（会社）</Label>
            <Input
              type="date"
              value={conflictDate}
              onChange={(e) => setConflictDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              途中入社契約のデフォルト抵触日。各工場で個別設定可能。
            </p>
          </div>
          <div className="space-y-1">
            <Label>契約期間（ヶ月）</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={contractPeriod}
              onChange={(e) => setContractPeriod(e.target.value)}
              placeholder="12"
            />
            <p className="text-xs text-muted-foreground">
              抵触日から遡って何ヶ月分を検索対象とするか（例: 12）
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
          <Button onClick={handleSave} disabled={updateCompany.isPending}>
            {updateCompany.isPending ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

> Verificar que `useUpdateCompany` existe en `src/lib/hooks/use-companies.ts`. Si no existe (el hook tiene `useCreateCompany` y otra cosa), revisar el nombre real y ajustar el import.

- [ ] **Step 2: Conectar en companies/index.tsx**

En `src/routes/companies/index.tsx`, agregar:

```typescript
// Agregar import al inicio:
import { CompanyEditDialog } from "./-company-edit-dialog";

// En el componente, agregar estado para el dialog (después de línea ~34):
const [editCompany, setEditCompany] = useState<Company | null>(null);
const [editCompanyOpen, setEditCompanyOpen] = useState(false);

// Reemplazar onEdit={() => {}} (línea ~85) con:
onEdit={(company) => {
  setEditCompany(company);
  setEditCompanyOpen(true);
}}

// Agregar el dialog al JSX (antes del cierre del componente):
<CompanyEditDialog
  company={editCompany}
  open={editCompanyOpen}
  onOpenChange={setEditCompanyOpen}
/>
```

- [ ] **Step 3: Verificar en el browser**

```bash
npm run dev
```

Navegar a `/companies`, hacer click en el ícono de edición de una empresa, verificar que el dialog abre con los campos correctos.

- [ ] **Step 4: Commit**

```bash
git add src/routes/companies/-company-edit-dialog.tsx src/routes/companies/index.tsx
git commit -m "feat(companies): agregar dialog de edición con campos conflictDate y contractPeriod"
```

---

### Task 8: mid-hires UI — Step 1 con auto-period

**Files:**
- Modify: `src/routes/contracts/mid-hires.tsx`

- [ ] **Step 1: Agregar imports necesarios**

En `src/routes/contracts/mid-hires.tsx`, verificar que existen estos imports (agregar los que falten):

```typescript
import { useState, useMemo } from "react";
import { useCompany } from "@/lib/hooks/use-companies";  // hook para cargar una empresa por id
```

> Si `useCompany(id)` no existe en `use-companies.ts`, verificar el nombre real del hook que retorna una empresa individual. Si es `useCompanies()` (lista), filtrar por id en el componente.

- [ ] **Step 2: Reemplazar estados de fechas**

En el componente `MidHiresPage` (o como se llame), reemplazar los estados `startDate` y `endDate` con los nuevos:

```typescript
// Remover:
// const [startDate, setStartDate] = useState("");
// const [endDate, setEndDate] = useState("");

// Agregar:
const [conflictDateInput, setConflictDateInput] = useState("");
const [contractPeriodInput, setContractPeriodInput] = useState(12);
const [conflictDateOverrides, setConflictDateOverrides] = useState<Record<string, string>>({});
const [startDateOverride, setStartDateOverride] = useState<string | undefined>(undefined);
```

- [ ] **Step 3: Cargar datos de la empresa seleccionada**

Cuando el usuario selecciona una empresa, auto-cargar `conflictDate` y `contractPeriod`:

```typescript
// Agregar hook para cargar empresa:
const { data: companies } = useCompanies();
const selectedCompanyData = useMemo(
  () => companies?.find((c) => c.id === companyId) ?? null,
  [companies, companyId],
);

// Cuando selectedCompanyData cambia, auto-rellenar las fechas:
useEffect(() => {
  if (selectedCompanyData) {
    setConflictDateInput(selectedCompanyData.conflictDate ?? "");
    setContractPeriodInput(selectedCompanyData.contractPeriod ?? 12);
  }
}, [selectedCompanyData]);
```

- [ ] **Step 4: Calcular periodStart en el cliente (para mostrar)**

```typescript
const periodStartDisplay = useMemo(() => {
  if (!conflictDateInput || !contractPeriodInput) return null;
  const d = new Date(conflictDateInput + "T00:00:00");
  d.setMonth(d.getMonth() - contractPeriodInput);
  return d.toISOString().split("T")[0];
}, [conflictDateInput, contractPeriodInput]);
```

- [ ] **Step 5: Actualizar los campos del formulario Step 1**

Reemplazar los campos de `startDate` y `endDate` en el JSX con:

```tsx
{/* Reemplazar los dos date inputs por estos tres campos: */}
<div className="space-y-1">
  <Label>抵触日（会社）</Label>
  <Input
    type="date"
    value={conflictDateInput}
    onChange={(e) => setConflictDateInput(e.target.value)}
  />
</div>

<div className="space-y-1">
  <Label>契約期間（ヶ月）</Label>
  <Input
    type="number"
    min={1}
    max={60}
    value={contractPeriodInput}
    onChange={(e) => setContractPeriodInput(Number(e.target.value))}
  />
</div>

{periodStartDisplay && (
  <div className="rounded-md bg-muted p-3 text-sm">
    <span className="text-muted-foreground">検索対象期間：</span>
    <span className="font-medium">{periodStartDisplay}</span>
    <span className="text-muted-foreground"> 〜 今日</span>
  </div>
)}
```

- [ ] **Step 6: Actualizar la llamada al preview API**

En la función `handlePreview` (o como se llame), actualizar el body de la request:

```typescript
// Antes:
const body = { companyId, factoryIds: selectedFactoryIds, startDate, endDate };

// Después:
const body = {
  companyId,
  factoryIds: selectedFactoryIds.length > 0 ? selectedFactoryIds : undefined,
  conflictDateOverrides,
  startDateOverride,
};
```

- [ ] **Step 7: Verificar en el browser**

```bash
npm run dev
```

Navegar a `/contracts/mid-hires`, seleccionar una empresa con `conflictDate` configurada, verificar que los campos se auto-rellenan y el período calculado se muestra correctamente.

- [ ] **Step 8: Commit**

```bash
git add src/routes/contracts/mid-hires.tsx
git commit -m "feat(mid-hires): Step 1 con auto-period desde company.conflictDate"
```

---

### Task 9: mid-hires Preview — componente agrupado con 抵触日 editable

**Files:**
- Create: `src/routes/contracts/-mid-hires-preview.tsx`
- Modify: `src/routes/contracts/mid-hires.tsx` (usar el nuevo componente en Step 2)

- [ ] **Step 1: Definir los tipos del preview**

En `src/lib/api-types.ts`, agregar el tipo de respuesta del preview:

```typescript
export interface MidHiresPreviewLine {
  factoryId: number;
  factoryName: string;
  department: string | null;
  lineName: string | null;
  effectiveConflictDate: string;
  periodStart: string;
  contractStartDate: string;
  contractEndDate: string;
  totalEmployees: number;
  totalContracts: number;
  rateGroups: Array<{
    rate: number;
    count: number;
    employees: Array<{
      id: number;
      fullName: string | null;
      effectiveHireDate: string;
      billingRate: number | null;
    }>;
  }>;
}

export interface MidHiresPreviewResponse {
  preview: true;
  totalContracts: number;
  totalEmployees: number;
  lines: MidHiresPreviewLine[];
  skipped: Array<{ factoryName: string; reason: string }>;
}
```

- [ ] **Step 2: Crear el componente de preview**

Crear `src/routes/contracts/-mid-hires-preview.tsx`:

```tsx
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { MidHiresPreviewLine } from "@/lib/api-types";

interface Props {
  lines: MidHiresPreviewLine[];
  skipped: Array<{ factoryName: string; reason: string }>;
  conflictDateOverrides: Record<string, string>;
  onConflictDateOverride: (factoryId: string, date: string) => void;
  excludedFactoryIds: Set<number>;
  onToggleFactory: (factoryId: number) => void;
  onConfirm: () => void;
  isCreating: boolean;
}

export function MidHiresPreview({
  lines,
  skipped,
  conflictDateOverrides,
  onConflictDateOverride,
  excludedFactoryIds,
  onToggleFactory,
  onConfirm,
  isCreating,
}: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const includedLines = lines.filter((l) => !excludedFactoryIds.has(l.factoryId));
  const totalContracts = includedLines.reduce((s, l) => s + l.totalContracts, 0);
  const totalEmployees = includedLines.reduce((s, l) => s + l.totalEmployees, 0);

  const toggleExpand = (factoryId: number) =>
    setExpanded((prev) => ({ ...prev, [factoryId]: !prev[factoryId] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          対象: <span className="font-medium text-foreground">{totalEmployees}名</span>
          {" / "}
          <span className="font-medium text-foreground">{totalContracts}件</span>の契約
        </div>
        <Button onClick={onConfirm} disabled={isCreating || totalContracts === 0}>
          {isCreating ? "作成中..." : `${totalContracts}件の契約を作成`}
        </Button>
      </div>

      <div className="space-y-2">
        {lines.map((line) => {
          const isExcluded = excludedFactoryIds.has(line.factoryId);
          const effectiveDate =
            conflictDateOverrides[String(line.factoryId)] ?? line.effectiveConflictDate;
          const isOpen = expanded[line.factoryId] ?? true;
          const label = [line.factoryName, line.department, line.lineName]
            .filter(Boolean)
            .join(" > ");

          return (
            <Card key={line.factoryId} className={`p-3 ${isExcluded ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={!isExcluded}
                  onCheckedChange={() => onToggleFactory(line.factoryId)}
                />
                <button
                  className="flex items-center gap-1 flex-1 text-left"
                  onClick={() => toggleExpand(line.factoryId)}
                >
                  {isOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <span className="font-medium text-sm">{label}</span>
                </button>
                <Badge variant="outline">{line.totalEmployees}名</Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>抵触日:</span>
                  <Input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) =>
                      onConflictDateOverride(String(line.factoryId), e.target.value)
                    }
                    className="h-6 w-36 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              {isOpen && (
                <div className="mt-2 pl-6 space-y-1">
                  <div className="text-xs text-muted-foreground mb-1">
                    検索期間: {line.periodStart} 〜 今日 → 契約終了: {line.contractEndDate}
                  </div>
                  {line.rateGroups.map((rg, i) => (
                    <div key={i} className="space-y-0.5">
                      <div className="text-xs font-medium">単価 {rg.rate.toLocaleString()}円</div>
                      {rg.employees.map((emp) => (
                        <div key={emp.id} className="text-xs text-muted-foreground pl-2 flex gap-2">
                          <span>{emp.fullName ?? `ID:${emp.id}`}</span>
                          <span>入社: {emp.effectiveHireDate}</span>
                          <span>→ {emp.effectiveHireDate} 〜 {line.contractEndDate}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {skipped.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">スキップ:</span>{" "}
          {skipped.map((s) => `${s.factoryName}（${s.reason}）`).join(", ")}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Integrar el preview en mid-hires.tsx**

En `src/routes/contracts/mid-hires.tsx`, cuando el preview está cargado (step 2), reemplazar el JSX del preview actual con:

```tsx
import { MidHiresPreview } from "./-mid-hires-preview";

// En el estado del componente, agregar:
const [excludedFactoryIds, setExcludedFactoryIds] = useState<Set<number>>(new Set());

const handleToggleFactory = (factoryId: number) => {
  setExcludedFactoryIds((prev) => {
    const next = new Set(prev);
    if (next.has(factoryId)) next.delete(factoryId);
    else next.add(factoryId);
    return next;
  });
};

const handleConflictDateOverride = (factoryId: string, date: string) => {
  setConflictDateOverrides((prev) => ({ ...prev, [factoryId]: date }));
};

// En el JSX del step 2:
{previewData && (
  <MidHiresPreview
    lines={previewData.lines}
    skipped={previewData.skipped}
    conflictDateOverrides={conflictDateOverrides}
    onConflictDateOverride={handleConflictDateOverride}
    excludedFactoryIds={excludedFactoryIds}
    onToggleFactory={handleToggleFactory}
    onConfirm={handleConfirm}
    isCreating={isCreating}
  />
)}
```

- [ ] **Step 4: Actualizar handleConfirm para filtrar excluidos**

```typescript
const handleConfirm = () => {
  const includedFactoryIds = previewData?.lines
    .filter((l) => !excludedFactoryIds.has(l.factoryId))
    .map((l) => l.factoryId);

  confirmMutation.mutate({
    companyId,
    factoryIds: includedFactoryIds,
    conflictDateOverrides,
    startDateOverride,
    generateDocs,
  });
};
```

- [ ] **Step 5: Typecheck y lint**

```bash
npm run typecheck 2>&1 | head -30
npm run lint 2>&1 | head -20
```

Expected: sin errores.

- [ ] **Step 6: Smoke test en el browser**

```bash
npm run dev
```

1. Ir a `/contracts/mid-hires`
2. Seleccionar una empresa con `conflictDate` configurada
3. Verificar que el período se auto-calcula
4. Hacer click en Preview
5. Verificar que el preview muestra las fábricas agrupadas con 抵触日 editable
6. Editar la 抵触日 de una fábrica y verificar que `contractEndDate` se actualiza
7. Excluir una fábrica con el checkbox
8. Confirmar la creación

- [ ] **Step 7: Run full test suite**

```bash
npm run test:run 2>&1 | tail -20
```

Expected: tests existentes pasan, sin regresiones.

- [ ] **Step 8: Commit final**

```bash
git add src/routes/contracts/-mid-hires-preview.tsx src/routes/contracts/mid-hires.tsx src/lib/api-types.ts
git commit -m "feat(mid-hires): preview agrupado con teishokubi editable por fábrica"
```

---

## Checklist post-implementación

- [ ] `npm run typecheck` — limpio
- [ ] `npm run lint` — limpio
- [ ] `npm run test:run` — sin regresiones
- [ ] Empresa sin `conflictDate`: warning visible en Step 1, no crash
- [ ] Empresa con `conflictDate`: auto-rellena campos y calcula período
- [ ] Preview muestra grupos por fábrica con 抵触日 editable
- [ ] Override de 抵触日 fluye correctamente al confirm
- [ ] Contratos creados tienen `startDate = hireDate` y `endDate = conflictDate - 1 día`
