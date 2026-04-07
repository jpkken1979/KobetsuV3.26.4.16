# Cleanup & Refactor — conflictWarningDays + Large File Split

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar `conflictWarningDays` al dashboard del servidor, y refactorizar `contracts.ts` (899 LOC) + `documents.ts` (945 LOC) extrayendo la lógica batch/generate a routers dedicados.

**Architecture:** 3 tasks completamente independientes (Task 1 no toca server/routes/contracts.ts ni documents.ts; Tasks 2+3 combinadas para gestionar el único punto de conflicto en server/index.ts). Task 1 corre en paralelo con Tasks 2+3.

**Tech Stack:** TypeScript strict, Hono 4.12, Drizzle ORM 0.38, React 19, TanStack React Query, Vitest

---

## Archivos modificados / creados

| Task | Archivos |
|------|---------|
| Task 1 (Dashboard warningDays) | `server/routes/dashboard.ts`, `src/lib/api.ts`, `src/routes/index.tsx` |
| Task 2+3 (Refactor batch/generate) | `server/routes/contracts.ts`, crear `server/routes/contracts-batch.ts`, `server/routes/documents.ts`, crear `server/routes/documents-generate.ts`, `server/index.ts` |

---

## Task 1: conflictWarningDays → dashboard /stats y /expiring

**Contexto:** `conflictWarningDays` está guardado en `localStorage` (app-settings) y se usa para alertas 抵触日. Pero `/dashboard/stats` (expiringIn30Days) y `/dashboard/expiring` hardcodean 30 días — el usuario que configura 60 días ve datos inconsistentes.

**Files:**
- Modify: `server/routes/dashboard.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/routes/index.tsx`

### Step 1: Leer dashboard.ts

- [ ] Lee `server/routes/dashboard.ts` completo.
  - Localiza `/stats` (GET) — línea ~26, busca `thirtyDaysLater` y `expiringContracts`
  - Localiza `/expiring` (GET) — línea ~81, busca `thirtyDaysLater`
  - Confirma que `clampDays` ya existe y úsalo

### Step 2: Modificar `/stats` para aceptar `warningDays`

- [ ] En el endpoint `/stats`, reemplaza el hardcode de 30 días:

```typescript
// Antes:
const thirtyDaysLater = toLocalDateStr(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

// Después:
const warningDays = clampDays(c.req.query("warningDays"), 30);
const expiryWindow = toLocalDateStr(new Date(Date.now() + warningDays * 24 * 60 * 60 * 1000));
```

Renombra `thirtyDaysLater` → `expiryWindow` en el query de `expiringContracts` también.
En el JSON de respuesta, cambia `expiringIn30Days` → `expiringInDays` (para no mentir sobre el número).

### Step 3: Modificar `/expiring` para aceptar `warningDays`

- [ ] En el endpoint `/expiring`, mismo fix:

```typescript
// Antes:
const thirtyDaysLater = toLocalDateStr(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

// Después:
const warningDays = clampDays(c.req.query("warningDays"), 30);
const expiryWindow = toLocalDateStr(new Date(Date.now() + warningDays * 24 * 60 * 60 * 1000));
```

### Step 4: Actualizar api.ts

- [ ] Lee `src/lib/api.ts` — busca `getDashboardStats` y `getExpiringContracts`
- [ ] Actualiza las funciones para aceptar y pasar `warningDays`:

```typescript
getDashboardStats: async (warningDays = 30) => {
  const res = await fetch(`${API_BASE}/dashboard/stats?warningDays=${warningDays}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<DashboardStats>;
},

