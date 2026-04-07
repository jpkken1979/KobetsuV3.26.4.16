# Kobetsuv2 — Fase 2: CRUD Core + Import

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar CRUD de companies/factories/employees, import con deteccion de re-entradas Takao, badges de estado y data check integrado.

**Architecture:** 8 Hono routes (companies, factories, employees) registradas en server/index.ts. React Query hooks para cada entidad. Companies page con factory editor Dialog. Employees page con TanStack Table. Import Dialog en /employees con deteccion Takao (R11), template descargable (R20) y data check tab. Validacion pre-PDF (R17) como servicio reutilizable.

**Tech Stack:** Hono 4 + Drizzle ORM + React 19 + TanStack Table v8 + React Hook Form + Zod 4 + ExcelJS (templates)

**Repo v2:** `C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1`

---

## Task 1: Types + Query Keys + Validation Service

**Files:**
- Create: `src/lib/api-types.ts`
- Create: `src/lib/query-keys.ts`
- Create: `server/services/validation.ts`
- Create: `server/__tests__/validation.test.ts`

### Step 1.1 — api-types.ts

- [ ] Create `src/lib/api-types.ts`:

```typescript
// src/lib/api-types.ts
// Shared TypeScript interfaces for the entire application.

// ─── Company ────────────────────────────────────────────────────────────
export interface Company {
  id: number;
  name: string;
  nameKana: string | null;
  shortName: string | null;
  address: string | null;
  phone: string | null;
  representative: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  factories?: Factory[];
}

export type CompanyCreate = Pick<Company, "name"> &
  Partial<Pick<Company, "nameKana" | "shortName" | "address" | "phone" | "representative">>;

export type CompanyUpdate = Partial<CompanyCreate & { isActive: boolean }>;

// ─── Factory ────────────────────────────────────────────────────────────
export interface Factory {
  id: number;
  companyId: number;
  factoryName: string;
  department: string | null;
  lineName: string | null;
  address: string | null;
  phone: string | null;
  hourlyRate: number | null;
  jobDescription: string | null;
  shiftPattern: string | null;
  workHours: string | null;
  workHoursDay: string | null;
  workHoursNight: string | null;
  breakTime: number | null;
  breakTimeDay: string | null;
  breakTimeNight: string | null;
  overtimeHours: string | null;
  overtimeOutsideDays: string | null;
  workDays: string | null;
  conflictDate: string | null;
  contractPeriod: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  closingDayText: string | null;
  paymentDayText: string | null;
  bankAccount: string | null;
  calendar: string | null;
  responsibilityLevel: string | null;
  welfare: string | null;
  safetyMeasures: string | null;
  terminationMeasures: string | null;
  supervisorDept: string | null;
  supervisorName: string | null;
  supervisorPhone: string | null;
  supervisorRole: string | null;
  complaintClientName: string | null;
  complaintClientPhone: string | null;
  complaintClientDept: string | null;
  complaintUnsName: string | null;
  complaintUnsPhone: string | null;
  complaintUnsDept: string | null;
  complaintUnsAddress: string | null;
  managerUnsName: string | null;
  managerUnsPhone: string | null;
  managerUnsDept: string | null;
  managerUnsAddress: string | null;
  hakensakiManagerName: string | null;
  hakensakiManagerPhone: string | null;
  hakensakiManagerDept: string | null;
  hakensakiManagerRole: string | null;
  hasRobotTraining: boolean | null;
  agreementPeriodEnd: string | null;
  isKyoteiTaisho: boolean | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  company?: Company;
}

export type FactoryCreate = Pick<Factory, "companyId" | "factoryName"> &
  Partial<Omit<Factory, "id" | "companyId" | "factoryName" | "createdAt" | "updatedAt" | "company">>;

export type FactoryUpdate = Partial<Omit<Factory, "id" | "createdAt" | "updatedAt" | "company">>;

// ─── Employee ───────────────────────────────────────────────────────────
export interface Employee {
  id: number;
  employeeNumber: string;
  clientEmployeeId: string | null;
  companyId: number | null;
  factoryId: number | null;
  fullName: string;
  katakanaName: string | null;
  gender: string | null;
  nationality: string | null;
  birthDate: string | null;
  status: string;
  hireDate: string | null;
  actualHireDate: string | null;
  hourlyRate: number | null;
  billingRate: number | null;
  visaExpiry: string | null;
  visaType: string | null;
  postalCode: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
  company?: Company | null;
  factory?: Factory | null;
}

export type EmployeeCreate = Pick<Employee, "employeeNumber" | "fullName"> &
  Partial<Omit<Employee, "id" | "employeeNumber" | "fullName" | "createdAt" | "updatedAt" | "company" | "factory">>;

export type EmployeeUpdate = Partial<Omit<Employee, "id" | "createdAt" | "updatedAt" | "company" | "factory">>;

// ─── Employee Filter Params ─────────────────────────────────────────────
export interface EmployeeFilterParams {
  companyId?: number;
  factoryId?: number;
  search?: string;
  status?: string;
}

// ─── Import Types ───────────────────────────────────────────────────────
export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

export interface FactoryDiffRow {
  factoryId: number | null;
  factoryName: string;
  companyName: string;
  changes: Array<{
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }>;
  isNew: boolean;
  hasActiveContracts: boolean;
  hasRateChange: boolean;
}

export interface FactoryImportPreview {
  diffs: FactoryDiffRow[];
  newCount: number;
  updateCount: number;
  unchangedCount: number;
}

// ─── Completeness ───────────────────────────────────────────────────────
export type CompletenessLevel = "green" | "yellow" | "red" | "gray";

export interface CompletenessRow {
  employeeId: number;
  employeeNumber: string;
  fullName: string;
  factoryName: string | null;
  companyName: string | null;
  level: CompletenessLevel;
  missingEmployee: string[];
  missingFactory: string[];
}

// ─── Validation (R17) ──────────────────────────────────────────────────
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Factory Badge Status (R24) ─────────────────────────────────────────
export interface FactoryBadgeStatus {
  dataComplete: "ok" | "warning" | "error";
  hasCalendar: boolean;
  employeeCount: number;
  conflictDate: string | null;
  missingFields: string[];
}

// ─── API Responses ──────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export interface ApiError {
  error: string;
}
```

### Step 1.2 — query-keys.ts

- [ ] Create `src/lib/query-keys.ts`:

```typescript
// src/lib/query-keys.ts
// Centralized React Query key factory. NEVER use raw string arrays.

import type { EmployeeFilterParams } from "./api-types";

export const queryKeys = {
  companies: {
    all: ["companies"] as const,
    detail: (id: number) => ["companies", id] as const,
  },
  factories: {
    all: (params?: { companyId?: number }) => ["factories", params] as const,
    detail: (id: number) => ["factories", id] as const,
    cascade: (companyId: number) => ["factories", "cascade", companyId] as const,
  },
  employees: {
    all: (params?: EmployeeFilterParams) => ["employees", params] as const,
    detail: (id: number) => ["employees", id] as const,
    completeness: ["employees", "completeness"] as const,
  },
  contracts: {
    all: (params?: { companyId?: number; status?: string }) =>
      ["contracts", params] as const,
    detail: (id: number) => ["contracts", id] as const,
  },
  dashboard: {
    stats: ["dashboard", "stats"] as const,
    alerts: ["dashboard", "alerts"] as const,
  },
  audit: {
    all: ["audit"] as const,
  },
} as const;
```

### Step 1.3 — Validation service (R17)

- [ ] Create `server/services/validation.ts`:

```typescript
// server/services/validation.ts
// R17: Pre-PDF validation service. Checks factory + employee data completeness
// before allowing document generation.

export interface PrePdfValidationResult {
  valid: boolean;
  errors: string[];
}

interface FactoryLike {
  supervisorName: string | null;
  supervisorPhone: string | null;
  hakensakiManagerName: string | null;
  hakensakiManagerPhone: string | null;
  address: string | null;
  workHours: string | null;
  conflictDate: string | null;
  closingDayText: string | null;
  paymentDayText: string | null;
  managerUnsName: string | null;
  managerUnsPhone: string | null;
  complaintUnsName: string | null;
  complaintUnsPhone: string | null;
  complaintClientName: string | null;
  complaintClientPhone: string | null;
}

interface EmployeeLike {
  fullName: string;
  billingRate: number | null;
  hourlyRate: number | null;
}

export function validateForPdf(
  factory: FactoryLike | null,
  employees: EmployeeLike[],
): PrePdfValidationResult {
  const errors: string[] = [];

  if (!factory) {
    errors.push("工場情報が見つかりません");
    return { valid: false, errors };
  }

  // Factory required fields
  if (!factory.supervisorName) errors.push("指揮命令者氏名が未入力です");
  if (!factory.supervisorPhone) errors.push("指揮命令者電話番号が未入力です");
  if (!factory.hakensakiManagerName) errors.push("派遣先責任者氏名が未入力です");
  if (!factory.hakensakiManagerPhone) errors.push("派遣先責任者電話番号が未入力です");
  if (!factory.address) errors.push("就業場所住所が未入力です");
  if (!factory.workHours) errors.push("就業時間が未入力です");
  if (!factory.conflictDate) errors.push("抵触日が未入力です");
  if (!factory.closingDayText) errors.push("締日が未入力です");
  if (!factory.paymentDayText) errors.push("支払日が未入力です");
  if (!factory.managerUnsName) errors.push("派遣元責任者氏名が未入力です");
  if (!factory.managerUnsPhone) errors.push("派遣元責任者電話番号が未入力です");
  if (!factory.complaintUnsName) errors.push("苦情処理担当者(UNS)氏名が未入力です");
  if (!factory.complaintUnsPhone) errors.push("苦情処理担当者(UNS)電話番号が未入力です");
  if (!factory.complaintClientName) errors.push("苦情処理担当者(派遣先)氏名が未入力です");
  if (!factory.complaintClientPhone) errors.push("苦情処理担当者(派遣先)電話番号が未入力です");

  // Employee required fields
  for (const emp of employees) {
    // billingRate ?? hourlyRate — use nullish coalescing, NEVER ||
    const rate = emp.billingRate ?? emp.hourlyRate;
    if (rate === null || rate === undefined) {
      errors.push(`${emp.fullName}: 単価または時給が未設定です`);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

### Step 1.4 — Validation tests

- [ ] Create `server/__tests__/validation.test.ts`:

```typescript
// server/__tests__/validation.test.ts
import { describe, it, expect } from "vitest";
import { validateForPdf } from "../services/validation.js";

const completeFactory = {
  supervisorName: "田中太郎",
  supervisorPhone: "086-111-2222",
  hakensakiManagerName: "佐藤花子",
  hakensakiManagerPhone: "086-333-4444",
  address: "岡山県倉敷市1-2-3",
  workHours: "08:00~17:00",
  conflictDate: "2027-03-31",
  closingDayText: "当月末",
  paymentDayText: "翌月20日",
  managerUnsName: "高橋次郎",
  managerUnsPhone: "052-111-2222",
  complaintUnsName: "鈴木一郎",
  complaintUnsPhone: "052-333-4444",
  complaintClientName: "山田健太",
  complaintClientPhone: "086-555-6666",
};

const completeEmployee = {
  fullName: "NGUYEN VAN A",
  billingRate: 1200,
  hourlyRate: 1000,
};

