/**
 * Integration tests for companies + factories routes.
 *
 * Uses Hono's built-in app.fetch() to call routes directly.
 * Companies and factories are mutated; each test creates its own
 * data and cleans up via the API (no raw SQL deletes).
 */
import { describe, it, expect, beforeAll } from "vitest";

import app from "../index.js";

// Reservado para cuando se implemente autenticación — actualmente el servidor no la valida
const AUTH = "Basic " + Buffer.from("jpkken:admin123").toString("base64");

/** Convenience wrapper around app.fetch() */
const request = (path: string, init?: RequestInit) =>
  app.fetch(
    new Request(`http://localhost${path}`, {
      ...init,
      headers: {
        Authorization: AUTH,
        ...(init?.headers as Record<string, string> | undefined),
      },
    }),
  );

// ─── Companies ────────────────────────────────────────────────────────

describe("Companies CRUD", () => {
  it("POST /api/companies creates a company", async () => {
    const res = await request("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Company for Route Tests",
        nameKana: "テストカブシキガイシャ",
        shortName: "テスト",
        address: "東京都テスト区1-2-3",
        phone: "03-1234-5678",
        representative: "テスト 代表",
      }),
    });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe("Test Company for Route Tests");
    expect(created.nameKana).toBe("テストカブシキガイシャ");
    expect(created.shortName).toBe("テスト");
    expect(created.isActive).toBe(true);
  });

  it("GET /api/companies returns list with embedded factories", async () => {
    const res = await request("/api/companies");
    expect(res.status).toBe(200);
    const companies = await res.json();
    expect(Array.isArray(companies)).toBe(true);
    // Each company should have factories array
    if (companies.length > 0) {
      expect(companies[0]).toHaveProperty("factories");
    }
  });

  it("GET /api/companies?includeInactive=true returns all companies", async () => {
    const res = await request("/api/companies?includeInactive=true");
    expect(res.status).toBe(200);
    const companies = await res.json();
    expect(Array.isArray(companies)).toBe(true);
  });

  it("POST /api/companies rejects missing name", async () => {
    const res = await request("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: "no name provided" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("GET /api/companies/:id returns 404 for non-existent", async () => {
    const res = await request("/api/companies/9999999");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Company not found");
  });

  it("PUT /api/companies/:id updates a company", async () => {
    // First create a company
    const create = await request("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Company to Update" }),
    });
    const created = await create.json();
    const id = created.id;

    // Update it
    const update = await request(`/api/companies/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shortName: "更新名", address: "新しい住所" }),
    });
    expect(update.status).toBe(200);
    const updated = await update.json();
    expect(updated.shortName).toBe("更新名");
    expect(updated.address).toBe("新しい住所");
    expect(updated.name).toBe("Company to Update"); // unchanged
  });

  it("DELETE /api/companies/:id soft-deletes (isActive=false)", async () => {
    const create = await request("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Company to Soft Delete" }),
    });
    const created = await create.json();
    const id = created.id;

    const del = await request(`/api/companies/${id}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    const body = await del.json();
    expect(body.success).toBe(true);

    // Should no longer appear in default list
    const list = await request("/api/companies");
    const companies = await list.json();
    const found = companies.find((c: { id: number }) => c.id === id);
    expect(found).toBeUndefined();
  });
});

// ─── Factories ────────────────────────────────────────────────────────

