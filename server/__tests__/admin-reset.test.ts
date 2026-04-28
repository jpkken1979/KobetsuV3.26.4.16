/**
 * Integration tests for POST /api/admin/reset-all
 *
 * Usa una mini Hono app que bypassa adminGuardMiddleware para testear
 * exclusivamente la lógica de negocio del endpoint.
 * Aislamiento: sqlite BEGIN/ROLLBACK wrappea cada test.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { db, sqlite } from "../db/index.js";
import {
  clientCompanies,
  factories,
  employees,
  contracts,
  contractEmployees,
  shiftTemplates,
  factoryCalendars,
  pdfVersions,
  auditLog,
} from "../db/schema.js";
import { count } from "drizzle-orm";

// ─── Setup: mini Hono app + aislamiento por transacción ─────────────────────

// Import lazy para que adminResetRouter exista cuando corremos los tests
// (el archivo todavía no existe — estos tests deben FALLAR primero)
let adminResetRouter: Hono;
try {
  const mod = await import("../routes/admin-reset.js");
  adminResetRouter = mod.adminResetRouter;
} catch {
  adminResetRouter = new Hono(); // placeholder vacío — tests fallarán
}

const testApp = new Hono();
testApp.route("/reset-all", adminResetRouter);

const postReset = (body: unknown) =>
  testApp.fetch(
    new Request("http://localhost/reset-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

// ─── Aislamiento: cada test en su propia transacción que se revierte ─────────

beforeEach(() => {
  sqlite.exec("BEGIN");
});

afterEach(() => {
  sqlite.exec("ROLLBACK");
});

// ─── Helper: insertar datos mínimos para testear el reset ────────────────────

function insertTestData() {
  const company = db
    .insert(clientCompanies)
    .values({ name: "テスト会社" })
    .returning()
    .get();
  const factory = db
    .insert(factories)
    .values({ companyId: company.id, factoryName: "テスト工場" })
    .returning()
    .get();
  db.insert(employees)
    .values({
      fullName: "テスト社員",
      employeeNumber: "TEST-001",
      companyId: company.id,
      factoryId: factory.id,
    })
    .run();
  db.insert(shiftTemplates)
    .values({ name: "テストシフト", workHours: "08:00-17:00", breakTime: "60分" })
    .run();
  return { companyId: company.id, factoryId: factory.id };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /reset-all — lógica de negocio", () => {
  it("returns 200 with correct deleted counts", async () => {
    insertTestData();

    const res = await postReset({ confirm: "RESET" });
    expect(res.status).toBe(200);

    const body = await res.json() as {
      success: boolean;
      deleted: Record<string, number>;
    };
    expect(body.success).toBe(true);
    expect(body.deleted).toHaveProperty("clientCompanies");
    expect(body.deleted).toHaveProperty("factories");
    expect(body.deleted).toHaveProperty("employees");
    expect(body.deleted).toHaveProperty("contracts");
    expect(body.deleted).toHaveProperty("contractEmployees");
    expect(body.deleted).toHaveProperty("factoryCalendars");
    expect(body.deleted).toHaveProperty("shiftTemplates");
    expect(body.deleted).toHaveProperty("pdfVersions");
    expect(body.deleted.clientCompanies).toBeGreaterThanOrEqual(1);
    expect(body.deleted.employees).toBeGreaterThanOrEqual(1);
    expect(body.deleted.shiftTemplates).toBeGreaterThanOrEqual(1);
  });

  it("returns 400 when confirm field is wrong string", async () => {
    const res = await postReset({ confirm: "YES" });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("Confirmación inválida");
  });

  it("returns 400 when confirm field is missing", async () => {
    const res = await postReset({});
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(typeof body.error).toBe("string");
  });

  it("returns 400 when body is empty object (raw request)", async () => {
    const res = await testApp.fetch(
      new Request("http://localhost/reset-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("leaves all 8 tables empty after successful reset", async () => {
    insertTestData();

    const res = await postReset({ confirm: "RESET" });
    expect(res.status).toBe(200);

    const [ccCount] = await db.select({ n: count() }).from(clientCompanies);
    const [fCount] = await db.select({ n: count() }).from(factories);
    const [empCount] = await db.select({ n: count() }).from(employees);
    const [cCount] = await db.select({ n: count() }).from(contracts);
    const [ceCount] = await db.select({ n: count() }).from(contractEmployees);
    const [stCount] = await db.select({ n: count() }).from(shiftTemplates);
    const [fcCount] = await db.select({ n: count() }).from(factoryCalendars);
    const [pvCount] = await db.select({ n: count() }).from(pdfVersions);

    expect(ccCount.n).toBe(0);
    expect(fCount.n).toBe(0);
    expect(empCount.n).toBe(0);
    expect(cCount.n).toBe(0);
    expect(ceCount.n).toBe(0);
    expect(stCount.n).toBe(0);
    expect(fcCount.n).toBe(0);
    expect(pvCount.n).toBe(0);
  });

  it("writes a reset entry to audit_log with entityType ALL_TABLES", async () => {
    insertTestData();

    const [beforeCount] = await db.select({ n: count() }).from(auditLog);
    await postReset({ confirm: "RESET" });
    const [afterCount] = await db.select({ n: count() }).from(auditLog);

    expect(afterCount.n).toBe(beforeCount.n + 1);

    const allLogs = await db.select().from(auditLog).all();
    const resetEntry = allLogs.find((l) => l.entityType === "ALL_TABLES");
    expect(resetEntry).toBeDefined();
    expect(resetEntry?.action).toBe("delete");
    expect(resetEntry?.userName).toBe("admin");
    expect(resetEntry?.detail).toBeTruthy();

    // detail es JSON envuelto por buildAuditDetail (M-3, audit 2026-04-28):
    // { message, ip, userAgent, ts, payload: { clientCompanies, employees, ... } }
    if (!resetEntry?.detail) throw new Error("resetEntry or detail missing");
    const detail = JSON.parse(resetEntry.detail) as {
      message: string;
      ip: string;
      ts: string;
      payload: Record<string, number>;
    };
    expect(detail.message).toBe("Admin reset-all");
    expect(detail.payload).toHaveProperty("clientCompanies");
    expect(detail.payload).toHaveProperty("employees");
  });

  it("does NOT delete pre-existing audit_log entries", async () => {
    // Insertar una entrada de audit_log ANTES del reset
    db.insert(auditLog).values({
      action: "create",
      entityType: "employees",
      entityId: 1,
      detail: "pre-existing entry",
      userName: "system",
    }).run();

    insertTestData();

    await postReset({ confirm: "RESET" });

    const allLogs = await db.select().from(auditLog).all();
    const preExisting = allLogs.find((l) => l.entityType === "employees" && l.detail === "pre-existing entry");
    expect(preExisting).toBeDefined();
  });
});
