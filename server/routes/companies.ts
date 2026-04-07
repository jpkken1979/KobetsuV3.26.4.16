import { Hono } from "hono";
import { db } from "../db/index.js";
import { clientCompanies, factories, auditLog } from "../db/schema.js";
import { and, eq } from "drizzle-orm";
import { createCompanySchema, updateCompanySchema } from "../validation.js";
import { parseIdParam } from "../services/db-utils.js";

export const companiesRouter = new Hono();

// GET /api/companies — list all
companiesRouter.get("/", async (c) => {
  try {
    const includeInactive = c.req.query("includeInactive") === "true";
    const companies = await db.query.clientCompanies.findMany({
      where: includeInactive ? undefined : eq(clientCompanies.isActive, true),
      orderBy: (t, { asc }) => [asc(t.name)],
      with: {
        factories: {
          where: eq(factories.isActive, true),
        },
      },
    });
    return c.json(companies);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Operation failed";
    return c.json({ error: message }, 500);
  }
});

// GET /api/companies/:id
companiesRouter.get("/:id", async (c) => {
  try {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const company = await db.query.clientCompanies.findFirst({
      where: and(eq(clientCompanies.id, id), eq(clientCompanies.isActive, true)),
      with: {
        factories: {
          where: eq(factories.isActive, true),
        },
        employees: true,
      },
    });
    if (!company) return c.json({ error: "Company not found" }, 404);
    return c.json(company);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Operation failed";
    return c.json({ error: message }, 500);
  }
});

// POST /api/companies
companiesRouter.post("/", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = createCompanySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const body = parsed.data;
    const result = db
      .insert(clientCompanies)
      .values(body)
      .returning()
      .get();

    db.insert(auditLog).values({
      action: "create",
      entityType: "company",
      entityId: result.id,
      detail: `Created company: ${result.name}`,
      userName: "system",
    }).run();

    return c.json(result, 201);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to create company" }, 500);
  }
});

// PUT /api/companies/:id
companiesRouter.put("/:id", async (c) => {
  try {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const raw = await c.req.json();
    const parsed = updateCompanySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const body = parsed.data;
    const result = db
      .update(clientCompanies)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(clientCompanies.id, id))
      .returning()
      .get();
    if (!result) return c.json({ error: "Company not found" }, 404);

    db.insert(auditLog).values({
      action: "update",
      entityType: "company",
      entityId: id,
      detail: `Updated company: ${result.name}`,
      userName: "system",
    }).run();

    return c.json(result);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to update company" }, 500);
  }
});

// DELETE /api/companies/:id (soft delete)
companiesRouter.delete("/:id", async (c) => {
  try {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const existing = await db.query.clientCompanies.findFirst({
      where: eq(clientCompanies.id, id),
    });
    if (!existing) return c.json({ error: "Company not found" }, 404);

    db.update(clientCompanies)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(clientCompanies.id, id))
      .run();

    db.insert(auditLog).values({
      action: "delete",
      entityType: "company",
      entityId: id,
      detail: `Deactivated company: ${existing.name}`,
      userName: "system",
    }).run();

    return c.json({ success: true });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to delete company" }, 500);
  }
});