describe("validateForPdf (R17)", () => {
  it("returns valid when all fields present", () => {
    const result = validateForPdf(completeFactory, [completeEmployee]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns errors when factory is null", () => {
    const result = validateForPdf(null, [completeEmployee]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("工場情報が見つかりません");
  });

  it("detects missing factory fields", () => {
    const incomplete = { ...completeFactory, supervisorName: null, hakensakiManagerPhone: null };
    const result = validateForPdf(incomplete, [completeEmployee]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("指揮命令者氏名が未入力です");
    expect(result.errors).toContain("派遣先責任者電話番号が未入力です");
  });

  it("detects missing employee rate using nullish coalescing", () => {
    const empNoRate = { fullName: "TEST USER", billingRate: null, hourlyRate: null };
    const result = validateForPdf(completeFactory, [empNoRate]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("TEST USER: 単価または時給が未設定です");
  });

  it("accepts employee with only hourlyRate (billingRate null)", () => {
    const empHourlyOnly = { fullName: "TEST", billingRate: null, hourlyRate: 1000 };
    const result = validateForPdf(completeFactory, [empHourlyOnly]);
    expect(result.valid).toBe(true);
  });

  it("accepts employee with billingRate = 0 (valid rate)", () => {
    const empZero = { fullName: "TEST", billingRate: 0, hourlyRate: null };
    const result = validateForPdf(completeFactory, [empZero]);
    // billingRate = 0 is not null, so it passes the nullish check
    expect(result.valid).toBe(true);
  });
});
```

### Step 1.5 — Verify

- [ ] Run: `cd C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1 && npx tsc --noEmit`
- [ ] Run: `npx vitest run server/__tests__/validation.test.ts`
- [ ] Commit: `feat(types): agregar api-types, query-keys y servicio de validacion pre-PDF (R17)`

---

## Task 2: Companies + Factories Backend Routes

**Files:**
- Create: `server/routes/companies.ts`
- Create: `server/routes/factories.ts`
- Create: `server/routes/import-factories.ts`
- Create: `server/__tests__/companies.test.ts`

### Step 2.1 — Companies router

- [ ] Create `server/routes/companies.ts`:

```typescript
// server/routes/companies.ts
import { Hono } from "hono";
import { db } from "../db/index.js";
import { clientCompanies, auditLog } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";

const app = new Hono();

// GET /api/companies — list all (with embedded factories)
app.get("/", async (c) => {
  const includeInactive = c.req.query("includeInactive") === "true";
  const companies = await db.query.clientCompanies.findMany({
    where: includeInactive ? undefined : eq(clientCompanies.isActive, true),
    with: { factories: true },
    orderBy: (co, { asc }) => asc(co.name),
  });
  return c.json(companies);
});

// GET /api/companies/:id
app.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) return c.json({ error: "Invalid ID" }, 400);
  const company = await db.query.clientCompanies.findFirst({
    where: eq(clientCompanies.id, id),
    with: { factories: true },
  });
  if (!company) return c.json({ error: "Company not found" }, 404);
  return c.json(company);
});

// POST /api/companies — create
app.post("/", async (c) => {
  const body = await c.req.json();
  const [created] = await db
    .insert(clientCompanies)
    .values({
      name: body.name,
      nameKana: body.nameKana ?? null,
      shortName: body.shortName ?? null,
      address: body.address ?? null,
      phone: body.phone ?? null,
      representative: body.representative ?? null,
    })
    .returning();

  await db.insert(auditLog).values({
    action: "create",
    entityType: "company",
    entityId: created.id,
    detail: `企業作成: ${created.name}`,
  });

  return c.json(created, 201);
});

// PUT /api/companies/:id — update
app.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

  const body = await c.req.json();
  const [updated] = await db
    .update(clientCompanies)
    .set({
      ...body,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(clientCompanies.id, id))
    .returning();

  if (!updated) return c.json({ error: "Company not found" }, 404);

  await db.insert(auditLog).values({
    action: "update",
    entityType: "company",
    entityId: id,
    detail: `企業更新: ${updated.name}`,
  });

  return c.json(updated);
});

export { app as companiesRouter };
```

### Step 2.2 — Factories router

- [ ] Create `server/routes/factories.ts`:

```typescript
// server/routes/factories.ts
import { Hono } from "hono";
import { db, sqlite } from "../db/index.js";
import { factories, auditLog, employees, contracts } from "../db/schema.js";
import { eq, and, sql, count } from "drizzle-orm";
import { REQUIRED_FACTORY_FIELDS } from "../services/completeness.js";

const app = new Hono();

// GET /api/factories?companyId= — list factories (optionally filtered)
app.get("/", async (c) => {
  const companyId = c.req.query("companyId");
  const where = companyId ? eq(factories.companyId, Number(companyId)) : undefined;
  const results = await db.query.factories.findMany({
    where,
    with: { company: true },
    orderBy: (f, { asc }) => [asc(f.companyId), asc(f.factoryName)],
  });
  return c.json(results);
});

// GET /api/factories/cascade/:companyId — cascade data for contract wizard
app.get("/cascade/:companyId", async (c) => {
  const companyId = Number(c.req.param("companyId"));
  if (Number.isNaN(companyId)) return c.json({ error: "Invalid companyId" }, 400);

  const results = await db.query.factories.findMany({
    where: and(
      eq(factories.companyId, companyId),
      eq(factories.isActive, true),
    ),
    orderBy: (f, { asc }) => [asc(f.factoryName), asc(f.department), asc(f.lineName)],
  });
  return c.json(results);
});

// GET /api/factories/badges/:companyId — factory badge status (R24)
app.get("/badges/:companyId", async (c) => {
  const companyId = Number(c.req.param("companyId"));
  if (Number.isNaN(companyId)) return c.json({ error: "Invalid companyId" }, 400);

  const facs = await db.query.factories.findMany({
    where: eq(factories.companyId, companyId),
    with: { calendars: true },
  });

  // Count employees per factory
  const empCounts = db
    .select({ factoryId: employees.factoryId, cnt: count() })
    .from(employees)
    .where(eq(employees.companyId, companyId))
    .groupBy(employees.factoryId)
    .all();

  const empCountMap = new Map(empCounts.map((r) => [r.factoryId, r.cnt]));

  const badges = facs.map((f) => {
    const missing: string[] = [];
    for (const field of REQUIRED_FACTORY_FIELDS) {
      const val = f[field as keyof typeof f];
      if (val === null || val === undefined || val === "") {
        missing.push(field);
      }
    }

    const currentYear = new Date().getFullYear();
    const hasCalendar = f.calendars.some((cal) => cal.year === currentYear);

    return {
      factoryId: f.id,
      factoryName: f.factoryName,
      department: f.department,
      lineName: f.lineName,
      dataComplete: missing.length === 0 ? "ok" : missing.length <= 3 ? "warning" : "error",
      hasCalendar,
      employeeCount: empCountMap.get(f.id) ?? 0,
      conflictDate: f.conflictDate,
      missingFields: missing,
    };
  });

  return c.json(badges);
});

// GET /api/factories/:id
app.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) return c.json({ error: "Invalid ID" }, 400);
  const factory = await db.query.factories.findFirst({
    where: eq(factories.id, id),
    with: { company: true },
  });
  if (!factory) return c.json({ error: "Factory not found" }, 404);
  return c.json(factory);
});

// POST /api/factories — create
app.post("/", async (c) => {
  const body = await c.req.json();
  if (!body.companyId || !body.factoryName) {
    return c.json({ error: "companyId and factoryName are required" }, 400);
  }

  try {
    const [created] = await db.insert(factories).values(body).returning();

    await db.insert(auditLog).values({
      action: "create",
      entityType: "factory",
      entityId: created.id,
      detail: `工場作成: ${created.factoryName}`,
    });

    return c.json(created, 201);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
      return c.json({ error: "この工場はすでに登録されています" }, 409);
    }
    throw err;
  }
});

// PUT /api/factories/:id — update
app.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

  const body = await c.req.json();
  const [updated] = await db
    .update(factories)
    .set({
      ...body,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(factories.id, id))
    .returning();

  if (!updated) return c.json({ error: "Factory not found" }, 404);

  await db.insert(auditLog).values({
    action: "update",
    entityType: "factory",
    entityId: id,
    detail: `工場更新: ${updated.factoryName}`,
  });

  return c.json(updated);
});

// DELETE /api/factories/:id — soft delete (set isActive=false)
app.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

  const [updated] = await db
    .update(factories)
    .set({ isActive: false, updatedAt: sql`(datetime('now'))` })
    .where(eq(factories.id, id))
    .returning();

  if (!updated) return c.json({ error: "Factory not found" }, 404);

  await db.insert(auditLog).values({
    action: "delete",
    entityType: "factory",
    entityId: id,
    detail: `工場無効化: ${updated.factoryName}`,
  });

  return c.json({ success: true });
});

export { app as factoriesRouter };
```

### Step 2.3 — Import factories router (R18 + R20)

- [ ] Create `server/routes/import-factories.ts`:

```typescript
// server/routes/import-factories.ts
// R18: Diff visual for factory re-import
// R20: Downloadable Excel template

import { Hono } from "hono";
import { db, sqlite } from "../db/index.js";
import { factories, contracts, auditLog, clientCompanies } from "../db/schema.js";
import { eq, and, ne, sql } from "drizzle-orm";
import { createBackup } from "../middleware/backup.js";
import { normalizeImportRow, normalizeCompanyName } from "../services/import-utils.js";
import ExcelJS from "exceljs";

const app = new Hono();

// Field mapping: Excel header (Japanese) → DB column name
const FACTORY_FIELD_MAP: Record<string, string> = {
  "派遣先名称": "companyName",
  "工場名": "factoryName",
  "部署": "department",
  "ライン": "lineName",
  "住所": "address",
  "電話番号": "phone",
  "時間単価": "hourlyRate",
  "業務内容": "jobDescription",
  "就業時間": "workHours",
  "日勤時間": "workHoursDay",
  "夜勤時間": "workHoursNight",
  "日勤休憩": "breakTimeDay",
  "夜勤休憩": "breakTimeNight",
  "抵触日": "conflictDate",
  "契約期間": "contractPeriod",
  "締日": "closingDayText",
  "支払日": "paymentDayText",
  "指揮命令者部署": "supervisorDept",
  "指揮命令者氏名": "supervisorName",
  "指揮命令者電話": "supervisorPhone",
  "指揮命令者役職": "supervisorRole",
  "派遣先責任者氏名": "hakensakiManagerName",
  "派遣先責任者電話": "hakensakiManagerPhone",
  "派遣先責任者部署": "hakensakiManagerDept",
  "派遣先責任者役職": "hakensakiManagerRole",
  "苦情処理担当者(派遣先)氏名": "complaintClientName",
  "苦情処理担当者(派遣先)電話": "complaintClientPhone",
  "苦情処理担当者(派遣先)部署": "complaintClientDept",
  "苦情処理担当者(UNS)氏名": "complaintUnsName",
  "苦情処理担当者(UNS)電話": "complaintUnsPhone",
  "苦情処理担当者(UNS)部署": "complaintUnsDept",
  "派遣元責任者氏名": "managerUnsName",
  "派遣元責任者電話": "managerUnsPhone",
  "派遣元責任者部署": "managerUnsDept",
};

const COMPARABLE_FIELDS = Object.values(FACTORY_FIELD_MAP).filter(
  (f) => f !== "companyName"
);

