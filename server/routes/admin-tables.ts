/**
 * Admin Tables Router
 *
 * Provides metadata (name, displayName, row count, column schema) for all 8 tables
 * in the database schema. Used by the admin database panel UI.
 */

import { Hono } from "hono";
import { db } from "../db/index.js";
import {
  clientCompanies,
  factories,
  employees,
  contracts,
  contractEmployees,
  factoryCalendars,
  shiftTemplates,
  auditLog,
} from "../db/schema.js";
import { count } from "drizzle-orm";

/** Canonical map: table name → Japanese display name */
const TABLE_DISPLAY_NAMES: Record<string, string> = {
  client_companies: "取引先企業",
  factories: "工場・ライン",
  employees: "社員",
  contracts: "個別契約書",
  contract_employees: "契約書×社員紐付け",
  factory_calendars: "工場カレンダー",
  shift_templates: "シフトテンプレート",
  audit_log: "監査ログ",
};

/**
 * Infer a SQLite column type label from a Drizzle-typed column definition.
 * Falls back to "text" for unknown types.
 */
function inferColumnType(col: { dataType?: string; driverType?: string }): string {
  const dt = (col.dataType ?? col.driverType ?? "text").toLowerCase();
  if (dt === "number") return "integer";
  if (dt === "boolean") return "boolean";
  if (dt === "real" || dt === "double" || dt === "float") return "real";
  return "text";
}

/** Map foreign-key reference descriptors for built-in tables */
const FK_REFERENCES: Record<string, { table: string; column: string }> = {
  company_id: { table: "client_companies", column: "id" },
  factory_id: { table: "factories", column: "id" },
  employee_id: { table: "employees", column: "id" },
  contract_id: { table: "contracts", column: "id" },
  previous_contract_id: { table: "contracts", column: "id" },
};

/** The 8 tables in schema order */
const TABLES = [
  clientCompanies,
  factories,
  employees,
  contracts,
  contractEmployees,
  factoryCalendars,
  shiftTemplates,
  auditLog,
] as const;

export const adminTablesRouter = new Hono();

/**
 * GET /api/admin/tables
 *
 * Returns an array of table descriptors with:
 * - name, displayName, count, columns
 */
adminTablesRouter.get("/", async (c) => {
  try {
    const results = await Promise.all(
      TABLES.map(async (table) => {
        const name = table._.name;
        const displayName = TABLE_DISPLAY_NAMES[name] ?? name;

        // Row count via Drizzle count()
        const countResult = await db.select({ count: count() }).from(table).execute();
        const rowCount = countResult[0]?.count ?? 0;

        // Column metadata via Drizzle inferred select type
        const selectType = table.$inferSelect;
        const columnEntries = Object.entries(selectType as Record<string, unknown>);

        const columns = columnEntries.map(([colName, colValue]) => {
          const isPrimaryKey = name === "client_companies"
            ? colName === "id"
            : name === "factories"
              ? colName === "id"
              : name === "employees"
                ? colName === "id"
                : name === "contracts"
                  ? colName === "id"
                  : name === "contract_employees"
                    ? colName === "id"
                    : name === "factory_calendars"
                      ? colName === "id"
                      : name === "shift_templates"
                        ? colName === "id"
                        : name === "audit_log"
                          ? colName === "id"
                          : false;

          const isFK = colName in FK_REFERENCES;
          const nullable = true; // Drizzle `.notNull()` is the exception, assume nullable unless known
          const colType = inferColumnType({ driverType: typeof colValue });

          return {
            name: colName,
            type: colType as "text" | "integer" | "real" | "boolean",
            nullable,
            isPrimaryKey: isPrimaryKey as boolean,
            isForeignKey: isFK as boolean,
            references: isFK
              ? (FK_REFERENCES[colName] as { table: string; column: string })
              : undefined,
          };
        });

        return { name, displayName, count: rowCount, columns };
      })
    );

    return c.json(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Failed to fetch table metadata: ${message}` }, 500);
  }
});