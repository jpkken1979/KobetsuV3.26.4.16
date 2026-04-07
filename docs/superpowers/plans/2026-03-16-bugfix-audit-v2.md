# Bugfix Audit v2 — Critical & High Issues (excl. Security)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir bugs críticos y altos encontrados en la segunda auditoría integral del 2026-03-16 — consistencia de PDFs legales, integridad del wizard de creación, guards de API, índices de DB, y ley laboral 150%.

**Architecture:** 5 grupos completamente independientes (sin solapamiento de archivos) ejecutables en paralelo. Excluye hallazgos de seguridad (app single-user local).

**Tech Stack:** TypeScript strict, Hono 4.12, Drizzle ORM 0.38, SQLite, React 19, TanStack React Query, Vitest, Zod 4, PDFKit

---

## Archivos modificados / creados

| Tarea | Archivos |
|-------|---------|
| Task 1 (PDF legal) | `server/pdf/kobetsu-pdf.ts`, `server/pdf/keiyakusho-pdf.ts`, `server/pdf/hakensakikanridaicho-pdf.ts`, `server/pdf/hakenmotokanridaicho-pdf.ts` |
| Task 2 (Frontend wizard) | `src/components/contract/employee-selector.tsx`, `src/components/contract/date-calculator.tsx` |
| Task 3 (API guards) | `server/routes/contracts.ts`, `server/routes/dashboard.ts`, `server/routes/calendars.ts`, `server/routes/factories.ts` |
| Task 4 (DB indexes) | `server/db/schema.ts`, nueva migración en `server/db/migrations/` |
| Task 5 (150% rate + tests) | `server/services/batch-helpers.ts`, `server/__tests__/batch-helpers.test.ts` |

---

## Task 1: PDF legal — consistencia de responsables y rates

**Fixes:** PDF-1 (billingRate `||` → `??`), PDF-2 (managerUnsName sin título), PDF-3 (派遣先責任者 vs 指揮命令者)

**Files:**
- Modify: `server/pdf/kobetsu-pdf.ts`
- Modify: `server/pdf/keiyakusho-pdf.ts`
- Modify: `server/pdf/hakensakikanridaicho-pdf.ts`
- Modify: `server/pdf/hakenmotokanridaicho-pdf.ts`

### Bug PDF-1: billingRate null silencioso

En `keiyakusho-pdf.ts` y `hakenmotokanridaicho-pdf.ts`, el rate usa `||` que trata `null` igual que `0`. Un empleado con `billingRate = null` cae al fallback correcto, pero uno con `billingRate = 0` (erróneo) muestra `¥0` en el documento legal.

- [ ] **Step 1: Leer keiyakusho-pdf.ts** — buscar `emp.billingRate ||` y ver contexto exacto
- [ ] **Step 2: Cambiar en keiyakusho-pdf.ts** — `emp.billingRate || data.hourlyRate` → `emp.billingRate ?? emp.hourlyRate ?? data.hourlyRate`
- [ ] **Step 3: Leer hakenmotokanridaicho-pdf.ts** — buscar el mismo patrón
- [ ] **Step 4: Cambiar en hakenmotokanridaicho-pdf.ts** — mismo fix

### Bug PDF-2: managerUnsName sin título en kobetsu-pdf

En `kobetsu-pdf.ts`, el fallback de `managerUnsName` es solo `mgr.name` (sin rol), mientras que en `keiyakusho-pdf.ts` y `hakenmotokanridaicho-pdf.ts` es `` `${unsMgr.role}　${unsMgr.name}` ``. Tres documentos del mismo contrato muestran nombres distintos para el mismo responsable.

- [ ] **Step 5: Leer kobetsu-pdf.ts** — buscar líneas con `data.managerUnsName || mgr.name` y `data.complaintUnsName || mgr.name`
- [ ] **Step 6: Cambiar managerUnsName** — `` data.managerUnsName || `${mgr.role}　${mgr.name}` ``
- [ ] **Step 7: Cambiar complaintUnsName** — mismo patrón con los campos de complaint manager
  - Ver cómo `keiyakusho-pdf.ts` construye el fallback (usa `unsMgr` del objeto UNS)
  - Replicar exactamente ese patrón en kobetsu-pdf.ts

