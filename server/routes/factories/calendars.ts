/**
 * Factory calendar routes.
 */
import { Hono } from "hono";
import { db, sqlite } from "../../db/index.js";
import { factories, employees, auditLog } from "../../db/schema.js";
import { eq, count } from "drizzle-orm";
import { z } from "zod";

const bulkCalendarSchema = z.object({
  calendarText: z.string().min(1, "calendarText is required"),
});

export const factoriesRouter = new Hono();

// PUT /api/factories/bulk-calendar — update worker calendar text on all active factories
factoriesRouter.put("/bulk-calendar", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = bulkCalendarSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const { calendarText } = parsed.data;

    const result = sqlite.transaction(() => {
      const updated = db
        .update(factories)
        .set({ workerCalendar: calendarText, updatedAt: new Date().toISOString() })
        .where(eq(factories.isActive, true))
        .returning({ id: factories.id })
        .all();

      db.insert(auditLog)
        .values({
          action: "update",
          entityType: "factory",
          entityId: 0,
          detail: `Bulk worker calendar update: ${updated.length} factories → "${calendarText}"`,
          userName: "system",
        })
        .run();

      return updated;
    })();

    return c.json({ updated: result.length, calendarText });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to bulk update calendars" }, 500);
  }
});

// GET /api/factories/badges/:companyId — factory badge status R24 (MUST come before /:id)
factoriesRouter.get("/badges/:companyId", async (c) => {
  try {
    const companyId = Number(c.req.param("companyId"));
    if (Number.isNaN(companyId)) return c.json({ error: "Invalid companyId" }, 400);

    const facs = await db.query.factories.findMany({
      where: eq(factories.companyId, companyId),
      with: { calendars: true },
    });

    const empCounts = db
      .select({ factoryId: employees.factoryId, cnt: count() })
      .from(employees)
      .where(eq(employees.companyId, companyId))
      .groupBy(employees.factoryId)
      .all();

    const empCountMap = new Map(empCounts.map((r) => [r.factoryId, r.cnt]));

    const REQUIRED_FACTORY_FIELDS = [
      "supervisorName", "supervisorPhone", "hakensakiManagerName", "hakensakiManagerPhone",
      "address", "workHours", "conflictDate", "closingDayText", "paymentDayText",
      "managerUnsName", "managerUnsPhone",
    ];

    const badges = facs.map((f) => {
      const missing: string[] = [];
      for (const field of REQUIRED_FACTORY_FIELDS) {
        const val = (f as Record<string, unknown>)[field];
        if (val === null || val === undefined || val === "") {
          missing.push(field);
        }
      }
      const currentYear = new Date().getFullYear();
      const hasCalendar = f.calendars.some((cal) => cal.year === currentYear);
      return {
        factoryId: f.id,
        factoryName: f.factoryName,
        department: f.department,
        lineName: f.lineName,
        dataComplete: missing.length === 0 ? "ok" : missing.length <= 3 ? "warning" : "error",
        hasCalendar,
        employeeCount: empCountMap.get(f.id) ?? 0,
        conflictDate: f.conflictDate,
        missingFields: missing,
      };
    });

    return c.json(badges);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Operation failed" }, 500);
  }
});
