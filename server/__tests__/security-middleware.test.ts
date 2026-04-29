/**
 * Tests para server/middleware/security.ts
 *
 * Cubre:
 *  - adminGuardMiddleware: gating por token, paths /api/admin, modo prod vs dev
 *  - rate limiting de mutaciones
 *  - securityHeadersMiddleware: headers obligatorios
 *
 * `ADMIN_TOKEN` y `NODE_ENV` se leen una sola vez al importar el módulo, así
 * que cada bloque que necesita un valor distinto usa `vi.resetModules()` + import
 * dinámico para reinicializar con el env seteado.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";

type SecurityModule = typeof import("../middleware/security.js");

async function loadModule(env: Record<string, string | undefined>): Promise<SecurityModule> {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  vi.resetModules();
  return import("../middleware/security.js");
}

function buildApp(mod: SecurityModule): Hono {
  const app = new Hono();
  app.use("*", mod.securityHeadersMiddleware);
  app.use("*", mod.adminGuardMiddleware);
  app.get("/api/health", (c) => c.json({ ok: true }));
  app.post("/api/contracts", (c) => c.json({ created: true }));
  app.get("/api/admin/tables", (c) => c.json({ tables: [] }));
  app.post("/api/admin/sql", (c) => c.json({ rows: [] }));
  app.delete("/api/admin/crud/x/1", (c) => c.json({ deleted: true }));
  return app;
}

describe("securityHeadersMiddleware", () => {
  it("agrega headers de seguridad obligatorios", async () => {
    const mod = await loadModule({ ADMIN_TOKEN: "test-token-1234567890", NODE_ENV: "test" });
    const app = buildApp(mod);
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Permissions-Policy")).toContain("geolocation=()");
  });
});

describe("adminGuardMiddleware: con ADMIN_TOKEN configurado", () => {
  const TOKEN = "valid-admin-token-1234567890abcdef";

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rechaza POST /api/admin/* sin header x-admin-token", async () => {
    const mod = await loadModule({ ADMIN_TOKEN: TOKEN, NODE_ENV: "test" });
    const app = buildApp(mod);
    const res = await app.request("/api/admin/sql", { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
  });

  it("rechaza POST /api/admin/* con token incorrecto (mismo length)", async () => {
    const mod = await loadModule({ ADMIN_TOKEN: TOKEN, NODE_ENV: "test" });
    const app = buildApp(mod);
    const wrong = "x".repeat(TOKEN.length);
    const res = await app.request("/api/admin/sql", {
      method: "POST",
      body: "{}",
      headers: { "x-admin-token": wrong },
    });
    expect(res.status).toBe(401);
  });

  it("rechaza POST /api/admin/* con token de longitud distinta (timing-safe)", async () => {
    const mod = await loadModule({ ADMIN_TOKEN: TOKEN, NODE_ENV: "test" });
    const app = buildApp(mod);
    const res = await app.request("/api/admin/sql", {
      method: "POST",
      body: "{}",
      headers: { "x-admin-token": "short" },
    });
    expect(res.status).toBe(401);
  });

  it("permite POST /api/admin/* con token correcto", async () => {
    const mod = await loadModule({ ADMIN_TOKEN: TOKEN, NODE_ENV: "test" });
    const app = buildApp(mod);
    const res = await app.request("/api/admin/sql", {
      method: "POST",
      body: "{}",
      headers: { "x-admin-token": TOKEN },
    });
    expect(res.status).toBe(200);
  });

  it("permite GET /api/admin/* sin token desde localhost en dev (UX shortcut)", async () => {
    const mod = await loadModule({ ADMIN_TOKEN: TOKEN, NODE_ENV: "test" });
    const app = buildApp(mod);
    // En dev sin x-forwarded-for/x-real-ip, getClientId devuelve "local" → localhost
    const res = await app.request("/api/admin/tables", { method: "GET" });
    expect(res.status).toBe(200);
  });

  it("rechaza GET /api/admin/* desde IP no-localhost sin token", async () => {
    const mod = await loadModule({ ADMIN_TOKEN: TOKEN, NODE_ENV: "test" });
    const app = buildApp(mod);
    const res = await app.request("/api/admin/tables", {
      method: "GET",
      headers: { "x-forwarded-for": "203.0.113.5" },
    });
    expect(res.status).toBe(401);
  });

  it("rechaza DELETE /api/admin/* aún desde localhost (mutación requiere token)", async () => {
    const mod = await loadModule({ ADMIN_TOKEN: TOKEN, NODE_ENV: "test" });
    const app = buildApp(mod);
    const res = await app.request("/api/admin/crud/x/1", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("permite POST a path no-admin sin token (rate-limit aplica, auth no)", async () => {
    const mod = await loadModule({ ADMIN_TOKEN: TOKEN, NODE_ENV: "test" });
    const app = buildApp(mod);
    const res = await app.request("/api/contracts", { method: "POST", body: "{}" });
    expect(res.status).toBe(200);
  });
});

describe("adminGuardMiddleware: sin ADMIN_TOKEN configurado", () => {
  it("en producción bloquea TODO /api/admin/* (incluso GET localhost)", async () => {
    const mod = await loadModule({ ADMIN_TOKEN: undefined, NODE_ENV: "production" });
    const app = buildApp(mod);
    const res = await app.request("/api/admin/tables", { method: "GET" });
    expect(res.status).toBe(503);
  });

  it("en dev permite GET /api/admin/* desde localhost (sin token configurado)", async () => {
    const mod = await loadModule({ ADMIN_TOKEN: undefined, NODE_ENV: "test" });
    const app = buildApp(mod);
    const res = await app.request("/api/admin/tables", { method: "GET" });
    expect(res.status).toBe(200);
  });

  it("en dev bloquea POST /api/admin/* incluso desde localhost (mutación sin token jamás)", async () => {
    const mod = await loadModule({ ADMIN_TOKEN: undefined, NODE_ENV: "test" });
    const app = buildApp(mod);
    const res = await app.request("/api/admin/sql", { method: "POST", body: "{}" });
    expect(res.status).toBe(503);
  });
});

describe("adminGuardMiddleware: rate limiting", () => {
  it("aplica rate limit configurable a mutaciones", async () => {
    const mod = await loadModule({
      ADMIN_TOKEN: "rate-limit-test-token-xxxxxxxxx",
      NODE_ENV: "test",
      API_RATE_LIMIT_MAX: "5",
      API_RATE_LIMIT_WINDOW_MS: "60000",
    });
    const app = buildApp(mod);

    // 5 requests permitidos
    for (let i = 0; i < 5; i++) {
      const res = await app.request("/api/contracts", {
        method: "POST",
        body: "{}",
        headers: { "x-forwarded-for": "10.0.0.1" },
      });
      expect(res.status).toBe(200);
    }

    // 6to: 429
    const res = await app.request("/api/contracts", {
      method: "POST",
      body: "{}",
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeDefined();
  });

  it("no aplica rate limit a GET", async () => {
    const mod = await loadModule({
      ADMIN_TOKEN: "rate-limit-get-test-token-yyyyyy",
      NODE_ENV: "test",
      API_RATE_LIMIT_MAX: "3",
      API_RATE_LIMIT_WINDOW_MS: "60000",
    });
    const app = buildApp(mod);

    for (let i = 0; i < 10; i++) {
      const res = await app.request("/api/health", {
        headers: { "x-forwarded-for": "10.0.0.2" },
      });
      expect(res.status).toBe(200);
    }
  });
});
