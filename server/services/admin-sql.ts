/**
 * Admin SQL Service
 *
 * Provides SQL validation and safe raw execution for the admin database panel.
 * Only SELECT queries are permitted — no mutations allowed.
 */

import { sqlite } from "../db/index.js";

/** Maximum SQL query length (10 000 characters) */
const MAX_SQL_LENGTH = 10_000;

/**
 * Parse and validate a raw SQL string.
 * Returns { safe: true } if the query is allowed, or { safe: false, message } if blocked.
 *
 * Basic length/empty checks only — the authoritative read-only guard is
 * `stmt.reader` in `executeSql()`, which uses better-sqlite3's internal parser
 * instead of a fragile regex blocklist.
 *
 * @param sql - Raw SQL string from the client
 */
export function parseAndValidate(sql: string): { safe: boolean; message?: string } {
  const trimmed = sql.trim();

  if (trimmed.length === 0) {
    return { safe: false, message: "Query cannot be empty." };
  }
  if (trimmed.length > MAX_SQL_LENGTH) {
    return { safe: false, message: `Query exceeds the maximum length of ${MAX_SQL_LENGTH} characters.` };
  }

  return { safe: true };
}

/** Result shape for a successful query execution */
export interface SqlExecutionResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  time: number;
}

/**
 * Execute a validated SELECT query and return results.
 * Measures wall-clock time in milliseconds.
 *
 * @param sql - Pre-validated SQL string (only SELECT)
 */
export function executeSql(sql: string): SqlExecutionResult {
  const start = performance.now();

  const stmt = sqlite.prepare(sql);

  // Authoritative read-only guard: better-sqlite3's `reader` property returns
  // true only for statements that return data (SELECT, etc.).  This replaces the
  // old regex blocklist and is immune to UNION, subquery, or semicolon tricks.
  if (!stmt.reader) {
    throw new Error("Only read-only (SELECT) queries are allowed.");
  }

  const rawRows = stmt.all() as Record<string, unknown>[];

  const time = Math.round(performance.now() - start);
  const columns = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];

  return {
    columns,
    rows: rawRows,
    rowCount: rawRows.length,
    time,
  };
}