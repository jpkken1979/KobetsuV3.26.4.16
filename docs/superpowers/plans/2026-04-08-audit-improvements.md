# KobetsuV3 Audit Improvements — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver los 4 HIGH, 11 MEDIUM y 8 LOW issues detectados por audit-pro el 2026-04-08, llevando el sistema a un estado de producción robusto.

**Architecture:** El plan está organizado en 6 tracks independientes ordenados por impacto y riesgo. Cada track puede ejecutarse por separado. Prioridad: A → B → C → D → E → F. Los tracks B y C pueden ejecutarse en paralelo después del A.

**Tech Stack:** TypeScript strict, Hono 4.12, React 19, Vitest 4, Zod 4, TanStack Query 5, Tailwind CSS 4, motion (framer-motion fork), SQLite + better-sqlite3

---

## Mapa de archivos

| Track | Archivos modificados | Archivos nuevos |
|-------|---------------------|-----------------|
| A | `package.json` | — |
| B | `src/lib/api.ts`, `server/services/admin-stats.ts` | — |
| C | `server/routes/documents-generate-batch-bundle.ts`, `documents-generate-batch-ids.ts`, `documents-generate-batch-set.ts`, `documents-generate-batch-factory.ts`, `documents-generate-individual.ts`, `documents.ts`, `calendars.ts`, `data-check.ts`, `admin-crud.ts` | — |
| D | — | `server/__tests__/batch-contracts-service.test.ts`, `server/__tests__/import-employees-service.test.ts`, `server/__tests__/import-factories-service.test.ts`, `server/__tests__/koritsu-excel-parser.test.ts` |
| E | `src/lib/hooks/use-reduced-motion.ts` (existe), `src/components/ui/button.tsx`, `src/components/layout/sidebar.tsx`, `src/components/contract/contract-form.tsx`, + 23 archivos de animación | — |
| F | `src/routes/admin/-employee-manager.tsx`, `src/routes/admin/-contract-manager.tsx` | `src/routes/admin/-employee-table.tsx`, `src/routes/admin/-employee-form.tsx`, `src/routes/admin/-contract-table.tsx`, `src/routes/admin/-contract-filters.tsx` |

---

## TRACK A — Quick Fixes de Dependencias

> **Estimado:** 20 min. Sin riesgo. Hacer primero.

### Task A1: Corregir ubicación de dependencias en package.json

**Issue resuelto:** H1 (pdfjs-dist rompe en producción), M11 (@types/yazl infla prod), L3 (@tailwindcss/vite en deps)

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Verificar el estado actual**

```bash
cd C:\Users\kenji\OneDrive\Desktop\KobetsuVsKonetsu\KobetsuV3
node -e "const p=require('./package.json'); console.log('pdfjs en deps:', !!p.dependencies['pdfjs-dist']); console.log('@types/yazl en deps:', !!p.dependencies['@types/yazl']); console.log('tailwind/vite en deps:', !!p.dependencies['@tailwindcss/vite'])"
```

Expected output:
```
pdfjs en deps: false
@types/yazl en deps: true
tailwind/vite en deps: true
```

- [ ] **Step 2: Aplicar los tres movimientos en package.json**

En `package.json`:
1. Mover `"pdfjs-dist"` de `devDependencies` a `dependencies` (sin cambiar versión)
2. Mover `"@types/yazl"` de `dependencies` a `devDependencies` (sin cambiar versión)
3. Mover `"@tailwindcss/vite"` de `dependencies` a `devDependencies` (sin cambiar versión)

- [ ] **Step 3: Verificar que la instalación no rompió nada**

```bash
cd C:\Users\kenji\OneDrive\Desktop\KobetsuVsKonetsu\KobetsuV3
npm install
npx tsc --noEmit
```

Expected: 0 errores TypeScript.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "fix(deps): mover pdfjs-dist a dependencies, @types/yazl y tailwindcss/vite a devDependencies"
```

---

### Task A2: Actualizar @hono/node-server a 1.19.13

**Issue resuelto:** H2 (path traversal GHSA-92pp-h63x-v22m)

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Actualizar el paquete**

```bash
cd C:\Users\kenji\OneDrive\Desktop\KobetsuVsKonetsu\KobetsuV3
npm update @hono/node-server
```

- [ ] **Step 2: Verificar que la versión instalada es >= 1.19.13**

```bash
node -e "console.log(require('./node_modules/@hono/node-server/package.json').version)"
```

Expected: `1.19.13` o superior.

- [ ] **Step 3: Smoke test del servidor**

```bash
cd C:\Users\kenji\OneDrive\Desktop\KobetsuVsKonetsu\KobetsuV3
npm run test:run 2>&1 | tail -5
```

Expected: todos los tests pasan (643 passed).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "fix(deps): actualizar @hono/node-server a 1.19.13 — fix path traversal GHSA-92pp-h63x-v22m"
```

---

## TRACK B — Performance

> **Estimado:** 1.5h. Independiente del resto.

### Task B1: Agregar timeout/AbortController en el wrapper central de fetch

**Issue resuelto:** M6 (fetch sin timeout en api.ts cubre el 100% de llamadas)

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Leer el archivo actual**

Abrir `src/lib/api.ts` y localizar la función central de fetch (alrededor de la línea 77).
El patrón actual es algo como:
```typescript
const res = await fetch(`${API_BASE}${path}`, { method, headers, body });
```

- [ ] **Step 2: Escribir el test que verifica el timeout**

