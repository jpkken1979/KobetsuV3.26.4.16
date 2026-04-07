# Factory Hierarchy Roles Editor — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow editing 4 shared roles (派遣先責任者, 苦情処理派遣先, 苦情処理UNS, 派遣元責任者UNS) + 2 addresses at the factory level, with automatic propagation to matching lines. Lines with different values (exceptions like リフト作業) are **automatically preserved** — the bulk update only touches lines that already have the majority value.

**Architecture:** UI-only approach (Option A) — the DB stays flat (each line row keeps its own copy of role fields). The frontend groups lines by `factoryName`, auto-detects shared vs. divergent role values, and provides a factory-level editor that bulk-updates **only matching lines** (excludes overrides by default) via a new API endpoint. No schema migration needed.

**Exception Safety Rule:** When bulk-updating a role, lines whose current value differs from the majority are **excluded from the update**. The confirmation dialog shows which lines will be updated and which are preserved. This prevents accidentally overwriting intentional per-line overrides (e.g., リフト作業 has 安藤 as 派遣先責任者, not 服部).

**Tech Stack:** Hono API routes, Drizzle ORM, React, TanStack Query, Zustand (existing), Tailwind CSS 4

---

## Data Analysis (Reference)

**高雄工業株式会社** — 7 factories, 51 lines, 3 regions:

| Factory | Lines | Region | 派遣先責任者 | 苦情(派遣先) | 苦情(UNS) | 派遣元責任者 |
|---------|-------|--------|-------------|-------------|-----------|-------------|
| CVJ工場 | 8 | 岡山 | ✅ 共通 | ✅ 共通 | ✅ 共通 | ✅ 共通 |
| HUB工場 | 5 | 岡山 | ✅ 共通 | ✅ 共通 | ✅ 共通 | ✅ 共通 |
| 本社工場 | 9 | 愛知 | ⚠ 1件異なる (リフト) | ✅ 共通 | ✅ 共通 | ✅ 共通 |
| 海南第一 | 13 | 愛知 | ⚠ 1件異なる (リフト) | ✅ 共通 | ✅ 共通 | ✅ 共通 |
| 海南第二 | 6 | 愛知 | ⚠ 3パターン | ✅ 共通 | ✅ 共通 | ✅ 共通 |
| 第一工場 | 7 | 静岡 | ⚠ 1件異なる | ✅ 共通 | ✅ 共通 | ✅ 共通 |
| 第二工場 | 5 | 静岡 | ✅ 共通 | ✅ 共通 | ✅ 共通 | ✅ 共通 |

**Key rule:** Show factory roles header only when a factory group has > 1 line.

---

## File Structure

### Create

| File | Responsibility |
|------|---------------|
| `server/services/factory-roles.ts` | Factory-level role detection (shared vs divergent) + bulk update logic |
| `src/routes/companies/-factory-roles-header.tsx` | Factory roles header component with inline edit + badges |
| `server/__tests__/factory-roles.test.ts` | Unit tests for factory-roles service |

### Modify

| File | Change |
|------|--------|
| `server/routes/factories.ts` | Add 2 endpoints: GET role-summary, PUT bulk-roles |
| `src/routes/companies/index.tsx` | Integrate FactoryRolesHeader into FactoryPanel (after factory group heading, before line cards) |
| `src/lib/api.ts` | Add types for FactoryGroupRoles API response + bulk update request |
| `src/lib/hooks/use-factories.ts` | Add useFactoryRoles query + useBulkUpdateRoles mutation |

---

## Chunk 1: Backend — Service + API

### Task 1: Write factory-roles service tests

**Files:**
- Create: `server/__tests__/factory-roles.test.ts`

- [x] **Step 1: Write failing tests for role detection**