// POST /api/import/factories — preview diff (R18)
app.post("/", async (c) => {
  const body = await c.req.json<{ rows: Record<string, unknown>[]; apply?: boolean }>();
  const { rows, apply } = body;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return c.json({ error: "No rows provided" }, 400);
  }

  // Resolve company names to IDs
  const allCompanies = await db.query.clientCompanies.findMany();
  const companyMap = new Map(allCompanies.map((co) => [co.name, co.id]));

  // Build diffs
  const diffs: Array<{
    factoryId: number | null;
    factoryName: string;
    companyName: string;
    changes: Array<{ field: string; oldValue: string | null; newValue: string | null }>;
    isNew: boolean;
    hasActiveContracts: boolean;
    hasRateChange: boolean;
  }> = [];

  let newCount = 0;
  let updateCount = 0;
  let unchangedCount = 0;

  for (const rawRow of rows) {
    const row = normalizeImportRow(rawRow);

    // Map Japanese headers to DB fields
    const mapped: Record<string, unknown> = {};
    let companyName = "";
    for (const [jpKey, dbField] of Object.entries(FACTORY_FIELD_MAP)) {
      if (row[jpKey] !== undefined) {
        if (dbField === "companyName") {
          companyName = normalizeCompanyName(String(row[jpKey]));
        } else {
          mapped[dbField] = row[jpKey];
        }
      }
    }

    const factoryName = String(mapped.factoryName ?? "").trim();
    if (!factoryName || !companyName) continue;

    const companyId = companyMap.get(companyName);
    if (!companyId) {
      diffs.push({
        factoryId: null,
        factoryName,
        companyName,
        changes: [],
        isNew: true,
        hasActiveContracts: false,
        hasRateChange: false,
      });
      newCount++;
      continue;
    }

    // Look up existing factory by unique key
    const existing = await db.query.factories.findFirst({
      where: and(
        eq(factories.companyId, companyId),
        eq(factories.factoryName, factoryName),
        mapped.department
          ? eq(factories.department, String(mapped.department))
          : undefined,
        mapped.lineName
          ? eq(factories.lineName, String(mapped.lineName))
          : undefined,
      ),
    });

    if (!existing) {
      diffs.push({
        factoryId: null,
        factoryName,
        companyName,
        changes: [],
        isNew: true,
        hasActiveContracts: false,
        hasRateChange: false,
      });
      newCount++;
      continue;
    }

    // Compare fields — only show non-empty incoming values that differ
    const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
    let hasRateChange = false;

    for (const field of COMPARABLE_FIELDS) {
      const newVal = mapped[field];
      if (newVal === undefined || newVal === null || newVal === "") continue;

      const oldVal = existing[field as keyof typeof existing];
      const newStr = String(newVal);
      const oldStr = oldVal != null ? String(oldVal) : null;

      if (newStr !== oldStr) {
        changes.push({ field, oldValue: oldStr, newValue: newStr });
        if (field === "hourlyRate") hasRateChange = true;
      }
    }

    if (changes.length === 0) {
      unchangedCount++;
      continue;
    }

    // Check active contracts for rate change warning
    let hasActiveContracts = false;
    if (hasRateChange) {
      const activeContract = await db.query.contracts.findFirst({
        where: and(
          eq(contracts.factoryId, existing.id),
          ne(contracts.status, "cancelled"),
        ),
      });
      hasActiveContracts = !!activeContract;
    }

    diffs.push({
      factoryId: existing.id,
      factoryName,
      companyName,
      changes,
      isNew: false,
      hasActiveContracts,
      hasRateChange,
    });
    updateCount++;
  }

  // If apply=true, perform the actual import inside a transaction
  if (apply) {
    createBackup();

    const tx = sqlite.transaction(() => {
      for (const diff of diffs) {
        if (diff.isNew) {
          const companyId = companyMap.get(diff.companyName);
          if (!companyId) continue;

          // Reconstruct fields from the original row
          const rowData = rows.find((r) => {
            const norm = normalizeImportRow(r);
            return String(norm["工場名"] ?? "").trim() === diff.factoryName;
          });
          if (!rowData) continue;

          const norm = normalizeImportRow(rowData);
          const vals: Record<string, unknown> = { companyId, factoryName: diff.factoryName };
          for (const [jpKey, dbField] of Object.entries(FACTORY_FIELD_MAP)) {
            if (dbField === "companyName") continue;
            if (norm[jpKey] !== undefined && norm[jpKey] !== null && norm[jpKey] !== "") {
              vals[dbField] = norm[jpKey];
            }
          }

          db.insert(factories).values(vals as typeof factories.$inferInsert).run();
        } else if (diff.factoryId && diff.changes.length > 0) {
          const updateData: Record<string, unknown> = {};
          for (const ch of diff.changes) {
            updateData[ch.field] = ch.newValue;
          }
          updateData.updatedAt = sql`(datetime('now'))`;

          db.update(factories)
            .set(updateData)
            .where(eq(factories.id, diff.factoryId))
            .run();
        }
      }
    });

    tx();

    await db.insert(auditLog).values({
      action: "import",
      entityType: "factory",
      detail: `工場インポート: 新規${newCount}件, 更新${updateCount}件`,
    });
  }

  return c.json({
    diffs,
    newCount,
    updateCount,
    unchangedCount,
  });
});

// GET /api/import/factories/template — downloadable Excel template (R20)
app.get("/template", async (c) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("工場マスタ");

  const headers = Object.keys(FACTORY_FIELD_MAP);
  ws.addRow(headers);

  // Example row
  ws.addRow([
    "サンプル株式会社",
    "本社工場",
    "製造1課",
    "ライン1",
    "岡山県倉敷市1-2-3",
    "086-111-2222",
    "1200",
    "製造業務",
    "08:00~17:00",
    "08:00~17:00",
    "21:00~06:00",
    "60分",
    "60分",
    "2027-03-31",
    "3ヶ月",
    "当月末",
    "翌月20日",
    "製造部",
    "田中太郎",
    "086-111-2222",
    "課長",
    "佐藤花子",
    "086-333-4444",
    "総務部",
    "部長",
    "山田健太",
    "086-555-6666",
    "総務部",
    "鈴木一郎",
    "052-111-2222",
    "業務部",
    "高橋次郎",
    "052-333-4444",
    "業務部",
  ]);

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8F5E9" },
  };

  // Auto-width columns
  for (let i = 1; i <= headers.length; i++) {
    const col = ws.getColumn(i);
    col.width = Math.max(headers[i - 1].length * 2, 12);
  }

  const buffer = await wb.xlsx.writeBuffer();

  c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  c.header("Content-Disposition", "attachment; filename=factory-template.xlsx");
  return c.body(buffer as ArrayBuffer);
});

export { app as importFactoriesRouter };
```

### Step 2.4 — Companies + Factories tests

- [ ] Create `server/__tests__/companies.test.ts`:

```typescript
// server/__tests__/companies.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { db, sqlite } from "../db/index.js";
import { clientCompanies, factories } from "../db/schema.js";
import { eq } from "drizzle-orm";

describe("Companies & Factories DB operations", () => {
  beforeAll(() => {
    // Clean test state — delete all test companies
    sqlite.exec("DELETE FROM factories WHERE company_id IN (SELECT id FROM client_companies WHERE name LIKE 'TEST_%')");
    sqlite.exec("DELETE FROM client_companies WHERE name LIKE 'TEST_%'");
  });

  it("creates a company", async () => {
    const [co] = await db
      .insert(clientCompanies)
      .values({ name: "TEST_会社A" })
      .returning();
    expect(co.id).toBeGreaterThan(0);
    expect(co.name).toBe("TEST_会社A");
    expect(co.isActive).toBe(true);
  });

  it("creates a factory with unique constraint", async () => {
    const [co] = await db
      .insert(clientCompanies)
      .values({ name: "TEST_会社B" })
      .returning();

    const [fac] = await db
      .insert(factories)
      .values({
        companyId: co.id,
        factoryName: "本社工場",
        department: "製造部",
        lineName: null,
      })
      .returning();

    expect(fac.id).toBeGreaterThan(0);
    expect(fac.factoryName).toBe("本社工場");

    // Duplicate should throw
    await expect(
      db.insert(factories).values({
        companyId: co.id,
        factoryName: "本社工場",
        department: "製造部",
        lineName: null,
      })
    ).rejects.toThrow(/UNIQUE/);
  });

  it("queries companies with factories relation", async () => {
    const companies = await db.query.clientCompanies.findMany({
      where: eq(clientCompanies.name, "TEST_会社B"),
      with: { factories: true },
    });
    expect(companies).toHaveLength(1);
    expect(companies[0].factories.length).toBeGreaterThanOrEqual(1);
  });
});
```

### Step 2.5 — Verify

- [ ] Run: `cd C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1 && npx tsc --noEmit`
- [ ] Run: `npx vitest run server/__tests__/companies.test.ts`
- [ ] Commit: `feat(routes): agregar rutas de companies, factories e import factories con diff visual (R18) y template (R20)`

---

## Task 3: Employees Backend + Import Route

**Files:**
- Create: `server/routes/employees.ts`
- Create: `server/services/takao-detection.ts`
- Create: `server/__tests__/takao-detection.test.ts`
- Create: `server/__tests__/employees.test.ts`

### Step 3.1 — Takao re-entry detection service (R11)

- [ ] Create `server/services/takao-detection.ts`:

```typescript
// server/services/takao-detection.ts
// R11: Re-entry detection for 高雄工業 only.
// If an employee has 2+ rows in Excel for the SAME company,
// and the last entry is within 1 year of the previous exit,
// then actualHireDate = first entry date.

import { differenceInDays, parseISO } from "date-fns";

export interface EmployeeEntry {
  employeeNumber: string;
  companyName: string;
  hireDate: string | null;
  exitDate: string | null;
}

export interface TakaoDetectionResult {
  employeeNumber: string;
  isReEntry: boolean;
  actualHireDate: string | null;
  originalHireDate: string | null;
  reason: string | null;
}

/**
 * Detects re-entries for 高雄工業 employees.
 * Only applies when companyName includes "高雄".
 */
export function detectTakaoReEntries(
  entries: EmployeeEntry[],
): TakaoDetectionResult[] {
  const results: TakaoDetectionResult[] = [];

  // Group by employeeNumber + companyName
  const grouped = new Map<string, EmployeeEntry[]>();
  for (const entry of entries) {
    // Only process 高雄 companies
    if (!entry.companyName.includes("高雄")) continue;

    const key = `${entry.employeeNumber}||${entry.companyName}`;
    const list = grouped.get(key) ?? [];
    list.push(entry);
    grouped.set(key, list);
  }

  for (const [_key, group] of grouped) {
    if (group.length < 2) continue;

    // Sort by hireDate ascending
    const sorted = group
      .filter((e) => e.hireDate)
      .sort((a, b) => a.hireDate!.localeCompare(b.hireDate!));

    if (sorted.length < 2) continue;

    const firstEntry = sorted[0];
    const lastEntry = sorted[sorted.length - 1];

    // Check if the previous entry has an exitDate
    const previousEntry = sorted[sorted.length - 2];
    if (!previousEntry.exitDate || !lastEntry.hireDate) continue;

    const exitDate = parseISO(previousEntry.exitDate);
    const reEntryDate = parseISO(lastEntry.hireDate);
    const daysBetween = differenceInDays(reEntryDate, exitDate);

    // Within 1 year (365 days) → re-entry
    if (daysBetween >= 0 && daysBetween <= 365) {
      results.push({
        employeeNumber: lastEntry.employeeNumber,
        isReEntry: true,
        actualHireDate: firstEntry.hireDate,
        originalHireDate: lastEntry.hireDate,
        reason: `再入社検出: 前回退社${previousEntry.exitDate} → 再入社${lastEntry.hireDate} (${daysBetween}日)`,
      });
    }
  }

  return results;
}
```

### Step 3.2 — Takao detection tests

- [ ] Create `server/__tests__/takao-detection.test.ts`:

```typescript
// server/__tests__/takao-detection.test.ts
import { describe, it, expect } from "vitest";
import { detectTakaoReEntries, type EmployeeEntry } from "../services/takao-detection.js";

describe("detectTakaoReEntries (R11)", () => {
  it("detects re-entry within 1 year for 高雄工業", () => {
    const entries: EmployeeEntry[] = [
      { employeeNumber: "E001", companyName: "高雄工業株式会社", hireDate: "2024-01-15", exitDate: "2024-06-30" },
      { employeeNumber: "E001", companyName: "高雄工業株式会社", hireDate: "2024-10-01", exitDate: null },
    ];
    const results = detectTakaoReEntries(entries);
    expect(results).toHaveLength(1);
    expect(results[0].isReEntry).toBe(true);
    expect(results[0].actualHireDate).toBe("2024-01-15");
    expect(results[0].originalHireDate).toBe("2024-10-01");
  });

  it("does not detect re-entry if gap > 1 year", () => {
    const entries: EmployeeEntry[] = [
      { employeeNumber: "E002", companyName: "高雄工業株式会社", hireDate: "2022-01-15", exitDate: "2022-06-30" },
      { employeeNumber: "E002", companyName: "高雄工業株式会社", hireDate: "2024-10-01", exitDate: null },
    ];
    const results = detectTakaoReEntries(entries);
    expect(results).toHaveLength(0);
  });

  it("ignores non-高雄 companies", () => {
    const entries: EmployeeEntry[] = [
      { employeeNumber: "E003", companyName: "フェニテック株式会社", hireDate: "2024-01-15", exitDate: "2024-06-30" },
      { employeeNumber: "E003", companyName: "フェニテック株式会社", hireDate: "2024-10-01", exitDate: null },
    ];
    const results = detectTakaoReEntries(entries);
    expect(results).toHaveLength(0);
  });

  it("handles single entry (no re-entry possible)", () => {
    const entries: EmployeeEntry[] = [
      { employeeNumber: "E004", companyName: "高雄工業株式会社", hireDate: "2024-01-15", exitDate: null },
    ];
    const results = detectTakaoReEntries(entries);
    expect(results).toHaveLength(0);
  });

  it("handles 3+ entries, uses first hireDate as actualHireDate", () => {
    const entries: EmployeeEntry[] = [
      { employeeNumber: "E005", companyName: "高雄工業株式会社", hireDate: "2023-01-15", exitDate: "2023-06-30" },
      { employeeNumber: "E005", companyName: "高雄工業株式会社", hireDate: "2023-08-01", exitDate: "2024-03-31" },
      { employeeNumber: "E005", companyName: "高雄工業株式会社", hireDate: "2024-06-01", exitDate: null },
    ];
    const results = detectTakaoReEntries(entries);
    expect(results).toHaveLength(1);
    expect(results[0].actualHireDate).toBe("2023-01-15");
  });
});
```

### Step 3.3 — Employees router

- [ ] Create `server/routes/employees.ts`:

```typescript
// server/routes/employees.ts
import { Hono } from "hono";
import { db, sqlite } from "../db/index.js";
import {
  employees,
  factories,
  clientCompanies,
  auditLog,
} from "../db/schema.js";
import { eq, and, or, like, sql, count } from "drizzle-orm";
import { createBackup } from "../middleware/backup.js";
import {
  normalizeImportRow,
  normalizeCompanyName,
  excelSerialToDate,
  parseRate,
  normalizePlacement,
} from "../services/import-utils.js";
import { detectTakaoReEntries, type EmployeeEntry } from "../services/takao-detection.js";
import { calcCompleteness, getMissingFields } from "../services/completeness.js";
import ExcelJS from "exceljs";