getExpiringContracts: async (warningDays = 30) => {
  const res = await fetch(`${API_BASE}/dashboard/expiring?warningDays=${warningDays}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ExpiringContract[]>;
},
```

- [ ] Actualiza la interfaz `DashboardStats` si tiene `expiringIn30Days` → `expiringInDays: number`

### Step 5: Actualizar dashboard frontend (src/routes/index.tsx)

- [ ] Lee `src/routes/index.tsx` — busca el `useQuery` de `getDashboardStats` y `getExpiringContracts`
- [ ] Pasa `conflictWarningDays` a ambas queries:

```typescript
const { conflictWarningDays } = getAppSettings();

const { data: stats, isLoading } = useQuery({
  queryKey: ["dashboard", "stats", conflictWarningDays],
  queryFn: () => api.getDashboardStats(conflictWarningDays),
});

const { data: expiring = [], isLoading: loadingExpiring } = useQuery({
  queryKey: ["dashboard", "expiring", conflictWarningDays],
  queryFn: () => api.getExpiringContracts(conflictWarningDays),
});
```

- [ ] Actualiza el label del StatCard de `expiringIn30Days` → usa `stats?.expiringInDays` y el título dinámico como `${conflictWarningDays}日以内` en lugar de `"30日以内"`
  - Busca el StatCard que muestra `expiringIn30Days` y actualiza tanto el value como el title/prop que muestra "30日"

### Step 6: Typecheck + lint

- [ ] Ejecuta:
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npx tsc --noEmit && npm run lint
```
Corrige errores.

### Step 7: Commit

- [ ]
```bash
cd "D:\Git\JP個別契約書v26.3.10" && git add server/routes/dashboard.ts src/lib/api.ts src/routes/index.tsx
git commit -m "feat(dashboard): conflictWarningDays conecta /stats y /expiring al servidor

- /stats y /expiring aceptan warningDays query param (defecto 30)
- getDashboardStats y getExpiringContracts pasan conflictWarningDays
- StatCard expiringIn30Days → expiringInDays con label dinámico

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2+3: Refactor contracts.ts + documents.ts (ejecutar como UN agente)

**Contexto:** `contracts.ts` tiene 899 LOC mezclando CRUD + 445 LOC de batch creation. `documents.ts` tiene 945 LOC mezclando PDF generation + batch + catalog. La separación de concerns mejora mantenibilidad y reduce el riesgo de regresiones.

**Estrategia de split:**
- `contracts.ts` → mantiene CRUD + bulk-delete + purge (~450 LOC)
- `contracts-batch.ts` (nuevo) → batch/preview, batch, new-hires/preview, new-hires (~450 LOC)
- `documents.ts` → mantiene download/:filename, list/:contractId, labor-history, open-folder (~150 LOC)
- `documents-generate.ts` (nuevo) → generate/:contractId, keiyakusho, shugyojoken, generate-batch (~800 LOC)
- `server/index.ts` → importa y registra los 2 nuevos routers

**Files:**
- Modify: `server/routes/contracts.ts`
- Create: `server/routes/contracts-batch.ts`
- Modify: `server/routes/documents.ts`
- Create: `server/routes/documents-generate.ts`
- Modify: `server/index.ts`

### Step 1: Leer contracts.ts completo

- [ ] Lee `server/routes/contracts.ts` completo.
  - Anota líneas exactas de: imports (1-71), CRUD (72-325), batch operations (326-771), bulk/delete (772-899)
  - Identifica todos los imports usados SOLO en batch (vs usados también en CRUD)

### Step 2: Crear contracts-batch.ts

- [ ] Crea `server/routes/contracts-batch.ts`:
  - HEADER: Copia solo los imports que batch necesita (db, sqlite, schemas, services, Hono, Zod)
  - Declara `export const contractsBatchRouter = new Hono()`
  - Copia EXACTAMENTE los handlers de batch (326-771) sin modificar ninguna lógica
  - Los paths en el nuevo router son relativos a `/batch` — NO, mantener paths completos como `/batch/preview`, `/batch`, `/batch/new-hires/preview`, `/batch/new-hires`

IMPORTANTE: Los endpoints en `contractsBatchRouter` se montarán en `/contracts` (mismo prefix), por lo que los paths internos deben ser `/batch/preview` etc. (igual que en el archivo original).

### Step 3: Limpiar contracts.ts

- [ ] En `contracts.ts`:
  - Elimina los handlers de batch (líneas 326-771)
  - Elimina imports que ya no se usan (los que solo usaban los handlers batch)
  - El archivo debe quedar con CRUD + bulk-delete + purge

### Step 4: Leer documents.ts completo

- [ ] Lee `server/routes/documents.ts` completo.
  - Anota líneas exactas de: imports, generate/:contractId (254-434), keiyakusho (435-560), shugyojoken (561-664), generate-batch (665-824), download/list/catalog (825-945)
  - Identifica imports usados solo en generación vs solo en catalog/download

### Step 5: Crear documents-generate.ts

- [ ] Crea `server/routes/documents-generate.ts`:
  - HEADER: Solo imports necesarios para generación (PDFKit, fs, path, db, schemas, pdf modules)
  - Declara `export const documentsGenerateRouter = new Hono()`
  - Copia EXACTAMENTE los handlers de generación: generate/:contractId, keiyakusho/:employeeNumber, shugyojoken/:employeeNumber, generate-batch
  - Los paths se mantienen igual: `/generate/:contractId`, `/keiyakusho/:employeeNumber`, etc.

### Step 6: Limpiar documents.ts

- [ ] En `documents.ts`:
  - Elimina los handlers de generación
  - Elimina imports que ya no se usan
  - El archivo debe quedar con: download/:filename, list/:contractId, labor-history, open-folder

### Step 7: Actualizar server/index.ts

- [ ] Lee `server/index.ts` — ver imports actuales y `api.route(...)` calls
- [ ] Añade imports de los nuevos routers:

```typescript
import { contractsBatchRouter } from "./routes/contracts-batch.js";
import { documentsGenerateRouter } from "./routes/documents-generate.js";
```

- [ ] Registra los nuevos routers (DESPUÉS de los existentes en el mismo prefijo):

```typescript
api.route("/contracts", contractsBatchRouter);
api.route("/documents", documentsGenerateRouter);
```

NOTA: En Hono, múltiples routers en el mismo path prefix funcionan correctamente — los paths de batch (`/batch/*`) no colisionan con CRUD (`/`, `/:id`).

### Step 8: Typecheck

- [ ]
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npx tsc --noEmit
```
Corrige todos los errores. Los más comunes serán imports faltantes o exports incorrectos.

### Step 9: Test

- [ ]
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npm run test:run
```
Expected: ≥184 tests pasando. Si falla algún test, busca imports rotos.

### Step 10: Build

- [ ]
```bash
cd "D:\Git\JP個別契約書v26.3.10" && npm run build 2>&1 | tail -5
```

### Step 11: Commit

- [ ]
```bash
cd "D:\Git\JP個別契約書v26.3.10" && git add server/routes/contracts.ts server/routes/contracts-batch.ts server/routes/documents.ts server/routes/documents-generate.ts server/index.ts
git commit -m "refactor(routes): extraer batch/generate a routers dedicados

- contracts-batch.ts: batch/preview, batch, new-hires/preview, new-hires (~450 LOC)
- documents-generate.ts: generate/:contractId, keiyakusho, shugyojoken, generate-batch (~800 LOC)
- contracts.ts y documents.ts quedan con solo CRUD/catalog (~450 LOC c/u)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Verificación Final (ejecutar después de ambas tasks)

- [ ] `npx tsc --noEmit` — sin errores
- [ ] `npm run lint` — sin errores
- [ ] `npm run test:run` — ≥184 tests
- [ ] `npm run build` — build exitoso