### Bug PDF-3: 派遣先責任者 mezclado con 指揮命令者

En `hakensakikanridaicho-pdf.ts`, el fallback para el campo `派遣先責任者` cae a `commanderDept`/`commanderName`/`commanderPhone` (que es el 指揮命令者, responsabilidad operacional) — son roles legales distintos.

- [ ] **Step 8: Leer hakensakikanridaicho-pdf.ts** — buscar líneas ~252-254 con `hakensakiManagerDept || commanderDept || supervisorDept`
- [ ] **Step 9: Eliminar fallback incorrecto** — cambiar a solo `data.hakensakiManagerDept ?? ""` sin fallback a commander/supervisor. Si el campo está vacío, mostrar vacío (no rellenar con datos de otro rol)

- [ ] **Step 10: Verificar typecheck**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npx tsc --noEmit
```

- [ ] **Step 11: Commit**
```bash
git add server/pdf/kobetsu-pdf.ts server/pdf/keiyakusho-pdf.ts server/pdf/hakensakikanridaicho-pdf.ts server/pdf/hakenmotokanridaicho-pdf.ts
git commit -m "fix(pdf): consistencia de responsables y rates en documentos legales

- billingRate usa ?? en lugar de || para distinguir null de 0 (PDF-1)
- managerUnsName con título en kobetsu-pdf igual que otros PDFs (PDF-2)
- 派遣先責任者 sin fallback a 指揮命令者 en hakensakikanridaicho (PDF-3)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Frontend wizard — integridad de datos

**Fixes:** FE-1 (loop mutateAsync sin rollback), FE-3 (deduplicación en rate groups), FE-4 (endDate stale en DateCalculator)

**Files:**
- Modify: `src/components/contract/employee-selector.tsx`
- Modify: `src/components/contract/date-calculator.tsx`

### Bug FE-3: Deduplicación faltante en selectedByRate

En `employee-selector.tsx`, si el mismo empleado aparece en `employees` y `companyEmployees`, puede agregarse dos veces a `selectedByRate`. En el submit, el mismo `employeeId` se envía dos veces a la API.

- [ ] **Step 1: Leer employee-selector.tsx** — buscar `selectedByRate` y el `useMemo` que lo construye
- [ ] **Step 2: Añadir deduplicación** — antes del `push()`, verificar que el empleado no está ya en el grupo:

```typescript
const selectedByRate = useMemo(() => {
  const groups = new Map<number, typeof employees[0][]>();
  const seenIds = new Set<number>(); // AÑADIR esto
  for (const emp of selectedEmployees) {
    if (seenIds.has(emp.id)) continue; // AÑADIR esto
    seenIds.add(emp.id); // AÑADIR esto
    const rate = emp.billingRate || emp.hourlyRate || data.hourlyRate;
    if (!groups.has(rate)) groups.set(rate, []);
    groups.get(rate)!.push(emp);
  }
  return groups;
}, [selectedEmployees, data.hourlyRate]);
```

### Bug FE-1: Loop mutateAsync sin feedback de error parcial

El loop de creación de contratos por rate group no informa al usuario si falla en el N-ésimo contrato. Los primeros K contratos están creados pero los restantes no.

- [ ] **Step 3: Leer el handleSubmit completo** — ver el loop y el manejo de errores actual
- [ ] **Step 4: Añadir error tracking al loop**

```typescript
const handleSubmit = async () => {
  setIsSubmitting(true);
  const errors: string[] = [];
  const created: string[] = [];

  for (const [rate, emps] of selectedByRate) {
    try {
      const result = await createContract.mutateAsync({
        // ... datos existentes
      });
      created.push(result.contractNumber);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      errors.push(`¥${rate.toLocaleString()}: ${msg}`);
    }
  }

  if (errors.length > 0 && created.length > 0) {
    toast.warning(`${created.length} contratos creados, ${errors.length} fallaron`, {
      description: errors.join("\n"),
    });
  } else if (errors.length > 0) {
    toast.error(`Todos los contratos fallaron`, { description: errors[0] });
  } else {
    // éxito completo — mantener comportamiento actual
  }
  setIsSubmitting(false);
};
```