const app = new Hono();

// GET /api/employees — list with filters
app.get("/", async (c) => {
  const companyId = c.req.query("companyId");
  const factoryId = c.req.query("factoryId");
  const search = c.req.query("search");
  const status = c.req.query("status") ?? "active";

  const conditions = [];
  if (companyId) conditions.push(eq(employees.companyId, Number(companyId)));
  if (factoryId) conditions.push(eq(employees.factoryId, Number(factoryId)));
  if (status && status !== "all") conditions.push(eq(employees.status, status));
  if (search) {
    conditions.push(
      or(
        like(employees.fullName, `%${search}%`),
        like(employees.katakanaName, `%${search}%`),
        like(employees.employeeNumber, `%${search}%`),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const results = await db.query.employees.findMany({
    where,
    with: { company: true, factory: true },
    orderBy: (e, { asc }) => asc(e.fullName),
    limit: 500,
  });

  return c.json(results);
});

// GET /api/employees/completeness — data check for all assigned employees
app.get("/completeness", async (c) => {
  const allEmployees = await db.query.employees.findMany({
    where: eq(employees.status, "active"),
    with: { factory: true, company: true },
  });

  const rows = allEmployees.map((emp) => {
    const level = calcCompleteness(
      emp as unknown as Record<string, unknown>,
      emp.factory as unknown as Record<string, unknown> | null,
    );
    const { missingEmployee, missingFactory } = getMissingFields(
      emp as unknown as Record<string, unknown>,
      emp.factory as unknown as Record<string, unknown> | null,
    );
    return {
      employeeId: emp.id,
      employeeNumber: emp.employeeNumber,
      fullName: emp.fullName,
      factoryName: emp.factory?.factoryName ?? null,
      companyName: emp.company?.name ?? null,
      level,
      missingEmployee,
      missingFactory,
    };
  });

  return c.json(rows);
});

// GET /api/employees/:id
app.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) return c.json({ error: "Invalid ID" }, 400);
  const emp = await db.query.employees.findFirst({
    where: eq(employees.id, id),
    with: { company: true, factory: true },
  });
  if (!emp) return c.json({ error: "Employee not found" }, 404);
  return c.json(emp);
});

// POST /api/employees — create
app.post("/", async (c) => {
  const body = await c.req.json();
  if (!body.employeeNumber || !body.fullName) {
    return c.json({ error: "employeeNumber and fullName are required" }, 400);
  }

  try {
    const [created] = await db.insert(employees).values(body).returning();

    await db.insert(auditLog).values({
      action: "create",
      entityType: "employee",
      entityId: created.id,
      detail: `社員作成: ${created.fullName} (${created.employeeNumber})`,
    });

    return c.json(created, 201);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
      return c.json({ error: "この社員番号は既に登録されています" }, 409);
    }
    throw err;
  }
});

// PUT /api/employees/:id — update
app.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

  const body = await c.req.json();
  const [updated] = await db
    .update(employees)
    .set({ ...body, updatedAt: sql`(datetime('now'))` })
    .where(eq(employees.id, id))
    .returning();

  if (!updated) return c.json({ error: "Employee not found" }, 404);

  await db.insert(auditLog).values({
    action: "update",
    entityType: "employee",
    entityId: id,
    detail: `社員更新: ${updated.fullName}`,
  });

  return c.json(updated);
});

// POST /api/employees/import — Excel import with Takao detection (R11)
app.post("/import", async (c) => {
  const body = await c.req.json<{
    rows: Record<string, unknown>[];
    mode: "upsert" | "skip";
    profileId?: number;
  }>();

  const { rows, mode } = body;
  if (!rows || rows.length === 0) {
    return c.json({ error: "No rows provided" }, 400);
  }

  createBackup();

  // Resolve companies and factories
  const allCompanies = await db.query.clientCompanies.findMany();
  const companyMap = new Map(allCompanies.map((co) => [co.name, co.id]));

  const allFactories = await db.query.factories.findMany();

  // Build Takao detection entries
  const takaoEntries: EmployeeEntry[] = [];

  // Parse rows
  const parsed: Array<{
    row: Record<string, unknown>;
    employeeNumber: string;
    data: Record<string, unknown>;
  }> = [];

  for (const rawRow of rows) {
    const row = normalizeImportRow(rawRow);
    const employeeNumber = String(row["社員番号"] ?? row["社員No"] ?? "").trim();
    if (!employeeNumber) continue;

    const fullName = String(row["氏名"] ?? row["名前"] ?? "").trim();
    const katakanaName = String(row["カタカナ"] ?? row["フリガナ"] ?? "").trim() || null;
    const companyName = normalizeCompanyName(String(row["派遣先名称"] ?? row["会社名"] ?? ""));
    const factoryName = String(row["工場名"] ?? "").trim();
    const department = String(row["部署"] ?? "").trim() || null;
    const lineName = String(row["ライン"] ?? "").trim() || null;

    // Resolve companyId
    const companyId = companyMap.get(companyName) ?? null;

    // Resolve factoryId
    let factoryId: number | null = null;
    if (companyId && factoryName) {
      const matchedFactory = allFactories.find(
        (f) =>
          f.companyId === companyId &&
          f.factoryName === factoryName &&
          (department === null || f.department === department) &&
          (lineName === null || f.lineName === lineName),
      );
      factoryId = matchedFactory?.id ?? null;
    }

    // Parse placement — if 0 or empty, keep null
    const placementStr = normalizePlacement(row["配属先"]);
    if (!placementStr && !factoryId) {
      // factoryId stays null — do not infer
    }

    const hireDate = excelSerialToDate(row["入社日"] ?? row["雇入日"]);
    const exitDate = excelSerialToDate(row["退社日"] ?? row["退職日"]);
    const birthDate = excelSerialToDate(row["生年月日"]);
    const visaExpiry = excelSerialToDate(row["在留期限"]);
    const billingRate = parseRate(row["請求単価"] ?? row["単価"]);
    const hourlyRate = parseRate(row["時給"]);

    const data: Record<string, unknown> = {
      employeeNumber,
      fullName,
      katakanaName,
      companyId,
      factoryId,
      nationality: String(row["国籍"] ?? "").trim() || null,
      gender: String(row["性別"] ?? "").trim() || null,
      birthDate,
      hireDate,
      hourlyRate,
      billingRate,
      visaExpiry,
      visaType: String(row["在留資格"] ?? "").trim() || null,
      status: exitDate ? "inactive" : "active",
      clientEmployeeId: String(row["派遣先社員番号"] ?? "").trim() || null,
    };

    parsed.push({ row, employeeNumber, data });

    // Collect for Takao detection
    if (companyName.includes("高雄")) {
      takaoEntries.push({
        employeeNumber,
        companyName,
        hireDate,
        exitDate,
      });
    }
  }

  // Run Takao detection (R11)
  const takaoResults = detectTakaoReEntries(takaoEntries);
  const takaoMap = new Map(takaoResults.map((r) => [r.employeeNumber, r]));

  // Execute import in transaction
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ row: number; message: string }> = [];

  const tx = sqlite.transaction(() => {
    for (let i = 0; i < parsed.length; i++) {
      const { employeeNumber, data } = parsed[i];
      try {
        // Apply Takao actualHireDate if detected
        const takao = takaoMap.get(employeeNumber);
        if (takao?.isReEntry) {
          data.actualHireDate = takao.actualHireDate;
        }

        const existing = db.query.employees.findFirst({
          where: eq(employees.employeeNumber, employeeNumber),
        }).sync();

        if (existing) {
          if (mode === "skip") {
            skipped++;
            continue;
          }
          // Upsert: only update non-null fields
          const updateData: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(data)) {
            if (value !== null && value !== undefined && value !== "") {
              updateData[key] = value;
            }
          }
          updateData.updatedAt = sql`(datetime('now'))`;

          db.update(employees)
            .set(updateData)
            .where(eq(employees.id, existing.id))
            .run();
          updated++;
        } else {
          db.insert(employees).values(data as typeof employees.$inferInsert).run();
          created++;
        }
      } catch (err: unknown) {
        errors.push({
          row: i + 2,
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  });

  tx();

  await db.insert(auditLog).values({
    action: "import",
    entityType: "employee",
    detail: `社員インポート: 新規${created}件, 更新${updated}件, スキップ${skipped}件, エラー${errors.length}件`,
  });

  return c.json({ created, updated, skipped, errors, takaoDetections: takaoResults });
});

// GET /api/employees/import/template — downloadable template (R20)
app.get("/import/template", async (c) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("社員マスタ");

  const headers = [
    "社員番号", "氏名", "カタカナ", "国籍", "性別", "生年月日",
    "入社日", "派遣先名称", "工場名", "部署", "ライン",
    "時給", "請求単価", "在留資格", "在留期限",
    "派遣先社員番号", "配属先",
  ];

  ws.addRow(headers);
  ws.addRow([
    "E001", "NGUYEN VAN A", "グエン バン エー", "ベトナム", "男", "1995-04-15",
    "2024-04-01", "高雄工業株式会社", "本社工場", "製造1課", "ライン1",
    "1000", "1200", "技能実習2号", "2027-03-31",
    "TK-001", "本社工場/製造1課",
  ]);

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE3F2FD" },
  };

  for (let i = 1; i <= headers.length; i++) {
    ws.getColumn(i).width = Math.max(headers[i - 1].length * 2, 12);
  }

  const buffer = await wb.xlsx.writeBuffer();
  c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  c.header("Content-Disposition", "attachment; filename=employee-template.xlsx");
  return c.body(buffer as ArrayBuffer);
});

export { app as employeesRouter };
```

### Step 3.4 — Employees tests

- [ ] Create `server/__tests__/employees.test.ts`:

```typescript
// server/__tests__/employees.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { db, sqlite } from "../db/index.js";
import { employees, clientCompanies, factories } from "../db/schema.js";
import { eq } from "drizzle-orm";

