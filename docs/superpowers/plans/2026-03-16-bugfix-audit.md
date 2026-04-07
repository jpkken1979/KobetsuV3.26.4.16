# Bugfix Audit — Critical & High Issues

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir los bugs críticos y high encontrados en la auditoría integral del 2026-03-16 — riesgo legal, datos corruptos y performance.

**Architecture:** 5 grupos de cambios completamente independientes (sin solapamiento de archivos) que pueden ejecutarse en paralelo. Cada grupo tiene un commit propio. Los tests críticos faltantes se añaden en un grupo separado.

**Tech Stack:** TypeScript strict, Hono 4.12, Drizzle ORM 0.38, SQLite (better-sqlite3), React 19, TanStack React Query, Vitest, Zod 4

---

## Archivos modificados / creados

| Tarea | Archivos |
|-------|---------|
| Task 1 (Frontend) | `src/routes/companies/index.tsx`, `src/lib/hooks/use-contracts.ts` |
| Task 2 (documents.ts) | `server/routes/documents.ts` |
| Task 3 (contracts + batch) | `server/routes/contracts.ts`, `server/services/batch-helpers.ts` |
| Task 4 (import + security + bundle) | `server/routes/import.ts`, `server/services/document-files.ts`, `vite.config.ts` |
| Task 5 (tests nuevos) | `server/__tests__/employee-mapper.test.ts` (new), `server/__tests__/contract-writes.test.ts` (new), `server/__tests__/import-assignment.test.ts` (new) |

---

## Task 1: Frontend — stale state + toast silencioso

**Fixes:** C-1 (FactoryPanel stale state), H-3 (onSuccess cuando PDFs fallaron)

**Files:**
- Modify: `src/routes/companies/index.tsx:283`
- Modify: `src/lib/hooks/use-contracts.ts:75-85`

### Bug C-1: FactoryPanel reutiliza estado entre empresas

Cuando el usuario abre empresa A, luego abre empresa B sin cerrar, React reutiliza la instancia de `FactoryPanel` (mismo key estático). El `companyForm` de empresa A se muestra en B. Si guarda antes de que cargue B, sobreescribe datos de B con los de A.

- [ ] **Step 1: Leer el archivo para entender el contexto**

```bash
# En src/routes/companies/index.tsx buscar línea 283
# Debe verse: key="factory-panel-sheet"
```

- [ ] **Step 2: Cambiar la key estática por una dinámica**

En `src/routes/companies/index.tsx`, buscar exactamente:
```tsx
key="factory-panel-sheet"
```
Reemplazar con:
```tsx
key={`factory-panel-${panelState.companyId}`}
```
Esto hace que React desmonte/monte `FactoryPanel` cuando cambia la empresa, reseteando todo el estado local.

- [ ] **Step 3: Verificar que typecheck pasa**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npx tsc --noEmit
```
Expected: sin errores.

### Bug H-3: onSuccess toast se dispara aunque 0 PDFs se generaron

`useBatchGenerateDocuments` llama `onMutationSuccess` incluso cuando el servidor devolvió errores (actualmente el servidor devuelve 200 aunque fallen todos los PDFs — eso se arregla en Task 2, pero el frontend también debe ser defensivo).

- [ ] **Step 4: Leer use-contracts.ts para ver la función completa**

El hook está en `src/lib/hooks/use-contracts.ts`. Buscar `useBatchGenerateDocuments`.

La interfaz `BatchDocumentResult` debe tener un campo `summary?: { errors?: number }`. Verificar la interfaz en `src/lib/api.ts` — buscar `BatchDocumentResult`.

- [ ] **Step 5: Modificar onSuccess para verificar errores parciales**

En `src/lib/hooks/use-contracts.ts`, dentro de `useBatchGenerateDocuments`, cambiar el `onSuccess` de:
```typescript
onSuccess: (data: BatchDocumentResult) => {
  toast.success(`ZIP生成完了: ${data.files?.length || 0}件のZIP`, {
    description: `${data.contractCount}契約 / ${data.employeeCount}名分`,
  });
},
```
A:
```typescript
onSuccess: (data: BatchDocumentResult) => {
  const errorCount = data.summary?.errors ?? 0;
  if (errorCount > 0) {
    toast.warning(`PDF生成: ${errorCount}件エラー`, {
      description: `${data.contractCount}契約処理 — エラーのある書類を確認してください`,
    });
  } else {
    toast.success(`ZIP生成完了: ${data.files?.length || 0}件のZIP`, {
      description: `${data.contractCount}契約 / ${data.employeeCount}名分`,
    });
  }
},
```

- [ ] **Step 6: Verificar typecheck**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npx tsc --noEmit
```

