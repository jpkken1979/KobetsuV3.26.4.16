# Data Check (データ確認) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unified employee + factory audit page with traffic-light completeness, inline editing, and Excel export/import.

**Architecture:** New route `/data-check` with a dedicated API endpoint that returns employees with eager-loaded factory data and calculated completeness. Two view modes (flat table / grouped by factory). Editing uses existing PUT endpoints for employees and factories. Export/import via ExcelJS.

**Tech Stack:** React 19, TanStack Router (file-based), TanStack React Query, TanStack Virtual, Zustand (view mode), ExcelJS, Drizzle ORM, Hono, Vitest.

**Spec:** `docs/superpowers/specs/2026-03-21-data-check-design.md`

---

## File Structure

### Server (new files)
- `server/routes/data-check.ts` — GET /data-check, POST /data-check/export, POST /data-check/import
- `server/services/completeness.ts` — Traffic light calculation logic + required field lists

### Server (modify)
- `server/index.ts` — Register dataCheckRouter

### Frontend (new files)
- `src/routes/data-check/index.tsx` — Page component with stats bar, filters, view toggle
- `src/routes/data-check/-flat-view.tsx` — Wide table with TanStack Virtual
- `src/routes/data-check/-grouped-view.tsx` — Collapsible factory sections
- `src/routes/data-check/-completeness.ts` — Frontend completeness helpers (colors, labels, icons)
- `src/routes/data-check/-export-import.tsx` — Export/import modal
- `src/lib/hooks/use-data-check.ts` — React Query hooks

### Frontend (modify)
- `src/lib/api.ts` — Add getDataCheck, exportDataCheck, importDataCheck functions
- `src/lib/api-types.ts` — Add DataCheckEmployee, DataCheckResponse interfaces
- `src/lib/query-keys.ts` — Add dataCheck key factory
- `src/components/layout/sidebar.tsx` — Add データ確認 nav item

### Tests (new)
- `server/__tests__/completeness.test.ts` — Unit tests for completeness logic

---

## Task 1: Completeness Logic (Server)

**Files:**
- Create: `server/services/completeness.ts`
- Create: `server/__tests__/completeness.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// server/__tests__/completeness.test.ts
import { describe, it, expect } from "vitest";
import { calcCompleteness, REQUIRED_EMPLOYEE_FIELDS, REQUIRED_FACTORY_FIELDS } from "../services/completeness.js";

describe("calcCompleteness", () => {
  const fullEmployee = {
    fullName: "テスト太郎", katakanaName: "テストタロウ",
    nationality: "ベトナム", gender: "male", birthDate: "1995-01-01",
    billingRate: 1600, hourlyRate: 1200, factoryId: 1,
  };
  const fullFactory = {
    supervisorName: "山田", hakensakiManagerName: "鈴木",
    managerUnsName: "高橋", complaintClientName: "田中",
    complaintUnsName: "佐藤", workHours: "8:00~17:00", conflictDate: "2027-03-31",
  };

  it("returns gray when factoryId is null", () => {
    expect(calcCompleteness({ ...fullEmployee, factoryId: null }, null)).toBe("gray");
  });

  it("returns green when both employee and factory are complete", () => {
    expect(calcCompleteness(fullEmployee, fullFactory)).toBe("green");
  });

  it("returns yellow when employee OK but factory missing supervisorName", () => {
    expect(calcCompleteness(fullEmployee, { ...fullFactory, supervisorName: null })).toBe("yellow");
  });

  it("returns yellow when factory OK but employee missing nationality", () => {
    expect(calcCompleteness({ ...fullEmployee, nationality: null }, fullFactory)).toBe("yellow");
  });

  it("returns red when both incomplete", () => {
    expect(calcCompleteness(
      { ...fullEmployee, nationality: null },
      { ...fullFactory, supervisorName: null }
    )).toBe("red");
  });

  it("accepts hourlyRate as fallback when billingRate is null", () => {
    expect(calcCompleteness(
      { ...fullEmployee, billingRate: null, hourlyRate: 1200 },
      fullFactory
    )).toBe("green");
  });

  it("returns yellow when both rates are null", () => {
    expect(calcCompleteness(
      { ...fullEmployee, billingRate: null, hourlyRate: null },
      fullFactory
    )).toBe("yellow");
  });

  it("exports required field lists", () => {
    expect(REQUIRED_EMPLOYEE_FIELDS.length).toBeGreaterThan(0);
    expect(REQUIRED_FACTORY_FIELDS.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/completeness.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement completeness.ts**

```typescript
// server/services/completeness.ts
export const REQUIRED_EMPLOYEE_FIELDS = [
  "fullName", "katakanaName", "nationality", "gender", "birthDate",
] as const;