describe("Employees DB operations", () => {
  let testCompanyId: number;
  let testFactoryId: number;

  beforeAll(async () => {
    // Clean test state
    sqlite.exec("DELETE FROM employees WHERE employee_number LIKE 'TEST_%'");
    sqlite.exec("DELETE FROM factories WHERE company_id IN (SELECT id FROM client_companies WHERE name = 'TEST_EMP_CO')");
    sqlite.exec("DELETE FROM client_companies WHERE name = 'TEST_EMP_CO'");

    const [co] = await db
      .insert(clientCompanies)
      .values({ name: "TEST_EMP_CO" })
      .returning();
    testCompanyId = co.id;

    const [fac] = await db
      .insert(factories)
      .values({ companyId: co.id, factoryName: "テスト工場" })
      .returning();
    testFactoryId = fac.id;
  });

  it("creates an employee", async () => {
    const [emp] = await db
      .insert(employees)
      .values({
        employeeNumber: "TEST_E001",
        fullName: "TEST EMPLOYEE",
        companyId: testCompanyId,
        factoryId: testFactoryId,
        billingRate: 1200,
        hourlyRate: 1000,
      })
      .returning();

    expect(emp.id).toBeGreaterThan(0);
    expect(emp.fullName).toBe("TEST EMPLOYEE");
    expect(emp.billingRate).toBe(1200);
  });

  it("enforces unique employeeNumber", async () => {
    await expect(
      db.insert(employees).values({
        employeeNumber: "TEST_E001",
        fullName: "DUPLICATE",
      })
    ).rejects.toThrow(/UNIQUE/);
  });

  it("queries employees with company and factory", async () => {
    const result = await db.query.employees.findFirst({
      where: eq(employees.employeeNumber, "TEST_E001"),
      with: { company: true, factory: true },
    });

    expect(result).toBeDefined();
    expect(result!.company?.name).toBe("TEST_EMP_CO");
    expect(result!.factory?.factoryName).toBe("テスト工場");
  });

  it("filters by factoryId", async () => {
    const results = await db.query.employees.findMany({
      where: eq(employees.factoryId, testFactoryId),
    });
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});
```

### Step 3.5 — Verify

- [ ] Run: `cd C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1 && npx tsc --noEmit`
- [ ] Run: `npx vitest run server/__tests__/takao-detection.test.ts server/__tests__/employees.test.ts`
- [ ] Commit: `feat(routes): agregar ruta de employees con import, deteccion Takao (R11) y template (R20)`

---

## Task 4: Register Routes + Fix Service Types

**Files:**
- Modify: `server/index.ts`
- Modify: `server/services/batch-helpers.ts`

### Step 4.1 — Register all routes in server/index.ts

- [ ] Replace the full contents of `server/index.ts`:

```typescript
// server/index.ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { systemRouter } from "./routes/system.js";
import { companiesRouter } from "./routes/companies.js";
import { factoriesRouter } from "./routes/factories.js";
import { importFactoriesRouter } from "./routes/import-factories.js";
import { employeesRouter } from "./routes/employees.js";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:3026"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

// Routes — literal paths BEFORE parameterized paths
app.route("/api/system", systemRouter);
app.route("/api/companies", companiesRouter);
app.route("/api/factories", factoriesRouter);
app.route("/api/import/factories", importFactoriesRouter);
app.route("/api/employees", employeesRouter);

// Serve static (production build)
app.use("/*", serveStatic({ root: "./dist" }));

const PORT = 8026;
console.log(`Server running on http://localhost:${PORT}`);

serve({ fetch: app.fetch, port: PORT });
```

### Step 4.2 — Fix batch-helpers.ts type imports

The v1 services import `Factory` and `Employee` as named types from schema, but the v2 schema only exports table definitions (`factories`, `employees`), not type aliases. Fix by using Drizzle's `InferSelectModel`.

- [ ] In `server/services/batch-helpers.ts`, replace the import line:

```typescript
// OLD:
import type { Factory, Employee } from "../db/schema.js";

// NEW:
import type { InferSelectModel } from "drizzle-orm";
import { factories as factoriesTable, employees as employeesTable } from "../db/schema.js";

type Factory = InferSelectModel<typeof factoriesTable>;
type Employee = InferSelectModel<typeof employeesTable>;
```

The actual edit: find the line `import type { Factory, Employee } from "../db/schema.js";` and replace it. The rest of `batch-helpers.ts` uses `Factory` and `Employee` as types and should work with the inferred types.

Also check and fix any other service files that import these types:

- [ ] Run `grep -rn "from.*schema" server/services/` and fix any other broken imports using the same `InferSelectModel` pattern.

### Step 4.3 — Verify

- [ ] Run: `cd C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1 && npx tsc --noEmit`
- [ ] Commit: `fix(server): registrar rutas y corregir imports de tipos en servicios v1`

---

## Task 5: React Query Hooks

**Files:**
- Create: `src/lib/hooks/use-companies.ts`
- Create: `src/lib/hooks/use-factories.ts`
- Create: `src/lib/hooks/use-employees.ts`
- Create: `src/lib/mutation-helpers.ts`

### Step 5.1 — Mutation helpers

- [ ] Create `src/lib/mutation-helpers.ts`:

```typescript
// src/lib/mutation-helpers.ts
// Shared toast helpers for React Query mutations.

import { toast } from "sonner";

export function onMutationSuccess(message: string): void {
  toast.success(message);
}

export function onMutationError(err: unknown): void {
  const message = err instanceof Error ? err.message : "エラーが発生しました";
  toast.error(message);
}
```

### Step 5.2 — useCompanies hook

- [ ] Create `src/lib/hooks/use-companies.ts`:

```typescript
// src/lib/hooks/use-companies.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { onMutationSuccess, onMutationError } from "@/lib/mutation-helpers";
import type { Company, CompanyCreate, CompanyUpdate } from "@/lib/api-types";

export function useCompanies(opts?: { includeInactive?: boolean }) {
  const params = opts?.includeInactive ? "?includeInactive=true" : "";
  return useQuery({
    queryKey: queryKeys.companies.all,
    queryFn: () => api.get<Company[]>(`/api/companies${params}`),
  });
}

export function useCompany(id: number | null) {
  return useQuery({
    queryKey: queryKeys.companies.detail(id!),
    queryFn: () => api.get<Company>(`/api/companies/${id}`),
    enabled: id !== null,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CompanyCreate) => api.post<Company>("/api/companies", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      onMutationSuccess("企業を作成しました");
    },
    onError: onMutationError,
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CompanyUpdate }) =>
      api.put<Company>(`/api/companies/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      onMutationSuccess("企業を更新しました");
    },
    onError: onMutationError,
  });
}
```

### Step 5.3 — useFactories hook

- [ ] Create `src/lib/hooks/use-factories.ts`:

```typescript
// src/lib/hooks/use-factories.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { onMutationSuccess, onMutationError } from "@/lib/mutation-helpers";
import type {
  Factory,
  FactoryCreate,
  FactoryUpdate,
  FactoryImportPreview,
  FactoryBadgeStatus,
} from "@/lib/api-types";

export function useFactories(companyId?: number) {
  const params = companyId ? `?companyId=${companyId}` : "";
  return useQuery({
    queryKey: queryKeys.factories.all({ companyId }),
    queryFn: () => api.get<Factory[]>(`/api/factories${params}`),
  });
}

export function useFactoryCascade(companyId: number | null) {
  return useQuery({
    queryKey: queryKeys.factories.cascade(companyId!),
    queryFn: () => api.get<Factory[]>(`/api/factories/cascade/${companyId}`),
    enabled: companyId !== null,
  });
}

export function useFactoryBadges(companyId: number | null) {
  return useQuery({
    queryKey: ["factories", "badges", companyId] as const,
    queryFn: () => api.get<FactoryBadgeStatus[]>(`/api/factories/badges/${companyId}`),
    enabled: companyId !== null,
  });
}

export function useFactory(id: number | null) {
  return useQuery({
    queryKey: queryKeys.factories.detail(id!),
    queryFn: () => api.get<Factory>(`/api/factories/${id}`),
    enabled: id !== null,
  });
}

export function useCreateFactory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FactoryCreate) => api.post<Factory>("/api/factories", data),
    onSuccess: () => {
      // Invalidate BOTH factories AND companies (companies embeds factories)
      qc.invalidateQueries({ queryKey: queryKeys.factories.all() });
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      onMutationSuccess("工場を作成しました");
    },
    onError: onMutationError,
  });
}

export function useUpdateFactory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: FactoryUpdate }) =>
      api.put<Factory>(`/api/factories/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.factories.all() });
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      onMutationSuccess("工場を更新しました");
    },
    onError: onMutationError,
  });
}

export function useDeleteFactory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/factories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.factories.all() });
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      onMutationSuccess("工場を無効化しました");
    },
    onError: onMutationError,
  });
}

export function useImportFactoriesPreview() {
  return useMutation({
    mutationFn: (rows: Record<string, unknown>[]) =>
      api.post<FactoryImportPreview>("/api/import/factories", { rows }),
    onError: onMutationError,
  });
}

export function useImportFactoriesApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Record<string, unknown>[]) =>
      api.post<FactoryImportPreview>("/api/import/factories", { rows, apply: true }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.factories.all() });
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      onMutationSuccess(`インポート完了: 新規${data.newCount}件, 更新${data.updateCount}件`);
    },
    onError: onMutationError,
  });
}
```

### Step 5.4 — useEmployees hook

- [ ] Create `src/lib/hooks/use-employees.ts`:

```typescript
// src/lib/hooks/use-employees.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { onMutationSuccess, onMutationError } from "@/lib/mutation-helpers";
import type {
  Employee,
  EmployeeCreate,
  EmployeeUpdate,
  EmployeeFilterParams,
  ImportResult,
  CompletenessRow,
} from "@/lib/api-types";

function buildEmployeeParams(params?: EmployeeFilterParams): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  if (params.companyId) sp.set("companyId", String(params.companyId));
  if (params.factoryId) sp.set("factoryId", String(params.factoryId));
  if (params.search) sp.set("search", params.search);
  if (params.status) sp.set("status", params.status);
  const str = sp.toString();
  return str ? `?${str}` : "";
}

export function useEmployees(params?: EmployeeFilterParams) {
  return useQuery({
    queryKey: queryKeys.employees.all(params),
    queryFn: () => api.get<Employee[]>(`/api/employees${buildEmployeeParams(params)}`),
  });
}