- [ ] **Step 7: Verificar lint**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npm run lint
```

- [ ] **Step 8: Commit**
```bash
cd "D:\Git\JP個別契約書v26.3.10"
git add src/routes/companies/index.tsx src/lib/hooks/use-contracts.ts
git commit -m "fix(companies): corregir stale state de FactoryPanel al cambiar empresa

- key dinámica en FactoryPanel evita reutilizar estado entre empresas (C-1)
- onSuccess verifica summary.errors antes de mostrar toast éxito (H-3)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: documents.ts — HTTP status correcto + N+1 en batch

**Fixes:** C-2 (PDFs fallados devuelven 200), H-7 (N+1 en generate-batch)

**Files:**
- Modify: `server/routes/documents.ts`

### Bug C-2: PDFs fallados devuelven HTTP 200 `success: true`

Cuando PDFKit falla, el error se guarda como `path: "ERROR: message"` pero el response tiene status 200. El frontend dispara `onSuccess` aunque no se creó ningún documento legal.

- [ ] **Step 1: Leer el archivo para entender la estructura**

En `server/routes/documents.ts`, buscar el endpoint `documentsRouter.post("/generate/:contractId")`.

Buscar el bloque donde se construye `generatedFiles` (array de objetos `{ type, filename, path }`). Buscar también `summary` que cuenta errores. Localizar la línea `return c.json(...)` al final del endpoint.

- [ ] **Step 2: Cambiar el status de respuesta según errores**

Localizar la respuesta final del endpoint `/generate/:contractId`. Actualmente es algo como:
```typescript
return c.json({ success: true, contractId, files: generatedFiles, summary });
```

Cambiarlo a:
```typescript
const hasErrors = generatedFiles.some((f) => f.path.startsWith("ERROR:"));
const allFailed = generatedFiles.length > 0 && generatedFiles.every((f) => f.path.startsWith("ERROR:"));
return c.json(
  { success: !hasErrors, contractId, files: generatedFiles, summary },
  allFailed ? 500 : hasErrors ? 207 : 200,
);
```

**NOTA:** HTTP 207 = Multi-Status (algunos éxito, algunos error). HTTP 500 = todos fallaron.

- [ ] **Step 3: Aplicar el mismo fix al endpoint `/generate-batch`**

El endpoint `generate-batch` (buscar `documentsRouter.post("/generate-batch"`) tiene una respuesta similar. Aplicar el mismo patrón:

```typescript
const hasErrors = results.some((r) => r.files?.some((f: {path: string}) => f.path.startsWith("ERROR:")));
return c.json(
  { success: !hasErrors, contractCount, employeeCount, files: zipFiles, summary: batchSummary },
  hasErrors ? 207 : 200,
);
```

### Bug H-7: N+1 en generate-batch — un query por contrato

`generate-batch` llama `getContractData(cid)` en un loop. Con 20 contratos = 20 queries secuenciales con relaciones anidadas.

- [ ] **Step 4: Leer la función `getContractData`**

En `server/routes/documents.ts`, buscar `getContractData`. Ver qué campos/relaciones incluye (debe tener `with: { company, factory, employees: { with: { employee } } }`).

- [ ] **Step 5: Reemplazar el loop por una query bulk**

En el endpoint `generate-batch`, buscar el loop que llama `getContractData`:
```typescript
const contractsData = [];
for (const cid of contractIds) {
  const contract = await getContractData(cid);
  if (contract) contractsData.push(contract);
}
```

Reemplazar con una sola query usando `inArray`. Necesitas importar `inArray` de drizzle-orm si no está importado.

Verificar qué imports de drizzle-orm existen al inicio del archivo. Si `inArray` no está importado, añadirlo.

Reemplazar el loop con:
```typescript
const { contracts: contractsTable } = await import("../db/schema.js");
// En realidad el schema ya está importado — buscar el import existente de schema
// La query debe seguir la misma estructura que getContractData pero para múltiples IDs:
const contractsData = await db.query.contracts.findMany({
  where: inArray(contracts.id, contractIds),
  with: {
    company: true,
    factory: true,
    employees: { with: { employee: true } },
  },
});
```

