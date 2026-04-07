import { Hono } from "hono";
import { db } from "../db/index.js";
import {
  contracts,
  employees,
  clientCompanies,
  factories,
  auditLog,
} from "../db/schema.js";
import { count, eq, and, gte, lte, desc, like, isNotNull } from "drizzle-orm";
import { toLocalDateStr } from "../services/contract-dates.js";

export const dashboardRouter = new Hono();

import { escapeLike } from "../services/db-utils.js";

function clampDays(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(365, Math.max(1, Math.round(parsed)));
}

// GET /api/dashboard/stats — Summary counts
dashboardRouter.get("/stats", async (c) => {
  try {
    const today = toLocalDateStr(new Date());
    const warningDays = clampDays(c.req.query("warningDays"), 30);
    const expiryWindow = toLocalDateStr(new Date(Date.now() + warningDays * 24 * 60 * 60 * 1000));

    const [
      totalCompanies,
      totalFactories,
      totalActiveEmployees,
      totalContracts,
      activeContracts,
      expiringContracts,
    ] = await Promise.all([
      db
        .select({ count: count() })
        .from(clientCompanies)
        .where(eq(clientCompanies.isActive, true)),
      db
        .select({ count: count() })
        .from(factories)
        .where(eq(factories.isActive, true)),
      db
        .select({ count: count() })
        .from(employees)
        .where(eq(employees.status, "active")),
      db.select({ count: count() }).from(contracts),
      db
        .select({ count: count() })
        .from(contracts)
        .where(eq(contracts.status, "active")),
      db
        .select({ count: count() })
        .from(contracts)
        .where(
          and(
            eq(contracts.status, "active"),
            gte(contracts.endDate, today),
            lte(contracts.endDate, expiryWindow)
          )
        ),
    ]);

    return c.json({
      companies: totalCompanies[0].count,
      factories: totalFactories[0].count,
      activeEmployees: totalActiveEmployees[0].count,
      totalContracts: totalContracts[0].count,
      activeContracts: activeContracts[0].count,
      expiringInDays: expiringContracts[0].count,
    });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to load stats" }, 500);
  }
});

// GET /api/dashboard/expiring — Contracts expiring in next N days (default 30)
dashboardRouter.get("/expiring", async (c) => {
  try {
    const today = toLocalDateStr(new Date());
    const warningDays = clampDays(c.req.query("warningDays"), 30);
    const expiryWindow = toLocalDateStr(new Date(Date.now() + warningDays * 24 * 60 * 60 * 1000));

    const results = await db.query.contracts.findMany({
      where: and(
        eq(contracts.status, "active"),
        gte(contracts.endDate, today),
        lte(contracts.endDate, expiryWindow)
      ),
      orderBy: [contracts.endDate],
      with: { company: true, factory: true, employees: true },
    });

    return c.json(results);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to load expiring contracts" }, 500);
  }
});

// GET /api/dashboard/teishokubi — 抵触日 alerts (factories approaching conflict date)
dashboardRouter.get("/teishokubi", async (c) => {
  try {
    const today = toLocalDateStr(new Date());
    const warningDays = clampDays(c.req.query("warningDays"), 180);
    const warningDate = toLocalDateStr(new Date(Date.now() + warningDays * 24 * 60 * 60 * 1000));

    const alerts = await db.query.factories.findMany({
      where: and(
        eq(factories.isActive, true),
        isNotNull(factories.conflictDate),
        gte(factories.conflictDate, today),
        lte(factories.conflictDate, warningDate)
      ),
      with: { company: true },
      orderBy: (t, { asc }) => [asc(t.conflictDate)],
    });

    return c.json(alerts);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to load teishokubi alerts" }, 500);
  }
});

// GET /api/dashboard/visa-expiry — Employees with visas expiring soon
dashboardRouter.get("/visa-expiry", async (c) => {
  try {
    const today = toLocalDateStr(new Date());
    const ninetyDaysLater = toLocalDateStr(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    const expiring = await db.query.employees.findMany({
      where: and(
        eq(employees.status, "active"),
        isNotNull(employees.visaExpiry),
        gte(employees.visaExpiry, today),
        lte(employees.visaExpiry, ninetyDaysLater)
      ),
      with: { company: true },
      orderBy: (t, { asc }) => [asc(t.visaExpiry)],
    });

    return c.json(expiring);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to load visa expiry data" }, 500);
  }
});

// GET /api/dashboard/nationality — Breakdown by nationality (SQL aggregate)
dashboardRouter.get("/nationality", async (c) => {
  try {
    const results = db
      .select({
        nationality: employees.nationality,
        count: count(),
      })
      .from(employees)
      .where(eq(employees.status, "active"))
      .groupBy(employees.nationality)
      .orderBy(desc(count()))
      .all();

    const sorted = results.map((r) => ({
      nationality: r.nationality || "不明",
      count: r.count,
    }));

    return c.json(sorted);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to load nationality data" }, 500);
  }
});

// GET /api/dashboard/by-company — Employee count per company (SQL aggregate + join)
dashboardRouter.get("/by-company", async (c) => {
  try {
    const results = db
      .select({
        companyName: clientCompanies.name,
        count: count(),
      })
      .from(employees)
      .leftJoin(clientCompanies, eq(employees.companyId, clientCompanies.id))
      .where(eq(employees.status, "active"))
      .groupBy(clientCompanies.name)
      .orderBy(desc(count()))
      .all();

    const sorted = results.map((r) => ({
      companyName: r.companyName || "未配属",
      count: r.count,
    }));

    return c.json(sorted);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to load company breakdown" }, 500);
  }
});

// GET /api/dashboard/audit — Recent audit log entries
dashboardRouter.get("/audit", async (c) => {
  try {
    const rawLimit = Number(c.req.query("limit")) || 50;
    const rawOffset = Number(c.req.query("offset")) || 0;
    const limit = Math.min(Math.max(rawLimit, 1), 500);
    const offset = Math.max(rawOffset, 0);
    const action = c.req.query("action");
    const entityType = c.req.query("entityType");
    const search = c.req.query("search");

    // For filtering, use direct select
    const conditions = [
      action ? eq(auditLog.action, action as typeof auditLog.action.enumValues[number]) : undefined,
      entityType ? eq(auditLog.entityType, entityType) : undefined,
      search ? like(auditLog.detail, `%${escapeLike(search)}%`) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [results, totalResult] = await Promise.all([
      db.query.auditLog.findMany({
        where: whereClause,
        orderBy: [desc(auditLog.timestamp)],
        limit,
        offset,
      }),
      db.select({ count: count() }).from(auditLog).where(whereClause),
    ]);

    return c.json({ logs: results, total: totalResult[0].count });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to load audit log" }, 500);
  }
});
