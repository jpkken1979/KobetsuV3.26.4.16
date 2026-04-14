# Database Reset — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar `POST /api/admin/reset-all` que borra todos los datos operativos en una transacción SQLite atómica, más la Danger Zone UI en Settings con confirmación por texto.

**Architecture:** Backend: ruta Hono con validación Zod + transacción SQLite (hijos antes padres) + entrada en audit_log. Frontend: sección Danger Zone al final de Settings con ConfirmDialog extendido (input de texto "RESET"), counts actuales desde `/api/dashboard/stats`, redirect post-reset. TDD: tests primero con mini Hono app + rollback por transacción para aislamiento.

**Tech Stack:** Hono 4.12, Drizzle ORM + better-sqlite3 (sync), Zod 4, React 19, React Query 5, TanStack Router, Sonner toasts, `motion/react`.

---

## File Map

| Archivo | Acción | Propósito |
|---------|--------|-----------|
| `server/__tests__/admin-reset.test.ts` | Create | Tests TDD del endpoint |
| `server/routes/admin-reset.ts` | Create | POST /api/admin/reset-all |
| `server/index.ts` | Modify | Registrar adminResetRouter en línea ~114 |
| `src/lib/api-types.ts` | Modify | Agregar ResetAllResponse interface |
| `src/lib/api.ts` | Modify | Agregar resetAllData method |
| `src/routes/settings/index.tsx` | Modify | Sección Danger Zone + lógica de reset |

---

## Task 1: Tests del endpoint (TDD)

**Files:**
- Create: `server/__tests__/admin-reset.test.ts`

Los tests usan una mini-app Hono directa (sin adminGuard) para testear la lógica de negocio. El aislamiento se logra con `sqlite.exec("BEGIN")` / `sqlite.exec("ROLLBACK")` por test — las deletes del reset quedan en una savepoint que se revierte en afterEach.

**Nota sobre ADMIN_TOKEN**: El adminGuardMiddleware solo actúa sobre paths `/api/admin/*` y lee `ADMIN_TOKEN` a nivel de módulo. La mini-app de tests bypassa el guard deliberadamente para aislar la lógica del endpoint. El comportamiento del guard (401/503) está cubierto por los tests del middleware existente.

- [ ] **Step 1: Crear el archivo de test con setup**

Crear `server/__tests__/admin-reset.test.ts`:

```typescript
/**
 * Integration tests for POST /api/admin/reset-all
 *
 * Usa una mini Hono app que bypassa adminGuardMiddleware para testear
 * exclusivamente la lógica de negocio del endpoint.
 * Aislamiento: sqlite BEGIN/ROLLBACK wrappea cada test.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { db, sqlite } from "../db/index.js";
import {
  clientCompanies,
  factories,
  employees,
  contracts,
  contractEmployees,
  shiftTemplates,
  factoryCalendars,
  pdfVersions,
  auditLog,
} from "../db/schema.js";
import { count } from "drizzle-orm";

// ─── Setup: mini Hono app + aislamiento por transacción ─────────────────────

// Import lazy para que adminResetRouter exista cuando corremos los tests
// (el archivo todavía no existe — estos tests deben FALLAR primero)
let adminResetRouter: Hono;
try {
  const mod = await import("../routes/admin-reset.js");
  adminResetRouter = mod.adminResetRouter;
} catch {
  adminResetRouter = new Hono(); // placeholder vacío — tests fallarán
}

const testApp = new Hono();
testApp.route("/reset-all", adminResetRouter);

const postReset = (body: unknown) =>
  testApp.fetch(
    new Request("http://localhost/reset-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

// ─── Aislamiento: cada test en su propia transacción que se revierte ─────────

beforeEach(() => {
  sqlite.exec("BEGIN");
});

afterEach(() => {
  sqlite.exec("ROLLBACK");
});

// ─── Helper: insertar datos mínimos para testear el reset ────────────────────

function insertTestData() {
  const company = db
    .insert(clientCompanies)
    .values({ name: "テスト会社" })
    .returning()
    .get();
  const factory = db
    .insert(factories)
    .values({ companyId: company.id, factoryName: "テスト工場" })
    .returning()
    .get();
  db.insert(employees)
    .values({ fullName: "テスト社員", companyId: company.id, factoryId: factory.id })
    .run();
  db.insert(shiftTemplates)
    .values({ name: "テストシフト", workHours: "08:00-17:00", breakMinutes: 60 })
    .run();
  return { companyId: company.id, factoryId: factory.id };
}
```

