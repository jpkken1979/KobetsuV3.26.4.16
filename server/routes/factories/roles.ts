/**
 * Factory role management routes.
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { auditLog } from "../../db/schema.js";
import { z } from "zod";
import {
  getFactoryGroupRoles,
  bulkUpdateFactoryRoles,
  ROLE_GROUPS,
  type RoleKey,
} from "../../services/factory-roles.js";

const bulkRolesSchema = z.object({
  companyId: z.number().int().positive(),
  factoryName: z.string().min(1),
  roleKey: z.string().min(1),
  value: z.object({
    name: z.string().nullable(),
    dept: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable().optional(),
  }),
  excludeLineIds: z.array(z.number().int().positive()).default([]),
});

export const factoriesRouter = new Hono();

// GET /api/factories/role-summary/:companyId
factoriesRouter.get("/role-summary/:companyId", async (c) => {
  try {
    const companyId = Number(c.req.param("companyId"));
    if (isNaN(companyId)) return c.json({ error: "Invalid companyId" }, 400);
    const result = getFactoryGroupRoles(companyId);
    return c.json(result);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

// PUT /api/factories/bulk-roles — bulk update a role across all lines in a factory
factoriesRouter.put("/bulk-roles", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = bulkRolesSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0].message }, 400);
    }
    const { companyId, factoryName, roleKey, value, excludeLineIds } = parsed.data;

    if (!(roleKey in ROLE_GROUPS)) {
      return c.json(
        { error: `Invalid roleKey. Must be one of: ${Object.keys(ROLE_GROUPS).join(", ")}` },
        400
      );
    }

    const updated = bulkUpdateFactoryRoles(
      companyId,
      factoryName,
      roleKey as RoleKey,
      value,
      excludeLineIds
    );

    const excludeNote =
      excludeLineIds.length > 0 ? `, ${excludeLineIds.length} excluded` : "";
    db.insert(auditLog)
      .values({
        action: "update",
        entityType: "factory",
        entityId: 0,
        detail: `Bulk role update: ${roleKey} for ${factoryName} (${updated} lines updated${excludeNote})`,
        userName: "system",
      })
      .run();

    return c.json({ updated, excluded: excludeLineIds.length });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});