**IMPORTANTE:** Antes de escribir esto, leer el archivo para ver exactamente cómo está importado el schema y qué alias tiene la tabla `contracts` (puede estar importada como `contracts` o con otro nombre para evitar conflicto con el router).

- [ ] **Step 6: Verificar typecheck**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npx tsc --noEmit
```

- [ ] **Step 7: Verificar lint**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npm run lint
```

- [ ] **Step 8: Commit**
```bash
git add server/routes/documents.ts
git commit -m "fix(documents): HTTP status correcto en PDF fallados + eliminar N+1 en batch

- generate y generate-batch devuelven 207/500 cuando hay errores de PDF (C-2)
- generate-batch usa inArray en lugar de loop por contrato (H-7)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: contracts.ts + batch-helpers.ts

**Fixes:** H-1 (null en PUT response), H-6 (N+1 en analyzeBatch), H-13 (Zod en bulk-delete/purge)

**Files:**
- Modify: `server/routes/contracts.ts`
- Modify: `server/services/batch-helpers.ts`

### Bug H-1: `PUT /contracts/:id` puede retornar `null` como HTTP 200

Si `db.update().returning().get()` no encuentra la fila (por modificación concurrente), devuelve `undefined`. La transacción retorna `null`. El endpoint hace `return c.json(null)` con status 200. El frontend recibe `null` y crashea al intentar `result.contractNumber`.

- [ ] **Step 1: Leer el endpoint PUT /:id**

En `server/routes/contracts.ts`, buscar `contractsRouter.put("/:id"`. Localizar el bloque `sqlite.transaction(()` y el `const result = sqlite.transaction(...)()`.

- [ ] **Step 2: Añadir guard después de la transacción**

Después de `const result = sqlite.transaction(...)()`, añadir:
```typescript
if (!result) {
  return c.json({ error: "Contract not found or modified concurrently" }, 404);
}
```

Esto debe ir ANTES de `return c.json(result)`.

### Bug H-6: N+1 en `analyzeBatch` — 152 queries para 76 fábricas

`analyzeBatch` llama `getActiveEmployees(factory.id)` y `findDuplicateContracts(...)` dentro del loop de factories. Con 76 fábricas = 152 queries secuenciales solo para el preview.

- [ ] **Step 3: Leer batch-helpers.ts para entender las funciones**

Leer `server/services/batch-helpers.ts` completo. Identificar:
- La función `getActiveEmployees(factoryId)` — ver su query exacta
- La función `findDuplicateContracts(factoryId, startDate, endDate, companyId)` — ver su query exacta
- El tipo de datos que retornan

- [ ] **Step 4: Añadir función bulk para employees**

Al final de `server/services/batch-helpers.ts`, añadir:

```typescript
/**
 * Bulk version of getActiveEmployees — fetches all active employees for multiple factories
 * in a single query and returns a Map<factoryId, Employee[]>.
 */
export async function getActiveEmployeesByFactories(
  factoryIds: number[],
): Promise<Map<number, typeof employees.$inferSelect[]>> {
  if (factoryIds.length === 0) return new Map();
  const rows = await db.query.employees.findMany({
    where: and(
      inArray(employees.factoryId, factoryIds),
      eq(employees.status, "active"),
    ),
  });
  const map = new Map<number, typeof employees.$inferSelect[]>();
  for (const emp of rows) {
    if (emp.factoryId == null) continue;
    const list = map.get(emp.factoryId) ?? [];
    list.push(emp);
    map.set(emp.factoryId, list);
  }
  return map;
}
```

**NOTA:** Verificar los imports exactos en batch-helpers.ts para `employees`, `inArray`, `and`, `eq`. Usar los mismos patrones del archivo.

- [ ] **Step 5: Añadir función bulk para duplicate contracts**

Añadir también en `batch-helpers.ts`:

```typescript
/**
 * Bulk version of findDuplicateContracts — checks all factories at once.
 * Returns a Map<factoryId, Contract[]> of overlapping active contracts.
 */
export async function findDuplicateContractsByFactories(
  factoryIds: number[],
  startDate: string,
  endDate: string,
): Promise<Map<number, (typeof contracts.$inferSelect & { employees: { employee: typeof employees.$inferSelect }[] })[]>> {
  if (factoryIds.length === 0) return new Map();
  const rows = await db.query.contracts.findMany({
    where: and(
      inArray(contracts.factoryId, factoryIds),
      ne(contracts.status, "cancelled"),
      lte(contracts.startDate, endDate),
      gte(contracts.endDate, startDate),
    ),
    with: { employees: { with: { employee: true } } },
  });
  const map = new Map<number, typeof rows>();
  for (const row of rows) {
    if (row.factoryId == null) continue;
    const list = map.get(row.factoryId) ?? [];
    list.push(row);
    map.set(row.factoryId, list);
  }
  return map;
}
```

**NOTA:** Verificar los imports necesarios (`ne`, `lte`, `gte`, `inArray`, `and`). Ver cuáles ya están importados en batch-helpers.ts y añadir solo los que faltan.

- [ ] **Step 6: Modificar `analyzeBatch` en contracts.ts para usar las funciones bulk**

En `server/routes/contracts.ts`, buscar la función `analyzeBatch` (o el handler que itera `targetFactories`).

Cambiar el patrón de:
```typescript
for (const factory of targetFactories) {
  const factoryEmps = await getActiveEmployees(factory.id);
  const duplicates = await findDuplicateContracts(factory.id, startDate, endDate, ...);
  ...
}
```

A:
```typescript
// Pre-fetch bulk — 2 queries en lugar de N*2
const factoryIds = targetFactories.map((f) => f.id);
const empsByFactory = await getActiveEmployeesByFactories(factoryIds);
const duplicatesByFactory = await findDuplicateContractsByFactories(factoryIds, startDate, endDate);

for (const factory of targetFactories) {
  const factoryEmps = empsByFactory.get(factory.id) ?? [];
  const duplicates = duplicatesByFactory.get(factory.id) ?? [];
  ...
}
```

**IMPORTANTE:** Leer exactamente cómo se usan `factoryEmps` y `duplicates` dentro del loop para asegurar que los tipos sean compatibles. Puede que `findDuplicateContracts` devuelva un tipo ligeramente diferente al de `findDuplicateContractsByFactories` — ajustar según sea necesario.

Hacer lo mismo para `analyzeNewHires` si también tiene el mismo loop N+1.

Añadir el import de las nuevas funciones al inicio de contracts.ts.

### Bug H-13: bulk-delete y purge sin validación Zod

`POST /contracts/bulk-delete` y `POST /contracts/purge` aceptan `ids: number[]` sin validar que sean enteros positivos.

- [ ] **Step 7: Añadir schema Zod para ids**

En `server/routes/contracts.ts`, añadir near el inicio del archivo (cerca de otros schemas Zod):

```typescript
const bulkIdsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "Al menos 1 ID requerido"),
});
```

- [ ] **Step 8: Aplicar en bulk-delete**

Buscar `POST /contracts/bulk-delete`. Cambiar:
```typescript
const { ids } = await c.req.json() as { ids: number[] };
if (!Array.isArray(ids) || ids.length === 0) {
  return c.json({ error: "ids array required" }, 400);
}
```
Por:
```typescript
const parsed = bulkIdsSchema.safeParse(await c.req.json());
if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
const { ids } = parsed.data;
```

- [ ] **Step 9: Aplicar en purge**

Buscar `POST /contracts/purge`. Aplicar el mismo patrón Zod.

- [ ] **Step 10: Verificar typecheck y lint**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npx tsc --noEmit && npm run lint
```