```typescript
// server/__tests__/factory-roles.test.ts
import { describe, it, expect } from "vitest";
import {
  detectSharedRoles,
  ROLE_GROUPS,
  type RoleKey,
} from "../services/factory-roles.js";

describe("factory-roles", () => {
  describe("detectSharedRoles", () => {
    it("detects all shared when all lines have same values", () => {
      const lines = [
        { id: 1, lineName: "A", department: "製作課",
          hakensakiManagerName: "田中", hakensakiManagerDept: "営業", hakensakiManagerPhone: "090",
          complaintClientName: "山田", complaintClientDept: "人事", complaintClientPhone: "080",
          complaintUnsName: "中山", complaintUnsDept: "営業部", complaintUnsPhone: "052", complaintUnsAddress: null,
          managerUnsName: "景森", managerUnsDept: "岡山", managerUnsPhone: "086", managerUnsAddress: "岡山県..." },
        { id: 2, lineName: "B", department: "製作課",
          hakensakiManagerName: "田中", hakensakiManagerDept: "営業", hakensakiManagerPhone: "090",
          complaintClientName: "山田", complaintClientDept: "人事", complaintClientPhone: "080",
          complaintUnsName: "中山", complaintUnsDept: "営業部", complaintUnsPhone: "052", complaintUnsAddress: null,
          managerUnsName: "景森", managerUnsDept: "岡山", managerUnsPhone: "086", managerUnsAddress: "岡山県..." },
      ];
      const result = detectSharedRoles(lines);
      expect(result.hakensakiManager.shared).toBe(true);
      expect(result.complaintClient.shared).toBe(true);
      expect(result.complaintUns.shared).toBe(true);
      expect(result.managerUns.shared).toBe(true);
      expect(result.hakensakiManager.overrides).toHaveLength(0);
    });

    it("detects override when one line differs", () => {
      const lines = [
        { id: 1, lineName: "Aライン", department: "製作課",
          hakensakiManagerName: "服部", hakensakiManagerDept: "愛知", hakensakiManagerPhone: "056",
          complaintClientName: "山田", complaintClientDept: "人事", complaintClientPhone: "080",
          complaintUnsName: "中山", complaintUnsDept: "営業部", complaintUnsPhone: "052", complaintUnsAddress: null,
          managerUnsName: "中山", managerUnsDept: "営業部", managerUnsPhone: "052", managerUnsAddress: null },
        { id: 2, lineName: "Bライン", department: "製作課",
          hakensakiManagerName: "服部", hakensakiManagerDept: "愛知", hakensakiManagerPhone: "056",
          complaintClientName: "山田", complaintClientDept: "人事", complaintClientPhone: "080",
          complaintUnsName: "中山", complaintUnsDept: "営業部", complaintUnsPhone: "052", complaintUnsAddress: null,
          managerUnsName: "中山", managerUnsDept: "営業部", managerUnsPhone: "052", managerUnsAddress: null },
        { id: 3, lineName: "リフト作業", department: "営業本部",
          hakensakiManagerName: "安藤", hakensakiManagerDept: "愛知", hakensakiManagerPhone: "056",
          complaintClientName: "山田", complaintClientDept: "人事", complaintClientPhone: "080",
          complaintUnsName: "中山", complaintUnsDept: "営業部", complaintUnsPhone: "052", complaintUnsAddress: null,
          managerUnsName: "中山", managerUnsDept: "営業部", managerUnsPhone: "052", managerUnsAddress: null },
      ];
      const result = detectSharedRoles(lines);
      // hakensakiManager differs for リフト
      expect(result.hakensakiManager.shared).toBe(false);
      expect(result.hakensakiManager.majority.name).toBe("服部");
      expect(result.hakensakiManager.overrides).toHaveLength(1);
      expect(result.hakensakiManager.overrides[0].lineId).toBe(3);
      expect(result.hakensakiManager.overrides[0].lineName).toBe("リフト作業");
      // Other roles still shared
      expect(result.complaintClient.shared).toBe(true);
      expect(result.complaintUns.shared).toBe(true);
      expect(result.managerUns.shared).toBe(true);
    });

    it("handles single line (always shared)", () => {
      const lines = [
        { id: 1, lineName: "A", department: "製作課",
          hakensakiManagerName: "田中", hakensakiManagerDept: "営業", hakensakiManagerPhone: "090",
          complaintClientName: "山田", complaintClientDept: "人事", complaintClientPhone: "080",
          complaintUnsName: "中山", complaintUnsDept: "営業部", complaintUnsPhone: "052", complaintUnsAddress: null,
          managerUnsName: "景森", managerUnsDept: "岡山", managerUnsPhone: "086", managerUnsAddress: null },
      ];
      const result = detectSharedRoles(lines);
      expect(result.hakensakiManager.shared).toBe(true);
    });

    it("majority is the most common value, not first", () => {
      const lines = [
        { id: 1, lineName: "品証課", department: "品証課",
          hakensakiManagerName: "副部長 服部", hakensakiManagerDept: "愛知", hakensakiManagerPhone: "056",
          complaintClientName: "Y", complaintClientDept: "D", complaintClientPhone: "P",
          complaintUnsName: "Z", complaintUnsDept: "D", complaintUnsPhone: "P", complaintUnsAddress: null,
          managerUnsName: "Z", managerUnsDept: "D", managerUnsPhone: "P", managerUnsAddress: null },
        { id: 2, lineName: "営業", department: "営業",
          hakensakiManagerName: "部長 金沢", hakensakiManagerDept: "愛知", hakensakiManagerPhone: "056",
          complaintClientName: "Y", complaintClientDept: "D", complaintClientPhone: "P",
          complaintUnsName: "Z", complaintUnsDept: "D", complaintUnsPhone: "P", complaintUnsAddress: null,
          managerUnsName: "Z", managerUnsDept: "D", managerUnsPhone: "P", managerUnsAddress: null },
        { id: 3, lineName: "P研磨", department: "製作課",
          hakensakiManagerName: "工場長 鬼頭", hakensakiManagerDept: "愛知", hakensakiManagerPhone: "056",
          complaintClientName: "Y", complaintClientDept: "D", complaintClientPhone: "P",
          complaintUnsName: "Z", complaintUnsDept: "D", complaintUnsPhone: "P", complaintUnsAddress: null,
          managerUnsName: "Z", managerUnsDept: "D", managerUnsPhone: "P", managerUnsAddress: null },
        { id: 4, lineName: "W研磨", department: "製作課",
          hakensakiManagerName: "工場長 鬼頭", hakensakiManagerDept: "愛知", hakensakiManagerPhone: "056",
          complaintClientName: "Y", complaintClientDept: "D", complaintClientPhone: "P",
          complaintUnsName: "Z", complaintUnsDept: "D", complaintUnsPhone: "P", complaintUnsAddress: null,
          managerUnsName: "Z", managerUnsDept: "D", managerUnsPhone: "P", managerUnsAddress: null },
        { id: 5, lineName: "ト精密", department: "製作課",
          hakensakiManagerName: "工場長 鬼頭", hakensakiManagerDept: "愛知", hakensakiManagerPhone: "056",
          complaintClientName: "Y", complaintClientDept: "D", complaintClientPhone: "P",
          complaintUnsName: "Z", complaintUnsDept: "D", complaintUnsPhone: "P", complaintUnsAddress: null,
          managerUnsName: "Z", managerUnsDept: "D", managerUnsPhone: "P", managerUnsAddress: null },
        { id: 6, lineName: "組立", department: "製作課",
          hakensakiManagerName: "工場長 鬼頭", hakensakiManagerDept: "愛知", hakensakiManagerPhone: "056",
          complaintClientName: "Y", complaintClientDept: "D", complaintClientPhone: "P",
          complaintUnsName: "Z", complaintUnsDept: "D", complaintUnsPhone: "P", complaintUnsAddress: null,
          managerUnsName: "Z", managerUnsDept: "D", managerUnsPhone: "P", managerUnsAddress: null },
      ];
      const result = detectSharedRoles(lines);
      // 鬼頭 appears 4 times (majority), 服部 and 金沢 are overrides
      expect(result.hakensakiManager.majority.name).toBe("工場長 鬼頭");
      expect(result.hakensakiManager.overrides).toHaveLength(2);
      expect(result.hakensakiManager.overrides.map(o => o.lineId)).toEqual([1, 2]);
    });

    it("includes address fields for UNS roles", () => {
      const lines = [
        { id: 1, lineName: "A", department: "製作課",
          hakensakiManagerName: "T", hakensakiManagerDept: "D", hakensakiManagerPhone: "P",
          complaintClientName: "T", complaintClientDept: "D", complaintClientPhone: "P",
          complaintUnsName: "中山", complaintUnsDept: "営業部", complaintUnsPhone: "052", complaintUnsAddress: "名古屋市",
          managerUnsName: "景森", managerUnsDept: "岡山", managerUnsPhone: "086", managerUnsAddress: "岡山県" },
      ];
      const result = detectSharedRoles(lines);
      expect(result.complaintUns.majority.address).toBe("名古屋市");
      expect(result.managerUns.majority.address).toBe("岡山県");
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/factory-roles.test.ts`
Expected: FAIL — module `../services/factory-roles.js` not found

