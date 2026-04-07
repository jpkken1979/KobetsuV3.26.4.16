import { db } from "../db/index.js";
import { factories } from "../db/schema.js";
import { eq, and, inArray } from "drizzle-orm";

// The 4 role groups that are shared at factory level
export const ROLE_GROUPS = {
  hakensakiManager: {
    label: "派遣先責任者",
    fields: {
      name: "hakensakiManagerName",
      dept: "hakensakiManagerDept",
      phone: "hakensakiManagerPhone",
    },
  },
  complaintClient: {
    label: "苦情処理（派遣先）",
    fields: {
      name: "complaintClientName",
      dept: "complaintClientDept",
      phone: "complaintClientPhone",
    },
  },
  complaintUns: {
    label: "苦情処理（UNS）",
    fields: {
      name: "complaintUnsName",
      dept: "complaintUnsDept",
      phone: "complaintUnsPhone",
      address: "complaintUnsAddress",
    },
  },
  managerUns: {
    label: "派遣元責任者",
    fields: {
      name: "managerUnsName",
      dept: "managerUnsDept",
      phone: "managerUnsPhone",
      address: "managerUnsAddress",
    },
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
  lines: Array<
    Record<string, unknown> & {
      id: number;
      lineName: string | null;
      department: string | null;
    }
  >
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
      .map((v) => ({
        lineId: v.lineId,
        lineName: v.lineName,
        department: v.department,
        value: v.value,
      }));

    result[roleKey] = { shared: overrides.length === 0, majority, overrides };
  }

  return result as Record<RoleKey, RoleSummary>;
}

// DB function: gets role summary for all factories of a company
export function getFactoryGroupRoles(
  companyId: number
): FactoryGroupRoles[] {
  const allLines = db
    .select()
    .from(factories)
    .where(eq(factories.companyId, companyId))
    .all();

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
      roles: detectSharedRoles(
        lines as Array<
          Record<string, unknown> & {
            id: number;
            lineName: string | null;
            department: string | null;
          }
        >
      ),
    }))
    .sort((a, b) => a.factoryName.localeCompare(b.factoryName, "ja"));
}

// DB function: bulk-updates a specific role across lines in a factory group
// EXCEPTION SAFETY: excludeLineIds skips lines with intentional overrides
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
    .where(
      and(eq(factories.companyId, companyId), eq(factories.factoryName, factoryName))
    )
    .all();

  const targetIds = allLines
    .map((l) => l.id)
    .filter((id) => !excludeLineIds.includes(id));

  if (targetIds.length === 0) return 0;

  // Update only non-excluded lines
  const result = db
    .update(factories)
    .set(updateData)
    .where(inArray(factories.id, targetIds))
    .run();

  return result.changes;
}
