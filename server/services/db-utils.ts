/** Escape special characters in a SQL LIKE pattern */
export function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

/** Parse a URL param as a positive integer ID, or return null if invalid */
export function parseIdParam(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}
