/**
 * Admin SQL Router
 *
 * Provides a safe SQL runner endpoint for the admin panel.
 * Only SELECT queries are permitted.
 */

import { Hono } from "hono";
import { parseAndValidate, executeSql } from "../services/admin-sql.js";
import { sanitizeErrorMessage } from "../services/error-utils.js";

export const adminSqlRouter = new Hono();

/**
 * POST /api/admin/sql
 *
 * Validates and executes a raw SQL SELECT query.
 * Returns { columns, rows, rowCount, time } on success.
 * Returns { error: string } on validation failure or execution error.
 */
adminSqlRouter.post("/", async (c) => {
  const body = await c.req.json<{ sql: string }>();
  const { sql } = body ?? {};

  // Validate
  const validation = parseAndValidate(sql ?? "");
  if (!validation.safe) {
    return c.json({ error: validation.message ?? "Invalid query." }, 400);
  }

  // Execute
  try {
    const result = executeSql(sql);
    return c.json(result);
  } catch (err: unknown) {
    return c.json({ error: `Query execution failed: ${sanitizeErrorMessage(err)}` }, 400);
  }
});