- [ ] **Step 2: Agregar test — 200 con conteos correctos**

Agregar al final del archivo:

```typescript
// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /reset-all — lógica de negocio", () => {
  it("returns 200 with correct deleted counts", async () => {
    insertTestData();

    const res = await postReset({ confirm: "RESET" });
    expect(res.status).toBe(200);

    const body = await res.json() as {
      success: boolean;
      deleted: Record<string, number>;
    };
    expect(body.success).toBe(true);
    expect(body.deleted).toHaveProperty("clientCompanies");
    expect(body.deleted).toHaveProperty("factories");
    expect(body.deleted).toHaveProperty("employees");
    expect(body.deleted).toHaveProperty("contracts");
    expect(body.deleted).toHaveProperty("contractEmployees");
    expect(body.deleted).toHaveProperty("factoryCalendars");
    expect(body.deleted).toHaveProperty("shiftTemplates");
    expect(body.deleted).toHaveProperty("pdfVersions");
    expect(body.deleted.clientCompanies).toBeGreaterThanOrEqual(1);
    expect(body.deleted.employees).toBeGreaterThanOrEqual(1);
    expect(body.deleted.shiftTemplates).toBeGreaterThanOrEqual(1);
  });
```

- [ ] **Step 3: Agregar test — 400 body inválido**

```typescript
  it("returns 400 when confirm field is wrong string", async () => {
    const res = await postReset({ confirm: "YES" });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("Confirmación inválida");
  });

  it("returns 400 when confirm field is missing", async () => {
    const res = await postReset({});
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(typeof body.error).toBe("string");
  });

  it("returns 400 when body is empty string", async () => {
    const res = await testApp.fetch(
      new Request("http://localhost/reset-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
  });
```

- [ ] **Step 4: Agregar test — tablas vacías post-reset**

```typescript
  it("leaves all 8 tables empty after successful reset", async () => {
    insertTestData();

    const res = await postReset({ confirm: "RESET" });
    expect(res.status).toBe(200);

    const [ccCount] = await db.select({ n: count() }).from(clientCompanies);
    const [fCount] = await db.select({ n: count() }).from(factories);
    const [empCount] = await db.select({ n: count() }).from(employees);
    const [cCount] = await db.select({ n: count() }).from(contracts);
    const [ceCount] = await db.select({ n: count() }).from(contractEmployees);
    const [stCount] = await db.select({ n: count() }).from(shiftTemplates);
    const [fcCount] = await db.select({ n: count() }).from(factoryCalendars);
    const [pvCount] = await db.select({ n: count() }).from(pdfVersions);

    expect(ccCount.n).toBe(0);
    expect(fCount.n).toBe(0);
    expect(empCount.n).toBe(0);
    expect(cCount.n).toBe(0);
    expect(ceCount.n).toBe(0);
    expect(stCount.n).toBe(0);
    expect(fcCount.n).toBe(0);
    expect(pvCount.n).toBe(0);
  });
```

- [ ] **Step 5: Agregar test — audit_log tiene entrada del reset**

