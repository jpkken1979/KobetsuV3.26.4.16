/**
 * Helpers para enriquecer audit_log.detail con metadata de la request.
 *
 * El campo `userName` del audit_log es estático ("admin" / "system" / "import")
 * porque la app no tiene login real. Para no perder trazabilidad forense,
 * incluimos IP y User-Agent dentro del campo `detail` como JSON.
 *
 * Ver M-3 en auditoría 2026-04-28.
 */
import type { Context } from "hono";

function getClientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = c.req.header("x-real-ip")?.trim();
  return forwarded || realIp || "local";
}

/**
 * Construye un detail JSON con la metadata de la request más un mensaje
 * descriptivo. Si pasás un objeto adicional, se mergea bajo la clave `payload`.
 *
 * @example
 *   buildAuditDetail(c, "Admin deleted contract id=42")
 *   // → '{"message":"Admin deleted contract id=42","ip":"127.0.0.1","userAgent":"Mozilla/...","ts":"2026-04-28T..."}'
 */
export function buildAuditDetail(
  c: Context,
  message: string,
  payload?: Record<string, unknown>,
): string {
  const detail: Record<string, unknown> = {
    message,
    ip: getClientIp(c),
    userAgent: c.req.header("user-agent")?.slice(0, 256) || null,
    ts: new Date().toISOString(),
  };
  if (payload) detail.payload = payload;
  return JSON.stringify(detail);
}
