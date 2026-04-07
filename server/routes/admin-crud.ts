/**
 * Admin CRUD Router
 *
 * Phase 2 of the Admin Database Panel.
 * Provides create / update / delete operations for any of the 8 valid tables.
 * Uses sqlite (better-sqlite3) directly for generic table operations;
 * Drizzle only for the audit-log insert.
 */

import { Hono } from "hono";
import { db, sqlite } from "../db/index.js";
import { auditLog } from "../db/schema.js";

/** All valid table names accepted by this router. */
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

/** Tables where DELETE is blocked. */
const DELETE_BLOCKED = new Set(["client_companies", "factories", "audit_log"]);

/** Entity type strings used in audit_log.entityType. */
const ENTITY_TYPE: Record<string, string> = {
  client_companies: "client_company",
  factories: "factory",
  employees: "employee",
  contracts: "contract",
  contract_employees: "contract_employee",
  factory_calendars: "factory_calendar",
  shift_templates: "shift_template",
  audit_log: "audit_log",
};

export const adminCrudRouter = new Hono();

// ─── Helpers ───────────────────────────────────────────────────────────────

function writeAuditLog(action: "create" | "update" | "delete", entityType: string, entityId: number, detail: string) {
  db.insert(auditLog).values({
    action,
    entityType,
    entityId,
    detail,
    userName: "admin",
  }).run();
}

function isValidTableName(name: string): name is typeof VALID_TABLES extends Set<infer T> ? T : never {
  return VALID_TABLES.has(name);
}

// ─── POST /api/admin/crud/:table — Create row ───────────────────────────────

/**
 * POST /api/admin/crud/:table
 *
 * Body: record to insert (column names must match the table schema).
 * Returns the created record including its generated id (201).
 */
adminCrudRouter.post("/:table", async (c) => {
  const tableName = c.req.param("table");

  if (!isValidTableName(tableName)) {
    return c.json({ error: `Invalid table: "${tableName}". Valid tables: ${[...VALID_TABLES].join(", ")}` }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body || Object.keys(body).length === 0) {
    return c.json({ error: "Request body is required" }, 400);
  }

  try {
    // Inject timestamps (all tables except shift_templates which has no timestamps)
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    if (tableName !== "shift_templates") {
      body = { ...body, createdAt: now, updatedAt: now };
    }

    const columns = Object.keys(body);
    const placeholders = columns.map(() => "?").join(", ");
    const sql = `INSERT INTO "${tableName}" (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`;
    const values = columns.map((k) => body[k]);

    const stmt = sqlite.prepare(sql);
    const result = stmt.all(...values) as Record<string, unknown>[];
    const inserted = result[0];

    if (!inserted) {
      return c.json({ error: "Insert returned no rows" }, 500);
    }

    writeAuditLog("create", ENTITY_TYPE[tableName], inserted.id as number, `Admin created ${ENTITY_TYPE[tableName]} via CRUD panel`);

    return c.json(inserted, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Insert failed: ${message}` }, 500);
  }
});

// ─── PUT /api/admin/crud/:table/:id — Update row ───────────────────────────

/**
 * PUT /api/admin/crud/:table/:id
 *
 * Body: partial record with fields to update.
 * Returns the updated record.
 */
adminCrudRouter.put("/:table/:id", async (c) => {
  const tableName = c.req.param("table");

  if (!isValidTableName(tableName)) {
    return c.json({ error: `Invalid table: "${tableName}". Valid tables: ${[...VALID_TABLES].join(", ")}` }, 400);
  }

  const idParam = c.req.param("id");
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: `Invalid id: "${idParam}". Must be a positive integer.` }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body || Object.keys(body).length === 0) {
    return c.json({ error: "Request body is required" }, 400);
  }

  try {
    // Guard: check record exists
    const existing = sqlite.prepare(`SELECT id FROM "${tableName}" WHERE id = ?`).get(id) as { id: number } | undefined;
    if (!existing) {
      return c.json({ error: `Record id=${id} not found in "${tableName}"` }, 404);
    }

    // Strip protected fields
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (k !== "id" && k !== "createdAt") {
        clean[k] = v;
      }
    }

    // Inject updatedAt
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    clean.updatedAt = now;

    const setPairs = Object.keys(clean).map((k) => `"${k}" = ?`).join(", ");
    const sqlStr = `UPDATE "${tableName}" SET ${setPairs} WHERE id = ? RETURNING *`;
    const values = [...Object.values(clean), id];

    const stmt = sqlite.prepare(sqlStr);
    const result = stmt.all(...values) as Record<string, unknown>[];
    const updated = result[0];

    if (!updated) {
      return c.json({ error: "Update returned no rows" }, 500);
    }

    writeAuditLog("update", ENTITY_TYPE[tableName], id, `Admin updated ${ENTITY_TYPE[tableName]} id=${id} via CRUD panel`);

    return c.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Update failed: ${message}` }, 500);
  }
});

// ─── DELETE /api/admin/crud/:table/:id — Delete row ───────────────────────

/**
 * DELETE /api/admin/crud/:table/:id
 *
 * Blocked for: client_companies, factories, audit_log.
 * Returns { deleted: true, id } on success.
 */
adminCrudRouter.delete("/:table/:id", async (c) => {
  const tableName = c.req.param("table");

  if (!isValidTableName(tableName)) {
    return c.json({ error: `Invalid table: "${tableName}". Valid tables: ${[...VALID_TABLES].join(", ")}` }, 400);
  }

  if (DELETE_BLOCKED.has(tableName)) {
    return c.json({ error: `DELETE is not allowed on table "${tableName}"` }, 403);
  }

  const idParam = c.req.param("id");
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: `Invalid id: "${idParam}". Must be a positive integer.` }, 400);
  }

  try {
    // Guard: check record exists
    const existing = sqlite.prepare(`SELECT id FROM "${tableName}" WHERE id = ?`).get(id) as { id: number } | undefined;
    if (!existing) {
      return c.json({ error: `Record id=${id} not found in "${tableName}"` }, 404);
    }

    sqlite.prepare(`DELETE FROM "${tableName}" WHERE id = ?`).run(id);

    writeAuditLog("delete", ENTITY_TYPE[tableName], id, `Admin deleted ${ENTITY_TYPE[tableName]} id=${id} via CRUD panel`);

    return c.json({ deleted: true, id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Delete failed: ${message}` }, 500);
  }
});
