# Data Check (データ確認) — Design Spec

## Purpose

Unified view of employees + their assigned factory data to audit contract readiness.
Shows completeness status (traffic light) and allows inline editing that syncs to the real DB tables.

## Route

`/data-check` — "データ確認" in sidebar navigation.

## API

### GET /api/data-check

Returns active employees with company + factory eager-loaded, plus calculated completeness.

```typescript
interface DataCheckEmployee {
  // All employee fields
  id: number;
  employeeNumber: string;
  clientEmployeeId: string | null;
  fullName: string;
  katakanaName: string | null;
  nationality: string | null;
  gender: string | null;
  birthDate: string | null;
  hireDate: string | null;
  actualHireDate: string | null;
  billingRate: number | null;
  hourlyRate: number | null;
  // Nested
  company: Company | null;
  factory: Factory | null;
  // Calculated
  completeness: "green" | "yellow" | "red" | "gray";
  missingEmployee: string[];  // field names missing
  missingFactory: string[];   // field names missing
}

interface DataCheckResponse {
  employees: DataCheckEmployee[];
  stats: { green: number; yellow: number; red: number; gray: number; total: number };
}
```

Query params: `?companyId=` (optional filter)

### Editing

No new endpoints. Uses existing:
- `PUT /api/employees/:id` — for employee field edits
- `PUT /api/factories/:id` — for factory field edits

Cache invalidation after edit: `queryKeys.dataCheck`, `queryKeys.employees`, `queryKeys.factories`, `queryKeys.companies`.

### Export/Import

- `GET /api/data-check/export` — Excel with all unified columns
- `POST /api/data-check/import` — Accepts same Excel format, updates employees and factories

Import logic:
- Match employee by `employeeNumber`
- Match factory by `(companyId, factoryName, department, lineName)`
- Group factory updates (N rows same factory → 1 DB update)
- Never overwrite with null/empty (same safety as existing factory import)

## Frontend

### Files

```
src/routes/data-check/
  index.tsx              — Page with toggle, stats bar, filters
  -flat-view.tsx         — Flat table (1 row = 1 employee + factory data)
  -grouped-view.tsx      — Grouped by factory with collapsible sections
  -completeness.ts       — Traffic light logic + required field lists
  -export-import.tsx     — Export/import modal

src/lib/hooks/
  use-data-check.ts      — React Query hook for GET /api/data-check
```

### View Toggle

Two modes switchable via toggle button:
- **Table** (テーブル): Flat wide table, 1 row per employee
- **Grouped** (グループ): Collapsible sections by company → factory → dept → line

### Flat View Columns (left to right)

| Group | Columns | Source | Editable |
|-------|---------|--------|----------|
| Status | Completeness dot | calculated | No |
| ID | 社員№, 派遣先ID | employee | Yes |
| Employee | 氏名, カナ, 国籍, 性別, 生年月日, 入社日, 単価, 時給 | employee | Yes |
| Company | 派遣先 | company | No (display only) |
| Factory | 工場, 課/ライン, 住所, TEL | factory | Partial |
| Legal | 抵触日 | factory | Yes |
| 指揮命令者 | 部署, 氏名, TEL | factory | Yes |
| 派遣先責任者 | 部署, 氏名, TEL | factory | Yes |
| 苦情処理(派遣先) | 部署, 氏名, TEL | factory | Yes |
| 苦情処理(派遣元) | 部署, 氏名, TEL | factory | Yes |
| 派遣元責任者 | 部署, 氏名, TEL | factory | Yes |
| Work | 就業時間, 休憩, 業務内容, 締日, 支払日 | factory | Yes |

Use TanStack Virtual for horizontal scroll. Column widths persisted in localStorage.

### Grouped View

- Company sections (top level, collapsible)
  - Factory sections (nested, collapsible)
    - Factory data header: shows factory fields + factory completeness
    - Employee rows: show employee fields + individual completeness
- Special "未配属" section at top for employees with `factoryId = null`
- Warning when editing factory field: "この変更は同じラインのN名全員に適用されます"

### Stats Bar

```
🟢 287 準備完了  |  🟡 42 一部不足  |  🔴 18 データ不足  |  ⚪ 45 未配属  |  合計: 392名
```

### Filters

- Company dropdown (all companies)
- Completeness filter (show only: green/yellow/red/gray or all)
- Free text search (employee name, number, factory name)

### Completeness Logic

```typescript
const REQUIRED_EMPLOYEE_FIELDS = [
  "fullName", "katakanaName", "nationality", "gender", "birthDate",
  // At least one rate
  "billingRate|hourlyRate",
];

const REQUIRED_FACTORY_FIELDS = [
  "supervisorName", "hakensakiManagerName", "managerUnsName",
  "complaintClientName", "complaintUnsName",
  "workHours", "conflictDate",
];

function calcCompleteness(emp): "green" | "yellow" | "red" | "gray" {
  if (!emp.factoryId) return "gray";
  const empOk = checkFields(emp, REQUIRED_EMPLOYEE_FIELDS);
  const facOk = checkFields(emp.factory, REQUIRED_FACTORY_FIELDS);
  if (empOk && facOk) return "green";
  if (empOk || facOk) return "yellow";
  return "red";
}
```

## Design System

Follows LUNARIS design system:
- Cards with `rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]`
- Primary: emerald (light) / neon green (dark)
- Stats dots use semantic colors: green-500, amber-500, red-500, gray-400
- Inline edit uses same pattern as `/companies/table` (click to edit, blur to save)
- AnimatedPage wrapper, PageHeader component

## Sidebar

Add entry in sidebar navigation:
- Icon: `ClipboardCheck` from lucide-react
- Label: "データ確認"
- Position: after "社員" (employees), before "書類" (documents)