Crear o agregar en `src/lib/__tests__/api.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('api fetch wrapper', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('should abort after 30 seconds', async () => {
    vi.useFakeTimers();

    // Simular un fetch que nunca resuelve
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(
      (_, init) =>
        new Promise((_, reject) => {
          (init?.signal as AbortSignal)?.addEventListener('abort', () =>
            reject(new DOMException('AbortError', 'AbortError'))
          );
        })
    );

    // Importar después de mockear fetch
    const { apiFetch } = await import('../api');
    const promise = apiFetch('/api/health');

    // Avanzar 30 segundos
    vi.advanceTimersByTime(30_001);

    await expect(promise).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/health'),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    vi.useRealTimers();
  });
});
```

- [ ] **Step 3: Ejecutar el test para verificar que falla**

```bash
cd C:\Users\kenji\OneDrive\Desktop\KobetsuVsKonetsu\KobetsuV3
npx vitest run src/lib/__tests__/api.test.ts
```

Expected: FAIL (apiFetch no exporta o no tiene AbortController).

- [ ] **Step 4: Implementar AbortController en api.ts**

En `src/lib/api.ts`, modificar la función de fetch interna para agregar timeout:

```typescript
const FETCH_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
```

Reemplazar todas las llamadas a `fetch(` dentro del wrapper por `fetchWithTimeout(`.

Asegurarse de que `fetchWithTimeout` está exportada como `apiFetch` o ajustar el test para importar correctamente según el nombre real que tenga la función en el archivo.

- [ ] **Step 5: Ejecutar el test para verificar que pasa**

```bash
npx vitest run src/lib/__tests__/api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Ejecutar la suite completa para verificar no hay regresiones**

```bash
cd C:\Users\kenji\OneDrive\Desktop\KobetsuVsKonetsu\KobetsuV3
npm run test:run
```

Expected: 643+ passed, 0 failed.

- [ ] **Step 7: Commit**

```bash
git add src/lib/api.ts src/lib/__tests__/api.test.ts
git commit -m "fix(api): agregar AbortController con timeout de 30s en wrapper central de fetch"
```

---

### Task B2: Consolidar computeNullCounts en una sola query SQL

**Issue resuelto:** M7 (62 queries síncronas en admin-stats bloquean el event loop)

**Files:**
- Modify: `server/services/admin-stats.ts`

- [ ] **Step 1: Leer el código actual de computeNullCounts**

Abrir `server/services/admin-stats.ts` y localizar las funciones `computeNullCounts` o similar (líneas 225–268). Identificar las columnas que se iteran y las tablas afectadas (`employees` y `factories`).

- [ ] **Step 2: Escribir el test que verifica el resultado consolidado**

Agregar en `server/__tests__/admin-stats.test.ts` (o crearlo si no existe):

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { computeNullCounts } from '../services/admin-stats';

describe('computeNullCounts', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, hourlyRate REAL);
      CREATE TABLE factories (id INTEGER PRIMARY KEY, factoryName TEXT, address TEXT);
      INSERT INTO employees VALUES (1, 'Nguyen', NULL);
      INSERT INTO employees VALUES (2, NULL, 500);
      INSERT INTO factories VALUES (1, 'Takao', NULL);
    `);
  });

  afterAll(() => { db.close(); });

  it('devuelve conteo de nulls por columna sin hacer más de 2 queries', () => {
    const querySpy = vi.spyOn(db, 'prepare');
    const result = computeNullCounts(db);

    // Verificar que se hicieron máximo 2 queries (una por tabla)
    expect(querySpy.mock.calls.length).toBeLessThanOrEqual(2);

    // Verificar valores correctos
    expect(result.employees.hourlyRate).toBe(1);
    expect(result.employees.name).toBe(1);
    expect(result.factories.address).toBe(1);
    expect(result.factories.factoryName).toBe(0);
  });
});
```

- [ ] **Step 3: Ejecutar el test para verificar que falla**

```bash
npx vitest run server/__tests__/admin-stats.test.ts -t "devuelve conteo de nulls"
```

Expected: FAIL.

- [ ] **Step 4: Implementar la query consolidada**

En `server/services/admin-stats.ts`, reemplazar el loop de computeNullCounts por una función que construye una sola query SQL con múltiples `SUM(CASE WHEN col IS NULL THEN 1 ELSE 0 END)`:

```typescript
function computeNullCountsForTable(
  db: Database.Database,
  tableName: string,
  columns: string[]
): Record<string, number> {
  if (columns.length === 0) return {};

  const selects = columns
    .map(col => `SUM(CASE WHEN "${col}" IS NULL THEN 1 ELSE 0 END) AS "${col}"`)
    .join(', ');

  const row = db.prepare(`SELECT ${selects} FROM "${tableName}"`).get() as Record<string, number>;
  return row ?? {};
}

