# conflictDate Override + 3 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar campo `conflictDateOverride` nullable por contrato para soportar contratos históricos retroactivos, más 3 fixes de auditoría de import.

**Architecture:** Campo nullable en `contracts` table propagado a través del Zod schema → API route → Zustand store → wizard Step 2 UI → PDF resolver. Los generadores PDF no cambian: reciben el valor ya resuelto (`override ?? factory`).

**Tech Stack:** Drizzle ORM (SQLite), Hono, React 19, Zustand 5, TanStack Router, Zod 4, Vitest

---

## Mapa de archivos

| Archivo | Cambio |
|---------|--------|
| `server/db/schema.ts` | +`conflictDateOverride` column en `contracts` |
| `server/validation.ts` | +`conflictDateOverride` en `createContractSchema` |
| `server/routes/contracts.ts` | +campo en INSERT/UPDATE |
| `server/services/document-generation.ts` | Resolver `override ?? factory.conflictDate` |
| `src/lib/api-types.ts` | +`conflictDateOverride` en `Contract` interface |
| `src/stores/contract-form.ts` | +`conflictDateOverride` + `useConflictDateOverride` |
| `src/routes/contracts/new.tsx` | Toggle + date picker en Step 2 |
| `src/routes/contracts/$contractId.tsx` | Mostrar 抵触日 efectiva |
| `server/routes/documents-generate-batch-utils.ts` | Fix TS: instalar pdf-lib, tipar `PDFPage` |
| `server/services/import-factories-service.ts` | Normalizar `抵触日` Date object → ISO |
| `src/routes/companies/-import-modal.tsx` | Validar headers de sheet antes de importar |

---

## Task 1: Fix TS — instalar pdf-lib y tipar PDFPage

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `server/routes/documents-generate-batch-utils.ts:1-22`

- [ ] **Step 1: Instalar pdf-lib**

```bash
npm install pdf-lib
```

Expected: pdf-lib aparece en `dependencies` en `package.json`.

- [ ] **Step 2: Agregar import type y tipar el parámetro `p`**

Abrir `server/routes/documents-generate-batch-utils.ts` y agregar al principio:

```ts
import type { PDFPage } from "pdf-lib";
```

Luego en la línea `copied.forEach((p) => merged.addPage(p))`, cambiar a:

```ts
copied.forEach((p: PDFPage) => merged.addPage(p));
```

- [ ] **Step 3: Verificar que no hay errores en ese archivo**

```bash
npx tsc --noEmit 2>&1 | grep "batch-utils"
```

Expected: sin output (sin errores en ese archivo).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json server/routes/documents-generate-batch-utils.ts
git commit -m "fix(pdf): instalar pdf-lib y tipar PDFPage en batch-utils"
```

---

## Task 2: Fix import factories — normalizar 抵触日 Date object a ISO

**Files:**
- Modify: `server/services/import-factories-service.ts:220`

- [ ] **Step 1: Leer la línea actual**

En `server/services/import-factories-service.ts` línea 220:
```ts
conflictDate: String(row["抵触日"] || row.conflictDate || "").trim() || null,
```

- [ ] **Step 2: Reemplazar con función que normaliza Date objects**

Agregar una función helper justo antes de `buildFactoryData` (o cerca del top del archivo si ya hay helpers):

```ts
function normalizeJpDateString(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split("T")[0];
  const s = String(val).trim();
  if (!s) return null;
  // "2028/12/15" → "2028-12-15"
  const slashMatch = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) return `${slashMatch[1]}-${slashMatch[2].padStart(2,"0")}-${slashMatch[3].padStart(2,"0")}`;
  // ya está en ISO o formato desconocido → devolver tal cual
  return s;
}
```

Luego reemplazar línea 220:
```ts
conflictDate: normalizeJpDateString(row["抵触日"] ?? row.conflictDate),
```

- [ ] **Step 3: Verificar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "import-factories"
```

Expected: sin output.

- [ ] **Step 4: Commit**

```bash
git add server/services/import-factories-service.ts
git commit -m "fix(import): normalizar fecha 抵触日 de Date/slash a ISO en factory import"
```

---

## Task 3: Fix import modal — validar sheet antes de procesar

**Files:**
- Modify: `src/routes/companies/-import-modal.tsx` (~líneas 43-61)

- [ ] **Step 1: Localizar `loadSheet` en el modal**

En `src/routes/companies/-import-modal.tsx`, la función `loadSheet` (L43-L61) llama a `parseCompanySheet(worksheet)` y guarda en `setParsedRows(rows)`.

