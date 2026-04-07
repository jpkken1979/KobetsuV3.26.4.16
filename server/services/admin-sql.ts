/**
 * Admin SQL Service
 *
 * Provides SQL validation and safe raw execution for the admin database panel.
 * Only SELECT queries are permitted — no mutations allowed.
 */

import { sqlite } from "../db/index.js";

/** Keywords and patterns that are never allowed in a query */
const BLOCKED_PATTERNS = [
  /^\s*INSERT/i,
  /^\s*UPDATE/i,
  /^\s*DELETE/i,
  /^\s*DROP/i,
  /^\s*CREATE/i,
  /^\s*ALTER/i,
  /^\s*TRUNCATE/i,
  /^\s*ATTACH/i,
  /^\s*DETACH/i,
  /^\s*PRAGMA/i,
  /^\s*EXPLAIN/i,
];

/** Maximum SQL query length (10 000 characters) */
const MAX_SQL_LENGTH = 10_000;

/**
 * Parse and validate a raw SQL string.
 * Returns { safe: true } if the query is allowed, or { safe: false, message } if blocked.
 *
 * @param sql - Raw SQL string from the client
 */
export function parseAndValidate(sql: string): { safe: boolean; message?: string } {
  const trimmed = sql.trim();

  // Length check
  if (trimmed.length === 0) {
    return { safe: false, message: "Query cannot be empty." };
  }
  if (trimmed.length > MAX_SQL_LENGTH) {
    return { safe: false, message: `Query exceeds the maximum length of ${MAX_SQL_LENGTH} characters.` };
  }

  // Must start with SELECT
  if (!/^\s*SELECT/i.test(trimmed)) {
    return { safe: false, message: "Only SELECT queries are allowed." };
  }

  // Block dangerous patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, message: `Query contains a blocked keyword or pattern.` };
    }
  }

  // Block double semicolons at the end (SQL injection padding attempt)
  if (/;;\s*$/.test(trimmed)) {
    return { safe: false, message: "Trailing semicolon padding is not allowed." };
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