```typescript
  it("writes a reset entry to audit_log with entityType ALL_TABLES", async () => {
    insertTestData();

    const [beforeCount] = await db.select({ n: count() }).from(auditLog);
    await postReset({ confirm: "RESET" });
    const [afterCount] = await db.select({ n: count() }).from(auditLog);

    expect(afterCount.n).toBe(beforeCount.n + 1);

    const allLogs = await db.select().from(auditLog).all();
    const resetEntry = allLogs.find((l) => l.entityType === "ALL_TABLES");
    expect(resetEntry).toBeDefined();
    expect(resetEntry?.action).toBe("delete");
    expect(resetEntry?.userName).toBe("admin");
    expect(resetEntry?.detail).toBeTruthy();

    // detail debe ser JSON con los conteos
    const detail = JSON.parse(resetEntry!.detail!) as Record<string, number>;
    expect(detail).toHaveProperty("clientCompanies");
    expect(detail).toHaveProperty("employees");
  });
```

- [ ] **Step 6: Agregar test — audit_log preexistente NO se borra**

```typescript
  it("does NOT delete pre-existing audit_log entries", async () => {
    // Insertar una entrada de audit_log ANTES del reset
    db.insert(auditLog).values({
      action: "create",
      entityType: "employees",
      entityId: 1,
      detail: "pre-existing entry",
      userName: "system",
    }).run();

    insertTestData();

    await postReset({ confirm: "RESET" });

    const allLogs = await db.select().from(auditLog).all();
    const preExisting = allLogs.find((l) => l.entityType === "employees" && l.detail === "pre-existing entry");
    expect(preExisting).toBeDefined();
  });
});
```

- [ ] **Step 7: Ejecutar tests — deben FALLAR (archivo no existe)**

```bash
cd "C:\Users\kenji\OneDrive\Desktop\KobetsuVsKonetsu\KobetsuV3"
npx vitest run server/__tests__/admin-reset.test.ts 2>&1 | tail -20
```

Esperado: FAIL — "Cannot find module '../routes/admin-reset.js'" o similar.

---

## Task 2: Backend — `server/routes/admin-reset.ts` + registro

**Files:**
- Create: `server/routes/admin-reset.ts`
- Modify: `server/index.ts` (línea ~114)

- [ ] **Step 1: Crear `server/routes/admin-reset.ts`**

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { db, sqlite } from "../db/index.js";
import {
  contractEmployees,
  pdfVersions,
  contracts,
  factoryCalendars,
  employees,
  shiftTemplates,
  factories,
  clientCompanies,
  auditLog,
} from "../db/schema.js";
import { count } from "drizzle-orm";

export const adminResetRouter = new Hono();

const resetSchema = z.object({ confirm: z.literal("RESET") });