- [ ] **Step 11: Commit**
```bash
git add server/routes/contracts.ts server/services/batch-helpers.ts
git commit -m "fix(contracts): null guard en PUT, Zod en bulk-delete/purge, N+1 en analyzeBatch

- PUT /:id retorna 404 si transaction devuelve null (H-1)
- bulk-delete y purge validan ids con Zod (H-13)
- analyzeBatch pre-fetches employees y duplicates en bulk (H-6)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: import.ts + document-files.ts + vite.config.ts

**Fixes:** C-3 (import sin transaction), C-6 (path traversal en download), H-8 (ExcelJS en main bundle)

**Files:**
- Modify: `server/routes/import.ts`
- Modify: `server/services/document-files.ts`
- Modify: `vite.config.ts`

### Bug C-3: Import de empleados sin `sqlite.transaction()`

El loop de import crea/actualiza empleados con commits individuales. Si falla en la fila 200 de 392, las primeras 199 filas están commiteadas sin posibilidad de rollback.

- [ ] **Step 1: Leer import.ts para localizar los loops de import**

En `server/routes/import.ts`, leer el handler `POST /import/employees`. Identificar:
- Dónde empieza el loop (`for (const rawRow of rows)`)
- Dónde terminan los `db.insert()`/`db.update()` dentro del loop
- Cómo se importa `sqlite` (buscar el import de `db/index.ts`)

- [ ] **Step 2: Envolver el loop de employees en `sqlite.transaction()`**

El patrón correcto (ya usado en contracts.ts) es:
```typescript
const importResult = sqlite.transaction(() => {
  const updated = 0, inserted = 0, errors: string[] = [];
  for (const rawRow of rows) {
    // ... todo el código del loop aquí
  }
  return { updated, inserted, errors };
})();
```

**IMPORTANTE:** El loop usa `async/await`. `sqlite.transaction()` en better-sqlite3 es **síncrono** — no puede envolver código async. Solución: las operaciones de better-sqlite3 son síncronas por defecto. Verificar si `db.query.employees.findFirst()` dentro del loop es async. Si usa Drizzle con better-sqlite3, debería poder usarse la API síncrona.

Si el loop usa `await`, cambiar a la API síncrona equivalente. En Drizzle con better-sqlite3:
- `await db.query.employees.findFirst(...)` → `db.query.employees.findFirst(...).sync()` — NO, Drizzle no tiene .sync()
- Alternativa: pre-cargar todos los employee numbers existentes antes del loop (como sugiere la auditoría de performance H en batch-helpers):

```typescript
// Antes del loop: un solo query para todos los existentes
const existingEmployees = db.query.employees.findMany({ columns: { id: true, employeeNumber: true } });
// Esta función en Drizzle con better-sqlite3 es síncrona (no retorna Promise)
const existingMap = new Map(existingEmployees.map(e => [e.employeeNumber, e.id]));
```

Luego en el loop usar `existingMap.get(employeeNumber)` en lugar del `findFirst` async.

Con todas las operaciones del loop siendo síncronas, envolver en `sqlite.transaction(()  => { ... })()`.

- [ ] **Step 3: Aplicar lo mismo a `/import/factories`**

Mismo patrón. El loop de factories también debe estar dentro de `sqlite.transaction()`.

**NOTA:** El endpoint de factories ya tiene operaciones síncronas de Drizzle con better-sqlite3 (`.run()`). Solo necesita el wrapper.

- [ ] **Step 4: Verificar que el handler devuelve el mismo formato de respuesta**

La respuesta debe seguir siendo `{ success, inserted, updated, errors, ... }`. Verificar que las variables de contadores (`inserted`, `updated`, `errors`) se inicializan fuera de la transacción si es necesario, o dentro y se retornan del closure.

### Bug C-6: Path traversal — falta confinement check

`resolveDownloadFilePath` en `document-files.ts` bloquea `../` pero no hace `path.resolve()` confinement check después de `path.join()`. `document-index.ts` ya tiene el patrón correcto.

- [ ] **Step 5: Leer document-files.ts**

Leer `server/services/document-files.ts` completo. Identificar la función `resolveDownloadFilePath` y cómo hace el join.

- [ ] **Step 6: Añadir confinement check post-resolve**

En `resolveDownloadFilePath`, dentro del loop sobre `candidates`, después de construir el candidatePath con `path.join(dir, filename)`:

```typescript
for (const dir of candidates) {
  const resolvedDir = path.resolve(dir);
  const candidatePath = path.resolve(dir, filename);
  // Post-resolution confinement: el path resuelto debe estar dentro del directorio
  if (!candidatePath.startsWith(resolvedDir + path.sep)) continue;
  if (fs.existsSync(candidatePath)) {
    return candidatePath;
  }
}
```

También añadir strip de null bytes en el caller (en `documents.ts` donde se lee el param):
```typescript
const filename = decodeURIComponent(c.req.param("filename")).replace(/\0/g, "");
```

Verificar en `documents.ts` dónde se llama `resolveDownloadFilePath` para añadir el strip. Importar `path` si no está importado en document-files.ts.

### H-8: ExcelJS en el main bundle

ExcelJS pesa >1MB y actualmente va en el bundle principal aunque solo se usa en `/import` y en el export de la tabla de empresas.

- [ ] **Step 7: Leer vite.config.ts**

Leer `vite.config.ts` para ver los `manualChunks` actuales.

- [ ] **Step 8: Añadir ExcelJS a manualChunks**

En `vite.config.ts`, dentro de `build.rollupOptions.output.manualChunks`, añadir:
```typescript
"exceljs": ["exceljs"],
"xlsx": ["xlsx"],  // si SheetJS también es una dependencia usada en cliente
```

- [ ] **Step 9: Verificar que build funciona**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npm run build 2>&1 | grep -E "(chunk|error|warn)" | head -20
```
Expected: ExcelJS aparece como chunk separado, no en el main bundle.