- [x] **Step 3: Commit test file**

```bash
git add server/__tests__/factory-roles.test.ts
git commit -m "test(factory-roles): agregar tests para detección de roles compartidos por fábrica"
```

---

### Task 2: Implement factory-roles service

**Files:**
- Create: `server/services/factory-roles.ts`

- [x] **Step 1: Create the service with role detection logic**

```typescript
// server/services/factory-roles.ts
import { db } from "../db/index.js";
import { factories } from "../db/schema.js";
import { eq, and, inArray } from "drizzle-orm";

// The 4 role groups that are shared at factory level
export const ROLE_GROUPS = {
  hakensakiManager: {
    label: "派遣先責任者",
    fields: { name: "hakensakiManagerName", dept: "hakensakiManagerDept", phone: "hakensakiManagerPhone" },
  },
  complaintClient: {
    label: "苦情処理（派遣先）",
    fields: { name: "complaintClientName", dept: "complaintClientDept", phone: "complaintClientPhone" },
  },
  complaintUns: {
    label: "苦情処理（UNS）",
    fields: { name: "complaintUnsName", dept: "complaintUnsDept", phone: "complaintUnsPhone", address: "complaintUnsAddress" },
  },
  managerUns: {
    label: "派遣元責任者",
    fields: { name: "managerUnsName", dept: "managerUnsDept", phone: "managerUnsPhone", address: "managerUnsAddress" },
  },
} as const;

export type RoleKey = keyof typeof ROLE_GROUPS;

export interface RoleValue {
  name: string | null;
  dept: string | null;
  phone: string | null;
  address?: string | null;
}

export interface RoleOverride {
  lineId: number;
  lineName: string | null;
  department: string | null;
  value: RoleValue;
}

export interface RoleSummary {
  shared: boolean;
  majority: RoleValue;
  overrides: RoleOverride[];
}

export interface FactoryGroupRoles {
  factoryName: string;
  lineCount: number;
  address: string | null;
  roles: Record<RoleKey, RoleSummary>;
}

// Extracts role values from a line record
function extractRoleValue(
  line: Record<string, unknown>,
  fields: { name: string; dept: string; phone: string; address?: string }
): RoleValue {
  const value: RoleValue = {
    name: (line[fields.name] as string | null) ?? null,
    dept: (line[fields.dept] as string | null) ?? null,
    phone: (line[fields.phone] as string | null) ?? null,
  };
  if (fields.address) {
    value.address = (line[fields.address] as string | null) ?? null;
  }
  return value;
}

// Pure function: detects shared vs. divergent roles from a list of lines
// Exported for testing without DB dependency
export function detectSharedRoles(
  lines: Array<Record<string, unknown> & { id: number; lineName: string | null; department: string | null }>
): Record<RoleKey, RoleSummary> {
  const result: Record<string, RoleSummary> = {};

  for (const [roleKey, config] of Object.entries(ROLE_GROUPS)) {
    const values = lines.map((line) => ({
      lineId: line.id,
      lineName: line.lineName,
      department: line.department,
      value: extractRoleValue(line, config.fields),
    }));

    // Find majority (most common value)
    const counts = new Map<string, { count: number; value: RoleValue }>();
    for (const v of values) {
      const key = JSON.stringify(v.value);
      const existing = counts.get(key);
      if (existing) existing.count++;
      else counts.set(key, { count: 1, value: v.value });
    }

    let majority: RoleValue = values[0].value;
    let maxCount = 0;
    for (const [, entry] of counts) {
      if (entry.count > maxCount) {
        maxCount = entry.count;
        majority = entry.value;
      }
    }

    const majorityKey = JSON.stringify(majority);
    const overrides = values
      .filter((v) => JSON.stringify(v.value) !== majorityKey)
      .map((v) => ({ lineId: v.lineId, lineName: v.lineName, department: v.department, value: v.value }));

    result[roleKey] = { shared: overrides.length === 0, majority, overrides };
  }

  return result as Record<RoleKey, RoleSummary>;
}

// DB function: gets role summary for all factories of a company
export function getFactoryGroupRoles(companyId: number): FactoryGroupRoles[] {
  const allLines = db.select().from(factories).where(eq(factories.companyId, companyId)).all();

  // Group by factoryName
  const grouped: Record<string, typeof allLines> = {};
  for (const f of allLines) {
    const name = f.factoryName;
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(f);
  }

  return Object.entries(grouped)
    .map(([factoryName, lines]) => ({
      factoryName,
      lineCount: lines.length,
      address: lines[0]?.address ?? null,
      roles: detectSharedRoles(lines as Array<Record<string, unknown> & { id: number; lineName: string | null; department: string | null }>),
    }))
    .sort((a, b) => a.factoryName.localeCompare(b.factoryName, "ja"));
}

// DB function: bulk-updates a specific role across lines in a factory group
// EXCEPTION SAFETY: excludeLineIds skips lines with intentional overrides (e.g., リフト作業)
export function bulkUpdateFactoryRoles(
  companyId: number,
  factoryName: string,
  roleKey: RoleKey,
  value: RoleValue,
  excludeLineIds: number[] = []
): number {
  const config = ROLE_GROUPS[roleKey];
  const updateData: Record<string, string | null> = {
    [config.fields.name]: value.name,
    [config.fields.dept]: value.dept,
    [config.fields.phone]: value.phone,
  };
  if ("address" in config.fields) {
    updateData[config.fields.address] = value.address ?? null;
  }

  // Get all matching line IDs, then exclude overrides
  const allLines = db
    .select({ id: factories.id })
    .from(factories)
    .where(and(eq(factories.companyId, companyId), eq(factories.factoryName, factoryName)))
    .all();

  const targetIds = allLines
    .map((l) => l.id)
    .filter((id) => !excludeLineIds.includes(id));

  if (targetIds.length === 0) return 0;

  // Update only non-excluded lines using inArray
  const result = db
    .update(factories)
    .set(updateData)
    .where(inArray(factories.id, targetIds))
    .run();

  return result.changes;
}
```