adminResetRouter.post("/", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "Confirmación inválida" }, 400);
  }

  const parsed = resetSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: "Confirmación inválida" }, 400);
  }

  try {
    // Contar filas antes de borrar (sync con better-sqlite3 + Drizzle)
    const [ceResult] = db.select({ n: count() }).from(contractEmployees).all();
    const [pvResult] = db.select({ n: count() }).from(pdfVersions).all();
    const [cResult] = db.select({ n: count() }).from(contracts).all();
    const [fcResult] = db.select({ n: count() }).from(factoryCalendars).all();
    const [empResult] = db.select({ n: count() }).from(employees).all();
    const [stResult] = db.select({ n: count() }).from(shiftTemplates).all();
    const [fResult] = db.select({ n: count() }).from(factories).all();
    const [ccResult] = db.select({ n: count() }).from(clientCompanies).all();

    const deletedCounts = {
      contractEmployees: ceResult?.n ?? 0,
      pdfVersions: pvResult?.n ?? 0,
      contracts: cResult?.n ?? 0,
      factoryCalendars: fcResult?.n ?? 0,
      employees: empResult?.n ?? 0,
      shiftTemplates: stResult?.n ?? 0,
      factories: fResult?.n ?? 0,
      clientCompanies: ccResult?.n ?? 0,
    };

    // Borrar en orden: hijos antes que padres (FK integrity)
    sqlite.transaction(() => {
      db.delete(contractEmployees).run();
      db.delete(pdfVersions).run();
      db.delete(contracts).run();
      db.delete(factoryCalendars).run();
      db.delete(employees).run();
      db.delete(shiftTemplates).run();
      db.delete(factories).run();
      db.delete(clientCompanies).run();
    })();

    // Registrar en audit_log (post-transacción, fuera del try de transacción)
    db.insert(auditLog)
      .values({
        action: "delete",
        entityType: "ALL_TABLES",
        entityId: null,
        detail: JSON.stringify(deletedCounts),
        userName: "admin",
      })
      .run();

    return c.json({ success: true, deleted: deletedCounts });
  } catch (err: unknown) {
    return c.json(
      { error: err instanceof Error ? err.message : "Reset failed" },
      500,
    );
  }
});
```

- [ ] **Step 2: Registrar la ruta en `server/index.ts`**

Agregar el import al bloque de imports de admin routes (cerca de la línea 22-24):

```typescript
import { adminResetRouter } from "./routes/admin-reset.js";
```

Agregar la ruta al bloque de routes de admin (después de línea 113 `api.route("/admin/backup", adminBackupRouter);`):

```typescript
api.route("/admin/reset-all", adminResetRouter);
```

- [ ] **Step 3: Ejecutar los tests — deben PASAR ahora**

```bash
npx vitest run server/__tests__/admin-reset.test.ts 2>&1 | tail -20
```

Esperado: todos los tests pasan (6 tests).

Si algún test falla, leer el error y corregir `admin-reset.ts` antes de continuar.

- [ ] **Step 4: Commit**

```bash
git add server/routes/admin-reset.ts server/index.ts server/__tests__/admin-reset.test.ts
git commit -m "feat(admin): endpoint POST /api/admin/reset-all con transacción atómica + tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: API types + client method

**Files:**
- Modify: `src/lib/api-types.ts` (cerca de línea 422 — junto a DashboardStats)
- Modify: `src/lib/api.ts` (cerca de línea 242 — junto a getDashboardStats)

- [ ] **Step 1: Agregar `ResetAllResponse` a `src/lib/api-types.ts`**

Buscar la sección de `DashboardStats` (línea ~422) y agregar DESPUÉS:

```typescript
export interface ResetAllDeletedCounts {
  clientCompanies: number;
  factories: number;
  employees: number;
  contracts: number;
  contractEmployees: number;
  factoryCalendars: number;
  shiftTemplates: number;
  pdfVersions: number;
}

export interface ResetAllResponse {
  success: true;
  deleted: ResetAllDeletedCounts;
}
```

- [ ] **Step 2: Agregar `resetAllData` a `src/lib/api.ts`**

Agregar el import de los tipos nuevos (buscar la línea donde se importa `DashboardStats` y agregar junto a ella):

```typescript
  ResetAllResponse,
```

Luego agregar el method cerca de `getDashboardStats` (línea ~242):

```typescript
  resetAllData: (body: { confirm: string }) =>
    request<ResetAllResponse>("/admin/reset-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
```

**Nota:** El header `x-admin-token` ya está incluido globalmente en el `request()` helper de `api.ts` (o se agrega inline). Verificar si `buildHeaders()` incluye `x-admin-token` automáticamente:

```bash
grep -n "x-admin-token\|buildHeaders\|ADMIN_TOKEN" src/lib/api.ts | head -10
```

Si NO hay header automático: agregar `"x-admin-token": import.meta.env.VITE_ADMIN_TOKEN ?? ""` en los headers. Si SÍ hay header automático: no agregar nada extra.

- [ ] **Step 3: Verificar typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-types.ts src/lib/api.ts
git commit -m "feat(api): agregar ResetAllResponse type y método resetAllData

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Frontend — Danger Zone en Settings

**Files:**
- Modify: `src/routes/settings/index.tsx` (al final, antes de `</motion.section>` en línea 631)