export const REQUIRED_FACTORY_FIELDS = [
  "supervisorName", "hakensakiManagerName", "managerUnsName",
  "complaintClientName", "complaintUnsName", "workHours", "conflictDate",
] as const;

type Completeness = "green" | "yellow" | "red" | "gray";

export function calcCompleteness(
  emp: Record<string, unknown>,
  factory: Record<string, unknown> | null,
): Completeness {
  if (!emp.factoryId || !factory) return "gray";

  const empOk = checkEmployeeFields(emp);
  const facOk = checkFactoryFields(factory);

  if (empOk && facOk) return "green";
  if (empOk || facOk) return "yellow";
  return "red";
}

function checkEmployeeFields(emp: Record<string, unknown>): boolean {
  for (const field of REQUIRED_EMPLOYEE_FIELDS) {
    if (!emp[field] && emp[field] !== 0) return false;
  }
  // At least one rate must exist
  if (!emp.billingRate && emp.billingRate !== 0 && !emp.hourlyRate && emp.hourlyRate !== 0) return false;
  return true;
}

function checkFactoryFields(factory: Record<string, unknown>): boolean {
  for (const field of REQUIRED_FACTORY_FIELDS) {
    if (!factory[field] && factory[field] !== 0) return false;
  }
  return true;
}