- [ ] **Step 2: Agregar validación de headers conocidos**

Reemplazar el interior de `loadSheet` para validar que la hoja tiene al menos un header esperado:

```ts
const loadSheet = useCallback(
  async (selectedFile: File, nextSheetName: string) => {
    const workbook = await loadExcelWorkbook(selectedFile);
    const worksheet = workbook.getWorksheet(nextSheetName);
    const rows = worksheet ? parseCompanySheet(worksheet) : [];

    // Validar que la hoja tiene headers reconocibles
    const EXPECTED_HEADERS = ["工場名", "部署名", "派遣先責任者氏名", "指揮命令者氏名", "会社名"];
    const firstRow = rows[0] ?? {};
    const keys = Object.keys(firstRow);
    const hasValidHeaders = EXPECTED_HEADERS.some((h) => keys.includes(h));
    if (rows.length > 0 && !hasValidHeaders) {
      setSheetError(`このシート (${nextSheetName}) はインポートに対応していません。企業データシートを選択してください。`);
      setParsedRows([]);
      setImportKind(null);
      return;
    }
    setSheetError(null);
    setParsedRows(rows);
    setImportKind(inferCompanyImportKind(nextSheetName, rows));

    // Also try to read Sheet 2 (企業情報)
    const companySheet =
      workbook.getWorksheet("企業情報") ??
      workbook.worksheets.find((ws) => ws.name.includes("企業情報"));
    if (companySheet && companySheet.name !== nextSheetName) {
      setCompanySheetData(parseCompanySheet(companySheet));
    } else {
      setCompanySheetData([]);
    }
  },
  [],
);
```

- [ ] **Step 3: Agregar state `sheetError` al componente**

En el bloque de `useState` del componente `ImportModal`, agregar:
```ts
const [sheetError, setSheetError] = useState<string | null>(null);
```

- [ ] **Step 4: Mostrar el error en el JSX**

Justo debajo del `<select>` o dropdown de sheets, agregar:
```tsx
{sheetError && (
  <p className="text-sm text-red-500 mt-1">{sheetError}</p>
)}
```

Y deshabilitar el botón de import cuando hay `sheetError`:
```tsx
disabled={!file || parsedRows.length === 0 || !!sheetError}
```

- [ ] **Step 5: Verificar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "import-modal"
```

Expected: sin output.

- [ ] **Step 6: Commit**

```bash
git add src/routes/companies/-import-modal.tsx
git commit -m "fix(import): validar headers de sheet antes de procesar factories"
```

---

## Task 4: DB Schema — agregar conflictDateOverride a contracts

**Files:**
- Modify: `server/db/schema.ts` (tabla `contracts`, después de `notificationDate`)

- [ ] **Step 1: Agregar columna en schema**

En `server/db/schema.ts`, dentro de la definición de `contracts`, después de `notificationDate: text("notification_date").notNull()`, agregar:

```ts
conflictDateOverride: text("conflict_date_override"),
```

- [ ] **Step 2: Push schema a la DB**

```bash
npm run db:push
```

Expected: mensaje de migración aplicada sin errores.

- [ ] **Step 3: Verificar que la columna existe**

```bash
npx tsx -e "import { db } from './server/db/index.ts'; const r = db.run('PRAGMA table_info(contracts)'); console.log(r);"
```

O via Drizzle Studio:
```bash
npm run db:studio
```

Buscar columna `conflict_date_override` en la tabla `contracts`.

- [ ] **Step 4: Commit**

```bash
git add server/db/schema.ts
git commit -m "feat(db): agregar columna conflict_date_override a contracts"
```

---

## Task 5: Validation schema + API route

**Files:**
- Modify: `server/validation.ts` (en `createContractSchema`)
- Modify: `server/routes/contracts.ts` (INSERT y UPDATE)

- [ ] **Step 1: Agregar campo al Zod schema**

En `server/validation.ts`, en `createContractSchema`, agregar después de `notificationDate`:

```ts
conflictDateOverride: z.string().nullable().optional(),
```

- [ ] **Step 2: Agregar campo al INSERT en contracts route**

En `server/routes/contracts.ts`, en la handler de `POST /` donde se construye el objeto para `db.insert(contracts)`, agregar:

```ts
conflictDateOverride: data.conflictDateOverride ?? null,
```

- [ ] **Step 3: Agregar campo al UPDATE**

En la handler de `PUT /:id`, en el objeto de `db.update(contracts).set(...)`, agregar:

```ts
conflictDateOverride: data.conflictDateOverride ?? null,
```

- [ ] **Step 4: Verificar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "validation|routes/contracts"
```

