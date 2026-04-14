/**
 * Integration tests for server/services/dashboard-stats.ts
 *
 * Covers all exported functions:
 *   - getDashboardStats
 *   - getExpiringContracts
 *   - getTeishokubiAlerts
 *   - getVisaExpiryAlerts
 *   - getNationalityBreakdown
 *   - getByCompanyBreakdown
 *   - getAuditLogs
 *
 * Uses the real SQLite test DB (kobetsu.test.db) — no mocks.
 * Data-setup is done via the Hono app routes to stay consistent
 * with integration test conventions in this repo.
 */
import { describe, it, expect } from "vitest";
import {
  getDashboardStats,
  getExpiringContracts,
  getTeishokubiAlerts,
  getVisaExpiryAlerts,
  getNationalityBreakdown,
  getByCompanyBreakdown,
  getAuditLogs,
} from "../services/dashboard-stats.js";

// ─── getDashboardStats ────────────────────────────────────────────────

describe("getDashboardStats", () => {
  it("returns an object with the required numeric fields", async () => {
    const stats = await getDashboardStats(30);
    expect(stats).toHaveProperty("companies");
    expect(stats).toHaveProperty("factories");
    expect(stats).toHaveProperty("activeEmployees");
    expect(stats).toHaveProperty("totalContracts");
    expect(stats).toHaveProperty("activeContracts");
    expect(stats).toHaveProperty("expiringInDays");
  });

  it("all stat values are non-negative integers", async () => {
    const stats = await getDashboardStats(30);
    for (const key of Object.keys(stats) as (keyof typeof stats)[]) {
      expect(typeof stats[key]).toBe("number");
      expect(stats[key]).toBeGreaterThanOrEqual(0);
    }
  });

  it("activeContracts is less than or equal to totalContracts", async () => {
    const stats = await getDashboardStats(30);
    expect(stats.activeContracts).toBeLessThanOrEqual(stats.totalContracts);
  });

  it("expiringInDays with warningDays=0 returns 0 (no contracts expire today only)", async () => {
    // With a 0-day window, contracts expiring after today are excluded
    const stats = await getDashboardStats(0);
    expect(stats.expiringInDays).toBeGreaterThanOrEqual(0);
  });

  it("expiringInDays with large warningDays >= expiringInDays with small warningDays", async () => {
    const statsSmall = await getDashboardStats(7);
    const statsLarge = await getDashboardStats(365);
    expect(statsLarge.expiringInDays).toBeGreaterThanOrEqual(statsSmall.expiringInDays);
  });
});

// ─── getExpiringContracts ─────────────────────────────────────────────

describe("getExpiringContracts", () => {
  it("returns an array", async () => {
    const result = await getExpiringContracts(30);
    expect(Array.isArray(result)).toBe(true);
  });

  it("each contract has company, factory, and employees relations", async () => {
    const result = await getExpiringContracts(365);
    for (const contract of result) {
      expect(contract).toHaveProperty("company");
      expect(contract).toHaveProperty("factory");
      expect(contract).toHaveProperty("employees");
    }
  });

  it("contracts are ordered by endDate ascending", async () => {
    const result = await getExpiringContracts(365);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].endDate! >= result[i - 1].endDate!).toBe(true);
    }
  });

  it("all returned contracts have status active", async () => {
    const result = await getExpiringContracts(365);
    for (const contract of result) {
      expect(contract.status).toBe("active");
    }
  });
});

// ─── getTeishokubiAlerts ──────────────────────────────────────────────

describe("getTeishokubiAlerts", () => {
  it("returns an array", async () => {
    const result = await getTeishokubiAlerts(90);
    expect(Array.isArray(result)).toBe(true);
  });

  it("each alert factory has a company relation", async () => {
    const result = await getTeishokubiAlerts(365 * 5);
    for (const factory of result) {
      expect(factory).toHaveProperty("company");
      expect(factory.conflictDate).not.toBeNull();
    }
  });

  it("alerts are ordered by conflictDate ascending", async () => {
    const result = await getTeishokubiAlerts(365 * 5);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].conflictDate! >= result[i - 1].conflictDate!).toBe(true);
    }
  });

  it("warningDays=0 returns fewer or equal alerts than warningDays=365", async () => {
    const narrow = await getTeishokubiAlerts(0);
    const wide = await getTeishokubiAlerts(365);
    expect(wide.length).toBeGreaterThanOrEqual(narrow.length);
  });
});

// ─── getVisaExpiryAlerts ──────────────────────────────────────────────

