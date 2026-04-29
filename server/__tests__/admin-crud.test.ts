/**
 * Tests para server/routes/admin-crud.ts (CREATE / UPDATE / DELETE genéricos).
 *
 * Cubre:
 *  - Whitelist de tablas (solo VALID_TABLES son válidas)
 *  - DELETE bloqueado en client_companies, factories, audit_log
 *  - Whitelist de columnas (filtra keys que no existen en el schema)
 *  - Validación de id (debe ser entero positivo)
 *  - Errores de body (JSON inválido, body vacío)
 *  - Audit log se escribe en cada mutación exitosa
 *
 * Estrategia: mini Hono app que monta adminCrudRouter sin pasar por el
 * adminGuardMiddleware (eso ya tiene su propio test). Aislamiento por
 * BEGIN/ROLLBACK como en admin-reset.test.ts.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { db, sqlite } from "../db/index.js";
import {
  clientCompanies,
  factories,
  employees,
  shiftTemplates,
  auditLog,
} from "../db/schema.js";
import { eq } from "drizzle-orm";
import { adminCrudRouter } from "../routes/admin-crud.js";

// ─── Mini app sin middleware admin ──────────────────────────────────────────

const testApp = new Hono();
testApp.route("/", adminCrudRouter);

const post = (table: string, body: unknown) =>
  testApp.fetch(
    new Request(`http://localhost/${table}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const put = (table: string, id: number | string, body: unknown) =>
  testApp.fetch(
    new Request(`http://localhost/${table}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const del = (table: string, id: number | string) =>
  testApp.fetch(
    new Request(`http://localhost/${table}/${id}`, { method: "DELETE" }),
  );

// ─── Aislamiento por transacción ────────────────────────────────────────────

beforeEach(() => {
  sqlite.exec("BEGIN");
});

afterEach(() => {
  sqlite.exec("ROLLBACK");
});

// ─── DELETE-block: las 3 tablas críticas ────────────────────────────────────

describe("DELETE bloqueado en tablas críticas", () => {
  it("rechaza DELETE en client_companies con 403", async () => {
    const inserted = db
      .insert(clientCompanies)
      .values({ name: "TEST-DeleteBlock" })
      .returning()
      .get();

    const res = await del("client_companies", inserted.id);
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/not allowed/i);

    // Confirmar que el registro sigue existiendo.
    const stillThere = await db.query.clientCompanies.findFirst({
      where: eq(clientCompanies.id, inserted.id),
    });
    expect(stillThere).toBeDefined();
  });

  it("rechaza DELETE en factories con 403", async () => {
    const company = db
      .insert(clientCompanies)
      .values({ name: "TEST-FactoryDeleteBlock" })
      .returning()
      .get();
    const factory = db
      .insert(factories)
      .values({ companyId: company.id, factoryName: "TEST-Factory" })
      .returning()
      .get();

    const res = await del("factories", factory.id);
    expect(res.status).toBe(403);

    const stillThere = await db.query.factories.findFirst({
      where: eq(factories.id, factory.id),
    });
    expect(stillThere).toBeDefined();
  });

  it("rechaza DELETE en audit_log con 403 (la integridad forense no se rompe)", async () => {
    const entry = db
      .insert(auditLog)
      .values({ action: "create", entityType: "test", detail: "TEST-block" })
      .returning()
      .get();

    const res = await del("audit_log", entry.id);
    expect(res.status).toBe(403);

    const stillThere = await db.query.auditLog.findFirst({
      where: eq(auditLog.id, entry.id),
    });
    expect(stillThere).toBeDefined();
  });

  it("permite DELETE en tablas no-bloqueadas (employees)", async () => {
    const company = db
      .insert(clientCompanies)
      .values({ name: "TEST-EmpDelete" })
      .returning()
      .get();
    const emp = db
      .insert(employees)
      .values({
        fullName: "TEST 削除",
        employeeNumber: "TEST-DEL-001",
        companyId: company.id,
      })
      .returning()
      .get();

    const res = await del("employees", emp.id);
    expect(res.status).toBe(200);
    const body = await res.json() as { deleted: boolean; id: number };
    expect(body.deleted).toBe(true);
    expect(body.id).toBe(emp.id);

    const gone = await db.query.employees.findFirst({
      where: eq(employees.id, emp.id),
    });
    expect(gone).toBeUndefined();
  });

  it("DELETE en tabla no-bloqueada escribe entry en audit_log", async () => {
    const company = db
      .insert(clientCompanies)
      .values({ name: "TEST-AuditDelete" })
      .returning()
      .get();
    const emp = db
      .insert(employees)
      .values({
        fullName: "TEST audit",
        employeeNumber: "TEST-AUD-001",
        companyId: company.id,
      })
      .returning()
      .get();

    await del("employees", emp.id);

    const auditEntries = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, emp.id))
      .all();
    const deleteEntry = auditEntries.find((e) => e.action === "delete" && e.entityType === "employee");
    expect(deleteEntry).toBeDefined();
    expect(deleteEntry?.userName).toBe("admin");
  });
});

// ─── Validación de tabla y id ───────────────────────────────────────────────

describe("validación de inputs", () => {
  it("rechaza tabla no-whitelisted con 400", async () => {
    const res = await del("hackertable", 1);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Invalid table/i);
  });

  it("rechaza id negativo con 400", async () => {
    const res = await del("employees", -1);
    expect(res.status).toBe(400);
  });

  it("rechaza id no numérico con 400", async () => {
    const res = await del("employees", "abc");
    expect(res.status).toBe(400);
  });

  it("rechaza id=0 con 400", async () => {
    const res = await del("employees", 0);
    expect(res.status).toBe(400);
  });

  it("DELETE sobre id inexistente devuelve 404", async () => {
    const res = await del("employees", 99999999);
    expect(res.status).toBe(404);
  });
});

// ─── POST (create) ──────────────────────────────────────────────────────────

describe("POST /:table — creación", () => {
  it("crea shift_templates exitosamente y devuelve 201", async () => {
    const res = await post("shift_templates", {
      name: "TEST-Shift",
      workHours: "08:00-17:00",
      breakTime: "60分",
    });
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.name).toBe("TEST-Shift");
    expect(body.id).toBeDefined();
  });

  it("filtra columnas no-whitelisteadas (e.g. inyección de id manual)", async () => {
    const res = await post("shift_templates", {
      name: "TEST-Filter",
      workHours: "08:00-17:00",
      breakTime: "60分",
      maliciousColumn: "ignored",
      __proto__: "ignored",
    });
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body).not.toHaveProperty("maliciousColumn");
  });

  it("rechaza body vacío con 400", async () => {
    const res = await post("shift_templates", {});
    expect(res.status).toBe(400);
  });

  it("rechaza tabla no-whitelisted con 400", async () => {
    const res = await post("sqlite_master", { name: "x" });
    expect(res.status).toBe(400);
  });

  it("rechaza body solo con columnas inválidas (todas filtradas)", async () => {
    const res = await post("shift_templates", { foo: 1, bar: 2 });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/No valid columns/i);
  });

  it("escribe entry de audit_log en create exitoso", async () => {
    const res = await post("shift_templates", {
      name: "TEST-Audit-Create",
      workHours: "08:00-17:00",
      breakTime: "60分",
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: number };

    const auditEntries = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, body.id))
      .all();
    const createEntry = auditEntries.find((e) => e.action === "create" && e.entityType === "shift_template");
    expect(createEntry).toBeDefined();
  });
});

// ─── PUT (update) ────────────────────────────────────────────────────────────

describe("PUT /:table/:id — update", () => {
  it("actualiza un shift_template existente", async () => {
    const original = db
      .insert(shiftTemplates)
      .values({ name: "TEST-Update-Original", workHours: "07:00-15:00", breakTime: "45分" })
      .returning()
      .get();

    const res = await put("shift_templates", original.id, {
      name: "TEST-Update-Modified",
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.name).toBe("TEST-Update-Modified");
    expect(body.id).toBe(original.id);
  });

  it("rechaza id inexistente con 404", async () => {
    const res = await put("shift_templates", 99999999, { name: "x" });
    expect(res.status).toBe(404);
  });

  it("ignora intento de cambiar id manualmente", async () => {
    const original = db
      .insert(shiftTemplates)
      .values({ name: "TEST-Protected-ID", workHours: "08:00-17:00", breakTime: "60分" })
      .returning()
      .get();

    const res = await put("shift_templates", original.id, {
      id: 99999, // intento de override
      name: "TEST-Protected-ID-Modified",
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { id: number; name: string };
    expect(body.id).toBe(original.id); // no cambia
    expect(body.name).toBe("TEST-Protected-ID-Modified");
  });

  it("rechaza tabla no-whitelisted con 400", async () => {
    const res = await put("sqlite_sequence", 1, { name: "x" });
    expect(res.status).toBe(400);
  });

  it("rechaza body vacío con 400", async () => {
    const original = db
      .insert(shiftTemplates)
      .values({ name: "TEST-EmptyBody", workHours: "08:00-17:00", breakTime: "60分" })
      .returning()
      .get();
    const res = await put("shift_templates", original.id, {});
    expect(res.status).toBe(400);
  });

  it("escribe entry de audit_log en update exitoso", async () => {
    const original = db
      .insert(shiftTemplates)
      .values({ name: "TEST-Audit-Update", workHours: "08:00-17:00", breakTime: "60分" })
      .returning()
      .get();

    await put("shift_templates", original.id, { name: "Updated" });

    const auditEntries = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, original.id))
      .all();
    const updateEntry = auditEntries.find((e) => e.action === "update" && e.entityType === "shift_template");
    expect(updateEntry).toBeDefined();
  });
});
