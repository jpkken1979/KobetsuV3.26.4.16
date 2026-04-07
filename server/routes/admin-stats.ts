/**
 * Admin Statistics Router
 *
 * Provides aggregate statistics for the admin stats dashboard.
 * GET /api/admin/stats
 */

import { Hono } from "hono";
import { computeAdminStats } from "../services/admin-stats.js";

export const adminStatsRouter = new Hono();

/**
 * GET /api/admin/stats
 *
 * Returns all admin statistics in one response:
 * - counts: row counts for all 8 tables
 * - contractStatusDistribution: contract counts grouped by status
 * - employeeStatusDistribution: employee counts grouped by status
 * - nationalityDistribution: top 10 nationalities
 * - monthlyContracts: last 12 months of contract starts
 * - topFactories: top 10 factories by employee count
 * - nullCounts: columns with null values
 * - expiringContracts: contracts expiring in the next 90 days
 */
adminStatsRouter.get("/", async (c) => {
  try {
    const stats = computeAdminStats();
    return c.json(stats);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Failed to compute admin stats: ${message}` }, 500);
  }
});
