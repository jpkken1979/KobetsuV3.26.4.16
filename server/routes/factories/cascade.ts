/**
 * Factory cascade/data routes.
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { factories } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export const factoriesRouter = new Hono();

// GET /api/factories/cascade/:companyId — for cascading select
// NOTE: Must be BEFORE /:id to avoid Hono matching "cascade" as :id
factoriesRouter.get("/cascade/:companyId", async (c) => {
  try {
    const companyId = Number(c.req.param("companyId"));
    const results = await db.query.factories.findMany({
      where: eq(factories.companyId, companyId),
      orderBy: (t, { asc }) => [asc(t.factoryName), asc(t.department), asc(t.lineName)],
    });

    // Group by factoryName → department → lineName for cascading UI
    const grouped: Record<string, Record<string, typeof results>> = {};
    for (const f of results) {
      const fName = f.factoryName;
      const dept = f.department || "—";
      if (!grouped[fName]) grouped[fName] = {};
      if (!grouped[fName][dept]) grouped[fName][dept] = [];
      grouped[fName][dept].push(f);
    }

    return c.json({ flat: results, grouped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Operation failed";
    return c.json({ error: message }, 500);
  }
});