export function getMissingFields(
  emp: Record<string, unknown>,
  factory: Record<string, unknown> | null,
): { missingEmployee: string[]; missingFactory: string[] } {
  const missingEmployee: string[] = [];
  for (const field of REQUIRED_EMPLOYEE_FIELDS) {
    if (!emp[field] && emp[field] !== 0) missingEmployee.push(field);
  }
  if (!emp.billingRate && emp.billingRate !== 0 && !emp.hourlyRate && emp.hourlyRate !== 0) {
    missingEmployee.push("billingRate|hourlyRate");
  }

  const missingFactory: string[] = [];
  if (factory) {
    for (const field of REQUIRED_FACTORY_FIELDS) {
      if (!factory[field] && factory[field] !== 0) missingFactory.push(field);
    }
  }

  return { missingEmployee, missingFactory };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/completeness.test.ts`
Expected: 8/8 PASS

- [ ] **Step 5: Commit**

```bash
git add server/services/completeness.ts server/__tests__/completeness.test.ts
git commit -m "feat(data-check): agregar lógica de completitud con tests"
```

---

## Task 2: API Endpoint

**Files:**
- Create: `server/routes/data-check.ts`
- Modify: `server/index.ts` — register router

- [ ] **Step 1: Create data-check router**

```typescript
// server/routes/data-check.ts
import { Hono } from "hono";
import { db } from "../db/index.js";
import { employees } from "../db/schema.js";
import { eq, type SQL, and } from "drizzle-orm";
import { calcCompleteness, getMissingFields } from "../services/completeness.js";

export const dataCheckRouter = new Hono();

// GET /api/data-check
dataCheckRouter.get("/", async (c) => {
  try {
    const companyId = c.req.query("companyId");
    const conditions: (SQL | undefined)[] = [
      eq(employees.status, "active"),
      companyId ? eq(employees.companyId, Number(companyId)) : undefined,
    ];
    const validConditions = conditions.filter((c): c is SQL => c !== undefined);

    const results = await db.query.employees.findMany({
      where: and(...validConditions),
      orderBy: (t, { asc }) => [asc(t.fullName)],
      with: { company: true, factory: true },
    });

    const stats = { green: 0, yellow: 0, red: 0, gray: 0, total: results.length };

    const enriched = results.map((emp) => {
      const completeness = calcCompleteness(
        emp as unknown as Record<string, unknown>,
        emp.factory as unknown as Record<string, unknown> | null,
      );
      const { missingEmployee, missingFactory } = getMissingFields(
        emp as unknown as Record<string, unknown>,
        emp.factory as unknown as Record<string, unknown> | null,
      );
      stats[completeness]++;
      return { ...emp, completeness, missingEmployee, missingFactory };
    });

    return c.json({ employees: enriched, stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load data check";
    return c.json({ error: message }, 500);
  }
});
```

- [ ] **Step 2: Register router in server/index.ts**

Find the router registration block and add:
```typescript
import { dataCheckRouter } from "./routes/data-check.js";
// In the route registration section:
api.route("/data-check", dataCheckRouter);
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add server/routes/data-check.ts server/index.ts
git commit -m "feat(data-check): agregar endpoint GET /api/data-check"
```

---

## Task 3: Frontend Types, Hooks, Query Keys

**Files:**
- Modify: `src/lib/api-types.ts` — add interfaces
- Modify: `src/lib/api.ts` — add API functions
- Modify: `src/lib/query-keys.ts` — add dataCheck keys
- Create: `src/lib/hooks/use-data-check.ts`

- [ ] **Step 1: Add types to api-types.ts**

```typescript
// Append to src/lib/api-types.ts
export interface DataCheckEmployee extends Employee {
  company: Company | null;
  factory: Factory | null;
  completeness: "green" | "yellow" | "red" | "gray";
  missingEmployee: string[];
  missingFactory: string[];
}

export interface DataCheckResponse {
  employees: DataCheckEmployee[];
  stats: { green: number; yellow: number; red: number; gray: number; total: number };
}
```

- [ ] **Step 2: Add API functions to api.ts**

```typescript
// Add to api.ts
getDataCheck: (companyId?: number) => {
  const params = companyId ? `?companyId=${companyId}` : "";
  return request<DataCheckResponse>(`/data-check${params}`);
},
```

- [ ] **Step 3: Add query keys**

```typescript
// Add to query-keys.ts
dataCheck: {
  all: ["dataCheck"] as const,
  byCompany: (companyId?: number) => ["dataCheck", companyId] as const,
  invalidateAll: ["dataCheck"] as const,
},
```

- [ ] **Step 4: Create hook**

```typescript
// src/lib/hooks/use-data-check.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useDataCheck(companyId?: number) {
  return useQuery({
    queryKey: queryKeys.dataCheck.byCompany(companyId),
    queryFn: () => api.getDataCheck(companyId),
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-types.ts src/lib/api.ts src/lib/query-keys.ts src/lib/hooks/use-data-check.ts
git commit -m "feat(data-check): agregar types, API wrapper, query keys y hook"
```

---

## Task 4: Completeness Helpers (Frontend)

**Files:**
- Create: `src/routes/data-check/-completeness.ts`

- [ ] **Step 1: Create completeness display helpers**

```typescript
// src/routes/data-check/-completeness.ts

export const COMPLETENESS_CONFIG = {
  green: { label: "準備完了", dotClass: "bg-green-500", badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  yellow: { label: "一部不足", dotClass: "bg-amber-500", badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  red: { label: "データ不足", dotClass: "bg-red-500", badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  gray: { label: "未配属", dotClass: "bg-gray-400", badgeClass: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400" },
} as const;

export type CompletenessLevel = keyof typeof COMPLETENESS_CONFIG;

// Japanese labels for missing fields
export const FIELD_LABELS: Record<string, string> = {
  fullName: "氏名",
  katakanaName: "カナ",
  nationality: "国籍",
  gender: "性別",
  birthDate: "生年月日",
  "billingRate|hourlyRate": "単価/時給",
  supervisorName: "指揮命令者",
  hakensakiManagerName: "派遣先責任者",
  managerUnsName: "派遣元責任者",
  complaintClientName: "苦情処理(派遣先)",
  complaintUnsName: "苦情処理(派遣元)",
  workHours: "就業時間",
  conflictDate: "抵触日",
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/data-check/-completeness.ts
git commit -m "feat(data-check): agregar helpers de completitud para frontend"
```

---

## Task 5: Main Page + Flat View

**Files:**
- Create: `src/routes/data-check/index.tsx`
- Create: `src/routes/data-check/-flat-view.tsx`
- Modify: `src/components/layout/sidebar.tsx` — add nav item

- [ ] **Step 1: Add sidebar navigation item**

In `src/components/layout/sidebar.tsx`, import `ClipboardCheck` from lucide-react and add to the navigation items after employees:
```typescript
{ name: "データ確認", href: "/data-check", icon: ClipboardCheck },
```

- [ ] **Step 2: Create main page**

Create `src/routes/data-check/index.tsx` with:
- `createFileRoute("/data-check")` route definition
- Stats bar showing green/yellow/red/gray counts
- Company filter dropdown
- Completeness filter (all / green / yellow / red / gray)
- Search input
- View toggle (テーブル / グループ)
- Renders `FlatView` or `GroupedView` based on toggle
- Uses `useDataCheck()` hook

Key structure:
```typescript
export const Route = createFileRoute("/data-check")({ component: DataCheckPage });

function DataCheckPage() {
  const [companyId, setCompanyId] = useState<number | undefined>();
  const [viewMode, setViewMode] = useState<"flat" | "grouped">("flat");
  const [filter, setFilter] = useState<CompletenessLevel | "all">("all");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useDataCheck(companyId);
  // ... stats bar, filters, view toggle, render FlatView or GroupedView
}
```

- [ ] **Step 3: Create flat view**

Create `src/routes/data-check/-flat-view.tsx`:
- Wide table with all columns per the spec
- TanStack Virtual for horizontal scroll performance
- Inline edit: click cell → input → blur saves via PUT /employees/:id or PUT /factories/:id
- Completeness dot as first column
- Tooltip on dot showing missing fields
- Sort by clicking column headers

Column groups:
1. Status dot
2. 社員№, 派遣先ID
3. 氏名, カナ, 国籍, 性別, 生年月日, 入社日, 単価, 時給
4. 派遣先(company name), 工場, 課/ライン, 住所, TEL
5. 抵触日
6. 指揮命令者(3), 派遣先責任者(3), 苦情処理派遣先(3), 苦情処理派遣元(3), 派遣元責任者(3)
7. 就業時間, 休憩, 業務内容, 締日, 支払日

- [ ] **Step 4: Verify typecheck and dev server**

Run: `npx tsc --noEmit`
Run: `npm run dev` — verify page loads at http://localhost:3026/data-check

- [ ] **Step 5: Commit**

```bash
git add src/routes/data-check/index.tsx src/routes/data-check/-flat-view.tsx src/components/layout/sidebar.tsx
git commit -m "feat(data-check): agregar página principal con vista tabla plana"
```

---

## Task 6: Grouped View

**Files:**
- Create: `src/routes/data-check/-grouped-view.tsx`

- [ ] **Step 1: Create grouped view**

Structure:
- Group employees by `company.name` → `factory.factoryName` → `factory.department` → `factory.lineName`
- Each factory group is collapsible (AnimatePresence + motion.div)
- Factory header shows: factory name, dept/line, completeness dot, count of employees, missing factory fields as badges
- Inside: employee rows with their data + individual completeness dot
- "未配属" section at top for employees with `factoryId === null`
- When editing factory field, show warning banner: "この変更は同じラインのN名全員に適用されます"

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/routes/data-check/-grouped-view.tsx
git commit -m "feat(data-check): agregar vista agrupada por fábrica"
```

---

## Task 7: Export/Import

**Files:**
- Create: `src/routes/data-check/-export-import.tsx`
- Modify: `server/routes/data-check.ts` — add export and import endpoints

- [ ] **Step 1: Add export endpoint**

```typescript
// POST /api/data-check/export
dataCheckRouter.post("/export", async (c) => {
  // Fetch all active employees with company + factory
  // Build ExcelJS workbook with unified columns
  // Headers: 社員№, 派遣先ID, 氏名, カナ, 国籍, 性別, 生年月日, 入社日, 単価, 時給,
  //          派遣先, 工場, 課, ライン, 住所, TEL, 抵触日,
  //          指揮命令者部署, 指揮命令者氏名, 指揮命令者TEL,
  //          派遣先責任者部署, 派遣先責任者氏名, 派遣先責任者TEL,
  //          苦情処理派遣先部署, 苦情処理派遣先氏名, 苦情処理派遣先TEL,
  //          苦情処理派遣元部署, 苦情処理派遣元氏名, 苦情処理派遣元TEL,
  //          派遣元責任者部署, 派遣元責任者氏名, 派遣元責任者TEL,
  //          就業時間, 休憩, 業務内容, 締日, 支払日, 状態
  // Write to E:\TestKintai\ with timestamp
  // Return { success, filename, path, count }
});
```

- [ ] **Step 2: Add import endpoint**

```typescript
// POST /api/data-check/import
dataCheckRouter.post("/import", async (c) => {
  // Accept JSON rows (parsed from Excel on frontend)
  // For each row:
  //   1. Match employee by employeeNumber → update employee fields
  //   2. Match factory by (companyId, factoryName, department, lineName) → update factory fields
  //   3. Group factory updates (N rows same factory → 1 update)
  //   4. Never overwrite with null/empty
  // Return { updated: { employees: N, factories: N }, errors: [] }
});
```

- [ ] **Step 3: Add API functions to api.ts**

```typescript
exportDataCheck: () => request<{ success: boolean; filename: string; path: string; count: number }>(
  "/data-check/export", { method: "POST" }
),
importDataCheck: (data: { rows: Record<string, unknown>[]; mode: string }) =>
  request<{ updated: { employees: number; factories: number }; errors: string[] }>(
    "/data-check/import", { method: "POST", body: JSON.stringify(data) }
  ),
```

- [ ] **Step 4: Create export/import modal**

`src/routes/data-check/-export-import.tsx`:
- Two buttons in page header: エクスポート / インポート
- Export: POST to API, show toast with filename
- Import: File picker → parse Excel on frontend → preview → confirm → POST to API
- Follow same pattern as `src/routes/companies/-import-modal.tsx`

- [ ] **Step 5: Verify typecheck and tests**

Run: `npx tsc --noEmit`
Run: `npx vitest run`

- [ ] **Step 6: Commit**

```bash
git add server/routes/data-check.ts src/routes/data-check/-export-import.tsx src/lib/api.ts
git commit -m "feat(data-check): agregar export/import Excel unificado"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```
Expected: all existing tests pass + new completeness tests pass

- [ ] **Step 2: Typecheck + lint**

```bash
npx tsc --noEmit
npx eslint src/ server/
```

- [ ] **Step 3: Manual verification**

1. Navigate to `/data-check` — page loads with stats bar
2. Toggle between flat/grouped views
3. Filter by company, by completeness status
4. Edit an employee field inline → verify it saves
5. Edit a factory field inline → verify warning appears, saves correctly
6. Export → verify Excel file generated
7. Import → verify changes applied

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(data-check): verificación final y ajustes menores"
git push origin main
```
