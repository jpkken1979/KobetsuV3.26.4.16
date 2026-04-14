/**
 * Unit tests for server/services/admin-sql.ts
 *
 * Tests parseAndValidate (length/empty checks) and executeSql
 * (read-only guard via stmt.reader, result shape).
 *
 * Uses the real SQLite test DB — no mocks needed since the module
 * imports `sqlite` from db/index.js which points to kobetsu.test.db
 * during test runs (VITEST=true env var set by vite.config.ts).
 */
import { describe, it, expect } from "vitest";
import { parseAndValidate, executeSql } from "../services/admin-sql.js";

// ─── parseAndValidate ─────────────────────────────────────────────────

describe("parseAndValidate", () => {
  it("returns safe: false for empty string", () => {
    const result = parseAndValidate("");
    expect(result.safe).toBe(false);
    expect(result.message).toBeDefined();
  });

  it("returns safe: false for whitespace-only string", () => {
    const result = parseAndValidate("   ");
    expect(result.safe).toBe(false);
    expect(result.message).toMatch(/empty/i);
  });

  it("returns safe: false when query exceeds 10000 characters", () => {
    const longQuery = "SELECT " + "a".repeat(10_001);
    const result = parseAndValidate(longQuery);
    expect(result.safe).toBe(false);
    expect(result.message).toMatch(/10.?000/);
  });

  it("returns safe: false for exactly 10001 chars (one over limit)", () => {
    // The trimmed content itself must exceed MAX_SQL_LENGTH
    const query = "S" + "E".repeat(10_000); // 10001 chars
    const result = parseAndValidate(query);
    expect(result.safe).toBe(false);
  });

  it("returns safe: true for a valid SELECT statement", () => {
    const result = parseAndValidate("SELECT 1");
    expect(result.safe).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it("returns safe: true for a SELECT with leading/trailing whitespace", () => {
    const result = parseAndValidate("  SELECT 1  ");
    expect(result.safe).toBe(true);
  });

  it("returns safe: true for a multi-line SELECT query", () => {
    const sql = `
      SELECT id, name
      FROM client_companies
      WHERE is_active = 1
      LIMIT 10
    `;
    const result = parseAndValidate(sql);
    expect(result.safe).toBe(true);
  });
});

// ─── executeSql ───────────────────────────────────────────────────────

describe("executeSql", () => {
  it("returns columns, rows, rowCount, and time for a valid SELECT", () => {
    const result = executeSql("SELECT 1 AS value, 2 AS other");
    expect(result).toHaveProperty("columns");
    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("rowCount");
    expect(result).toHaveProperty("time");
    expect(result.columns).toEqual(["value", "other"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ value: 1, other: 2 });
    expect(result.rowCount).toBe(1);
    expect(typeof result.time).toBe("number");
  });

  it("returns empty columns and rowCount 0 when SELECT returns no rows", () => {
    // A valid SELECT that returns zero rows
    const result = executeSql(
      "SELECT id FROM client_companies WHERE id = -9999999"
    );
    expect(result.rowCount).toBe(0);
    expect(result.rows).toHaveLength(0);
    expect(result.columns).toEqual([]);
  });

  it("returns non-negative time measurement", () => {
    const result = executeSql("SELECT 42 AS n");
    expect(result.time).toBeGreaterThanOrEqual(0);
  });

  it("throws for INSERT statement", () => {
    expect(() =>
      executeSql("INSERT INTO audit_log (action) VALUES ('test')")
    ).toThrow("Only read-only (SELECT) queries are allowed.");
  });

  it("throws for UPDATE statement", () => {
    expect(() =>
      executeSql("UPDATE client_companies SET name = 'x' WHERE id = -1")
    ).toThrow("Only read-only (SELECT) queries are allowed.");
  });

  it("throws for DELETE statement", () => {
    expect(() =>
      executeSql("DELETE FROM audit_log WHERE id = -1")
    ).toThrow("Only read-only (SELECT) queries are allowed.");
  });

  it("throws for DROP TABLE statement", () => {
    expect(() =>
      executeSql("DROP TABLE IF EXISTS audit_log")
    ).toThrow("Only read-only (SELECT) queries are allowed.");
  });

  it("allows UNION SELECT (read-only, should not throw)", () => {
    const result = executeSql(
      "SELECT 1 AS n UNION SELECT 2 AS n"
    );
    expect(result.rowCount).toBe(2);
    expect(result.columns).toEqual(["n"]);
  });

  it("allows SELECT with subquery (read-only, should not throw)", () => {
    const result = executeSql(
      "SELECT (SELECT 99) AS sub"
    );
    expect(result.rowCount).toBe(1);
    expect(result.rows[0]).toEqual({ sub: 99 });
  });

  it("allows SELECT against a real table (sqlite_master)", () => {
    const result = executeSql(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name LIMIT 5"
    );
    expect(result.columns).toEqual(["name"]);
    expect(result.rowCount).toBeGreaterThan(0);
  });
});
