/** Escape special characters in a SQL LIKE pattern */
/**
 * Escapa caracteres especiales de SQL LIKE (% _ \).
 */
export function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

/** Parse a URL param as a positive integer ID, or return null if invalid */
/**
 * Parsea un parametro de URL como ID entero positivo. Retorna null si es invalido.
 */
export function parseIdParam(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}
