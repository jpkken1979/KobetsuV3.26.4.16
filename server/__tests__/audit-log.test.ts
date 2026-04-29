/**
 * Cross-cutting test del audit log.
 *
 * El audit_log es el único trail forense del sistema. Si un mutating endpoint
 * deja de escribir su entry, perdemos trazabilidad sin warning.
 *
 * Cobertura por dominio (entityType esperado):
 *   - companies (POST/PUT/DELETE → "company")
 *   - calendars (POST → "calendar")
 *   - contracts (vía batch o single, → "contract") — verificado por
 *     contracts-mutations.test.ts y batch-contracts.test.ts indirectamente.
 *   - admin-crud → cubierto en admin-crud.test.ts
 *   - admin-reset → cubierto en admin-reset.test.ts
 *
 * Estrategia: mini Hono app que monta los routers sin pasar por el
 * adminGuardMiddleware. BEGIN/ROLLBACK por test.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { db, sqlite } from "../db/index.js";
import { auditLog, clientCompanies, factories } from "../db/schema.js";
import { eq, gt } from "drizzle-orm";
import { companiesRouter } from "../routes/companies.js";
import { calendarsRouter } from "../routes/calendars.js";

// ─── Mini app sin middleware ────────────────────────────────────────────────

const testApp = new Hono();
testApp.route("/companies", companiesRouter);
testApp.route("/calendars", calendarsRouter);

const post = (path: string, body: unknown) =>
  testApp.fetch(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
const put = (path: string, body: unknown) =>
  testApp.fetch(
    new Request(`http://localhost${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
const del = (path: string) =>
  testApp.fetch(
    new Request(`http://localhost${path}`, { method: "DELETE" }),
  );

// ─── Aislamiento ────────────────────────────────────────────────────────────

beforeEach(() => {
  sqlite.exec("BEGIN");
});

afterEach(() => {
  sqlite.exec("ROLLBACK");
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function maxAuditId(): Promise<number> {
  const all = await db.select({ id: auditLog.id }).from(auditLog).all();
  return all.reduce((max, r) => (r.id > max ? r.id : max), 0);
}

async function newAuditEntries(sinceId: number) {
  return db.select().from(auditLog).where(gt(auditLog.id, sinceId)).all();
}

// ─── Tests por dominio ──────────────────────────────────────────────────────

describe("audit_log: companies", () => {
  it("POST /companies escribe entry create con entityType='company'", async () => {
    const before = await maxAuditId();

    const res = await post("/companies", { name: "AUDIT-TEST-Company-Create" });
    expect(res.status).toBe(201);
    const created = await res.json() as { id: number; name: string };

    const entries = await newAuditEntries(before);
    const myEntry = entries.find((e) => e.entityId === created.id);
    expect(myEntry).toBeDefined();
    expect(myEntry?.action).toBe("create");
    expect(myEntry?.entityType).toBe("company");
    expect(myEntry?.userName).toBeTruthy();
  });

  it("PUT /companies/:id escribe entry update", async () => {
    const created = db
      .insert(clientCompanies)
      .values({ name: "AUDIT-TEST-ForUpdate" })
      .returning()
      .get();
    const before = await maxAuditId();

    const res = await put(`/companies/${created.id}`, {
      name: "AUDIT-TEST-Updated",
    });
    expect(res.status).toBe(200);

    const entries = await newAuditEntries(before);
    const updateEntry = entries.find((e) => e.entityId === created.id && e.action === "update");
    expect(updateEntry).toBeDefined();
    expect(updateEntry?.entityType).toBe("company");
  });

  it("DELETE /companies/:id (soft delete) escribe entry delete", async () => {
    const created = db
      .insert(clientCompanies)
      .values({ name: "AUDIT-TEST-ForDelete" })
      .returning()
      .get();
    const before = await maxAuditId();

    const res = await del(`/companies/${created.id}`);
    expect(res.status).toBe(200);

    const entries = await newAuditEntries(before);
    const deleteEntry = entries.find((e) => e.entityId === created.id && e.action === "delete");
    expect(deleteEntry).toBeDefined();
    expect(deleteEntry?.entityType).toBe("company");
  });
});

describe("audit_log: calendars", () => {
  it("POST /calendars escribe entry con entityType='calendar'", async () => {
    const company = db
      .insert(clientCompanies)
      .values({ name: "AUDIT-TEST-CompanyForCal" })
      .returning()
      .get();
    const factory = db
      .insert(factories)
      .values({ companyId: company.id, factoryName: "AUDIT-TEST-Factory-Cal" })
      .returning()
      .get();

    const before = await maxAuditId();

    const res = await post("/calendars", {
      factoryId: factory.id,
      year: 2099,
      holidays: [],
      description: "AUDIT-TEST-Calendar",
    });
    // /calendars devuelve 201 (create) o 200 (update — fallback a updateCalendar).
    expect([200, 201]).toContain(res.status);

    const entries = await newAuditEntries(before);
    const calEntry = entries.find((e) => e.entityType === "calendar");
    expect(calEntry).toBeDefined();
    expect(["create", "update"]).toContain(calEntry?.action);
  });
});

describe("audit_log: estructura de entries", () => {
  it("todos los entries generados por mutaciones tienen userName, action, entityType, timestamp", async () => {
    const before = await maxAuditId();
    await post("/companies", { name: "AUDIT-TEST-Structure" });

    const entries = await newAuditEntries(before);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.userName).toBeTruthy();
      expect(e.timestamp).toBeTruthy();
      expect(e.action).toBeTruthy();
      expect(e.entityType).toBeTruthy();
    }
  });

  it("action enum es enforced por Drizzle en TS — DB layer acepta strings arbitrarios", async () => {
    // SQLite no enforce CHECK constraint para text-enums de Drizzle. La validación
    // vive solo a nivel TS/build. Documentamos el comportamiento real para que
    // nadie asuma protección en runtime.
    expect(() => {
      db.insert(auditLog).values({
        action: "frobnicate" as unknown as "create",
        entityType: "test",
        detail: "AUDIT-TEST-arbitrary-action",
      }).run();
    }).not.toThrow();
  });
});

describe("audit_log: integridad forense", () => {
  it("audit_log NO se borra cuando se borra la entidad referenciada", async () => {
    const company = db
      .insert(clientCompanies)
      .values({ name: "AUDIT-TEST-Integrity" })
      .returning()
      .get();

    const auditEntry = db
      .insert(auditLog)
      .values({
        action: "create",
        entityType: "company",
        entityId: company.id,
        detail: "AUDIT-TEST-Integrity entry",
        userName: "test",
      })
      .returning()
      .get();

    // Hard delete la company
    db.delete(clientCompanies).where(eq(clientCompanies.id, company.id)).run();

    // El audit entry debe seguir ahí (el FK no es CASCADE, intencionalmente)
    const stillThere = await db.query.auditLog.findFirst({
      where: eq(auditLog.id, auditEntry.id),
    });
    expect(stillThere).toBeDefined();
    expect(stillThere?.entityId).toBe(company.id);
  });

  it("audit_log no tiene FK constraint hacia entityId — preserva historia post-delete", async () => {
    // Entry para una entidad que NO existe en ninguna tabla.
    const ghost = db
      .insert(auditLog)
      .values({
        action: "delete",
        entityType: "company",
        entityId: 999999, // no existe
        detail: "AUDIT-TEST-ghost-entity",
        userName: "test",
      })
      .returning()
      .get();

    expect(ghost.id).toBeDefined();
    const fetched = await db.query.auditLog.findFirst({ where: eq(auditLog.id, ghost.id) });
    expect(fetched?.entityId).toBe(999999);
  });
});