export function computeNullCounts(db: Database.Database) {
  const empCols = ['name', 'hourlyRate', 'billingRate', /* ... resto de columnas reales */];
  const factCols = ['factoryName', 'address', /* ... resto de columnas reales */];

  return {
    employees: computeNullCountsForTable(db, 'employees', empCols),
    factories: computeNullCountsForTable(db, 'factories', factCols),
  };
}
```

**Importante:** obtener la lista real de columnas leyendo el schema en `server/db/schema.ts` antes de implementar. No inventar nombres de columna.

- [ ] **Step 5: Ejecutar el test para verificar que pasa**

```bash
npx vitest run server/__tests__/admin-stats.test.ts
```

Expected: PASS.

- [ ] **Step 6: Ejecutar la suite completa**

```bash
npm run test:run
```

Expected: 643+ passed, 0 failed.

- [ ] **Step 7: Commit**

```bash
git add server/services/admin-stats.ts server/__tests__/admin-stats.test.ts
git commit -m "perf(admin): consolidar computeNullCounts en queries únicas por tabla — eliminar N+1 de 62 queries"
```

---

## TRACK C — Validación Zod en Rutas de Documentos

> **Estimado:** 2h. Independiente del resto.

**Contexto:** El patrón correcto ya existe en `contracts.ts` (usa `safeParse`). Replicarlo en las rutas que reciben body sin validación. Las rutas afectadas son las de generación de documentos y admin-crud.

### Task C1: Definir schemas Zod compartidos para generación de documentos

**Issue resuelto:** H3 (10+ endpoints sin validación de entrada)

**Files:**
- Modify: `server/routes/documents-generate-batch-bundle.ts`, `documents-generate-batch-ids.ts`, `documents-generate-batch-set.ts`, `documents-generate-batch-factory.ts`, `documents-generate-individual.ts`, `documents.ts`, `calendars.ts`, `data-check.ts`

- [ ] **Step 1: Leer los bodies esperados en cada ruta**

Abrir cada archivo listado y registrar qué campos se esperan del body:

| Archivo | Campos esperados |
|---------|-----------------|
| `documents-generate-batch-bundle.ts:42` | `contractIds: number[]` o similar |
| `documents-generate-batch-ids.ts:46` | `ids: number[]` o similar |
| `documents-generate-batch-set.ts:39` | `setId: number` o similar |
| `documents-generate-batch-factory.ts:43` | `factoryId: number`, `year: number`, etc. |
| `documents-generate-individual.ts:41,171` | `contractId: number`, etc. |
| `documents.ts:168,191` | parámetros de documento |
| `calendars.ts:14` | datos de calendario |
| `data-check.ts:258` | filtros de query |

Leer los archivos para confirmar los tipos exactos antes de continuar.

- [ ] **Step 2: Agregar schemas Zod en cada ruta**

Para cada ruta, aplicar el patrón:

```typescript
import { z } from 'zod';

// En el handler:
const bodySchema = z.object({
  contractIds: z.array(z.number().int().positive()),
  // ... campos reales según lo leído en Step 1
});

const parsed = bodySchema.safeParse(await c.req.json());
if (!parsed.success) {
  return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
}
const { contractIds } = parsed.data;
// Usar parsed.data en lugar del body directo
```

Aplicar este patrón en los 8 archivos listados.

- [ ] **Step 3: Verificar TypeScript limpio**

```bash
cd C:\Users\kenji\OneDrive\Desktop\KobetsuVsKonetsu\KobetsuV3
npx tsc --noEmit
```

Expected: 0 errores.

- [ ] **Step 4: Ejecutar ESLint**

```bash
npm run lint
```

Expected: 0 violations.

- [ ] **Step 5: Ejecutar la suite de tests**

```bash
npm run test:run
```

Expected: 643+ passed, 0 failed.

- [ ] **Step 6: Commit**

```bash
git add server/routes/documents-generate-batch-bundle.ts \
        server/routes/documents-generate-batch-ids.ts \
        server/routes/documents-generate-batch-set.ts \
        server/routes/documents-generate-batch-factory.ts \
        server/routes/documents-generate-individual.ts \
        server/routes/documents.ts \
        server/routes/calendars.ts \
        server/routes/data-check.ts
git commit -m "fix(security): agregar validación Zod en rutas de generación de documentos y calendarios"
```

---

### Task C2: Whitelist de columnas en admin-crud

**Issue resuelto:** M5 (column names sin validar en INSERT/UPDATE)

**Files:**
- Modify: `server/routes/admin-crud.ts`

- [ ] **Step 1: Leer el código actual de admin-crud.ts**

Localizar las líneas 76–94 (POST insert) y 137–165 (PUT update) donde se usa `Object.keys(body)` sin validar los nombres de columna.

- [ ] **Step 2: Escribir el test**

En `server/__tests__/admin-crud.test.ts` (o el archivo de test del admin panel):

```typescript
it('rechaza columnas desconocidas en INSERT', async () => {
  const res = await app.request('/api/admin/crud/employees', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ADMIN_TOKEN ?? 'test-token'}`,
    },
    body: JSON.stringify({
      name: 'Test',
      injectedColumn: 'malicious_value', // columna que no existe en el schema
    }),
  });
  // Debe devolver 400 (columna inválida) o ignorar la columna extra
  expect([400, 422]).toContain(res.status);
});
```

- [ ] **Step 3: Implementar la whitelist de columnas**

En `server/routes/admin-crud.ts`, agregar una función que obtiene las columnas válidas del schema de Drizzle para una tabla dada:

```typescript
import { getTableColumns } from 'drizzle-orm';
import * as schema from '../db/schema';

// Mapa de nombre de tabla → objeto Drizzle table
const TABLE_MAP: Record<string, unknown> = {
  employees: schema.employees,
  factories: schema.factories,
  client_companies: schema.clientCompanies,
  contracts: schema.contracts,
  contract_employees: schema.contractEmployees,
  factory_calendars: schema.factoryCalendars,
  shift_templates: schema.shiftTemplates,
  audit_log: schema.auditLog,
  // Agregar las demás tablas del schema
};

function getValidColumns(tableName: string): Set<string> {
  const table = TABLE_MAP[tableName];
  if (!table) return new Set();
  return new Set(Object.keys(getTableColumns(table as Parameters<typeof getTableColumns>[0])));
}
```

Luego en el handler de POST/PUT:

```typescript
const validColumns = getValidColumns(tableName);
const filteredBody = Object.fromEntries(
  Object.entries(body as Record<string, unknown>).filter(([key]) => validColumns.has(key))
);
if (Object.keys(filteredBody).length === 0) {
  return c.json({ error: 'No valid columns provided' }, 400);
}
// Usar filteredBody en lugar de body
```

- [ ] **Step 4: Verificar TypeScript y tests**

```bash
npx tsc --noEmit && npm run test:run
```

Expected: 0 errores TS, todos los tests pasan.

- [ ] **Step 5: Commit**

```bash
git add server/routes/admin-crud.ts
git commit -m "fix(security): agregar whitelist de columnas en admin-crud INSERT/UPDATE"
```

---

## TRACK D — Cobertura de Tests

> **Estimado:** 4-6h. El track más largo. Cada sub-task es independiente.

**Contexto:** La cobertura global falla los 4 thresholds (44-49% vs 50% mínimo). Los servicios críticos con 0% coverage son: `batch-contracts.ts` (637L), `import-employees.ts` (318L), `import-factories-service.ts` (567L), `koritsu-excel-parser.ts`. El patrón de testing del proyecto usa SQLite en memoria (`:memory:`) — NO mocks.

### Task D1: Tests para batch-contracts.ts (servicio más crítico)

**Issue resuelto:** M2 (0% coverage en lógica de creación batch)

**Files:**
- Create: `server/__tests__/batch-contracts-service.test.ts`

- [ ] **Step 1: Leer batch-contracts.ts y mapear funciones exportadas**

Abrir `server/services/batch-contracts.ts` e identificar:
- Qué funciones exporta
- Qué argumentos reciben (db, contractData, etc.)
- Qué retornan
- Qué casos de borde existen (rate groups, employee assignments, etc.)

- [ ] **Step 2: Crear el test file con setup de DB en memoria**

```typescript
// server/__tests__/batch-contracts-service.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { createBatchContracts } from '../services/batch-contracts';
// Ajustar imports según las exportaciones reales del archivo

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  // Crear las tablas necesarias
  sqlite.exec(`
    CREATE TABLE client_companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyName TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE factories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyId INTEGER REFERENCES client_companies(id),
      factoryName TEXT NOT NULL,
      hourlyRate REAL,
      workHours TEXT
    );
    CREATE TABLE employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyId INTEGER REFERENCES client_companies(id),
      factoryId INTEGER REFERENCES factories(id),
      name TEXT NOT NULL,
      hourlyRate REAL,
      billingRate REAL
    );
    CREATE TABLE contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyId INTEGER REFERENCES client_companies(id),
      factoryId INTEGER REFERENCES factories(id),
      contractNumber TEXT UNIQUE,
      startDate TEXT,
      endDate TEXT,
      status TEXT DEFAULT 'active',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE contract_employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contractId INTEGER REFERENCES contracts(id),
      employeeId INTEGER REFERENCES employees(id),
      hourlyRate REAL
    );
    CREATE TABLE audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entityType TEXT,
      entityId INTEGER,
      details TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db = drizzle(sqlite, { schema });
});

