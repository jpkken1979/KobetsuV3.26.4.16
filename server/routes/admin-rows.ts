/**
 * Admin Rows Router
 *
 * Provides paginated, sortable, filterable row data for any table.
 * Used by the admin database panel table-explorer.
 */

import { Hono } from "hono";
import { z } from "zod";
import { sqlite } from "../db/index.js";

const VALID_TABLES = [
  "client_companies",
  "factories",
  "employees",
  "contracts",
  "contract_employees",
  "factory_calendars",
  "shift_templates",
  "audit_log",
] as const;

const COLUMN_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const querySchema = z.object({
  table: z.enum(VALID_TABLES),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.string().regex(COLUMN_NAME_RE).optional(),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

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
  const parsed = querySchema.safeParse({
    table: c.req.query("table"),
    page: c.req.query("page"),
    pageSize: c.req.query("pageSize"),
    sortBy: c.req.query("sortBy") || undefined,
    sortDir: c.req.query("sortDir"),
  });

  if (!parsed.success) {
    return c.json({ error: "Invalid query parameters", details: parsed.error.issues }, 400);
  }

  const { table, page, pageSize, sortBy, sortDir } = parsed.data;

  try {
    // Get total count
    const countResult = sqlite.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get() as { count: number };
    const total = countResult?.count ?? 0;

    // Build ORDER BY clause (sortBy ya validado por Zod regex)
    const orderClause = sortBy ? ` ORDER BY "${sortBy}" ${sortDir.toUpperCase()}` : "";

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