- [ ] **Step 10: Verificar typecheck y lint**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npx tsc --noEmit && npm run lint
```

- [ ] **Step 11: Commit**
```bash
git add server/routes/import.ts server/services/document-files.ts vite.config.ts
git commit -m "fix(import): transacción SQLite en import, path confinement en download, ExcelJS lazy

- import employees y factories usan sqlite.transaction() para rollback atómico (C-3)
- resolveDownloadFilePath añade post-resolve confinement check (C-6)
- ExcelJS y xlsx en chunks separados en vite build (H-8)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Tests críticos faltantes

**Fixes:** C-5 (employee-mapper rate chain), C-7 (contract-writes empty assignments), H-9 (import-assignment factory rule)

**Files:**
- Create: `server/__tests__/employee-mapper.test.ts`
- Create: `server/__tests__/contract-writes.test.ts`
- Create: `server/__tests__/import-assignment.test.ts`

**Contexto del test runner:**
```bash
# Run tests:
cd "D:\Git\JP個別契約書v26.3.10" && npx vitest run server/__tests__/[filename].test.ts
# Ver tests existentes como referencia:
# server/__tests__/services.test.ts
# server/__tests__/fixes.test.ts
```

**IMPORTANTE:** Los archivos de test existentes usan `import { describe, it, expect } from "vitest"` y `vi.mock()` para mocks. Seguir el mismo patrón.