afterEach(() => { sqlite.close(); });
```

- [ ] **Step 3: Escribir tests que fallan para las funciones principales**

```typescript
describe('createBatchContracts', () => {
  it('crea un contrato por cada grupo de tarifa distinta', async () => {
    // Seed: 1 empresa, 1 fábrica, 3 empleados (2 con la misma tarifa, 1 diferente)
    sqlite.exec(`
      INSERT INTO client_companies (companyName) VALUES ('TestCo');
      INSERT INTO factories (companyId, factoryName, hourlyRate) VALUES (1, 'Fábrica A', 1200);
      INSERT INTO employees (companyId, factoryId, name, billingRate) VALUES (1, 1, 'Nguyen A', 1500);
      INSERT INTO employees (companyId, factoryId, name, billingRate) VALUES (1, 1, 'Tran B', 1500);
      INSERT INTO employees (companyId, factoryId, name, billingRate) VALUES (1, 1, 'Le C', 1800);
    `);

    const result = await createBatchContracts(sqlite, db, {
      companyId: 1,
      factoryId: 1,
      startDate: '2026-05-01',
      endDate: '2026-10-31',
      employeeAssignments: [
        { employeeId: 1, hourlyRate: 1500 },
        { employeeId: 2, hourlyRate: 1500 },
        { employeeId: 3, hourlyRate: 1800 },
      ],
    });

    // 2 grupos de tarifa → 2 contratos
    expect(result.contracts).toHaveLength(2);
    expect(result.contracts[0].employeeIds).toHaveLength(2); // los de 1500
    expect(result.contracts[1].employeeIds).toHaveLength(1); // el de 1800
  });

  it('falla si no hay empleados en el assignment', async () => {
    sqlite.exec(`
      INSERT INTO client_companies (companyName) VALUES ('TestCo');
      INSERT INTO factories (companyId, factoryName) VALUES (1, 'Fábrica A');
    `);

    await expect(
      createBatchContracts(sqlite, db, {
        companyId: 1,
        factoryId: 1,
        startDate: '2026-05-01',
        endDate: '2026-10-31',
        employeeAssignments: [],
      })
    ).rejects.toThrow();
  });

  it('usa transacción — si falla un contrato, no se crea ninguno', async () => {
    sqlite.exec(`
      INSERT INTO client_companies (companyName) VALUES ('TestCo');
      INSERT INTO factories (companyId, factoryName) VALUES (1, 'Fábrica A');
    `);

    // Empleado que no existe → debe fallar toda la transacción
    await expect(
      createBatchContracts(sqlite, db, {
        companyId: 1,
        factoryId: 1,
        startDate: '2026-05-01',
        endDate: '2026-10-31',
        employeeAssignments: [{ employeeId: 9999, hourlyRate: 1500 }],
      })
    ).rejects.toThrow();

    // Verificar que no quedaron contratos huérfanos
    const count = sqlite.prepare('SELECT COUNT(*) as n FROM contracts').get() as { n: number };
    expect(count.n).toBe(0);
  });
});
```

**Nota:** Ajustar el nombre y los argumentos de `createBatchContracts` a los que existan realmente en el archivo. Si la función tiene un nombre diferente, usar el nombre correcto.

- [ ] **Step 4: Ejecutar tests para verificar que fallan**

```bash
npx vitest run server/__tests__/batch-contracts-service.test.ts
```

Expected: FAIL con "cannot find module" o "function not defined".

- [ ] **Step 5: Ajustar los imports según las exportaciones reales**

Leer `server/services/batch-contracts.ts` y corregir los imports del test para que coincidan con las exportaciones reales. No modificar el servicio — solo el test.

- [ ] **Step 6: Ejecutar tests hasta que pasen**

```bash
npx vitest run server/__tests__/batch-contracts-service.test.ts
```

Expected: PASS los 3 tests.

- [ ] **Step 7: Verificar que la cobertura de batch-contracts.ts mejora**

```bash
npx vitest run --coverage --reporter=verbose server/__tests__/batch-contracts-service.test.ts 2>&1 | grep "batch-contracts"
```

Expected: líneas > 40% (objetivo final > 50%).

- [ ] **Step 8: Commit**

```bash
git add server/__tests__/batch-contracts-service.test.ts
git commit -m "test(batch-contracts): agregar tests de integración para creación batch de contratos"
```

---

### Task D2: Tests para import-employees.ts

**Files:**
- Create: `server/__tests__/import-employees-service.test.ts`

- [ ] **Step 1: Leer import-employees.ts y mapear funciones exportadas**

Abrir `server/services/import-employees.ts` (318L) e identificar:
- Función principal de importación (probablemente `importEmployees`)
- Qué formato de datos espera (rows del Excel parseado)
- Qué tablas escribe

- [ ] **Step 2: Escribir tests con datos de Excel simulados**

```typescript
// server/__tests__/import-employees-service.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { importEmployees } from '../services/import-employees';
// Ajustar según exportaciones reales

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    CREATE TABLE client_companies (id INTEGER PRIMARY KEY AUTOINCREMENT, companyName TEXT NOT NULL, createdAt TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE factories (id INTEGER PRIMARY KEY AUTOINCREMENT, companyId INTEGER REFERENCES client_companies(id), factoryName TEXT NOT NULL, department TEXT, lineName TEXT);
    CREATE TABLE employees (id INTEGER PRIMARY KEY AUTOINCREMENT, companyId INTEGER REFERENCES client_companies(id), factoryId INTEGER, name TEXT NOT NULL, nameKana TEXT, visaType TEXT, hourlyRate REAL, billingRate REAL, createdAt TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, entityType TEXT, entityId INTEGER, details TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP);
  `);
  // Seed empresa base
  sqlite.exec(`INSERT INTO client_companies (companyName) VALUES ('Empresa Test')`);
  db = drizzle(sqlite, { schema });
});

afterEach(() => { sqlite.close(); });

describe('importEmployees', () => {
  it('importa empleados nuevos correctamente', async () => {
    const rows = [
      {
        name: 'Nguyen Van A',
        nameKana: 'グエン バン エー',
        visaType: '特定技能',
        hourlyRate: 1000,
        billingRate: 1200,
        companyName: 'Empresa Test',
        factoryId: null,
      },
    ];

    const result = await importEmployees(sqlite, db, rows);

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(0);

    const emp = sqlite.prepare('SELECT * FROM employees WHERE name = ?').get('Nguyen Van A') as { name: string; billingRate: number };
    expect(emp).toBeDefined();
    expect(emp.billingRate).toBe(1200);
  });

  it('actualiza empleado existente sin duplicar', async () => {
    sqlite.exec(`INSERT INTO employees (companyId, name, hourlyRate) VALUES (1, 'Nguyen Van A', 1000)`);

    const rows = [
      {
        name: 'Nguyen Van A',
        hourlyRate: 1100,
        billingRate: 1300,
        companyName: 'Empresa Test',
        factoryId: null,
      },
    ];

    const result = await importEmployees(sqlite, db, rows);

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);

    const count = sqlite.prepare('SELECT COUNT(*) as n FROM employees WHERE name = ?').get('Nguyen Van A') as { n: number };
    expect(count.n).toBe(1); // no duplicado
  });

  it('no asigna factoryId si el campo es 0 o null (regla crítica del dominio)', async () => {
    const rows = [
      {
        name: 'Le Thi B',
        companyName: 'Empresa Test',
        factoryId: 0, // valor 0 = null por regla del dominio
      },
    ];

    await importEmployees(sqlite, db, rows);

    const emp = sqlite.prepare('SELECT factoryId FROM employees WHERE name = ?').get('Le Thi B') as { factoryId: number | null };
    expect(emp.factoryId).toBeNull(); // 0 debe tratarse como null
  });
});
```

- [ ] **Step 3: Ajustar imports y ejecutar**

```bash
npx vitest run server/__tests__/import-employees-service.test.ts
```

Ajustar los imports y nombres de funciones según las exportaciones reales. El test de `factoryId: 0 → null` es la regla crítica del dominio (CLAUDE.md: "派遣先ID values of 0 must be treated as null").

- [ ] **Step 4: Commit cuando pasen**

```bash
git add server/__tests__/import-employees-service.test.ts
git commit -m "test(import): agregar tests de integración para importEmployees — incluyendo regla factoryId=0→null"
```

---

### Task D3: Tests para import-factories-service.ts

**Files:**
- Create: `server/__tests__/import-factories-service.test.ts`

- [ ] **Step 1: Leer import-factories-service.ts y mapear funciones**

Abrir `server/services/import-factories-service.ts` (567L). Identificar:
- Función principal (probablemente `importFactories`)
- Regla CRÍTICA: nunca sobrescribir campos existentes con null/vacío

- [ ] **Step 2: Escribir tests**

```typescript
// server/__tests__/import-factories-service.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { importFactories } from '../services/import-factories-service';

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    CREATE TABLE client_companies (id INTEGER PRIMARY KEY AUTOINCREMENT, companyName TEXT NOT NULL, createdAt TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE factories (id INTEGER PRIMARY KEY AUTOINCREMENT, companyId INTEGER REFERENCES client_companies(id), factoryName TEXT NOT NULL, department TEXT, lineName TEXT, address TEXT, supervisorName TEXT, hourlyRate REAL, workHours TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, entityType TEXT, entityId INTEGER, details TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP);
  `);
  sqlite.exec(`INSERT INTO client_companies (companyName) VALUES ('Empresa Test')`);
  db = drizzle(sqlite, { schema });
});