NOTA: No quitar los `await` — son necesarios. Solo añadir try/catch individual por iteración.

### Bug FE-4: endDate stale en DateCalculator

Cuando el usuario cambia factory en Step 1 (nuevo `contractPeriod`/`conflictDate`), vuelve a Step 2, y el `endDate` no se recalcula automáticamente.

- [ ] **Step 5: Leer date-calculator.tsx** — buscar `handleStartDateChange` y qué valores del store lee. Ver también las dependencias del `useEffect`
- [ ] **Step 6: Añadir efecto de recálculo** — si hay un `startDate` y `contractPeriod` cambia:

```typescript
// Añadir useEffect que observe contractPeriod y conflictDate
useEffect(() => {
  if (data.startDate && data.contractPeriod) {
    const newEnd = calcEndDateFromPeriod(data.startDate, data.contractPeriod, data.conflictDate ?? null);
    if (newEnd && newEnd !== data.endDate) {
      updateField("endDate", newEnd);
    }
  }
}, [data.contractPeriod, data.conflictDate]); // Recalcular solo cuando cambien estos
```

NOTA: Las dependencias de `updateField` y `data.startDate` no deben incluirse para evitar loops. Verificar el código existente para el patrón correcto de `useStore` en el wizard.

- [ ] **Step 7: Verificar typecheck y lint**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npx tsc --noEmit && npm run lint
```

- [ ] **Step 8: Commit**
```bash
git add src/components/contract/employee-selector.tsx src/components/contract/date-calculator.tsx
git commit -m "fix(wizard): deduplicación en rate groups, error tracking por contrato, endDate recálculo

- Set de IDs vistos evita enviar mismo employeeId dos veces (FE-3)
- try/catch individual por rate group informa contratos parciales (FE-1)
- useEffect recalcula endDate cuando cambia contractPeriod (FE-4)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: API guards + validación

**Fixes:** API-1 (race condition contract number), API-2 (limit/offset en audit), API-3 (holidays validation), API-4 (Zod en bulk-roles), COD-2 (PATCH contrato cancelado)

**Files:**
- Modify: `server/routes/contracts.ts`
- Modify: `server/routes/dashboard.ts`
- Modify: `server/routes/calendars.ts`
- Modify: `server/routes/factories.ts`

### Bug API-1: Race condition en generación de contract number

`POST /contracts` genera el número de contrato fuera de la transacción. Dos requests concurrentes pueden generar el mismo `KOB-YYYYMM-XXXX`.

- [ ] **Step 1: Leer contracts.ts** — buscar `generateContractNumber` y ver dónde se llama respecto a `sqlite.transaction()`
- [ ] **Step 2: Mover la generación DENTRO de la transacción** — si actualmente es:

```typescript
contractData.contractNumber = generateContractNumber(contractData.startDate);
const result = sqlite.transaction(() => { ... })();
```

Cambiar a:
```typescript
const result = sqlite.transaction(() => {
  if (!contractData.contractNumber) {
    contractData.contractNumber = generateContractNumber(contractData.startDate);
    // Verificar que no existe ya ese número
    const existing = db.query.contracts.findFirst({
      where: eq(contracts.contractNumber, contractData.contractNumber),
    });
    if (existing) {
      // Generar uno nuevo con sufijo incremental
      contractData.contractNumber = generateContractNumber(contractData.startDate, true);
    }
  }
  // ... resto de la transacción
})();
```

NOTA: Leer `generateContractNumber` en `server/services/contract-number.ts` para entender si ya tiene lógica de retry. Si la tiene, simplemente moverla dentro de la transacción es suficiente.

### Bug COD-2: PATCH de contrato cancelado sin guard

- [ ] **Step 3: Buscar el handler PUT /:id en contracts.ts** — ver si verifica `status !== 'cancelled'` antes de actualizar
- [ ] **Step 4: Añadir guard al inicio del handler**

```typescript
if (existingContract?.status === "cancelled") {
  return c.json({ error: "No se puede modificar un contrato cancelado" }, 409);
}
```