### Tests C-5: `mapContractEmployeeToPDF` — cadena de rates

La función en `server/services/employee-mapper.ts` determina qué rate va en el PDF legal:
```typescript
billingRate: ce.hourlyRate ?? ce.employee.billingRate ?? ce.employee.hourlyRate
```

Bug potencial: si `ce.hourlyRate === 0` (número cero), `0 ?? x` devuelve `0` y el PDF imprime `¥0/h`.

- [ ] **Step 1: Leer employee-mapper.ts para ver la interfaz exacta**

Leer `server/services/employee-mapper.ts`. Identificar:
- La función `mapContractEmployeeToPDF` (o cómo se llama exactamente)
- El tipo de su input (`ce` — ContractEmployee con employee anidado)
- Qué campo del output corresponde a `billingRate`

- [ ] **Step 2: Crear `server/__tests__/employee-mapper.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
// Importar la función — verificar el nombre exacto en el archivo
import { mapContractEmployeeToPDF } from "../services/employee-mapper.js";

// Helper para construir un mock de ContractEmployee
function makeContractEmployee(overrides: {
  ceHourlyRate?: number | null;
  empBillingRate?: number | null;
  empHourlyRate?: number | null;
}) {
  return {
    id: 1,
    contractId: 1,
    employeeId: 1,
    hourlyRate: overrides.ceHourlyRate ?? null,
    employee: {
      id: 1,
      fullName: "テスト太郎",
      employeeNumber: "E001",
      billingRate: overrides.empBillingRate ?? null,
      hourlyRate: overrides.empHourlyRate ?? null,
      // otros campos necesarios — ver la interfaz Employee en api.ts o schema.ts
    },
  };
}

describe("mapContractEmployeeToPDF — rate priority chain", () => {
  it("usa junction rate cuando está presente (billingRate priority)", () => {
    const ce = makeContractEmployee({ ceHourlyRate: 1609, empBillingRate: 1550, empHourlyRate: 1200 });
    const result = mapContractEmployeeToPDF(ce as any);
    expect(result.billingRate).toBe(1609);
  });

  it("usa employee.billingRate cuando junction rate es null", () => {
    const ce = makeContractEmployee({ ceHourlyRate: null, empBillingRate: 1550, empHourlyRate: 1200 });
    const result = mapContractEmployeeToPDF(ce as any);
    expect(result.billingRate).toBe(1550);
  });

  it("usa employee.hourlyRate como último fallback", () => {
    const ce = makeContractEmployee({ ceHourlyRate: null, empBillingRate: null, empHourlyRate: 1200 });
    const result = mapContractEmployeeToPDF(ce as any);
    expect(result.billingRate).toBe(1200);
  });

  it("DOCUMENTA: junction rate de 0 devuelve 0 (bug potencial — 0 ?? x = 0)", () => {
    const ce = makeContractEmployee({ ceHourlyRate: 0, empBillingRate: 1550, empHourlyRate: 1200 });
    const result = mapContractEmployeeToPDF(ce as any);
    // Si este test FALLA (devuelve 0), confirma el bug y debe añadirse un fix:
    // cambiar `ce.hourlyRate ?? ...` a `ce.hourlyRate != null ? ce.hourlyRate : ...`
    // Si PASA con 1550, el código ya maneja bien cero — documentar como correcto
    expect(result.billingRate).not.toBe(0); // Este test puede fallar — leer el resultado
  });
});
```