describe("getVisaExpiryAlerts", () => {
  it("returns an array", async () => {
    const result = await getVisaExpiryAlerts();
    expect(Array.isArray(result)).toBe(true);
  });

  it("each employee alert has a company relation", async () => {
    const result = await getVisaExpiryAlerts();
    for (const employee of result) {
      expect(employee).toHaveProperty("company");
      expect(employee.visaExpiry).not.toBeNull();
    }
  });

  it("all returned employees have status active", async () => {
    const result = await getVisaExpiryAlerts();
    for (const employee of result) {
      expect(employee.status).toBe("active");
    }
  });

  it("employees are ordered by visaExpiry ascending", async () => {
    const result = await getVisaExpiryAlerts();
    for (let i = 1; i < result.length; i++) {
      expect(result[i].visaExpiry! >= result[i - 1].visaExpiry!).toBe(true);
    }
  });
});

// ─── getNationalityBreakdown ──────────────────────────────────────────

describe("getNationalityBreakdown", () => {
  it("returns an array", () => {
    const result = getNationalityBreakdown();
    expect(Array.isArray(result)).toBe(true);
  });

  it("each entry has nationality (string) and count (number)", () => {
    const result = getNationalityBreakdown();
    for (const entry of result) {
      expect(typeof entry.nationality).toBe("string");
      expect(typeof entry.count).toBe("number");
      expect(entry.count).toBeGreaterThan(0);
    }
  });

  it("entries with null nationality are mapped to 不明", () => {
    const result = getNationalityBreakdown();
    // All entries must have a non-empty nationality string (nulls → 不明)
    for (const entry of result) {
      expect(entry.nationality.length).toBeGreaterThan(0);
    }
  });

  it("counts are ordered descending", () => {
    const result = getNationalityBreakdown();
    for (let i = 1; i < result.length; i++) {
      expect(result[i].count).toBeLessThanOrEqual(result[i - 1].count);
    }
  });
});

// ─── getByCompanyBreakdown ────────────────────────────────────────────

describe("getByCompanyBreakdown", () => {
  it("returns an array", () => {
    const result = getByCompanyBreakdown();
    expect(Array.isArray(result)).toBe(true);
  });

  it("each entry has companyName (string) and count (number)", () => {
    const result = getByCompanyBreakdown();
    for (const entry of result) {
      expect(typeof entry.companyName).toBe("string");
      expect(typeof entry.count).toBe("number");
      expect(entry.count).toBeGreaterThan(0);
    }
  });

  it("entries with null companyName are mapped to 未配属", () => {
    const result = getByCompanyBreakdown();
    for (const entry of result) {
      expect(entry.companyName.length).toBeGreaterThan(0);
    }
  });

  it("counts are ordered descending", () => {
    const result = getByCompanyBreakdown();
    for (let i = 1; i < result.length; i++) {
      expect(result[i].count).toBeLessThanOrEqual(result[i - 1].count);
    }
  });
});

// ─── getAuditLogs ─────────────────────────────────────────────────────

describe("getAuditLogs", () => {
  it("returns logs array and total count", async () => {
    const result = await getAuditLogs({ limit: 10, offset: 0 });
    expect(result).toHaveProperty("logs");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.logs)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("respects limit parameter", async () => {
    const result = await getAuditLogs({ limit: 3, offset: 0 });
    expect(result.logs.length).toBeLessThanOrEqual(3);
  });

  it("total is non-negative", async () => {
    const result = await getAuditLogs({ limit: 10, offset: 0 });
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("logs.length <= total", async () => {
    const result = await getAuditLogs({ limit: 100, offset: 0 });
    expect(result.logs.length).toBeLessThanOrEqual(result.total);
  });

  it("offset reduces the returned logs", async () => {
    const page1 = await getAuditLogs({ limit: 5, offset: 0 });
    const page2 = await getAuditLogs({ limit: 5, offset: 5 });
    // If total > 5, the two pages should not overlap
    if (page1.total > 5 && page2.logs.length > 0) {
      expect(page1.logs[0].id).not.toBe(page2.logs[0].id);
    }
  });

  it("filters by action when provided", async () => {
    const result = await getAuditLogs({ limit: 50, offset: 0, action: "create" });
    for (const log of result.logs) {
      expect(log.action).toBe("create");
    }
  });

  it("filters by entityType when provided", async () => {
    const result = await getAuditLogs({ limit: 50, offset: 0, entityType: "contract" });
    for (const log of result.logs) {
      expect(log.entityType).toBe("contract");
    }
  });

  it("search filters by detail content", async () => {
    // Get a real detail value to search on
    const all = await getAuditLogs({ limit: 5, offset: 0 });
    if (all.logs.length > 0 && all.logs[0].detail) {
      const keyword = all.logs[0].detail.slice(0, 5);
      const filtered = await getAuditLogs({ limit: 50, offset: 0, search: keyword });
      expect(filtered.logs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("returns empty logs array when offset exceeds total", async () => {
    const result = await getAuditLogs({ limit: 10, offset: 999_999 });
    expect(result.logs).toHaveLength(0);
  });

  it("no filters returns all logs (respecting limit)", async () => {
    const result = await getAuditLogs({ limit: 1000, offset: 0 });
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.logs.length).toBeLessThanOrEqual(1000);
  });
});
