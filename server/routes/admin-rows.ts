/**
 * Admin Rows Router
 *
 * Provides paginated, sortable, filterable row data for any table.
 * Used by the admin database panel table-explorer.
 */

import { Hono } from "hono";
import { sqlite } from "../db/index.js";

const VALID_TABLES = new Set([
  "client_companies",
  "factories",
  "employees",
  "contracts",
  "contract_employees",
  "factory_calendars",
  "shift_templates",
  "audit_log",
]);

export const adminRowsRouter = new Hono();

/**
 * GET /api/admin/rows
 *
 * Query params:
 *   table  — table name (required)
 *   page    — 1-based page number (default 1)
 *   pageSize — rows per page (default 25, max 100)
 *   sortBy   — column name to sort by (default: first column)
 *   sortDir  — "asc" | "desc" (default "asc")
 *
 * Returns { rows, total, columns, page, pageSize }
 */
adminRowsRouter.get("/", async (c) => {
  const table = c.req.query("table");
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize") ?? 25)));
  const sortBy = c.req.query("sortBy") ?? "";
  const sortDir = c.req.query("sortDir") === "desc" ? "desc" : "asc";

  if (!table || !VALID_TABLES.has(table)) {
    return c.json({ error: "Invalid or missing table name" }, 400);
  }

  try {
    // Get total count
    const countResult = sqlite.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get() as { count: number };
    const total = countResult?.count ?? 0;

    // Build ORDER BY clause
    let orderClause = "";
    if (sortBy) {
      // Validate column name (simple alphanumeric + underscore check)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(sortBy)) {
        return c.json({ error: "Invalid sortBy column" }, 400);
      }
      orderClause = ` ORDER BY "${sortBy}" ${sortDir.toUpperCase()}`;
    }

    // Build pagination
    const offset = (page - 1) * pageSize;

    const rows = sqlite
      .prepare(`SELECT * FROM "${table}"${orderClause} LIMIT ? OFFSET ?`)
      .all(pageSize, offset) as Record<string, unknown>[];

    // Get column names from first row
    const columns =
      rows.length > 0
        ? Object.keys(rows[0]).map((name) => ({
            name,
            type: "text" as const,
          }))
        : [];

    return c.json({ rows, total, columns, page, pageSize });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Query failed: ${message}` }, 500);
  }
});