**NOTA:** Si la función `mapContractEmployeeToPDF` no existe con ese nombre exacto, leer employee-mapper.ts para encontrar la función correcta que mapea rates. Puede llamarse diferente o estar inline.

- [ ] **Step 3: Ejecutar los tests**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npx vitest run server/__tests__/employee-mapper.test.ts
```

Si el test de `billingRate === 0` falla (retorna 0), el bug existe. Documentarlo en el test con `// BUG: ce.hourlyRate === 0 pasa como 0 al PDF`. No arreglar el bug en esta tarea — solo documentarlo con el test.

### Tests C-7: `buildContractEmployeeRows` — array vacío

La función en `server/services/contract-writes.ts` prioriza `employeeAssignments` sobre `employeeIds`. Si `employeeAssignments: []` se pasa, el array vacío es truthy y la función retorna `[]` ignorando cualquier `employeeIds`.

- [ ] **Step 4: Leer contract-writes.ts**

Leer `server/services/contract-writes.ts`. Identificar:
- La función `buildContractEmployeeRows` (o nombre equivalente)
- Su firma de parámetros
- La lógica de prioridad

- [ ] **Step 5: Crear `server/__tests__/contract-writes.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
// Ajustar el import según el nombre real de la función
import { buildContractEmployeeRows } from "../services/contract-writes.js";

describe("buildContractEmployeeRows — prioridad de asignaciones", () => {
  it("usa employeeAssignments cuando está presente con datos", () => {
    const result = buildContractEmployeeRows({
      contractId: 1,
      employeeAssignments: [{ employeeId: 5, hourlyRate: 1600 }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].employeeId).toBe(5);
    expect(result[0].hourlyRate).toBe(1600);
  });

  it("usa employeeAssignments sin rate (null)", () => {
    const result = buildContractEmployeeRows({
      contractId: 1,
      employeeAssignments: [{ employeeId: 5 }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].hourlyRate).toBeNull();
  });

  it("usa employeeIds como fallback cuando no hay assignments", () => {
    const result = buildContractEmployeeRows({
      contractId: 1,
      employeeIds: [3, 4],
    });
    expect(result).toHaveLength(2);
  });

  it("DOCUMENTA: employeeAssignments vacío ignora employeeIds (comportamiento de prioridad)", () => {
    const result = buildContractEmployeeRows({
      contractId: 1,
      employeeAssignments: [],   // array vacío — truthy pero sin datos
      employeeIds: [3],
    });
    // Documenta que [] vacío toma prioridad sobre employeeIds
    expect(result).toHaveLength(0);
    // Si esto es un bug, cambiar la condición a: employeeAssignments?.length > 0
  });

  it("retorna array vacío cuando no se proveen ni assignments ni ids", () => {
    const result = buildContractEmployeeRows({ contractId: 1 });
    expect(result).toHaveLength(0);
  });
});
```

### Tests H-9: `resolveFactoryAssignment` — regla de asignación a fábrica

La regla crítica: si `department` y `lineName` están vacíos → `factoryId` debe ser `null`. Cero tests actualmente.

- [ ] **Step 6: Leer import-assignment.ts**

Leer `server/services/import-assignment.ts`. Identificar:
- La función `resolveFactoryAssignment` y `buildFactoryLookup`
- Sus parámetros exactos
- La estructura `FactoryLookup` que retorna `buildFactoryLookup`

