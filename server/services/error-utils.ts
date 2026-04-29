/**
 * Utilidades para errores: extrae mensaje de un `unknown` y elimina paths
 * absolutos del filesystem (Unix y Windows) para que no se filtren al cliente.
 *
 * Cierra LOW-1 (audit 2026-04-29). App es local-first, pero cualquier respuesta
 * de error que viaje al frontend con `/home/user/...` o `C:\Users\...` filtra
 * estructura interna sin necesidad.
 */

const UNIX_ABSOLUTE_PATH = /(?:^|\s|["'`([])(?:\/(?:home|var|etc|tmp|usr|opt|root|mnt|srv|private)\/[^\s"'`)\]]+)/g;
const WINDOWS_ABSOLUTE_PATH = /(?:^|\s|["'`([])(?:[A-Z]:\\[^\s"'`)\]]+)/gi;

export function sanitizeErrorMessage(err: unknown, fallback = "Unknown error"): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : fallback;
  return raw
    .replace(UNIX_ABSOLUTE_PATH, (m) => m.replace(/\/[^\s"'`)\]]+/, "<path>"))
    .replace(WINDOWS_ABSOLUTE_PATH, (m) => m.replace(/[A-Z]:\\[^\s"'`)\]]+/i, "<path>"))
    .slice(0, 500);
}