- [x] **Step 2: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/factory-roles.test.ts`
Expected: ALL PASS

- [x] **Step 3: Commit**

```bash
git add server/services/factory-roles.ts
git commit -m "feat(factory-roles): servicio de detección de roles compartidos y bulk update"
```

---

### Task 3: Add API endpoints

**Files:**
- Modify: `server/routes/factories.ts` — add 2 new routes

- [x] **Step 1: Add GET /role-summary/:companyId endpoint**

At the end of the factories router (before `export`), add:

```typescript
import { getFactoryGroupRoles, bulkUpdateFactoryRoles, ROLE_GROUPS, type RoleKey } from "../services/factory-roles.js";

// GET /api/factories/role-summary/:companyId
factoriesRouter.get("/role-summary/:companyId", async (c) => {
  try {
    const companyId = Number(c.req.param("companyId"));
    if (isNaN(companyId)) return c.json({ error: "Invalid companyId" }, 400);
    const result = getFactoryGroupRoles(companyId);
    return c.json(result);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
```

- [x] **Step 2: Add PUT /bulk-roles endpoint**

```typescript
// PUT /api/factories/bulk-roles
factoriesRouter.put("/bulk-roles", async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, factoryName, roleKey, value, excludeLineIds = [] } = body;

    if (!companyId || !factoryName || !roleKey || !value) {
      return c.json({ error: "Missing required fields: companyId, factoryName, roleKey, value" }, 400);
    }
    if (!(roleKey in ROLE_GROUPS)) {
      return c.json({ error: `Invalid roleKey. Must be one of: ${Object.keys(ROLE_GROUPS).join(", ")}` }, 400);
    }

    const updated = bulkUpdateFactoryRoles(
      companyId, factoryName, roleKey as RoleKey, value, excludeLineIds
    );

    // Audit log
    const excludeNote = excludeLineIds.length > 0 ? `, ${excludeLineIds.length} excluded` : "";
    db.insert(auditLog).values({
      action: "update",
      entityType: "factory",
      detail: `Bulk role update: ${roleKey} for ${factoryName} (${updated} lines updated${excludeNote})`,
    }).run();

    return c.json({ updated, excluded: excludeLineIds.length });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
```

- [x] **Step 3: Verify endpoints work**

Run: `npm run dev:server` and test with curl:
```bash
curl http://localhost:8026/api/factories/role-summary/25
```
Expected: JSON array of 7 factory groups with role summaries

- [x] **Step 4: Run full test suite**

Run: `npm run test:run`
Expected: All 157+ tests pass (existing + new)

- [x] **Step 5: Commit**

```bash
git add server/routes/factories.ts
git commit -m "feat(factories): agregar endpoints role-summary y bulk-roles para edición jerárquica"
```

---

## Chunk 2: Frontend — Component + Integration

### Task 4: Add API types and hooks

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/lib/hooks/use-factories.ts`

- [x] **Step 1: Add types to api.ts**

At the end of the interfaces section in `src/lib/api.ts`:

```typescript
// Factory-level role summary types
export type RoleKey = "hakensakiManager" | "complaintClient" | "complaintUns" | "managerUns";

export interface RoleValue {
  name: string | null;
  dept: string | null;
  phone: string | null;
  address?: string | null;
}

export interface RoleOverride {
  lineId: number;
  lineName: string | null;
  department: string | null;
  value: RoleValue;
}

export interface RoleSummary {
  shared: boolean;
  majority: RoleValue;
  overrides: RoleOverride[];
}

export interface FactoryGroupRoles {
  factoryName: string;
  lineCount: number;
  address: string | null;
  roles: Record<RoleKey, RoleSummary>;
}
```

- [x] **Step 2: Add hooks to use-factories.ts**

```typescript
import type { FactoryGroupRoles, RoleKey, RoleValue } from "../api";

export function useFactoryRoles(companyId: number | null) {
  return useQuery<FactoryGroupRoles[]>({
    queryKey: queryKeys.factories.roleSummary(companyId!),
    queryFn: () => api.get(`/api/factories/role-summary/${companyId}`),
    enabled: !!companyId,
  });
}

export function useBulkUpdateRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      companyId: number; factoryName: string; roleKey: RoleKey;
      value: RoleValue; excludeLineIds?: number[];
    }) => api.put("/api/factories/bulk-roles", data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.factories.roleSummary(variables.companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.factories.cascade(variables.companyId) });
    },
    ...onMutationError,
    ...onMutationSuccess("担当者を一括更新しました"),
  });
}
```

- [x] **Step 3: Add query key to query-keys.ts**

In `src/lib/query-keys.ts`, under factories:

```typescript
factories: {
  // ... existing keys ...
  roleSummary: (companyId: number) => ["factories", "role-summary", companyId] as const,
},
```

- [x] **Step 4: Commit**

```bash
git add src/lib/api.ts src/lib/hooks/use-factories.ts src/lib/query-keys.ts
git commit -m "feat(api): agregar tipos y hooks para factory role summary y bulk update"
```

---

### Task 5: Create FactoryRolesHeader component

**Files:**
- Create: `src/routes/companies/-factory-roles-header.tsx`

This is the core UI component. It shows the 4 shared roles per factory group.

- [x] **Step 1: Create the component**

```tsx
// src/routes/companies/-factory-roles-header.tsx
import { useState } from "react";
import { Check, AlertTriangle, Pencil, X, Save, MapPin } from "lucide-react";
import type { FactoryGroupRoles, RoleKey, RoleValue, RoleSummary } from "@/lib/api";
import { useBulkUpdateRoles } from "@/lib/hooks/use-factories";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const ROLE_LABELS: Record<RoleKey, string> = {
  hakensakiManager: "派遣先責任者",
  complaintClient: "苦情処理（派遣先）",
  complaintUns: "苦情処理（UNS）",
  managerUns: "派遣元責任者",
};

const HAS_ADDRESS: RoleKey[] = ["complaintUns", "managerUns"];

interface Props {
  companyId: number;
  group: FactoryGroupRoles;
}

export function FactoryRolesHeader({ companyId, group }: Props) {
  const [editingRole, setEditingRole] = useState<RoleKey | null>(null);
  const [editValue, setEditValue] = useState<RoleValue>({ name: null, dept: null, phone: null });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const bulkUpdate = useBulkUpdateRoles();

  // Don't show for single-line factories — no grouping benefit
  if (group.lineCount <= 1) return null;

  function startEdit(roleKey: RoleKey, current: RoleValue) {
    setEditingRole(roleKey);
    setEditValue({ ...current });
  }

  function cancelEdit() {
    setEditingRole(null);
  }

  function requestSave() {
    setConfirmOpen(true);
  }

  // EXCEPTION SAFETY: exclude override line IDs from bulk update
  function confirmSave() {
    if (!editingRole) return;
    const overrides = group.roles[editingRole].overrides;
    const excludeLineIds = overrides.map((o) => o.lineId);
    bulkUpdate.mutate(
      {
        companyId, factoryName: group.factoryName,
        roleKey: editingRole, value: editValue, excludeLineIds,
      },
      { onSuccess: () => { setEditingRole(null); setConfirmOpen(false); } }
    );
  }

  // Calculate affected vs preserved counts for confirmation
  const editingOverrides = editingRole ? group.roles[editingRole].overrides : [];
  const affectedCount = group.lineCount - editingOverrides.length;

  return (
    <div className="mb-3 rounded-lg border border-border/50 bg-card/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span>担当者（工場共通）</span>
      </div>
      <div className="space-y-1.5">
        {(Object.entries(ROLE_LABELS) as [RoleKey, string][]).map(([roleKey, label]) => {
          const role = group.roles[roleKey];
          const isEditing = editingRole === roleKey;
          const hasAddress = HAS_ADDRESS.includes(roleKey);

          return (
            <RoleRow
              key={roleKey}
              roleKey={roleKey}
              label={label}
              role={role}
              isEditing={isEditing}
              editValue={editValue}
              hasAddress={hasAddress}
              lineCount={group.lineCount}
              onStartEdit={() => startEdit(roleKey, role.majority)}
              onCancelEdit={cancelEdit}
              onRequestSave={requestSave}
              onEditValueChange={setEditValue}
            />
          );
        })}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="担当者を一括更新"
        description={
          editingOverrides.length > 0
            ? `${group.factoryName}の${affectedCount}件のラインに${editingRole ? ROLE_LABELS[editingRole] : ""}を適用します。\n\n以下の${editingOverrides.length}件は異なる値のため更新しません:\n${editingOverrides.map((o) => `• ${o.lineName} (${o.value.name})`).join("\n")}`
            : `${group.factoryName}の全${group.lineCount}ラインに${editingRole ? ROLE_LABELS[editingRole] : ""}を適用しますか？`
        }
        confirmText={`${affectedCount}件に適用`}
        onConfirm={confirmSave}
        loading={bulkUpdate.isPending}
      />
    </div>
  );
}

// --- RoleRow sub-component ---

interface RoleRowProps {
  roleKey: RoleKey;
  label: string;
  role: RoleSummary;
  isEditing: boolean;
  editValue: RoleValue;
  hasAddress: boolean;
  lineCount: number;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onRequestSave: () => void;
  onEditValueChange: (v: RoleValue) => void;
}

function RoleRow({
  label, role, isEditing, editValue, hasAddress, lineCount,
  onStartEdit, onCancelEdit, onRequestSave, onEditValueChange,
}: RoleRowProps) {
  if (isEditing) {
    return (
      <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-primary">{label}</span>
          <div className="flex gap-1">
            <button onClick={onCancelEdit} className="rounded p-1 text-muted-foreground hover:bg-muted">
              <X className="h-3.5 w-3.5" />
            </button>
            <button onClick={onRequestSave} className="rounded bg-primary p-1 text-primary-foreground hover:bg-primary/90">
              <Save className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <input
            className="rounded border border-border bg-background px-2 py-1 text-xs"
            placeholder="氏名"
            value={editValue.name ?? ""}
            onChange={(e) => onEditValueChange({ ...editValue, name: e.target.value || null })}
          />
          <input
            className="rounded border border-border bg-background px-2 py-1 text-xs"
            placeholder="部署"
            value={editValue.dept ?? ""}
            onChange={(e) => onEditValueChange({ ...editValue, dept: e.target.value || null })}
          />
          <input
            className="rounded border border-border bg-background px-2 py-1 text-xs"
            placeholder="電話番号"
            value={editValue.phone ?? ""}
            onChange={(e) => onEditValueChange({ ...editValue, phone: e.target.value || null })}
          />
        </div>
        {hasAddress && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
            <input
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              placeholder="住所（事業所）"
              value={editValue.address ?? ""}
              onChange={(e) => onEditValueChange({ ...editValue, address: e.target.value || null })}
            />
          </div>
        )}
      </div>
    );
  }

  // Display mode
  const { majority, shared, overrides } = role;
  const displayName = majority.name || "未設定";
  const displayDept = majority.dept || "";
  const displayPhone = majority.phone || "";

  return (
    <div className="group flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/50">
      {/* Shared/Override badge */}
      {shared ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-500" />
      ) : (
        <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
      )}

      {/* Label */}
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>

      {/* Value */}
      <span className="flex-1 truncate font-medium">{displayName}</span>
      <span className="hidden truncate text-muted-foreground sm:block">{displayDept}</span>
      <span className="hidden truncate text-muted-foreground md:block">{displayPhone}</span>

      {/* Override count */}
      {!shared && (
        <span
          className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600"
          title={overrides.map((o) => `${o.lineName}: ${o.value.name}`).join("\n")}
        >
          {overrides.length}件異なる
        </span>
      )}

      {/* Address indicator */}
      {hasAddress && majority.address && (
        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" title={majority.address} />
      )}

      {/* Edit button */}
      <button
        onClick={onStartEdit}
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}
```

- [x] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: No errors

- [x] **Step 3: Commit**

```bash
git add src/routes/companies/-factory-roles-header.tsx
git commit -m "feat(companies): componente FactoryRolesHeader para edición jerárquica de roles por fábrica"
```

---

### Task 6: Integrate FactoryRolesHeader into FactoryPanel

**Files:**
- Modify: `src/routes/companies/index.tsx` — FactoryPanel section

The integration point is inside the factory group rendering loop (around line 1613-1807 of index.tsx), where factories are already grouped by `factoryName`. We insert `FactoryRolesHeader` after the group heading and before the grid of FactoryCards.

- [x] **Step 1: Import and add query**

At the top of the file, add:
```typescript
import { FactoryRolesHeader } from "./-factory-roles-header";
import { useFactoryRoles } from "@/lib/hooks/use-factories";
```

Inside the FactoryPanel component, add the query:
```typescript
const { data: roleSummary } = useFactoryRoles(selectedCompany?.id ?? null);
```

- [x] **Step 2: Insert FactoryRolesHeader in the factory group loop**

Find the section where factory groups are mapped (the `Object.entries(grouped).map(...)` block). After the factory group heading (factory name + count badge + 一括設定 button), before the grid of FactoryCards, insert:

```tsx
{/* Factory-level roles header */}
{roleSummary && (() => {
  const groupRoles = roleSummary.find((g) => g.factoryName === factoryName);
  return groupRoles ? (
    <FactoryRolesHeader companyId={selectedCompany!.id} group={groupRoles} />
  ) : null;
})()}
```

- [x] **Step 3: Verify it renders correctly**

Run: `npm run dev` and navigate to `/companies`
- Open 高雄工業
- Each factory group (CVJ工場, HUB工場, etc.) should show the roles header
- Shared roles show ✓ green check, divergent show ⚠ amber with count
- Single-line factories should NOT show the header

- [x] **Step 4: Commit**

```bash
git add src/routes/companies/index.tsx
git commit -m "feat(companies): integrar FactoryRolesHeader en panel de fábricas"
```

---

### Task 7: End-to-end verification + polish

- [x] **Step 1: Run full test suite**

```bash
npm run test:run
```
Expected: All tests pass (existing 157 + new factory-roles tests)

- [x] **Step 2: Run typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: No errors

- [x] **Step 3: Manual E2E testing**

1. Open 高雄工業 → verify 7 factory groups with roles headers
2. CVJ工場: all 4 roles should show ✓ (green check)
3. 本社工場: 派遣先責任者 should show ⚠ 1件異なる (リフト作業)
4. Hover amber badge → tooltip shows "リフト作業: 部長 安藤 忍"
5. Click pencil on 苦情処理(UNS) in 本社工場 → edit mode with 3 inputs + address
6. Change value → click save → confirmation dialog shows:
   - "9件のラインに苦情処理（UNS）を適用します" (all shared, no exceptions)
7. Confirm → 9 lines updated → toast "担当者を一括更新しました"
8. Now click pencil on 派遣先責任者 in 本社工場 → change value → save:
   - Dialog shows "8件のラインに派遣先責任者を適用します"
   - Dialog also shows "以下の1件は異なる値のため更新しません: • リフト作業 (部長 安藤 忍)"
   - Button says "8件に適用" (not 9!)
9. Confirm → verify リフト作業 STILL has 安藤 忍 (preserved!)
10. Verify in drawer: open リフト作業 → 担当者 tab → 安藤 remains unchanged
11. Test with 加藤木材工業 (2 facs, 12 lines) — should also work
12. Test with 瑞陵精機 (1 fac, 1 line) — header should NOT appear
13. Test 海南第二工場 (3 patterns) — should show ⚠ 2件異なる, update only 4 majority lines

- [x] **Step 4: Verify PDF output not affected**

```bash
npx tsx test-pdf.ts
```
Expected: PDFs generate correctly (the bulk update modifies DB fields that PDFs read)

- [x] **Step 5: Final commit**

```bash
git commit -m "feat(companies): verificación completa del editor jerárquico de roles por fábrica"
```

---

## Summary

| Metric | Value |
|--------|-------|
| Files created | 3 (service, component, test) |
| Files modified | 4 (factories route, api types, hooks, index.tsx) |
| Schema changes | 0 |
| New endpoints | 2 (GET role-summary, PUT bulk-roles) |
| Estimated tasks | 7 |
| Risk level | Low (UI-only, no migration, existing data untouched until user edits) |
