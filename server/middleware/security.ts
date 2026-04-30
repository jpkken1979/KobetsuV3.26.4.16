import type { Context, Next } from "hono";
import { timingSafeEqual } from "node:crypto";

const RATE_LIMIT_WINDOW_MS = Number(process.env.API_RATE_LIMIT_WINDOW_MS ?? 60_000);
const RATE_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX ?? 180);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN?.trim() ?? "";

// Granular rate limits per endpoint path (windowSeconds, maxRequests)
const ENDPOINT_RATE_LIMITS: Record<string, [number, number]> = {
  // Preview operations — read-only, more permissive
  "/api/contracts/batch/preview": [60, 30],
  "/api/contracts/batch/new-hires/preview": [60, 30],
  "/api/contracts/batch/mid-hires/preview": [60, 30],
  "/api/contracts/batch/smart-by-factory/preview": [60, 30],

  // Batch create operations — more restrictive
  "/api/contracts/batch": [300, 10],
  "/api/contracts/batch/new-hires": [300, 20],
  "/api/contracts/batch/mid-hires": [300, 20],
  "/api/contracts/batch/by-line": [300, 20],
  "/api/contracts/batch/smart-by-factory": [300, 10],

  // Document generation — CPU-intensive
  "/api/documents/generate": [300, 50],
  "/api/documents/generate-batch": [600, 10],
  "/api/documents/generate-factory": [600, 10],
  "/api/documents/generate-set": [600, 10],
  "/api/documents/generate-by-ids": [600, 10],
};

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateBucket>();

function isMutationMethod(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

/**
 * Returns the rate-limit config for a given path.
 * Falls back to global defaults if no specific entry exists.
 */
function getEndpointRateLimit(path: string): { windowMs: number; max: number } {
  const specific = ENDPOINT_RATE_LIMITS[path];
  if (specific) {
    return { windowMs: specific[0] * 1000, max: specific[1] };
  }
  return { windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX };
}

function consumeRateLimit(key: string, windowMs: number, max: number): {
  allowed: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();
  const current = rateBuckets.get(key);

  if (!current || now >= current.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: Math.ceil(windowMs / 1000) };
  }

  if (current.count >= max) {
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

function setRateLimitHeaders(
  c: Context,
  _windowSec: number,
  max: number,
  remaining: number,
  resetAtSec: number,
): void {
  void _windowSec; // unused but kept for API signature symmetry
  c.header("X-RateLimit-Limit", String(max));
  c.header("X-RateLimit-Remaining", String(Math.max(0, remaining)));
  c.header("X-RateLimit-Reset", String(resetAtSec));
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

function isAdminProtectedPath(path: string): boolean {
  return path.startsWith("/api/admin/") || path === "/api/backup";
}

function getClientId(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = c.req.header("x-real-ip")?.trim();
  return forwarded ?? realIp ?? "local";
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

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

  if (isAdminProtectedPath(path)) {
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

  const { windowMs, max } = getEndpointRateLimit(path);
  const clientId = getClientId(c);
  const rateKey = `${clientId}:${method}:${path}`;
  const rate = consumeRateLimit(rateKey, windowMs, max);

  const resetAtSec = Math.ceil((Date.now() + windowMs) / 1000);
  const remaining = rate.allowed
    ? (rateBuckets.get(rateKey)?.count ?? 1)
    : 0;
  setRateLimitHeaders(c, Math.ceil(windowMs / 1000), max, remaining, resetAtSec);

  if (!rate.allowed) {
    return c.json(
      { error: "Too many requests. Please retry later." },
      429,
      { "Retry-After": String(rate.retryAfterSec) },
    );
  }

  await next();
}