Expected: sin output.

- [ ] **Step 5: Commit**

```bash
git add server/validation.ts server/routes/contracts.ts
git commit -m "feat(api): aceptar conflictDateOverride en POST/PUT /api/contracts"
```

---

## Task 6: API Types + Zustand Store

**Files:**
- Modify: `src/lib/api-types.ts` (interface `Contract`)
- Modify: `src/stores/contract-form.ts` (interface `ContractFormData` + initialState + actions)

- [ ] **Step 1: Agregar campo en `Contract` interface**

En `src/lib/api-types.ts`, en la interface `Contract`, agregar después de `notificationDate`:

```ts
conflictDateOverride: string | null;
```

- [ ] **Step 2: Agregar campos en `ContractFormData`**

En `src/stores/contract-form.ts`, en la interface `ContractFormData`, en la sección Step 2 (Dates), agregar:

```ts
conflictDateOverride: string | null;
useConflictDateOverride: boolean;
```

- [ ] **Step 3: Inicializar en el estado inicial**

En el objeto `initialState` o `defaultFormData` del store, agregar:

```ts
conflictDateOverride: null,
useConflictDateOverride: false,
```

- [ ] **Step 4: Agregar acciones en el store**

En las actions del store, agregar:

```ts
setConflictDateOverride: (date: string | null) =>
  set((s) => ({ ...s, conflictDateOverride: date })),
setUseConflictDateOverride: (val: boolean) =>
  set((s) => ({ ...s, useConflictDateOverride: val, conflictDateOverride: val ? s.conflictDateOverride : null })),
```

- [ ] **Step 5: Verificar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "api-types|contract-form"
```

Expected: sin output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api-types.ts src/stores/contract-form.ts
git commit -m "feat(store): agregar conflictDateOverride al store y Contract type"
```

---

## Task 7: Wizard Step 2 — toggle + date picker

**Files:**
- Modify: `src/routes/contracts/new.tsx` (handlers de fecha + JSX del Step 2)

- [ ] **Step 1: Actualizar `handleStartDateChange` para usar override efectivo**

En `src/routes/contracts/new.tsx`, localizar `handleStartDateChange` (~L95). Reemplazar:

```ts
const conflictDate = selectedLine?.conflictDate ? new Date(selectedLine.conflictDate) : null;
```

por:

```ts
const effectiveConflict = state.useConflictDateOverride && state.conflictDateOverride
  ? new Date(state.conflictDateOverride)
  : selectedLine?.conflictDate ? new Date(selectedLine.conflictDate) : null;
```

Y usar `effectiveConflict` en `calculateEndDate(...)`.

- [ ] **Step 2: Mismo cambio en `handlePeriodChange` (~L107)**

```ts
const effectiveConflict = state.useConflictDateOverride && state.conflictDateOverride
  ? new Date(state.conflictDateOverride)
  : selectedLine?.conflictDate ? new Date(selectedLine.conflictDate) : null;
const calculated = calculateEndDate(new Date(state.startDate), period, effectiveConflict);
```

- [ ] **Step 3: Actualizar el warning de endDate > conflictDate (~L426)**

Reemplazar la condición:

```tsx
{selectedLine?.conflictDate && state.endDate > selectedLine.conflictDate && (
```

por:

```tsx
{(() => {
  const eff = state.useConflictDateOverride && state.conflictDateOverride
    ? state.conflictDateOverride
    : selectedLine?.conflictDate;
  return eff && state.endDate > eff;
})() && (
  <div className="flex items-center gap-2 text-amber-600 text-sm">
    <AlertTriangle className="h-4 w-4" />
    終了日が抵触日を超えています
  </div>
)}
```

- [ ] **Step 4: Agregar UI del toggle + date picker en el JSX de Step 2**

Localizar la línea `<span>抵触日: {selectedLine.conflictDate || "未設定"}</span>` (~L380). Reemplazar el bloque con:

```tsx
<div className="flex flex-col gap-2">
  <span className="text-sm text-muted-foreground">
    抵触日 (工場設定): {selectedLine.conflictDate || "未設定"}
  </span>
  <label className="flex items-center gap-2 text-sm cursor-pointer">
    <input
      type="checkbox"
      checked={state.useConflictDateOverride}
      onChange={(e) => wizard.setUseConflictDateOverride(e.target.checked)}
      className="rounded"
    />
    別の抵触日を使用する
  </label>
  {state.useConflictDateOverride && (
    <input
      type="date"
      value={state.conflictDateOverride ?? ""}
      onChange={(e) => wizard.setConflictDateOverride(e.target.value || null)}
      className="border rounded px-2 py-1 text-sm w-40"
    />
  )}
</div>
```

