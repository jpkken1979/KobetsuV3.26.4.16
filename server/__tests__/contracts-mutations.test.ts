/**
 * Integration tests for contract mutations (POST, PUT, DELETE, bulk-delete, purge).
 * Uses Hono's built-in app.fetch() — no real HTTP server needed.
 */
import { describe, it, expect, vi } from "vitest";

// Mock pdf-parse — not installed as a dependency
vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn(),
  default: vi.fn(),
}));

import app from "../index.js";

const AUTH = "Basic " + Buffer.from("jpkken:admin123").toString("base64");

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

// ─── Helpers ────────────────────────────────────────────────────────

/** Get the first company and factory from DB (needed for valid contract creation) */
async function getFirstCompanyAndFactory(): Promise<{ companyId: number; factoryId: number } | null> {
  const companiesRes = await request("/api/companies");
  const companies = await companiesRes.json();
  if (!Array.isArray(companies) || companies.length === 0) return null;

  const companyId = companies[0].id;
  const factoriesRes = await request(`/api/factories/cascade/${companyId}`);
  const factoriesData = await factoriesRes.json();
  if (!factoriesData?.flat?.length) return null;

  return { companyId, factoryId: factoriesData.flat[0].id };
}

const validContractBase = {
  startDate: "2099-01-05",
  endDate: "2099-03-31",
  contractDate: "2098-12-31",
  notificationDate: "2098-12-30",
};

// ─── POST /api/contracts ────────────────────────────────────────────

describe("POST /api/contracts", () => {
  it("rejects request with missing required fields", async () => {
    const res = await request("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: 1 }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  it("rejects invalid date format", async () => {
    const res = await request("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: 1,
        factoryId: 1,
        startDate: "April 1",
        endDate: "2026-06-30",
        contractDate: "2026-03-30",
        notificationDate: "2026-03-27",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid status value", async () => {
    const res = await request("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: 1,
        factoryId: 1,
        ...validContractBase,
        status: "pending",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects negative companyId", async () => {
    const res = await request("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: -1,
        factoryId: 1,
        ...validContractBase,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects negative factoryId", async () => {
    const res = await request("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: 1,
        factoryId: -1,
        ...validContractBase,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when factoryId does not exist", async () => {
    const res = await request("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: 1,
        factoryId: 999999,
        ...validContractBase,
      }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("not found");
  });

  it("creates a contract with valid data and cleans up", async () => {
    const ids = await getFirstCompanyAndFactory();
    if (!ids) return; // skip if no data

    const res = await request("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...ids,
        ...validContractBase,
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("contractNumber");
    expect(data.contractNumber).toMatch(/^KOB-/);
    expect(data.startDate).toBe("2099-01-05");

    // Clean up: soft delete then purge
    const deleteRes = await request(`/api/contracts/${data.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);

    const purgeRes = await request("/api/contracts/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [data.id] }),
    });
    expect(purgeRes.status).toBe(200);
  });
});

// ─── PUT /api/contracts/:id ─────────────────────────────────────────

describe("PUT /api/contracts/:id", () => {
  it("returns 400 for invalid ID", async () => {
    const res = await request("/api/contracts/abc", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent contract", async () => {
    const res = await request("/api/contracts/999999", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    expect(res.status).toBe(404);
  });

  it("allows partial update with valid data", async () => {
    const ids = await getFirstCompanyAndFactory();
    if (!ids) return;

    // Create a contract to update
    const createRes = await request("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...ids,
        ...validContractBase,
      }),
    });
    if (createRes.status !== 201) return;
    const created = await createRes.json();

    // Update notes
    const updateRes = await request(`/api/contracts/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "__test_update__" }),
    });
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.notes).toBe("__test_update__");

    // Clean up
    await request(`/api/contracts/${created.id}`, { method: "DELETE" });
    await request("/api/contracts/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [created.id] }),
    });
  });
});

// ─── DELETE /api/contracts/:id ──────────────────────────────────────

describe("DELETE /api/contracts/:id", () => {
  it("returns 400 for invalid ID", async () => {
    const res = await request("/api/contracts/abc", { method: "DELETE" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent contract", async () => {
    const res = await request("/api/contracts/999999", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("soft deletes a contract (sets status to cancelled)", async () => {
    const ids = await getFirstCompanyAndFactory();
    if (!ids) return;

    const createRes = await request("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ids, ...validContractBase }),
    });
    if (createRes.status !== 201) return;
    const created = await createRes.json();

    const deleteRes = await request(`/api/contracts/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);
    const data = await deleteRes.json();
    expect(data.success).toBe(true);

    // Verify it's cancelled
    const getRes = await request(`/api/contracts/${created.id}`);
    const contract = await getRes.json();
    expect(contract.status).toBe("cancelled");

    // Clean up
    await request("/api/contracts/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [created.id] }),
    });
  });
});

// ─── POST /api/contracts/bulk-delete ────────────────────────────────

describe("POST /api/contracts/bulk-delete", () => {
  it("rejects empty ids array", async () => {
    const res = await request("/api/contracts/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects missing ids field", async () => {
    const res = await request("/api/contracts/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("rejects non-positive ids", async () => {
    const res = await request("/api/contracts/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [-1, 0] }),
    });
    expect(res.status).toBe(400);
  });

  it("handles non-existent ids gracefully", async () => {
    const res = await request("/api/contracts/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [999998, 999999] }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.deleted).toBe(0);
  });
});

// ─── POST /api/contracts/purge ──────────────────────────────────────

describe("POST /api/contracts/purge", () => {
  it("rejects empty ids array", async () => {
    const res = await request("/api/contracts/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects missing ids field", async () => {
    const res = await request("/api/contracts/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("handles non-existent ids gracefully (purges 0)", async () => {
    const res = await request("/api/contracts/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [999998, 999999] }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.purged).toBe(0);
  });

  it("only purges cancelled contracts (safety check)", async () => {
    const ids = await getFirstCompanyAndFactory();
    if (!ids) return;

    // Create and DON'T cancel it
    const createRes = await request("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ids, ...validContractBase }),
    });
    if (createRes.status !== 201) return;
    const created = await createRes.json();

    // Try to purge an active contract — should be skipped
    const purgeRes = await request("/api/contracts/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [created.id] }),
    });
    expect(purgeRes.status).toBe(200);
    const purgeData = await purgeRes.json();
    expect(purgeData.purged).toBe(0); // Should NOT purge active contract

    // Verify contract still exists
    const getRes = await request(`/api/contracts/${created.id}`);
    expect(getRes.status).toBe(200);

    // Clean up properly
    await request(`/api/contracts/${created.id}`, { method: "DELETE" });
    await request("/api/contracts/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [created.id] }),
    });
  });
});