Este check debe ir después de `findFirst` del contrato y antes de `sqlite.transaction()`.

### Bug API-2: limit/offset sin validación en /audit

- [ ] **Step 5: En dashboard.ts**, buscar `const limit = Number(...)` en el endpoint `/audit`
- [ ] **Step 6: Añadir clamp**

```typescript
const rawLimit = Number(c.req.query("limit")) || 50;
const rawOffset = Number(c.req.query("offset")) || 0;
const limit = Math.min(Math.max(rawLimit, 1), 500); // entre 1 y 500
const offset = Math.max(rawOffset, 0);
```

### Bug API-3: Holidays sin validación en calendars

- [ ] **Step 7: En calendars.ts**, buscar donde se parsea el array `holidays`
- [ ] **Step 8: Añadir validación de formato de fecha**

```typescript
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const validHolidays = parsedHolidays.filter((d: unknown) =>
  typeof d === "string" && DATE_REGEX.test(d) && !isNaN(new Date(d).getTime())
);
// Usar validHolidays en lugar del array original
```

### Bug API-4: bulk-roles sin Zod

- [ ] **Step 9: En factories.ts**, buscar el handler `PUT /bulk-roles`
- [ ] **Step 10: Ver si hay un schema Zod existente** — buscar otros schemas en el archivo para seguir el mismo patrón
- [ ] **Step 11: Añadir Zod schema y aplicarlo**

```typescript
const bulkRolesSchema = z.object({
  companyId: z.number().int().positive(),
  factoryName: z.string().min(1),
  roleKey: z.string().min(1),
  value: z.string(),
  excludeLineIds: z.array(z.number().int().positive()).default([]),
});
```

Reemplazar el body destructuring manual por `bulkRolesSchema.safeParse(await c.req.json())`.

- [ ] **Step 12: Verificar typecheck y lint**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npx tsc --noEmit && npm run lint
```

- [ ] **Step 13: Commit**
```bash
git add server/routes/contracts.ts server/routes/dashboard.ts server/routes/calendars.ts server/routes/factories.ts
git commit -m "fix(api): race condition contract number, guards y validación de inputs

- generateContractNumber dentro de sqlite.transaction() (API-1)
- PATCH contrato cancelado devuelve 409 (COD-2)
- limit/offset en /audit clampado a 1-500 (API-2)
- holidays validadas con regex YYYY-MM-DD (API-3)
- bulk-roles usa Zod para validar tipos (API-4)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: DB indexes (safe)

**Fixes:** DB-3 (índices en factories), más chequeo a nivel app de DB-2

**Files:**
- Modify: `server/db/schema.ts`
- Modify: `server/routes/employees.ts` (guard antes de delete)

NOTA: Los CHECK constraints de enums (DB-1) y el FK RESTRICT (DB-2) requieren recrear tablas en SQLite. En lugar de eso, añadir validación a nivel aplicación y solo los índices (que son seguros de añadir).

### Fix DB-3: Índices faltantes en factories

- [ ] **Step 1: Leer server/db/schema.ts** — buscar la tabla `factories` y los índices existentes
- [ ] **Step 2: Añadir índices** en el schema de `factories`:

```typescript
// Dentro de la definición de factories, en la sección de indexes
isActiveIdx: index("idx_factories_is_active").on(table.isActive),
conflictDateIdx: index("idx_factories_conflict_date").on(table.conflictDate),
```

NOTA: Ver exactamente cómo están definidos los otros índices en el schema para seguir el mismo patrón.

- [ ] **Step 3: Aplicar con db:push**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npm run db:push
```

Si `db:push` falla por un error de índice existente, usar `db:generate` y luego `db:migrate` para generar una migración SQL limpia.

### Fix DB-2 (app-level): Guard antes de delete employee

- [ ] **Step 4: Leer server/routes/employees.ts** — buscar el endpoint DELETE /employees/:id (si existe)
- [ ] **Step 5: Si existe DELETE**, añadir check:

```typescript
const activeContracts = await db.query.contractEmployees.findFirst({
  where: eq(contractEmployees.employeeId, id),
});
if (activeContracts) {
  return c.json({ error: "No se puede eliminar un empleado con contratos asignados" }, 409);
}
```

Si no existe el endpoint DELETE, documentarlo en el commit message.

- [ ] **Step 6: Verificar typecheck**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npx tsc --noEmit
```