La sección Danger Zone muestra los counts actuales del DB, un botón "Borrar todo" que abre un ConfirmDialog con input de texto. El usuario debe escribir `RESET` exacto para habilitar el botón de confirmación. Post-reset: toast + invalidar todas las queries + redirect a `/` en 1.5s.

- [ ] **Step 1: Agregar imports faltantes**

En `src/routes/settings/index.tsx`, actualizar estas líneas de imports:

```typescript
// Cambiar:
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

// Por:
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
```

- [ ] **Step 2: Agregar imports de tipos**

El tipo `ResetAllResponse` ya está en `src/lib/api-types.ts`. No necesita import directo en settings (se infiere desde `api.resetAllData`).

Verificar que `AlertTriangle`, `Trash2`, `Database` ya están en los imports de lucide. Son necesarios para la Danger Zone. Si alguno falta, agregar al bloque de lucide imports existente.

- [ ] **Step 3: Agregar estado y lógica de reset en el componente `SettingsPage`**

Dentro de `function SettingsPage()`, después de las líneas existentes de `const queryClient = useQueryClient();`, agregar:

```typescript
const navigate = useNavigate();

// Estado para el diálogo de reset
const [showResetDialog, setShowResetDialog] = useState(false);
const [resetConfirmText, setResetConfirmText] = useState("");

// Query de stats para mostrar conteos actuales
const { data: dbStats } = useQuery({
  queryKey: queryKeys.dashboard.stats(),
  queryFn: () => api.getDashboardStats(),
  staleTime: 30_000,
});

// Mutación de reset
const resetMutation = useMutation({
  mutationFn: () => api.resetAllData({ confirm: "RESET" }),
  onSuccess: (data) => {
    const d = data.deleted;
    toast.success(
      `Base de datos reseteada. Se borraron ${d.contracts} contratos, ${d.employees} empleados, ${d.clientCompanies} empresas.`,
    );
    void queryClient.invalidateQueries();
    setShowResetDialog(false);
    setResetConfirmText("");
    setTimeout(() => {
      void navigate({ to: "/" });
    }, 1500);
  },
  onError: (err: unknown) => {
    const message = err instanceof Error ? err.message : "Error al resetear la base de datos";
    toast.error(message);
  },
});
```

- [ ] **Step 4: Agregar la sección Danger Zone en el JSX**

En `src/routes/settings/index.tsx`, localizar la línea con `</motion.section>` que cierra la última sección (línea ~631). Agregar ANTES de ese cierre:

```tsx
      {/* ─── Danger Zone ─────────────────────────────────────── */}
      <motion.section
        initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? undefined : { duration: 0.3, delay: 0.35 }}
        className="space-y-4"
      >
        <div className="border border-destructive/30 rounded-2xl p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <h2 className="text-sm font-semibold text-destructive">Zona de peligro</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Estas acciones son irreversibles. El audit log se conserva.
          </p>

          {/* Reset card */}
          <div className="flex items-start justify-between gap-4 rounded-xl bg-muted/30 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-destructive/10 p-2 shrink-0 mt-0.5">
                <Database className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Reset completo de base de datos</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Borra todos los contratos, empleados, empresas y fábricas.
                  {dbStats && (
                    <span className="ml-1 text-muted-foreground/70">
                      ({dbStats.totalContracts} contratos · {dbStats.activeEmployees} empleados · {dbStats.companies} empresas · {dbStats.factories} fábricas)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowResetDialog(true)}
              className="shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Borrar todo
            </Button>
          </div>
        </div>

        {/* ConfirmDialog con input RESET */}
        <ConfirmDialog
          open={showResetDialog}
          onClose={() => {
            setShowResetDialog(false);
            setResetConfirmText("");
          }}
          onConfirm={() => resetMutation.mutate()}
          title="Reset total de base de datos"
          description={`Esta acción borrará TODOS los datos operativos (${dbStats?.totalContracts ?? 0} contratos, ${dbStats?.activeEmployees ?? 0} empleados, ${dbStats?.companies ?? 0} empresas, ${dbStats?.factories ?? 0} fábricas). El audit log se conserva. Esta operación es irreversible.`}
          confirmLabel="Confirmar borrado"
          variant="destructive"
          isPending={resetMutation.isPending}
          confirmDisabled={resetConfirmText !== "RESET" || resetMutation.isPending}
          extraContent={
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Escribí <span className="font-mono font-bold text-foreground">RESET</span> para confirmar:
              </p>
              <input
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-mono focus:border-destructive/50 focus:outline-none"
                placeholder="RESET"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          }
        />
      </motion.section>
```

