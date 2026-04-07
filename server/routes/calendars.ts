import { Hono } from "hono";
import { db } from "../db/index.js";
import { factoryCalendars, auditLog } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { createCalendarSchema } from "../validation.js";
import { parseIdParam } from "../services/db-utils.js";

export const calendarsRouter = new Hono();

// POST /api/calendars — create or update calendar
// NOTE: Must be BEFORE parameterized routes to avoid Hono matching "" as :factoryId
calendarsRouter.post("/", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = createCalendarSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const { factoryId, year, holidays, description } = parsed.data;

    // Calculate total work days (365 - weekends - holidays)
    const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
    let parsedHolidays: unknown[];
    if (Array.isArray(holidays)) {
      parsedHolidays = holidays;
    } else {
      try {
        parsedHolidays = JSON.parse(holidays || "[]");
      } catch {
        return c.json({ error: "Invalid holidays JSON" }, 400);
      }
    }
    const holidayDates: string[] = parsedHolidays.filter((d): d is string =>
      typeof d === "string" && DATE_REGEX.test(d) && !isNaN(new Date(d).getTime())
    );

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);
    let totalWorkDays = 0;
    const holidaySet = new Set(holidayDates);

    for (
      let d = new Date(startOfYear);
      d <= endOfYear;
      d.setDate(d.getDate() + 1)
    ) {
      const day = d.getDay();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${dd}`;
      if (day !== 0 && day !== 6 && !holidaySet.has(dateStr)) {
        totalWorkDays++;
      }
    }

    // Upsert: try update first, then insert
    const existing = await db.query.factoryCalendars.findFirst({
      where: and(
        eq(factoryCalendars.factoryId, factoryId),
        eq(factoryCalendars.year, year)
      ),
    });

    if (existing) {
      const result = db
        .update(factoryCalendars)
        .set({
          holidays: JSON.stringify(holidayDates),
          description: description || null,
          totalWorkDays,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(factoryCalendars.id, existing.id))
        .returning()
        .get();

      db.insert(auditLog).values({
        action: "update",
        entityType: "calendar",
        entityId: result.id,
        detail: `Updated calendar: factory ${factoryId}, year ${year} (${totalWorkDays} work days)`,
        userName: "system",
      }).run();

      return c.json(result);
    }

    const result = db
      .insert(factoryCalendars)
      .values({
        factoryId,
        year,
        holidays: JSON.stringify(holidayDates),
        description: description || null,
        totalWorkDays,
      })
      .returning()
      .get();

    db.insert(auditLog).values({
      action: "create",
      entityType: "calendar",
      entityId: result.id,
      detail: `Created calendar: factory ${factoryId}, year ${year} (${totalWorkDays} work days)`,
      userName: "system",
    }).run();

    return c.json(result, 201);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to save calendar" }, 500);
  }
});

// GET /api/calendars/:factoryId — get all years for a factory
calendarsRouter.get("/:factoryId", async (c) => {
  try {
    const factoryId = parseIdParam(c.req.param("factoryId"));
    if (!factoryId) return c.json({ error: "Invalid ID" }, 400);
    const results = await db.query.factoryCalendars.findMany({
      where: eq(factoryCalendars.factoryId, factoryId),
      orderBy: (t, { desc }) => [desc(t.year)],
    });
    return c.json(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Operation failed";
    return c.json({ error: message }, 500);
  }
});

// GET /api/calendars/:factoryId/:year — get specific year
calendarsRouter.get("/:factoryId/:year", async (c) => {
  try {
    const factoryId = Number(c.req.param("factoryId"));
    const year = Number(c.req.param("year"));
    const result = await db.query.factoryCalendars.findFirst({
      where: and(
        eq(factoryCalendars.factoryId, factoryId),
        eq(factoryCalendars.year, year)
      ),
    });
    if (!result) return c.json({ error: "Calendar not found" }, 404);
    return c.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Operation failed";
    return c.json({ error: message }, 500);
  }
});

// DELETE /api/calendars/:id
calendarsRouter.delete("/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const existing = await db.query.factoryCalendars.findFirst({
      where: eq(factoryCalendars.id, id),
    });
    if (!existing) return c.json({ error: "Calendar not found" }, 404);

    db.delete(factoryCalendars).where(eq(factoryCalendars.id, id)).run();

    db.insert(auditLog).values({
      action: "delete",
      entityType: "calendar",
      entityId: id,
      detail: `Deleted calendar: factory ${existing.factoryId}, year ${existing.year}`,
      userName: "system",
    }).run();

    return c.json({ success: true });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to delete calendar" }, 500);
  }
});