- [ ] **Step 7: Commit**
```bash
git add server/db/schema.ts server/routes/employees.ts
git commit -m "fix(db): índices en factories y guard antes de delete employee

- índices en factories.isActive y conflictDate para batch queries (DB-3)
- DELETE employee bloqueado si tiene contract_employees (DB-2 app-level)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: 150% rate (60h+) + tests de checkExemption

**Fixes:** COD-1 (150% rate), COD-3 (tests de exemption rules)

**Files:**
- Modify: `server/services/batch-helpers.ts`
- Modify: `server/__tests__/batch-helpers.test.ts`

### Fix COD-1: 150% para 60h+/semana

La ley laboral japonesa (労働基準法第37条) exige 150% para horas extra que excedan 60h/semana. Actualmente `batch-helpers.ts` hardcodea solo 125% y 135%.

- [ ] **Step 1: Leer batch-helpers.ts** — buscar `overtimeRate`, `holidayRate` y ver la estructura de `groupEmployeesByRate` o similar. Ver también si hay un campo `weeklyHours` o si se calcula
- [ ] **Step 2: Verificar si el sistema tiene datos de horas semanales** — si el schema de `factories` tiene `maxWeeklyHours` o similar
- [ ] **Step 3: Añadir cálculo 150% en groupEmployeesByRate**

Si hay campo de horas semanales disponible:
```typescript
const weeklyHours = factory.weeklyHours ?? 40;
const overtimeMultiplier = weeklyHours > 60 ? 1.5 : 1.25;
overtimeRate: Math.round(rate * overtimeMultiplier),
```

Si NO hay campo de horas semanales (lo más probable), añadir el campo `sixtyHourRate` como adicional en la respuesta del preview (sin romper lo existente):
```typescript
sixtyHourRate: Math.round(rate * 1.5), // 60h超 — 労働基準法第37条第1項但書
```

- [ ] **Step 4: Actualizar las interfaces TypeScript** si se añade un campo nuevo — buscar el tipo `RateGroup` o similar en el archivo

### Tests COD-3: checkExemption rules

- [ ] **Step 5: Leer batch-helpers.ts** — buscar `checkExemption` o `isExempt` o referencias a "高雄" y "請負". Ver la firma exacta de la función
- [ ] **Step 6: Añadir tests en batch-helpers.test.ts**

Añadir nuevo `describe("checkExemption")` al final del archivo:
```typescript
describe("checkExemption — 請負工場のexemption rules", () => {
  it("高雄工業岡山工場 は exempt", () => {
    // Usar el factory con factoryName que contenga la regla
  });
  it("dept.includes('請負') → exempt", () => {
    // ...
  });
  it("empresa normal → no exempt", () => {
    // ...
  });
});
```

NOTA: Ver los tests existentes en `batch-helpers.test.ts` para el patrón de factory mock.

- [ ] **Step 7: Ejecutar tests**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npx vitest run server/__tests__/batch-helpers.test.ts
```

- [ ] **Step 8: Ejecutar suite completa**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npm run test:run
```

- [ ] **Step 9: Commit**
```bash
git add server/services/batch-helpers.ts server/__tests__/batch-helpers.test.ts
git commit -m "feat(rates): añadir sixtyHourRate 150% y tests de exemption rules

- sixtyHourRate: rate * 1.5 para horas que excedan 60h/sem (COD-1, 労基法第37条)
- tests para checkExemption: 高雄工業岡山工場, 請負 dept, empresa normal (COD-3)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Verificación Final

- [ ] **Typecheck limpio**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npx tsc --noEmit
```

- [ ] **Lint limpio**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npm run lint
```

- [ ] **Tests completos**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npm run test:run
```
Expected: ≥173 tests pasando.

- [ ] **Build exitoso**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npm run build 2>&1 | tail -10
```