- [ ] **Step 5: Incluir `conflictDateOverride` en el payload de submit**

Localizar donde se construye el objeto para `createContract` (o `api.createContract`). Agregar:

```ts
conflictDateOverride: state.useConflictDateOverride ? state.conflictDateOverride : null,
```

- [ ] **Step 6: Verificar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "contracts/new"
```

Expected: sin output.

- [ ] **Step 7: Commit**

```bash
git add src/routes/contracts/new.tsx
git commit -m "feat(wizard): agregar toggle conflictDateOverride en Step 2"
```

---

## Task 8: PDF resolver — usar override si está seteado

**Files:**
- Modify: `server/services/document-generation.ts` (~L223)

- [ ] **Step 1: Localizar la construcción de `conflictDate` en `common`**

En `server/services/document-generation.ts`, línea ~223:

```ts
conflictDate: factory.conflictDate || "",
```

- [ ] **Step 2: Verificar que `contract` está en scope en ese punto**

Buscar cómo se llama la función que contiene L223 y confirmar que recibe el objeto `contract`. Si el contrato se pasa como parámetro, el campo `conflictDateOverride` ya estará disponible tras el Task 5.

- [ ] **Step 3: Reemplazar con resolver**

```ts
conflictDate: contract.conflictDateOverride || factory.conflictDate || "",
```

- [ ] **Step 4: Verificar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "document-generation"
```

Expected: sin output.

- [ ] **Step 5: Commit**

```bash
git add server/services/document-generation.ts
git commit -m "feat(pdf): resolver conflictDateOverride ?? factory.conflictDate en generadores"
```

---

## Task 9: Detalle de contrato — mostrar 抵触日 efectiva

**Files:**
- Modify: `src/routes/contracts/$contractId.tsx` (~sección "契約情報")

- [ ] **Step 1: Agregar fila de 抵触日 en la sección de fechas**

En `src/routes/contracts/$contractId.tsx`, en la `<Section title="契約情報">` (~L386), agregar después de `<DetailRow label="終了日" ...>`:

```tsx
{(contract.conflictDateOverride || contract.factory?.conflictDate) && (
  <DetailRow
    label="抵触日"
    value={contract.conflictDateOverride
      ? `${contract.conflictDateOverride} (個別設定)`
      : contract.factory?.conflictDate ?? ""}
  />
)}
```

- [ ] **Step 2: Verificar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "contractId"
```

Expected: sin output.

- [ ] **Step 3: Commit**

```bash
git add src/routes/contracts/\$contractId.tsx
git commit -m "feat(ui): mostrar 抵触日 efectiva en detalle de contrato"
```

---

## Task 10: Tests + build final

- [ ] **Step 1: Ejecutar test suite**

```bash
npm run test:run
```

Expected: todos los tests pasan. Si alguno falla porque el schema cambió (column nueva), actualizar los fixtures de test para incluir `conflictDateOverride: null`.

- [ ] **Step 2: Ejecutar typecheck completo**

```bash
npm run typecheck
```

Expected: los únicos errores que quedaban eran `pdf-lib` (ya fixed en Task 1) y `any` en batch-utils (ya fixed). Sin errores nuevos.

- [ ] **Step 3: Ejecutar lint**

```bash
npm run lint
```

Expected: 0 errores, 0 warnings nuevos.

- [ ] **Step 4: Build de producción**

```bash
npm run build
```

Expected: build exitoso sin errores.

- [ ] **Step 5: Commit final de cierre**

```bash
git add -A
git commit -m "test(contracts): verificar conflictDateOverride en suite — build limpio"
```

---

## Criterios de aceptación

- [ ] Contrato con `conflictDateOverride = "2022/10/01"` se crea y persiste correctamente
- [ ] `endDate` se cappea al override en el wizard (no al `conflictDate` de la fábrica)
- [ ] PDF muestra la 抵触日 del override si está seteado
- [ ] Contrato sin override funciona exactamente igual que antes (`conflictDateOverride = null`)
- [ ] Detalle del contrato muestra "(個別設定)" cuando hay override activo
- [ ] `待機中` importa como `onLeave` (ya fixeado en sesión anterior)
- [ ] `npm run typecheck` pasa sin errores nuevos
- [ ] `npm run build` pasa
- [ ] `npm run test:run` pasa