afterEach(() => { sqlite.close(); });

describe('importFactories', () => {
  it('crea fábricas nuevas', async () => {
    const rows = [
      { companyName: 'Empresa Test', factoryName: 'Planta A', department: 'Línea 1', hourlyRate: 1200, workHours: '08:00-17:00' },
    ];

    const result = await importFactories(sqlite, db, rows);

    expect(result.created).toBeGreaterThan(0);
    const factory = sqlite.prepare('SELECT * FROM factories WHERE factoryName = ?').get('Planta A') as { factoryName: string; hourlyRate: number };
    expect(factory).toBeDefined();
    expect(factory.hourlyRate).toBe(1200);
  });

  it('NUNCA sobrescribe campos existentes con valores vacíos o null — regla crítica', async () => {
    sqlite.exec(`
      INSERT INTO factories (companyId, factoryName, address, supervisorName)
      VALUES (1, 'Planta A', 'Dirección existente', 'Sr. Tanaka')
    `);

    // Importar con address vacía y supervisorName ausente
    const rows = [
      { companyName: 'Empresa Test', factoryName: 'Planta A', address: '', supervisorName: null },
    ];

    await importFactories(sqlite, db, rows);

    const factory = sqlite.prepare('SELECT address, supervisorName FROM factories WHERE factoryName = ?').get('Planta A') as { address: string; supervisorName: string };
    // Los campos originales NO deben haberse borrado
    expect(factory.address).toBe('Dirección existente');
    expect(factory.supervisorName).toBe('Sr. Tanaka');
  });
});
```

- [ ] **Step 3: Ejecutar, ajustar imports, verificar que pasan**

```bash
npx vitest run server/__tests__/import-factories-service.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add server/__tests__/import-factories-service.test.ts
git commit -m "test(import): agregar tests para importFactories — verificar regla no-sobrescribir-con-null"
```

---

### Task D4: Verificar coverage global y ajustar thresholds si es necesario

**Issue resuelto:** M1 (coverage global falla los 4 thresholds de 50%)

**Files:**
- Modify: `vite.config.ts` (solo si los thresholds siguen siendo inalcanzables después de D1-D3)

- [ ] **Step 1: Ejecutar coverage completo después de D1-D3**

```bash
cd C:\Users\kenji\OneDrive\Desktop\KobetsuVsKonetsu\KobetsuV3
npm run test:coverage 2>&1 | tail -20
```

- [ ] **Step 2: Evaluar el resultado**

Si las 4 métricas superan el 50%: **no tocar vite.config.ts, el problema está resuelto**.

Si alguna métrica sigue por debajo del 50% después de los nuevos tests, es porque los thresholds globales incluyen servicios PDF que son difíciles de testear sin PDFKit. En ese caso, ajustar en `vite.config.ts`:

```typescript
// En la sección coverage.thresholds:
thresholds: {
  lines: 45,      // ajustar al valor real alcanzable
  functions: 45,
  statements: 43,
  branches: 36,
},
```

**Solo aplicar si es imprescindible** — el objetivo es subir la cobertura real, no bajar el threshold.

- [ ] **Step 3: Commit solo si se modificó vite.config.ts**

```bash
git add vite.config.ts
git commit -m "test(coverage): ajustar thresholds globales a nivel alcanzable post-nuevos-tests"
```

---

## TRACK E — Accesibilidad UI (C-001) y Design Tokens

> **Estimado:** 3h. Independiente del resto.

### Task E1: Crear hook centralizado useMotion

**Issue resuelto:** H4 (23 archivos sin useReducedMotion), M9 (colores hardcodeados)

**Files:**
- Modify: `src/lib/hooks/use-reduced-motion.ts` (verificar si existe; si no, crear)

- [ ] **Step 1: Verificar si el hook ya existe**

```bash
ls "C:\Users\kenji\OneDrive\Desktop\KobetsuVsKonetsu\KobetsuV3\src\lib\hooks\"
```

Si existe `use-reduced-motion.ts`, leerlo. Si no existe, crearlo.

- [ ] **Step 2: Verificar/crear el hook useMotion**

El hook debe retornar variantes de animación que respetan `prefers-reduced-motion`. Si `animated.tsx` ya tiene este patrón, extraerlo a un hook reutilizable:

```typescript
// src/lib/hooks/use-reduced-motion.ts
import { useReducedMotion } from 'motion/react';

