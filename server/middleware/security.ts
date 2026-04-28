import type { Context, Next } from "hono";
import { timingSafeEqual } from "node:crypto";

const RATE_LIMIT_WINDOW_MS = Number(process.env.API_RATE_LIMIT_WINDOW_MS ?? 60_000);
const RATE_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX ?? 180);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN?.trim() ?? "";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateBucket>();

function isMutationMethod(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function isAdminPath(path: string): boolean {
  return path.startsWith("/api/admin/");
}

function getClientId(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = c.req.header("x-real-ip")?.trim();
  return forwarded ?? realIp ?? "local";
}

function consumeRateLimit(key: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const current = rateBuckets.get(key);

  if (!current || now >= current.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSec: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) };
  }

  if (current.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return {
    allowed: true,
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

// Periodic cleanup every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateBuckets) {
    if (now >= value.resetAt) {
      rateBuckets.delete(key);
    }
  }
}, 60_000);

export async function securityHeadersMiddleware(_c: Context, next: Next) {
  await next();
  _c.header("X-Content-Type-Options", "nosniff");
  _c.header("X-Frame-Options", "SAMEORIGIN");
  _c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  _c.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
}

function isLocalhost(c: Context): boolean {
  const clientId = getClientId(c);
  return (
    clientId === "local" ||
    clientId === "127.0.0.1" ||
    clientId === "::1" ||
    clientId === "::ffff:127.0.0.1"
  );
}

export async function adminGuardMiddleware(c: Context, next: Next) {
  const method = c.req.method.toUpperCase();
  const path = c.req.path;

  if (isAdminPath(path)) {
    const isProd = process.env.NODE_ENV === "production";
    const isMutation = isMutationMethod(method);

    // ADMIN_TOKEN debe estar configurado siempre que se exponga el panel.
    if (!ADMIN_TOKEN) {
      // En producción: bloquear todo /api/admin/*.
      // En dev: permitir solo GETs desde localhost para no romper flujo, pero
      // bloquear cualquier mutación (no se puede destruir DB sin token jamás).
      if (isProd || isMutation || !isLocalhost(c)) {
        return c.json(
          { error: "Admin routes are disabled: ADMIN_TOKEN is not configured." },
          503,
        );
      }
      // dev + GET + localhost → continuar sin token
    } else {
      // Con ADMIN_TOKEN configurado: política depende del método.
      //
      // - Mutaciones (POST/PUT/PATCH/DELETE): token OBLIGATORIO siempre,
      //   incluso desde localhost. Esto cierra C-1 (bypass total via
      //   localhost) y previene CSRF same-origin desde el browser del usuario.
      //
      // - Lecturas (GET): token obligatorio en producción; en dev se permite
      //   desde localhost para que el admin panel sea utilizable sin
      //   configurar localStorage en cada sesión.
      const requiresToken = isMutation || isProd || !isLocalhost(c);

      if (requiresToken) {
        const provided = c.req.header("x-admin-token")?.trim();
        if (!provided || !safeCompare(provided, ADMIN_TOKEN)) {
          return c.json({ error: "Unauthorized admin access." }, 401);
        }
      }
    }
  }

  if (!isMutationMethod(method)) {
    await next();
    return;
  }

  const clientId = getClientId(c);
  const rateKey = `${clientId}:${method}:${c.req.path}`;
  const rate = consumeRateLimit(rateKey);
  if (!rate.allowed) {
    return c.json(
      { error: "Too many requests. Please retry later." },
      429,
      { "Retry-After": String(rate.retryAfterSec) },
    );
  }

  await next();
}