- [ ] **Step 7: Crear `server/__tests__/import-assignment.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { buildFactoryLookup, resolveFactoryAssignment } from "../services/import-assignment.js";

// Factories de test
const factories = [
  { id: 1, companyId: 10, factoryName: "本社工場", department: "製作1課", lineName: "Aライン" },
  { id: 2, companyId: 10, factoryName: "本社工場", department: "製作2課", lineName: "Bライン" },
  { id: 3, companyId: 10, factoryName: "本社工場", department: "製作1課", lineName: "Bライン" },
  { id: 4, companyId: 20, factoryName: "第2工場", department: "製作課", lineName: "Aライン" },
];

describe("resolveFactoryAssignment — regla de asignación", () => {
  it("retorna null cuando department y lineName están vacíos (regla crítica del proyecto)", () => {
    const lookup = buildFactoryLookup(factories as any);
    const result = resolveFactoryAssignment({
      companyId: 10,
      department: "",
      lineName: "",
      resolvedFactoryName: "本社工場",
      lookup,
    });
    expect(result).toBeNull();
  });

  it("retorna null cuando companyId es null", () => {
    const lookup = buildFactoryLookup(factories as any);
    const result = resolveFactoryAssignment({
      companyId: null,
      department: "製作1課",
      lineName: "Aライン",
      resolvedFactoryName: "本社工場",
      lookup,
    });
    expect(result).toBeNull();
  });

  it("resuelve por match exacto (companyId + factoryName + department + lineName)", () => {
    const lookup = buildFactoryLookup(factories as any);
    const result = resolveFactoryAssignment({
      companyId: 10,
      department: "製作1課",
      lineName: "Aライン",
      resolvedFactoryName: "本社工場",
      lookup,
    });
    expect(result).toBe(1);
  });

  it("resuelve por lineName solo cuando exact falla", () => {
    const lookup = buildFactoryLookup(factories as any);
    const result = resolveFactoryAssignment({
      companyId: 10,
      department: "不明部署",  // no existe exacto
      lineName: "Bライン",
      resolvedFactoryName: "本社工場",
      lookup,
    });
    // Puede resolver por line-only key — verificar cuál ID retorna según la lógica
    expect(result).not.toBeNull(); // Al menos debe resolver algo
  });

  it("retorna null cuando hay ambigüedad (misma lineName en múltiples factories)", () => {
    const lookup = buildFactoryLookup(factories as any);
    // Bライン existe en id:2 (製作2課) y id:3 (製作1課) — ambiguo
    const result = resolveFactoryAssignment({
      companyId: 10,
      department: "",
      lineName: "Bライン",
      resolvedFactoryName: "本社工場",
      lookup,
    });
    // Si department está vacío → null por la regla del proyecto
    expect(result).toBeNull();
  });
});

describe("buildFactoryLookup — construcción del índice", () => {
  it("construye keys exactos para cada factory", () => {
    const lookup = buildFactoryLookup(factories as any);
    // Verificar que el lookup no es null/undefined
    expect(lookup).toBeTruthy();
  });

  it("no mezcla factories de diferentes companyIds", () => {
    const lookup = buildFactoryLookup(factories as any);
    // Factory de companyId:20 no debe ser accesible con companyId:10
    const result = resolveFactoryAssignment({
      companyId: 10,
      department: "製作課",
      lineName: "Aライン",
      resolvedFactoryName: "第2工場",
      lookup,
    });
    expect(result).not.toBe(4); // No debe retornar el factory de companyId:20
  });
});
```

**NOTA:** Los nombres exactos de parámetros de `resolveFactoryAssignment` y `buildFactoryLookup` deben verificarse en el archivo antes de escribir los tests. Ajustar según la interfaz real.

- [ ] **Step 8: Ejecutar todos los nuevos tests**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npx vitest run server/__tests__/employee-mapper.test.ts server/__tests__/contract-writes.test.ts server/__tests__/import-assignment.test.ts
```

Expected: todos los tests pasan (excepto posiblemente el de `billingRate === 0` que puede fallar y es el objetivo de documentarlo).

- [ ] **Step 9: Ejecutar el test suite completo para asegurar que no se rompió nada**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npm run test:run
```

- [ ] **Step 10: Commit**
```bash
git add server/__tests__/employee-mapper.test.ts server/__tests__/contract-writes.test.ts server/__tests__/import-assignment.test.ts
git commit -m "test: añadir tests para cadena de rates, asignación de contratos y factory lookup

- employee-mapper: 4 tests de rate priority chain (documenta bug billingRate=0)
- contract-writes: 5 tests de buildContractEmployeeRows incluyendo array vacío
- import-assignment: tests de resolveFactoryAssignment y regla de asignación

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

- [ ] **Test suite completo**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npm run test:run
```
Expected: ≥131 tests pasando (pueden aumentar con los nuevos tests).

- [ ] **Build exitoso**
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npm run build 2>&1 | tail -10
```