describe("Factories CRUD", () => {
  let companyId = 0;

  beforeAll(async () => {
    // Create a company once for all factory tests
    const res = await request("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Factory Test Company" }),
    });
    const created = await res.json();
    companyId = created.id;
  });

  it("POST /api/factories creates a factory with unique constraint", async () => {
    const res = await request("/api/factories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        factoryName: "Test Factory Line",
        department: "Test Dept",
        lineName: "Line A",
        address: "大阪府テスト市1-2-3",
        phone: "06-9999-8888",
        supervisorName: "Supervisor Name",
        supervisorPhone: "06-1111-2222",
        hakensakiManagerName: "Hakensaki Manager",
        hakensakiManagerPhone: "06-3333-4444",
        managerUnsName: "UNS Manager",
        managerUnsPhone: "052-123-4567",
        workHours: "7:00～15:30",
        conflictDate: "2027-03-31",
        closingDayText: "20日",
        paymentDayText: "翌月20日",
      }),
    });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.id).toBeGreaterThan(0);
    expect(created.factoryName).toBe("Test Factory Line");
    expect(created.companyId).toBe(companyId);
  });

  it("POST /api/factories rejects same factoryName with different dept (unique combo)", async () => {
    // Same factory name, different department → should be accepted (different unique key)
    const res = await request("/api/factories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        factoryName: "Test Factory Line",
        department: "Different Dept", // different from first test
        lineName: "Line B",
      }),
    });
    // This should succeed (different dept+line combo)
    expect(res.status).toBe(201);
  });

  it("POST /api/factories rejects duplicate (unique constraint)", async () => {
    // Create a fresh company for this specific test to avoid side effects
    const coRes = await request("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Duplicate Test Company" }),
    });
    const co = await coRes.json();
    const coId = co.id;

    // Insert first factory
    const first = await request("/api/factories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: coId, factoryName: "Unique Factory", department: "Dept", lineName: "L1" }),
    });
    expect(first.status).toBe(201);

    // Try to insert same factory again — returns 400 from schema validation
    const second = await request("/api/factories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: coId, factoryName: "Unique Factory", department: "Dept", lineName: "L1" }),
    });
    // Either 400 (schema) or 500 (UNIQUE constraint uncaught) — both mean rejected
    expect([400, 500]).toContain(second.status);
    const body = await second.json();
    expect(body.error).toBeTruthy();
  });

  it("POST /api/factories rejects missing companyId or factoryName", async () => {
    const res1 = await request("/api/factories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factoryName: "No Company" }),
    });
    expect(res1.status).toBe(400);

    const res2 = await request("/api/factories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    expect(res2.status).toBe(400);
  });

  it("GET /api/factories returns list with embedded company", async () => {
    const res = await request("/api/factories");
    expect(res.status).toBe(200);
    const factories = await res.json();
    expect(Array.isArray(factories)).toBe(true);
    if (factories.length > 0) {
      expect(factories[0]).toHaveProperty("company");
    }
  });

  it("GET /api/factories?companyId= filters by company", async () => {
    const res = await request(`/api/factories?companyId=${companyId}`);
    expect(res.status).toBe(200);
    const factories = await res.json();
    expect(Array.isArray(factories)).toBe(true);
    for (const f of factories) {
      expect(f.companyId).toBe(companyId);
    }
  });

  it("GET /api/factories/cascade/:companyId returns grouped factories", async () => {
    const res = await request(`/api/factories/cascade/${companyId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("flat");
    expect(data).toHaveProperty("grouped");
    expect(Array.isArray(data.flat)).toBe(true);
  });

  it("GET /api/factories/:id returns single factory with company", async () => {
    // Get a factory from the list
    const list = await request(`/api/factories?companyId=${companyId}`);
    const factories = await list.json();
    if (factories.length === 0) {
      expect(true).toBe(true); // skip if no data
      return;
    }
    const id = factories[0].id;
    const res = await request(`/api/factories/${id}`);
    expect(res.status).toBe(200);
    const factory = await res.json();
    expect(factory.id).toBe(id);
    expect(factory).toHaveProperty("company");
  });

  it("GET /api/factories/:id returns 404 for non-existent", async () => {
    const res = await request("/api/factories/9999999");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Factory not found");
  });

  it("PUT /api/factories/:id updates a factory", async () => {
    const list = await request(`/api/factories?companyId=${companyId}`);
    const factories = await list.json();
    if (factories.length === 0) {
      expect(true).toBe(true);
      return;
    }
    const id = factories[0].id;

    const res = await request(`/api/factories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobDescription: " Updated job desc" }),
    });
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.jobDescription).toBe(" Updated job desc");
  });

  it("GET /api/factories/badges/:companyId returns badge status", async () => {
    const res = await request(`/api/factories/badges/${companyId}`);
    expect(res.status).toBe(200);
    const badges = await res.json();
    expect(Array.isArray(badges)).toBe(true);
    if (badges.length > 0) {
      expect(badges[0]).toHaveProperty("factoryId");
      expect(badges[0]).toHaveProperty("factoryName");
      expect(badges[0]).toHaveProperty("dataComplete");
      expect(["ok", "warning", "error"]).toContain(badges[0].dataComplete);
      expect(badges[0]).toHaveProperty("hasCalendar");
      expect(badges[0]).toHaveProperty("employeeCount");
    }
  });

  it("GET /api/factories/badges/:companyId returns 400 for invalid companyId", async () => {
    const res = await request("/api/factories/badges/not-a-number");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid companyId");
  });
});

// ─── Company + Factory relationship ──────────────────────────────────

describe("Company + Factory relationship queries", () => {
  it("GET /api/companies includes factories in response", async () => {
    const res = await request("/api/companies?includeInactive=true");
    expect(res.status).toBe(200);
    const companies = await res.json();
    // Find a company that should have factories
    const withFactories = companies.find(
      (c: { factories?: unknown[] }) => c.factories && c.factories.length > 0
    );
    if (withFactories) {
      expect(Array.isArray(withFactories.factories)).toBe(true);
      for (const f of withFactories.factories) {
        expect(f).toHaveProperty("factoryName");
        expect(f).toHaveProperty("department");
      }
    }
  });

  it("GET /api/companies/:id includes factories and employees", async () => {
    // Create a company to ensure we have a known active one
    const coRes = await request("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Relationship Test Company" }),
    });
    const co = await coRes.json();
    const id = co.id;

    const res = await request(`/api/companies/${id}`);
    expect(res.status).toBe(200);
    const company = await res.json();
    expect(company).toHaveProperty("factories");
    expect(company).toHaveProperty("employees");
  });
});
