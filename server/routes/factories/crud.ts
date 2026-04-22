/**
 * Factory CRUD routes.
 */
import { Hono } from "hono";
import { db, sqlite } from "../../db/index.js";
import { factories, employees, contracts, auditLog } from "../../db/schema.js";
import { eq, count } from "drizzle-orm";
import { createFactorySchema, updateFactorySchema } from "../../validation.js";

export const factoriesRouter = new Hono();

const REQUIRED_FACTORY_FIELDS = [
  "supervisorName", "supervisorPhone", "hakensakiManagerName", "hakensakiManagerPhone",
  "address", "workHours", "conflictDate", "closingDayText", "paymentDayText",
  "managerUnsName", "managerUnsPhone",
];

// GET /api/factories — list all (optional ?companyId=)
factoriesRouter.get("/", async (c) => {
  try {
    const companyId = c.req.query("companyId");

    const results = await db.query.factories.findMany({
      where: companyId ? eq(factories.companyId, Number(companyId)) : undefined,
      orderBy: (t, { asc }) => [asc(t.factoryName), asc(t.department), asc(t.lineName)],
      with: { company: true },
    });
    return c.json(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Operation failed";
    return c.json({ error: message }, 500);
  }
});

// GET /api/factories/:id
factoriesRouter.get("/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const factory = await db.query.factories.findFirst({
      where: eq(factories.id, id),
      with: { company: true, employees: true },
    });
    if (!factory) return c.json({ error: "Factory not found" }, 404);
    return c.json(factory);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Operation failed";
    return c.json({ error: message }, 500);
  }
});

// POST /api/factories
factoriesRouter.post("/", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = createFactorySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const body = parsed.data;
    const result = db.insert(factories).values(body).returning().get();

    db.insert(auditLog).values({
      action: "create",
      entityType: "factory",
      entityId: result.id,
      detail: `Created factory: ${result.factoryName} / ${result.department} / ${result.lineName}`,
      userName: "system",
    }).run();

    return c.json(result, 201);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to create factory" }, 500);
  }
});

// PUT /api/factories/:id
factoriesRouter.put("/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const raw = await c.req.json();
    const parsed = updateFactorySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const body = parsed.data;
    const result = db
      .update(factories)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(factories.id, id))
      .returning()
      .get();
    if (!result) return c.json({ error: "Factory not found" }, 404);

    db.insert(auditLog)
      .values({
        action: "update",
        entityType: "factory",
        entityId: id,
        detail: `Updated factory: ${result.factoryName} / ${result.department} / ${result.lineName}`,
        userName: "system",
      })
      .run();

    return c.json(result);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to update factory" }, 500);
  }
});

// DELETE /api/factories/:id
factoriesRouter.delete("/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));

    const result = sqlite.transaction(() => {
      const existing = db.select().from(factories).where(eq(factories.id, id)).get();

      if (!existing) return { error: "Factory not found", status: 404 as const };

      // Prevent deletion if factory has active employees or contracts
      const empCount = db.select({ c: count() }).from(employees).where(eq(employees.factoryId, id)).get();
      if ((empCount?.c ?? 0) > 0) {
        return {
          error: `この工場には ${empCount!.c} 名の社員が配属されています。先に社員の配属を変更してください。`,
          status: 400 as const,
        };
      }
      const conCount = db.select({ c: count() }).from(contracts).where(eq(contracts.factoryId, id)).get();
      if ((conCount?.c ?? 0) > 0) {
        return {
          error: `この工場には ${conCount!.c} 件の契約があります。先に契約を移動してください。`,
          status: 400 as const,
        };
      }

      db.delete(factories).where(eq(factories.id, id)).run();

      db.insert(auditLog)
        .values({
          action: "delete",
          entityType: "factory",
          entityId: id,
          detail: `Deleted factory: ${existing.factoryName} / ${existing.department} / ${existing.lineName}`,
          userName: "system",
        })
        .run();

      return { success: true } as const;
    })();

    if ("error" in result) {
      return c.json({ error: result.error }, result.status);
    }
    return c.json(result);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to delete factory" }, 500);
  }
});

export { REQUIRED_FACTORY_FIELDS };