**Nota:** Esta sección es una `motion.section` NUEVA, independiente de la sección de Modo Developer. Se agrega DESPUÉS de que cierra la sección anterior con `</motion.section>` pero ANTES del cierre de `</AnimatedPage>`.

Estructura final del JSX:
```
<AnimatedPage>
  <PageHeader ... />
  <motion.section> ... </motion.section>  {/* Backup */}
  <motion.section> ... </motion.section>  {/* Conflict Warning */}
  <motion.section> ... </motion.section>  {/* Bulk Calendar */}
  <motion.section> ... </motion.section>  {/* System Info */}
  <motion.section> ... </motion.section>  {/* Modo Developer */}
  <motion.section> ... </motion.section>  {/* ← NUEVA: Danger Zone */}
</AnimatedPage>
```

- [ ] **Step 5: Verificar typecheck y lint**

```bash
npm run typecheck 2>&1 | tail -10
npm run lint 2>&1 | tail -10
```

Esperado: 0 errores.

Errores comunes y soluciones:
- `Property 'totalContracts' does not exist on type 'DashboardStats'` → Verificar que `DashboardStats` en `api-types.ts` tiene `totalContracts`. Si el campo se llama diferente, usar el nombre correcto.
- `useMutation` not found → Agregar al import de `@tanstack/react-query`
- `useNavigate` not found → Agregar al import de `@tanstack/react-router`

- [ ] **Step 6: Correr suite completa de tests**

```bash
npm run test:run 2>&1 | tail -15
```

Esperado: 761+ tests passing (755 anteriores + los 6 nuevos de admin-reset).

- [ ] **Step 7: Commit**

```bash
git add src/routes/settings/index.tsx src/lib/api-types.ts src/lib/api.ts
git commit -m "feat(settings): Danger Zone con reset total de base de datos

- Input RESET requerido para confirmar
- Muestra conteos actuales antes de confirmar
- Post-reset: toast + invalidar queries + redirect a /

Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step 8: Push**

```bash
git push origin master
```

---

## Notas para el implementer

- **auditLog enum**: La columna `action` tiene enum `["create", "update", "delete", "export", "import"]`. El reset usa `"delete"` con `entityType: "ALL_TABLES"` para diferenciarse de deletes normales.
- **adminGuardMiddleware** ya se aplica globalmente en `server/index.ts:51` para todos los paths `/api/admin/*` — NO agregar el guard a nivel de ruta individual.
- **DashboardStats** tiene los campos: `companies`, `factories`, `activeEmployees`, `totalContracts`, `activeContracts`, `expiringInDays`. Usar estos nombres exactos en el JSX de la Danger Zone.
- **Transacción**: `sqlite.transaction(() => { ... })()` — el `()` al final ejecuta inmediatamente (IIFE pattern de better-sqlite3).
- **Test isolation**: El `beforeEach/afterEach` con `BEGIN/ROLLBACK` envuelve TODAS las operaciones del test en una transacción. El inner `sqlite.transaction()` del reset crea un savepoint que se revierte con el ROLLBACK externo — esto es correcto y esperado.
- **No usar `p-5`** — solo `p-4` o `p-6`.
- **motion/react** — todos los `animate`, `whileHover`, etc. deben respetar `useReducedMotion()` (ya importado en settings). El patrón: `initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}`.