export function useEmployee(id: number | null) {
  return useQuery({
    queryKey: queryKeys.employees.detail(id!),
    queryFn: () => api.get<Employee>(`/api/employees/${id}`),
    enabled: id !== null,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EmployeeCreate) => api.post<Employee>("/api/employees", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.employees.all() });
      onMutationSuccess("社員を作成しました");
    },
    onError: onMutationError,
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: EmployeeUpdate }) =>
      api.put<Employee>(`/api/employees/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.employees.all() });
      onMutationSuccess("社員を更新しました");
    },
    onError: onMutationError,
  });
}

export function useImportEmployees() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { rows: Record<string, unknown>[]; mode: "upsert" | "skip" }) =>
      api.post<ImportResult & { takaoDetections: unknown[] }>("/api/employees/import", payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.employees.all() });
      onMutationSuccess(
        `インポート完了: 新規${data.created}件, 更新${data.updated}件`,
      );
    },
    onError: onMutationError,
  });
}

export function useEmployeeCompleteness() {
  return useQuery({
    queryKey: queryKeys.employees.completeness,
    queryFn: () => api.get<CompletenessRow[]>("/api/employees/completeness"),
  });
}
```

### Step 5.5 — Verify

- [ ] Run: `cd C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1 && npx tsc --noEmit`
- [ ] Commit: `feat(hooks): agregar React Query hooks para companies, factories y employees`

---

## Task 6: Companies Page (List + Factory Editor + Badges)

**Files:**
- Modify: `src/routes/companies.tsx`
- Create: `src/routes/-company-card.tsx`
- Create: `src/routes/-factory-editor.tsx`
- Create: `src/routes/-factory-import-tab.tsx`

### Step 6.1 — CompanyCard component

- [ ] Create `src/routes/-company-card.tsx`:

```tsx
// src/routes/-company-card.tsx
// Company card with expandable factory list and R24 badges.

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Pencil, Building2, AlertTriangle, CheckCircle, XCircle, Calendar, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Company, Factory } from "@/lib/api-types";
import { useFactoryBadges } from "@/lib/hooks/use-factories";

interface CompanyCardProps {
  company: Company;
  onEditFactory: (factory: Factory) => void;
  onAddFactory: (companyId: number) => void;
  onEditCompany: (company: Company) => void;
}

export function CompanyCard({ company, onEditFactory, onAddFactory, onEditCompany }: CompanyCardProps) {
  const [expanded, setExpanded] = useState(false);
  const badges = useFactoryBadges(expanded ? company.id : null);

  const factoryCount = company.factories?.length ?? 0;
  const badgeMap = new Map(
    (badges.data ?? []).map((b) => [b.factoryId, b]),
  );

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[--color-bg-secondary] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <button className="p-0.5 text-[--color-text-secondary]">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <Building2 className="h-4 w-4 text-[--color-text-secondary]" />
          <div>
            <span className="text-sm font-medium text-[--color-text]">{company.name}</span>
            {company.shortName ? (
              <span className="ml-2 text-xs text-[--color-text-secondary]">({company.shortName})</span>
            ) : null}
          </div>
          <Badge variant="outline">{factoryCount}工場</Badge>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => onEditCompany(company)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onAddFactory(company.id)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && company.factories && company.factories.length > 0 ? (
        <div className="border-t border-[--color-border]">
          {company.factories.map((fac) => {
            const badge = badgeMap.get(fac.id);
            return (
              <div
                key={fac.id}
                className="flex items-center justify-between px-4 py-2 pl-12 hover:bg-[--color-bg-secondary] transition-colors cursor-pointer border-b border-[--color-border] last:border-b-0"
                onClick={() => onEditFactory(fac)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[--color-text]">{fac.factoryName}</span>
                  {fac.department ? (
                    <span className="text-xs text-[--color-text-secondary]">{fac.department}</span>
                  ) : null}
                  {fac.lineName ? (
                    <span className="text-xs text-[--color-text-secondary]">/ {fac.lineName}</span>
                  ) : null}
                </div>

                {/* R24 Badges */}
                {badge ? (
                  <div className="flex items-center gap-1.5">
                    {badge.dataComplete === "ok" ? (
                      <Badge variant="success"><CheckCircle className="h-3 w-3 mr-0.5" />完了</Badge>
                    ) : badge.dataComplete === "warning" ? (
                      <Badge variant="warning"><AlertTriangle className="h-3 w-3 mr-0.5" />{badge.missingFields.length}</Badge>
                    ) : (
                      <Badge variant="destructive"><XCircle className="h-3 w-3 mr-0.5" />{badge.missingFields.length}</Badge>
                    )}

                    {badge.hasCalendar ? (
                      <Badge variant="success"><Calendar className="h-3 w-3" /></Badge>
                    ) : (
                      <Badge variant="outline"><Calendar className="h-3 w-3" /></Badge>
                    )}

                    <Badge variant="secondary"><Users className="h-3 w-3 mr-0.5" />{badge.employeeCount}</Badge>

                    {badge.conflictDate ? (
                      <Badge variant="outline" className="text-xs">{badge.conflictDate}</Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : expanded ? (
        <div className="px-4 py-6 text-center text-sm text-[--color-text-secondary] border-t border-[--color-border]">
          工場が登録されていません
        </div>
      ) : null}
    </Card>
  );
}
```

### Step 6.2 — FactoryEditor dialog

- [ ] Create `src/routes/-factory-editor.tsx`:

```tsx
// src/routes/-factory-editor.tsx
// Factory editor using centered Dialog (not Sheet drawer, per CLAUDE.md).

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCreateFactory, useUpdateFactory } from "@/lib/hooks/use-factories";
import type { Factory, FactoryCreate, FactoryUpdate } from "@/lib/api-types";
import { useState } from "react";

interface FactoryEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factory: Factory | null;
  companyId: number;
}

export function FactoryEditor({ open, onOpenChange, factory, companyId }: FactoryEditorProps) {
  const [tab, setTab] = useState("basic");
  const isEdit = factory !== null;
  const createFactory = useCreateFactory();
  const updateFactory = useUpdateFactory();

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<FactoryCreate & FactoryUpdate>({
    defaultValues: factory ?? { companyId },
  });

  useEffect(() => {
    if (open) {
      reset(factory ?? { companyId, factoryName: "" });
      setTab("basic");
    }
  }, [open, factory, companyId, reset]);

  function onSubmit(data: FactoryCreate & FactoryUpdate) {
    if (isEdit && factory) {
      updateFactory.mutate(
        { id: factory.id, data },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createFactory.mutate(
        { ...data, companyId } as FactoryCreate,
        { onSuccess: () => onOpenChange(false) },
      );
    }
  }

  const loading = createFactory.isPending || updateFactory.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] overflow-y-auto"
        title={isEdit ? `工場編集: ${factory?.factoryName}` : "新規工場"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="basic">基本情報</TabsTrigger>
              <TabsTrigger value="supervisor">責任者</TabsTrigger>
              <TabsTrigger value="work">就業</TabsTrigger>
              <TabsTrigger value="complaint">苦情処理</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-3 mt-4">
              <Input label="工場名" {...register("factoryName")} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="部署" {...register("department")} />
                <Input label="ライン名" {...register("lineName")} />
              </div>
              <Input label="住所" {...register("address")} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="電話番号" {...register("phone")} />
                <Input label="時間単価" type="number" step="0.01" {...register("hourlyRate", { valueAsNumber: true })} />
              </div>
              <Input label="業務内容" {...register("jobDescription")} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="抵触日" type="date" {...register("conflictDate")} />
                <Input label="契約期間" {...register("contractPeriod")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="締日" {...register("closingDayText")} helper="例: 当月末" />
                <Input label="支払日" {...register("paymentDayText")} helper="例: 翌月20日" />
              </div>
            </TabsContent>

            <TabsContent value="supervisor" className="space-y-3 mt-4">
              <h4 className="text-sm font-medium text-[--color-text]">指揮命令者</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input label="氏名" {...register("supervisorName")} />
                <Input label="部署" {...register("supervisorDept")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="電話" {...register("supervisorPhone")} />
                <Input label="役職" {...register("supervisorRole")} />
              </div>

              <h4 className="text-sm font-medium text-[--color-text] mt-4">派遣先責任者</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input label="氏名" {...register("hakensakiManagerName")} />
                <Input label="部署" {...register("hakensakiManagerDept")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="電話" {...register("hakensakiManagerPhone")} />
                <Input label="役職" {...register("hakensakiManagerRole")} />
              </div>
            </TabsContent>

            <TabsContent value="work" className="space-y-3 mt-4">
              <Input label="就業時間 (workHours)" {...register("workHours")} helper="例: 08:00~17:00, 21:00~06:00" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="日勤時間" {...register("workHoursDay")} />
                <Input label="夜勤時間" {...register("workHoursNight")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="日勤休憩" {...register("breakTimeDay")} />
                <Input label="夜勤休憩" {...register("breakTimeNight")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="時間外" {...register("overtimeHours")} />
                <Input label="休日出勤" {...register("overtimeOutsideDays")} />
              </div>
              <Input label="出勤日" {...register("workDays")} />
            </TabsContent>

            <TabsContent value="complaint" className="space-y-3 mt-4">
              <h4 className="text-sm font-medium text-[--color-text]">苦情処理(派遣先)</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input label="氏名" {...register("complaintClientName")} />
                <Input label="部署" {...register("complaintClientDept")} />
              </div>
              <Input label="電話" {...register("complaintClientPhone")} />

              <h4 className="text-sm font-medium text-[--color-text] mt-4">苦情処理(UNS)</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input label="氏名" {...register("complaintUnsName")} />
                <Input label="部署" {...register("complaintUnsDept")} />
              </div>
              <Input label="電話" {...register("complaintUnsPhone")} />

              <h4 className="text-sm font-medium text-[--color-text] mt-4">派遣元責任者</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input label="氏名" {...register("managerUnsName")} />
                <Input label="部署" {...register("managerUnsDept")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="電話" {...register("managerUnsPhone")} />
                <Input label="所在地" {...register("managerUnsAddress")} helper="例: 岡山営業所" />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t border-[--color-border]">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" loading={loading} disabled={!isDirty}>
              {isEdit ? "更新" : "作成"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 6.3 — Factory import tab

- [ ] Create `src/routes/-factory-import-tab.tsx`:

```tsx
// src/routes/-factory-import-tab.tsx
// R18: Diff visual for factory re-import. R20: Template download.

import { useState } from "react";
import { Download, Upload, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useImportFactoriesPreview, useImportFactoriesApply } from "@/lib/hooks/use-factories";
import type { FactoryDiffRow } from "@/lib/api-types";
import ExcelJS from "exceljs";

export function FactoryImportTab() {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [diffs, setDiffs] = useState<FactoryDiffRow[]>([]);
  const [stats, setStats] = useState({ newCount: 0, updateCount: 0, unchangedCount: 0 });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const preview = useImportFactoriesPreview();
  const apply = useImportFactoriesApply();

  async function handleFile(file: File) {
    const buffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) return;

    const headers: string[] = [];
    ws.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? "").trim();
    });

    const parsedRows: Record<string, unknown>[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const obj: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) obj[header] = cell.value;
      });
      if (Object.keys(obj).length > 0) parsedRows.push(obj);
    });

    setRows(parsedRows);

    // Run preview
    preview.mutate(parsedRows, {
      onSuccess: (data) => {
        setDiffs(data.diffs);
        setStats({
          newCount: data.newCount,
          updateCount: data.updateCount,
          unchangedCount: data.unchangedCount,
        });
      },
    });
  }

  function handleApply() {
    if (!rows) return;
    apply.mutate(rows, {
      onSuccess: () => {
        setConfirmOpen(false);
        setRows(null);
        setDiffs([]);
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[--color-text]">工場インポート</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open("/api/import/factories/template", "_blank")}
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          テンプレート
        </Button>
      </div>

      <FileUpload onFile={handleFile} disabled={preview.isPending} />

      {preview.isPending ? (
        <div className="text-sm text-[--color-text-secondary] text-center py-4">解析中...</div>
      ) : null}

      {diffs.length > 0 ? (
        <>
          {/* Stats summary */}
          <div className="flex gap-3">
            <Badge variant="success">新規 {stats.newCount}</Badge>
            <Badge variant="warning">更新 {stats.updateCount}</Badge>
            <Badge variant="secondary">変更なし {stats.unchangedCount}</Badge>
          </div>

          {/* Diff list */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {diffs.map((diff, i) => (
              <Card key={i} className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-[--color-text]">
                    {diff.companyName} / {diff.factoryName}
                  </span>
                  {diff.isNew ? (
                    <Badge variant="success">新規</Badge>
                  ) : (
                    <Badge variant="warning">{diff.changes.length}項目変更</Badge>
                  )}
                  {diff.hasRateChange && diff.hasActiveContracts ? (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-0.5" />
                      単価変更(契約あり)
                    </Badge>
                  ) : null}
                </div>
                {diff.changes.length > 0 ? (
                  <div className="space-y-1">
                    {diff.changes.map((ch, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs">
                        <span className="text-[--color-text-secondary] w-32 shrink-0">{ch.field}</span>
                        <span className="text-red-500 line-through">{ch.oldValue ?? "未設定"}</span>
                        <ArrowRight className="h-3 w-3 text-[--color-text-secondary]" />
                        <span className="text-[--color-success]">{ch.newValue}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setConfirmOpen(true)} disabled={apply.isPending}>
              <Upload className="h-4 w-4 mr-1" />
              適用する ({stats.newCount + stats.updateCount}件)
            </Button>
          </div>

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="工場インポートを適用しますか？"
            description={`新規${stats.newCount}件、更新${stats.updateCount}件の変更を適用します。バックアップは自動作成されます。`}
            confirmLabel="適用"
            onConfirm={handleApply}
            loading={apply.isPending}
          />
        </>
      ) : null}
    </div>
  );
}
```

### Step 6.4 — Companies page (main)

- [ ] Replace the full contents of `src/routes/companies.tsx`:

```tsx
// src/routes/companies.tsx
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Upload as UploadIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCompanies, useCreateCompany, useUpdateCompany } from "@/lib/hooks/use-companies";
import type { Company, Factory } from "@/lib/api-types";
import { CompanyCard } from "./-company-card";
import { FactoryEditor } from "./-factory-editor";
import { FactoryImportTab } from "./-factory-import-tab";
import { useForm } from "react-hook-form";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/companies")({
  component: CompaniesPage,
});

function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("list");
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [factoryEditorOpen, setFactoryEditorOpen] = useState(false);
  const [editingFactory, setEditingFactory] = useState<Factory | null>(null);
  const [factoryCompanyId, setFactoryCompanyId] = useState<number>(0);

  const companies = useCompanies();

  const filtered = (companies.data ?? []).filter((co) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      co.name.toLowerCase().includes(q) ||
      (co.nameKana ?? "").toLowerCase().includes(q) ||
      (co.shortName ?? "").toLowerCase().includes(q)
    );
  });

  function handleEditFactory(factory: Factory) {
    setEditingFactory(factory);
    setFactoryCompanyId(factory.companyId);
    setFactoryEditorOpen(true);
  }

  function handleAddFactory(companyId: number) {
    setEditingFactory(null);
    setFactoryCompanyId(companyId);
    setFactoryEditorOpen(true);
  }

  function handleEditCompany(company: Company) {
    setEditingCompany(company);
    setCompanyDialogOpen(true);
  }

  function handleAddCompany() {
    setEditingCompany(null);
    setCompanyDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="企業・工場"
        description="派遣先企業と工場の管理"
        actions={
          <Button onClick={handleAddCompany}>
            <Plus className="h-4 w-4 mr-1" />
            企業追加
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="list">企業一覧</TabsTrigger>
          <TabsTrigger value="import">
            <UploadIcon className="h-3.5 w-3.5 mr-1" />
            工場インポート
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <Input
            placeholder="企業名で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm mb-4"
          />

          {companies.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-12 w-12" />}
              title={search ? "検索結果なし" : "企業が登録されていません"}
              description={search ? "検索条件を変更してください" : "企業追加ボタンから登録してください"}
              action={!search ? <Button onClick={handleAddCompany}>企業追加</Button> : undefined}
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((co) => (
                <CompanyCard
                  key={co.id}
                  company={co}
                  onEditFactory={handleEditFactory}
                  onAddFactory={handleAddFactory}
                  onEditCompany={handleEditCompany}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="import" className="mt-4">
          <FactoryImportTab />
        </TabsContent>
      </Tabs>

      {/* Company add/edit dialog */}
      <CompanyDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        company={editingCompany}
      />

      {/* Factory editor dialog */}
      <FactoryEditor
        open={factoryEditorOpen}
        onOpenChange={setFactoryEditorOpen}
        factory={editingFactory}
        companyId={factoryCompanyId}
      />
    </div>
  );
}

// ─── Company Add/Edit Dialog ────────────────────────────────────────────
function CompanyDialog({
  open,
  onOpenChange,
  company,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company | null;
}) {
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const isEdit = company !== null;

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      name: company?.name ?? "",
      nameKana: company?.nameKana ?? "",
      shortName: company?.shortName ?? "",
      address: company?.address ?? "",
      phone: company?.phone ?? "",
      representative: company?.representative ?? "",
    },
  });

  // Reset form when dialog opens
  useState(() => {
    if (open) {
      reset({
        name: company?.name ?? "",
        nameKana: company?.nameKana ?? "",
        shortName: company?.shortName ?? "",
        address: company?.address ?? "",
        phone: company?.phone ?? "",
        representative: company?.representative ?? "",
      });
    }
  });

  function onSubmit(data: Record<string, string>) {
    if (isEdit && company) {
      updateCompany.mutate(
        { id: company.id, data },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createCompany.mutate(
        data as { name: string },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={isEdit ? "企業編集" : "新規企業"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Input label="企業名" {...register("name")} required />
          <Input label="フリガナ" {...register("nameKana")} />
          <Input label="略称" {...register("shortName")} />
          <Input label="住所" {...register("address")} />
          <Input label="電話番号" {...register("phone")} />
          <Input label="代表者" {...register("representative")} />
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" loading={createCompany.isPending || updateCompany.isPending}>
              {isEdit ? "更新" : "作成"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 6.5 — Verify

- [ ] Run: `cd C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1 && npx tsc --noEmit`
- [ ] Commit: `feat(companies): agregar pagina de empresas con factory editor, badges R24, import tab R18/R20`

---

## Task 7: Employees Page (TanStack Table + Editor Drawer)

**Files:**
- Modify: `src/routes/employees.tsx`
- Create: `src/routes/-employee-table.tsx`
- Create: `src/routes/-employee-editor.tsx`

### Step 7.1 — Employee table component

- [ ] Create `src/routes/-employee-table.tsx`:

```tsx
// src/routes/-employee-table.tsx
// TanStack Table v8 for employee list with column filtering.

import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { Employee } from "@/lib/api-types";
import { ArrowUpDown } from "lucide-react";

interface EmployeeTableProps {
  data: Employee[];
  onRowClick: (employee: Employee) => void;
}

export function EmployeeTable({ data, onRowClick }: EmployeeTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns: ColumnDef<Employee>[] = useMemo(
    () => [
      {
        accessorKey: "employeeNumber",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting()}
          >
            社員番号 <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        size: 100,
      },
      {
        accessorKey: "fullName",
        header: "氏名",
        size: 160,
      },
      {
        accessorKey: "katakanaName",
        header: "カタカナ",
        size: 140,
      },
      {
        accessorFn: (row) => row.company?.name ?? "—",
        id: "companyName",
        header: "派遣先",
        size: 160,
      },
      {
        accessorFn: (row) => row.factory?.factoryName ?? "—",
        id: "factoryName",
        header: "工場",
        size: 140,
      },
      {
        accessorKey: "billingRate",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting()}
          >
            単価 <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ getValue }) => {
          const v = getValue<number | null>();
          return v != null ? `¥${v.toLocaleString("ja-JP")}` : "—";
        },
        size: 80,
      },
      {
        accessorKey: "hourlyRate",
        header: "時給",
        cell: ({ getValue }) => {
          const v = getValue<number | null>();
          return v != null ? `¥${v.toLocaleString("ja-JP")}` : "—";
        },
        size: 80,
      },
      {
        accessorKey: "nationality",
        header: "国籍",
        size: 80,
      },
      {
        accessorKey: "visaExpiry",
        header: "在留期限",
        cell: ({ getValue }) => {
          const v = getValue<string | null>();
          if (!v) return "—";
          const isExpiring = new Date(v) < new Date(Date.now() + 90 * 86400000);
          return (
            <span className={isExpiring ? "text-[--color-destructive] font-medium" : ""}>
              {v}
            </span>
          );
        },
        size: 100,
      },
      {
        accessorKey: "status",
        header: "状態",
        cell: ({ getValue }) => {
          const v = getValue<string>();
          return (
            <Badge variant={v === "active" ? "success" : "secondary"}>
              {v === "active" ? "在籍" : "退社"}
            </Badge>
          );
        },
        size: 60,
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="overflow-x-auto border border-[--color-border] rounded-[--radius-lg]">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-[--color-border] bg-[--color-bg-secondary]">
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="px-3 py-2 text-left text-xs font-medium text-[--color-text-secondary] uppercase"
                  style={{ width: h.getSize() }}
                >
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[--color-border] hover:bg-[--color-bg-secondary] transition-colors cursor-pointer"
              onClick={() => onRowClick(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2 text-[--color-text]">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.getRowModel().rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-[--color-text-secondary]">
          社員が見つかりません
        </div>
      ) : null}
    </div>
  );
}
```

### Step 7.2 — Employee editor drawer

- [ ] Create `src/routes/-employee-editor.tsx`:

```tsx
// src/routes/-employee-editor.tsx
// Sheet drawer for editing employee details.

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useUpdateEmployee, useCreateEmployee } from "@/lib/hooks/use-employees";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useFactories } from "@/lib/hooks/use-factories";
import type { Employee, EmployeeCreate, EmployeeUpdate } from "@/lib/api-types";
import { X } from "lucide-react";
import { useState } from "react";

interface EmployeeEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

export function EmployeeEditor({ open, onOpenChange, employee }: EmployeeEditorProps) {
  const isEdit = employee !== null;
  const update = useUpdateEmployee();
  const create = useCreateEmployee();
  const companies = useCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const factoriesList = useFactories(selectedCompanyId ?? undefined);

  const { register, handleSubmit, reset, setValue, watch } = useForm<EmployeeCreate & EmployeeUpdate>({
    defaultValues: employee ?? {},
  });

  const watchedCompanyId = watch("companyId");

  useEffect(() => {
    if (open) {
      reset(employee ?? { employeeNumber: "", fullName: "" });
      setSelectedCompanyId(employee?.companyId ?? null);
    }
  }, [open, employee, reset]);

  useEffect(() => {
    if (watchedCompanyId !== selectedCompanyId) {
      setSelectedCompanyId(watchedCompanyId ?? null);
    }
  }, [watchedCompanyId, selectedCompanyId]);

  const companyOptions: ComboboxOption[] = (companies.data ?? []).map((co) => ({
    value: String(co.id),
    label: co.name,
  }));

  const factoryOptions: ComboboxOption[] = (factoriesList.data ?? []).map((f) => ({
    value: String(f.id),
    label: `${f.factoryName}${f.department ? ` / ${f.department}` : ""}`,
  }));

  function onSubmit(data: EmployeeCreate & EmployeeUpdate) {
    if (isEdit && employee) {
      update.mutate(
        { id: employee.id, data },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      create.mutate(data as EmployeeCreate, {
        onSuccess: () => onOpenChange(false),
      });
    }
  }

  const loading = update.isPending || create.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" hideClose className="w-full max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? `社員編集: ${employee?.fullName}` : "新規社員"}</SheetTitle>
          <SheetClose asChild>
            <Button variant="ghost" size="icon">
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="社員番号" {...register("employeeNumber")} required disabled={isEdit} />
            <Input label="氏名" {...register("fullName")} required />
          </div>
          <Input label="カタカナ" {...register("katakanaName")} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="国籍" {...register("nationality")} />
            <Input label="性別" {...register("gender")} />
          </div>

          <Input label="生年月日" type="date" {...register("birthDate")} />
          <Input label="入社日" type="date" {...register("hireDate")} />

          <div className="space-y-1">
            <label className="text-sm font-medium text-[--color-text]">派遣先</label>
            <Combobox
              options={companyOptions}
              value={watchedCompanyId != null ? String(watchedCompanyId) : undefined}
              onValueChange={(v) => {
                setValue("companyId", Number(v));
                setValue("factoryId", null);
              }}
              placeholder="企業を選択"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[--color-text]">工場</label>
            <Combobox
              options={factoryOptions}
              value={watch("factoryId") != null ? String(watch("factoryId")) : undefined}
              onValueChange={(v) => setValue("factoryId", Number(v))}
              placeholder="工場を選択"
              disabled={!selectedCompanyId}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="時給 (¥)" type="number" step="0.01" {...register("hourlyRate", { valueAsNumber: true })} />
            <Input label="単価 (¥)" type="number" step="0.01" {...register("billingRate", { valueAsNumber: true })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="在留資格" {...register("visaType")} />
            <Input label="在留期限" type="date" {...register("visaExpiry")} />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[--color-border]">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" loading={loading}>
              {isEdit ? "更新" : "作成"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

### Step 7.3 — Employees page (main)

- [ ] Replace the full contents of `src/routes/employees.tsx`:

```tsx
// src/routes/employees.tsx
import { useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Users, Search, Filter } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useEmployees } from "@/lib/hooks/use-employees";
import { useCompanies } from "@/lib/hooks/use-companies";
import type { Employee, EmployeeFilterParams } from "@/lib/api-types";
import { EmployeeTable } from "./-employee-table";
import { EmployeeEditor } from "./-employee-editor";

export const Route = createFileRoute("/employees")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const [tab, setTab] = useState("list");
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const filterParams: EmployeeFilterParams = {
    search: search || undefined,
    companyId: companyFilter ? Number(companyFilter) : undefined,
    status: statusFilter || undefined,
  };

  const employees = useEmployees(filterParams);
  const companies = useCompanies();

  const companyOptions: ComboboxOption[] = [
    { value: "", label: "全企業" },
    ...(companies.data ?? []).map((co) => ({
      value: String(co.id),
      label: co.name,
    })),
  ];

  const handleRowClick = useCallback((emp: Employee) => {
    setEditingEmployee(emp);
    setEditorOpen(true);
  }, []);

  function handleAdd() {
    setEditingEmployee(null);
    setEditorOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="社員"
        description="派遣社員の管理とExcelインポート"
        actions={
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-1" />
            社員追加
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="list">社員一覧</TabsTrigger>
          <TabsTrigger value="import">インポート</TabsTrigger>
          <TabsTrigger value="datacheck">データチェック</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--color-text-secondary]" />
              <input
                type="text"
                placeholder="氏名・カタカナ・社員番号で検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full pl-9 pr-3 rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-elevated] text-sm text-[--color-text] placeholder:text-[--color-text-disabled] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
              />
            </div>
            <div className="w-48">
              <Combobox
                options={companyOptions}
                value={companyFilter}
                onValueChange={setCompanyFilter}
                placeholder="企業で絞込"
              />
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={statusFilter === "active" ? "default" : "outline"}
                onClick={() => setStatusFilter("active")}
              >
                在籍
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "all" ? "default" : "outline"}
                onClick={() => setStatusFilter("all")}
              >
                全員
              </Button>
            </div>
          </div>

          {/* Table */}
          {employees.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (employees.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title="社員が見つかりません"
              description="検索条件を変更するか、インポートから社員を登録してください"
            />
          ) : (
            <>
              <div className="text-xs text-[--color-text-secondary]">
                {employees.data!.length}件表示
              </div>
              <EmployeeTable
                data={employees.data!}
                onRowClick={handleRowClick}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="import" className="mt-4">
          {/* Task 8 implements this */}
          <EmptyState
            icon={<Users className="h-12 w-12" />}
            title="インポート機能"
            description="Task 8で実装"
          />
        </TabsContent>

        <TabsContent value="datacheck" className="mt-4">
          {/* Task 8 implements this */}
          <EmptyState
            icon={<Filter className="h-12 w-12" />}
            title="データチェック"
            description="Task 8で実装"
          />
        </TabsContent>
      </Tabs>

      <EmployeeEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        employee={editingEmployee}
      />
    </div>
  );
}
```

### Step 7.4 — Verify

- [ ] Run: `cd C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1 && npx tsc --noEmit`
- [ ] Commit: `feat(employees): agregar pagina de empleados con TanStack Table, filtros y editor drawer`

---

## Task 8: Import Employees Dialog + Data Check Tab

**Files:**
- Create: `src/routes/-employee-import.tsx`
- Create: `src/routes/-data-check-tab.tsx`
- Modify: `src/routes/employees.tsx` (replace placeholder tabs)

### Step 8.1 — Employee import dialog (R11 Takao + R20 template)

- [ ] Create `src/routes/-employee-import.tsx`:

```tsx
// src/routes/-employee-import.tsx
// Employee import with Takao detection (R11) + template download (R20).

import { useState } from "react";
import { Download, Upload, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useImportEmployees } from "@/lib/hooks/use-employees";
import ExcelJS from "exceljs";
import { toast } from "sonner";

export function EmployeeImportTab() {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [mode, setMode] = useState<"upsert" | "skip">("upsert");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; message: string }>;
    takaoDetections: Array<{
      employeeNumber: string;
      isReEntry: boolean;
      actualHireDate: string | null;
      reason: string | null;
    }>;
  } | null>(null);

  const importMutation = useImportEmployees();

  async function handleFile(file: File) {
    setResult(null);
    const buffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) {
      toast.error("シートが見つかりません");
      return;
    }

    const headers: string[] = [];
    ws.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? "").trim();
    });

    const parsedRows: Record<string, unknown>[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const obj: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) obj[header] = cell.value;
      });
      if (Object.keys(obj).length > 0) parsedRows.push(obj);
    });

    setRows(parsedRows);
    setRowCount(parsedRows.length);
  }

  function handleImport() {
    if (!rows) return;
    importMutation.mutate(
      { rows, mode },
      {
        onSuccess: (data) => {
          setResult(data);
          setConfirmOpen(false);
          setRows(null);
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[--color-text]">社員インポート</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open("/api/employees/import/template", "_blank")}
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          テンプレート
        </Button>
      </div>

      <FileUpload onFile={handleFile} />

      {rows ? (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[--color-text]">{rowCount}行を検出</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={mode === "upsert" ? "default" : "outline"}
                onClick={() => setMode("upsert")}
              >
                更新あり
              </Button>
              <Button
                size="sm"
                variant={mode === "skip" ? "default" : "outline"}
                onClick={() => setMode("skip")}
              >
                新規のみ
              </Button>
            </div>
          </div>
          <Button onClick={() => setConfirmOpen(true)} disabled={importMutation.isPending}>
            <Upload className="h-4 w-4 mr-1" />
            インポート実行 ({rowCount}行)
          </Button>
        </Card>
      ) : null}

      {/* Result display */}
      {result ? (
        <Card className="p-4 space-y-3">
          <h4 className="text-sm font-medium text-[--color-text]">インポート結果</h4>
          <div className="flex gap-3">
            <Badge variant="success">新規 {result.created}</Badge>
            <Badge variant="warning">更新 {result.updated}</Badge>
            <Badge variant="secondary">スキップ {result.skipped}</Badge>
            {result.errors.length > 0 ? (
              <Badge variant="destructive">エラー {result.errors.length}</Badge>
            ) : null}
          </div>

          {/* Takao detections (R11) */}
          {result.takaoDetections.length > 0 ? (
            <div className="border border-amber-200 dark:border-amber-800 rounded-[--radius-md] p-3 bg-amber-50 dark:bg-amber-900/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  高雄工業 再入社検出 ({result.takaoDetections.length}件)
                </span>
              </div>
              {result.takaoDetections.map((det, i) => (
                <div key={i} className="text-xs text-amber-700 dark:text-amber-400 pl-6">
                  {det.employeeNumber}: {det.reason}
                  {det.actualHireDate ? ` → actualHireDate: ${det.actualHireDate}` : ""}
                </div>
              ))}
            </div>
          ) : null}

          {/* Import errors */}
          {result.errors.length > 0 ? (
            <div className="space-y-1">
              <h5 className="text-xs font-medium text-[--color-destructive]">エラー詳細:</h5>
              {result.errors.slice(0, 20).map((err, i) => (
                <div key={i} className="text-xs text-[--color-destructive]">
                  行{err.row}: {err.message}
                </div>
              ))}
              {result.errors.length > 20 ? (
                <div className="text-xs text-[--color-text-secondary]">
                  ...他{result.errors.length - 20}件
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="社員インポートを実行しますか？"
        description={`${rowCount}行を${mode === "upsert" ? "更新あり" : "新規のみ"}モードでインポートします。バックアップは自動作成されます。`}
        confirmLabel="インポート"
        onConfirm={handleImport}
        loading={importMutation.isPending}
      />
    </div>
  );
}
```

### Step 8.2 — Data check tab

- [ ] Create `src/routes/-data-check-tab.tsx`:

```tsx
// src/routes/-data-check-tab.tsx
// Completeness matrix integrated in /employees page.

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmployeeCompleteness } from "@/lib/hooks/use-employees";
import type { CompletenessRow, CompletenessLevel } from "@/lib/api-types";
import { CheckCircle, AlertTriangle, XCircle, HelpCircle, Search } from "lucide-react";

const levelConfig: Record<CompletenessLevel, { icon: typeof CheckCircle; variant: "success" | "warning" | "destructive" | "secondary"; label: string }> = {
  green: { icon: CheckCircle, variant: "success", label: "完了" },
  yellow: { icon: AlertTriangle, variant: "warning", label: "一部不足" },
  red: { icon: XCircle, variant: "destructive", label: "不足" },
  gray: { icon: HelpCircle, variant: "secondary", label: "未配属" },
};

export function DataCheckTab() {
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState<CompletenessLevel | "all">("all");
  const completeness = useEmployeeCompleteness();

  const filtered = useMemo(() => {
    let rows = completeness.data ?? [];
    if (filterLevel !== "all") {
      rows = rows.filter((r) => r.level === filterLevel);
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.fullName.toLowerCase().includes(q) ||
          r.employeeNumber.toLowerCase().includes(q) ||
          (r.companyName ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [completeness.data, filterLevel, search]);

  // Stats
  const stats = useMemo(() => {
    const data = completeness.data ?? [];
    return {
      green: data.filter((r) => r.level === "green").length,
      yellow: data.filter((r) => r.level === "yellow").length,
      red: data.filter((r) => r.level === "red").length,
      gray: data.filter((r) => r.level === "gray").length,
      total: data.length,
    };
  }, [completeness.data]);

  if (completeness.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex gap-2">
        <Badge
          variant={filterLevel === "all" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilterLevel("all")}
        >
          全体 {stats.total}
        </Badge>
        <Badge
          variant={filterLevel === "green" ? "success" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilterLevel("green")}
        >
          <CheckCircle className="h-3 w-3 mr-0.5" /> {stats.green}
        </Badge>
        <Badge
          variant={filterLevel === "yellow" ? "warning" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilterLevel("yellow")}
        >
          <AlertTriangle className="h-3 w-3 mr-0.5" /> {stats.yellow}
        </Badge>
        <Badge
          variant={filterLevel === "red" ? "destructive" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilterLevel("red")}
        >
          <XCircle className="h-3 w-3 mr-0.5" /> {stats.red}
        </Badge>
        <Badge
          variant={filterLevel === "gray" ? "secondary" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilterLevel("gray")}
        >
          <HelpCircle className="h-3 w-3 mr-0.5" /> {stats.gray}
        </Badge>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--color-text-secondary]" />
        <input
          type="text"
          placeholder="氏名・社員番号・企業名で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full pl-9 pr-3 rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-elevated] text-sm text-[--color-text] placeholder:text-[--color-text-disabled] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
        />
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {filtered.map((row) => {
          const config = levelConfig[row.level];
          const Icon = config.icon;
          return (
            <Card key={row.employeeId} className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${
                    row.level === "green" ? "text-[--color-success]" :
                    row.level === "yellow" ? "text-amber-500" :
                    row.level === "red" ? "text-[--color-destructive]" :
                    "text-[--color-text-secondary]"
                  }`} />
                  <div>
                    <div className="text-sm font-medium text-[--color-text]">
                      {row.fullName}
                      <span className="ml-2 text-xs text-[--color-text-secondary]">{row.employeeNumber}</span>
                    </div>
                    <div className="text-xs text-[--color-text-secondary]">
                      {row.companyName ?? "未配属"} / {row.factoryName ?? "—"}
                    </div>
                  </div>
                </div>
                <Badge variant={config.variant}>{config.label}</Badge>
              </div>

              {/* Missing fields */}
              {(row.missingEmployee.length > 0 || row.missingFactory.length > 0) ? (
                <div className="mt-2 pl-6 space-y-1">
                  {row.missingEmployee.length > 0 ? (
                    <div className="text-xs text-[--color-text-secondary]">
                      <span className="font-medium">社員:</span> {row.missingEmployee.join(", ")}
                    </div>
                  ) : null}
                  {row.missingFactory.length > 0 ? (
                    <div className="text-xs text-[--color-text-secondary]">
                      <span className="font-medium">工場:</span> {row.missingFactory.join(", ")}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-[--color-text-secondary]">
          {search || filterLevel !== "all" ? "条件に一致する社員がいません" : "社員データがありません"}
        </div>
      ) : null}
    </div>
  );
}
```

### Step 8.3 — Update employees.tsx to wire import and data check tabs

- [ ] In `src/routes/employees.tsx`, replace the two placeholder `TabsContent` blocks:

Replace the import tab placeholder:
```tsx
// REPLACE THIS:
<TabsContent value="import" className="mt-4">
  <EmptyState icon={<Users className="h-12 w-12" />} title="インポート機能" description="Task 8で実装" />
</TabsContent>

// WITH THIS:
<TabsContent value="import" className="mt-4">
  <EmployeeImportTab />
</TabsContent>
```

Replace the data check tab placeholder:
```tsx
// REPLACE THIS:
<TabsContent value="datacheck" className="mt-4">
  <EmptyState icon={<Filter className="h-12 w-12" />} title="データチェック" description="Task 8で実装" />
</TabsContent>

// WITH THIS:
<TabsContent value="datacheck" className="mt-4">
  <DataCheckTab />
</TabsContent>
```

Add the imports at the top of `employees.tsx`:
```typescript
import { EmployeeImportTab } from "./-employee-import";
import { DataCheckTab } from "./-data-check-tab";
```

Remove the now-unused `Filter` import from lucide-react (it was only used by the placeholder).

### Step 8.4 — Verify

- [ ] Run: `cd C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1 && npx tsc --noEmit`
- [ ] Run: `npx vitest run` (run all tests)
- [ ] Commit: `feat(import): agregar import de empleados con deteccion Takao R11, templates R20 y data check`

---

## Summary

| Task | Description | Files | Key features |
|------|-------------|-------|-------------|
| 1 | Types + Query Keys + Validation | 4 create | R17 pre-PDF validation |
| 2 | Companies + Factories routes | 4 create | R18 diff, R20 template, R24 badges endpoint |
| 3 | Employees route + Takao service | 4 create | R11 re-entry detection |
| 4 | Register routes + fix types | 2 modify | Wire everything, fix InferSelectModel |
| 5 | React Query hooks | 4 create | Mutation helpers, invalidation strategy |
| 6 | Companies page | 4 create/modify | Expandable cards, factory editor Dialog, import tab |
| 7 | Employees page | 3 create/modify | TanStack Table, Sheet editor, filters |
| 8 | Import + Data Check | 3 create + 1 modify | Takao UI, completeness matrix |

**Total: 26 files (20 create, 6 modify)**

---

## Critical Rules Reminder

- `closingDayText` / `paymentDayText` are FREE TEXT, not numbers
- Rate priority: `billingRate ?? hourlyRate ?? factory.hourlyRate` — ALWAYS `??`, NEVER `||`
- Factory mutations MUST invalidate BOTH `queryKeys.factories` AND `queryKeys.companies`
- Factory editor uses centered `Dialog`, NOT Sheet drawer
- Never auto-modify `client_companies` or `factories` data — analyze and present only
- `workHours` (text) is the source of truth for shifts
- Employee import: `派遣先ID = 0` must be treated as null
- Query keys via factory pattern — NEVER use raw string arrays
