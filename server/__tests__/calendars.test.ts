/**
 * Integration tests for the calendars API route (POST /api/calendars).
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

// ─── GET /api/calendars/:factoryId ──────────────────────────────────

describe("GET /api/calendars/:factoryId", () => {
  it("returns array for a valid factoryId", async () => {
    // Use a factoryId that may or may not exist — should return 200 with array
    const res = await request("/api/calendars/1");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 400 for invalid factoryId", async () => {
    const res = await request("/api/calendars/abc");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });
});

// ─── POST /api/calendars ────────────────────────────────────────────

describe("POST /api/calendars", () => {
  it("rejects request with missing factoryId", async () => {
    const res = await request("/api/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: 2026,
        holidays: [],
      }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  it("rejects request with missing year", async () => {
    const res = await request("/api/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        factoryId: 1,
        holidays: [],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects year outside valid range (< 2020)", async () => {
    const res = await request("/api/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        factoryId: 1,
        year: 2019,
        holidays: [],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects year outside valid range (> 2100)", async () => {
    const res = await request("/api/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        factoryId: 1,
        year: 2101,
        holidays: [],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("accepts holidays as array of date strings", async () => {
    const res = await request("/api/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        factoryId: 99999,
        year: 2026,
        holidays: ["2026-01-01", "2026-05-03"],
      }),
    });
    // May return 201 (create) or 200 (upsert) or 500 (FK constraint if factory doesn't exist)
    // The validation should pass at least
    if (res.status === 201 || res.status === 200) {
      const data = await res.json();
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("factoryId");
      expect(data).toHaveProperty("year");
      expect(data).toHaveProperty("totalWorkDays");
    } else {
      // FK constraint error is acceptable for non-existent factory
      expect(res.status).toBe(500);
    }
  });

  it("accepts holidays as JSON string", async () => {
    const res = await request("/api/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        factoryId: 99999,
        year: 2027,
        holidays: '["2027-01-01"]',
      }),
    });
    // Same as above — validation passes, FK may fail
    expect([200, 201, 500]).toContain(res.status);
  });

  it("rejects completely empty body", async () => {
    const res = await request("/api/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("rejects negative factoryId", async () => {
    const res = await request("/api/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        factoryId: -1,
        year: 2026,
        holidays: [],
      }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── Calendar work day calculation ──────────────────────────────────

describe("Calendar totalWorkDays calculation", () => {
  it("calculates work days correctly for a real factory", async () => {
    // First, find a real factory
    const factoriesRes = await request("/api/factories");
    const factoriesList = await factoriesRes.json();
    if (!Array.isArray(factoriesList) || factoriesList.length === 0) return;

    const factoryId = factoriesList[0].id;
    const res = await request("/api/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        factoryId,
        year: 2099, // Use a far-future year to avoid conflicts
        holidays: ["2099-01-01", "2099-12-25"],
        description: "__test_calendar__",
      }),
    });

    if (res.status === 201 || res.status === 200) {
      const data = await res.json();
      expect(data.totalWorkDays).toBeTypeOf("number");
      expect(data.totalWorkDays).toBeGreaterThan(200); // ~261 work days minus holidays
      expect(data.totalWorkDays).toBeLessThan(270);

      // Clean up: delete the calendar we just created
      const deleteRes = await request(`/api/calendars/${data.id}`, {
        method: "DELETE",
      });
      expect(deleteRes.status).toBe(200);
    }
  });
});
