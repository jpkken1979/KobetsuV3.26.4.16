import { describe, it, expect } from "vitest";
import { subtractMonths, subtractDays } from "../services/contract-dates";

describe("subtractMonths", () => {
  it("resta 12 meses a una fecha normal", () => {
    expect(subtractMonths("2026-10-01", 12)).toBe("2025-10-01");
  });

  it("resta 6 meses", () => {
    expect(subtractMonths("2026-10-01", 6)).toBe("2026-04-01");
  });

  it("resta 1 mes en enero → diciembre año anterior", () => {
    expect(subtractMonths("2026-01-15", 1)).toBe("2025-12-15");
  });
});

describe("subtractDays", () => {
  it("resta 1 día (teishokubi → último día de contrato)", () => {
    expect(subtractDays("2026-10-01", 1)).toBe("2026-09-30");
  });

  it("cruza mes", () => {
    expect(subtractDays("2026-04-01", 1)).toBe("2026-03-31");
  });

  it("cruza año", () => {
    expect(subtractDays("2026-01-01", 1)).toBe("2025-12-31");
  });
});
