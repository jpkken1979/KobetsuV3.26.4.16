import { Hono } from "hono";
import {
  getDashboardStats,
  getExpiringContracts,
  getTeishokubiAlerts,
  getVisaExpiryAlerts,
  getNationalityBreakdown,
  getByCompanyBreakdown,
  getAuditLogs,
} from "../services/dashboard-stats.js";

export const dashboardRouter = new Hono();

function clampDays(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(365, Math.max(1, Math.round(parsed)));
}

// GET /api/dashboard/stats — Summary counts
dashboardRouter.get("/stats", async (c) => {
  try {
    const warningDays = clampDays(c.req.query("warningDays"), 30);
    return c.json(await getDashboardStats(warningDays));
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to load stats" }, 500);
  }
});

// GET /api/dashboard/expiring — Contracts expiring in next N days (default 30)
dashboardRouter.get("/expiring", async (c) => {
  try {
    const warningDays = clampDays(c.req.query("warningDays"), 30);
    return c.json(await getExpiringContracts(warningDays));
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to load expiring contracts" }, 500);
  }
});

// GET /api/dashboard/teishokubi — 抵触日 alerts (factories approaching conflict date)
dashboardRouter.get("/teishokubi", async (c) => {
  try {
    const warningDays = clampDays(c.req.query("warningDays"), 180);
    return c.json(await getTeishokubiAlerts(warningDays));
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to load teishokubi alerts" }, 500);
  }
});

// GET /api/dashboard/visa-expiry — Employees with visas expiring soon
dashboardRouter.get("/visa-expiry", async (c) => {
  try {
    return c.json(await getVisaExpiryAlerts());
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to load visa expiry data" }, 500);
  }
});

// GET /api/dashboard/nationality — Breakdown by nationality (SQL aggregate)
dashboardRouter.get("/nationality", async (c) => {
  try {
    return c.json(getNationalityBreakdown());
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to load nationality data" }, 500);
  }
});

// GET /api/dashboard/by-company — Employee count per company (SQL aggregate + join)
dashboardRouter.get("/by-company", async (c) => {
  try {
    return c.json(getByCompanyBreakdown());
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

    return c.json(await getAuditLogs({ limit, offset, action, entityType, search }));
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to load audit log" }, 500);
  }
});