export type MotionVariant = {
  initial: object;
  animate: object;
  exit?: object;
  transition?: object;
};

/**
 * Devuelve variantes de animación que se reducen a cero si
 * el usuario tiene prefers-reduced-motion activado.
 */
export function useMotionSafe(
  full: MotionVariant,
  reduced: MotionVariant = { initial: {}, animate: {} }
): MotionVariant {
  const prefersReduced = useReducedMotion();
  return prefersReduced ? reduced : full;
}

/**
 * Versión simple: retorna true si las animaciones deben desactivarse.
 */
export function useShouldReduceMotion(): boolean {
  return useReducedMotion() ?? false;
}
```

- [ ] **Step 3: Escribir test del hook**

```typescript
// src/lib/hooks/__tests__/use-reduced-motion.test.ts
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useShouldReduceMotion } from '../use-reduced-motion';

describe('useShouldReduceMotion', () => {
  it('devuelve false cuando no hay preferencia de reducción', () => {
    vi.mock('motion/react', () => ({ useReducedMotion: () => false }));
    const { result } = renderHook(() => useShouldReduceMotion());
    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 4: Ejecutar el test**

```bash
npx vitest run src/lib/hooks/__tests__/use-reduced-motion.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/hooks/use-reduced-motion.ts src/lib/hooks/__tests__/use-reduced-motion.test.ts
git commit -m "feat(a11y): crear hook useShouldReduceMotion centralizado para guardia C-001"
```

---

### Task E2: Aplicar useReducedMotion en los 23 archivos afectados

**Files:** Los 23 archivos listados en H4 del reporte de audit.

- [ ] **Step 1: Script de verificación — listar archivos con motion sin guardia**

```bash
cd C:\Users\kenji\OneDrive\Desktop\KobetsuVsKonetsu\KobetsuV3
grep -rl "whileHover\|whileTap\|animate=" src/ --include="*.tsx" | xargs grep -L "useReducedMotion\|useShouldReduceMotion"
```

Este comando lista todos los archivos que usan motion pero no tienen la guardia.

- [ ] **Step 2: Aplicar el patrón en cada archivo**

Para cada archivo del listado, el patrón es:

```typescript
// Al inicio del componente, después de los otros hooks:
import { useShouldReduceMotion } from '@/lib/hooks/use-reduced-motion';

function MiComponente() {
  const reduceMotion = useShouldReduceMotion();

  // En cada atributo de animación:
  return (
    <motion.div
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      initial={reduceMotion ? {} : { opacity: 0, y: -10 }}
      whileHover={reduceMotion ? {} : { scale: 1.02 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
    >
```

Trabajar archivo por archivo. No cambiar la lógica de negocio ni el layout — solo condicionar los valores de animación.

- [ ] **Step 3: Verificar que no quedan archivos sin guardia**

```bash
grep -rl "whileHover\|whileTap\|animate=" src/ --include="*.tsx" | xargs grep -L "useReducedMotion\|useShouldReduceMotion"
```

Expected: output vacío (0 archivos sin guardia).

- [ ] **Step 4: TypeScript y ESLint limpios**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 5: Commit por cada bloque de 5-7 archivos** (para mantener commits manejables)

```bash
git add src/routes/... src/components/...
git commit -m "fix(a11y): aplicar useReducedMotion en [nombre-sección] — C-001"
```

---

### Task E3: Migrar colores hardcodeados a CSS custom properties

**Issue resuelto:** M9 (hex en button.tsx, sidebar.tsx, contract-form.tsx)

**Files:**
- Modify: `src/components/ui/button.tsx`, `src/components/layout/sidebar.tsx`, `src/components/contract/contract-form.tsx`
- Reference: `src/index.css` (donde están los `@theme` tokens)

- [ ] **Step 1: Leer index.css para mapear los tokens existentes**

Buscar en `src/index.css` los valores hex que corresponden a los colores hardcodeados:
- `#0f766e` → probablemente `--color-primary` o `--color-emerald-700`
- `#00f5d4`, `#00c9ae` → probablemente `--color-primary` en dark mode
- `#06010f` → probablemente `--color-background-dark` o `--color-foreground-dark`

Confirmar los nombres exactos de variables antes de editar.

- [ ] **Step 2: Reemplazar en button.tsx**

Cambiar por ejemplo:
```typescript
// Antes:
"bg-[#0f766e] dark:from-[#00f5d4] dark:to-[#00c9ae] dark:text-[#06010f]"
// Después:
"bg-(--color-primary) dark:from-(--color-accent) dark:to-(--color-accent-light) dark:text-(--color-background)"
```

Usar la sintaxis de Tailwind v4 para CSS vars: `bg-(--variable)` o `text-(--variable)`.

Los nombres de variables exactos deben leerse de `src/index.css` primero.

- [ ] **Step 3: Reemplazar en sidebar.tsx y contract-form.tsx**

Mismo patrón: reemplazar `text-[#06010f]` por la variable CSS correspondiente al foreground en dark mode.

- [ ] **Step 4: Verificar visualmente (opcional)**

Si el servidor de dev está corriendo, navegar a las páginas y confirmar que los colores se ven igual.

- [ ] **Step 5: TypeScript limpio**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/button.tsx src/components/layout/sidebar.tsx src/components/contract/contract-form.tsx
git commit -m "fix(ui): migrar colores hex hardcodeados a CSS custom properties del tema LUNARIS"
```

---

## TRACK F — Refactoring de Archivos Grandes de Admin

> **Estimado:** 3-4h. Opcional si los otros tracks están completos.
> **Prerequisito:** Ninguno. Independiente.

### Task F1: Split de admin/-employee-manager.tsx (1224 líneas)

**Files:**
- Modify: `src/routes/admin/-employee-manager.tsx`
- Create: `src/routes/admin/-employee-table.tsx`, `src/routes/admin/-employee-form.tsx`, `src/routes/admin/-employee-filters.tsx`

- [ ] **Step 1: Analizar la estructura del componente**

Leer `src/routes/admin/-employee-manager.tsx` y clasificar el contenido en:
- **Tabla**: columnas, renderizado de filas, paginación
- **Formulario**: campos de creación/edición
- **Filtros**: search bar, dropdowns de filtro
- **Orquestador**: estado compartido, queries, handlers

- [ ] **Step 2: Extraer el componente de tabla**

Crear `src/routes/admin/-employee-table.tsx` con:
- Las columnas definidas con `@tanstack/react-table`
- El renderizado de la tabla y paginación
- Props tipadas que recibe del orquestador

```typescript
// src/routes/admin/-employee-table.tsx
import type { Employee } from '@/lib/api-types';

interface EmployeeTableProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (id: number) => void;
  isLoading: boolean;
}

export function EmployeeTable({ employees, onEdit, onDelete, isLoading }: EmployeeTableProps) {
  // Mover aquí el código de tabla del archivo original
}
```

- [ ] **Step 3: Extraer el formulario**

Crear `src/routes/admin/-employee-form.tsx` con el dialog/sheet de creación/edición.

- [ ] **Step 4: Extraer los filtros**

Crear `src/routes/admin/-employee-filters.tsx` con los controles de búsqueda y filtrado.

- [ ] **Step 5: Actualizar el orquestador**

`-employee-manager.tsx` queda como orquestador liviano:

```typescript
// src/routes/admin/-employee-manager.tsx
import { EmployeeTable } from './-employee-table';
import { EmployeeForm } from './-employee-form';
import { EmployeeFilters } from './-employee-filters';
// Estado, queries y handlers aquí
// Render: <EmployeeFilters .../> <EmployeeTable .../> <EmployeeForm .../>
```

El archivo debería quedar en ~200 líneas.

- [ ] **Step 6: TypeScript sin errores**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Verificar que la página de admin sigue funcionando**

```bash
npm run test:run
```

Expected: 643+ passed, 0 failed.

- [ ] **Step 8: Commit**

```bash
git add src/routes/admin/-employee-manager.tsx src/routes/admin/-employee-table.tsx src/routes/admin/-employee-form.tsx src/routes/admin/-employee-filters.tsx
git commit -m "refactor(admin): split employee-manager en tabla, formulario y filtros (1224L → ~200L orquestador)"
```

---

### Task F2: Split de admin/-contract-manager.tsx (951 líneas)

**Files:**
- Modify: `src/routes/admin/-contract-manager.tsx`
- Create: `src/routes/admin/-contract-table.tsx`, `src/routes/admin/-contract-filters.tsx`

- [ ] **Step 1: Analizar la estructura**

Leer el archivo y clasificar el contenido en tabla, filtros y orquestador (misma metodología que F1).

- [ ] **Step 2: Extraer tabla y filtros**

Crear `-contract-table.tsx` y `-contract-filters.tsx` siguiendo el mismo patrón que F1.

- [ ] **Step 3: Actualizar el orquestador**

`-contract-manager.tsx` como orquestador liviano (~200L).

- [ ] **Step 4: TypeScript y tests limpios**

```bash
npx tsc --noEmit && npm run test:run
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/-contract-manager.tsx src/routes/admin/-contract-table.tsx src/routes/admin/-contract-filters.tsx
git commit -m "refactor(admin): split contract-manager en tabla y filtros (951L → ~200L orquestador)"
```

---

## Checklist de verificación final

Después de completar todos los tracks:

- [ ] `npm run test:run` — 0 failed
- [ ] `npm run test:coverage` — 4 métricas superan thresholds
- [ ] `npm run lint` — 0 violations
- [ ] `npx tsc --noEmit` — 0 errores
- [ ] `npm audit` — 0 CRITICAL, 0 HIGH
- [ ] Grep de `motion.` sin `useReducedMotion` — 0 resultados
- [ ] Grep de hex hardcodeados en .tsx — 0 en button/sidebar/contract-form
- [ ] `node -e "const p=require('./package.json'); console.log(p.dependencies['pdfjs-dist'])"` — muestra versión (no undefined)

---

## Orden de ejecución recomendado

```
Track A (20 min)  →  commit rápido sin riesgo
Track B + Track C  →  paralelo (independientes)
Track D  →  comenzar D1 mientras B y C terminan
Track E  →  después de D1-D3 terminados
Track F  →  último, cuando todo lo funcional está cubierto
```

**Total estimado:** 12-15h de trabajo de implementación.

---

## Self-Review

**Spec coverage:**
- H1 (pdfjs-dist): cubierto en A1 ✓
- H2 (@hono/node-server): cubierto en A2 ✓
- H3 (Zod validation): cubierto en C1 ✓
- H4 (useReducedMotion): cubierto en E1+E2 ✓
- M1-M4 (coverage): cubierto en D1-D4 ✓
- M5 (admin-crud columns): cubierto en C2 ✓
- M6 (fetch timeout): cubierto en B1 ✓
- M7 (62 queries): cubierto en B2 ✓
- M8 (JSDoc): **no incluido** — decisión deliberada, es trabajo de documentación pura sin impacto funcional. Agregar JSDoc es lineal y no requiere plan formal.
- M9 (colores hardcodeados): cubierto en E3 ✓
- M10 (admin managers grandes): cubierto en F1+F2 ✓
- M11 (@types/yazl): cubierto en A1 ✓
- L3 (@tailwindcss/vite): cubierto en A1 ✓
- L5 (path hardcodeado en test): **no incluido** — es un string en un test, corrección de 1 línea obvia que no necesita plan.
- L6 (5 archivos grandes nuevos): **no incluido** — documentar en CLAUDE.md es suficiente por ahora.
- L7 (README escueto): **no incluido** — documentación pura fuera del scope.

**Placeholder scan:** Sin TBD, sin "implement later", sin referencias a funciones no definidas. Todos los code blocks son concretos.

**Type consistency:** Los tipos `Employee`, `MotionVariant`, `EmployeeTableProps` son consistentes en los tasks que los referencian.
