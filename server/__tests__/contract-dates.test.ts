import { describe, it, expect } from "vitest";
import {
  toLocalDateStr,
  isFactoryClosureDay,
  getFactoryClosureDays,
  subtractBusinessDays,
  calculateContractDate,
  calculateNotificationDate,
  calculateContractDates,
} from "../services/contract-dates.js";

// ─── toLocalDateStr ────────────────────────────────────────────────

describe("toLocalDateStr", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(toLocalDateStr(new Date(2026, 3, 1))).toBe("2026-04-01"); // April (0-indexed month)
  });

  it("pads single-digit months and days", () => {
    expect(toLocalDateStr(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("handles December 31", () => {
    expect(toLocalDateStr(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

// ─── isFactoryClosureDay ───────────────────────────────────────────

describe("isFactoryClosureDay", () => {
  it("returns true for Jan 1 (年末年始)", () => {
    expect(isFactoryClosureDay(new Date(2026, 0, 1))).toBe(true);
  });

  it("returns true for Jan 3 (年末年始)", () => {
    expect(isFactoryClosureDay(new Date(2026, 0, 3))).toBe(true);
  });

  it("returns false for Jan 4 (normal day)", () => {
    expect(isFactoryClosureDay(new Date(2026, 0, 4))).toBe(false);
  });

  it("returns true for Dec 29 (年末年始)", () => {
    expect(isFactoryClosureDay(new Date(2026, 11, 29))).toBe(true);
  });

  it("returns true for Dec 31 (年末年始)", () => {
    expect(isFactoryClosureDay(new Date(2026, 11, 31))).toBe(true);
  });

  it("returns true for Apr 29 (昭和の日 / GW)", () => {
    expect(isFactoryClosureDay(new Date(2026, 3, 29))).toBe(true);
  });

  it("returns true for May 3-6 (GW)", () => {
    expect(isFactoryClosureDay(new Date(2026, 4, 3))).toBe(true);
    expect(isFactoryClosureDay(new Date(2026, 4, 6))).toBe(true);
  });

  it("returns false for May 2 (not GW closure)", () => {
    expect(isFactoryClosureDay(new Date(2026, 4, 2))).toBe(false);
  });

  it("returns true for Aug 13-16 (お盆)", () => {
    expect(isFactoryClosureDay(new Date(2026, 7, 13))).toBe(true);
    expect(isFactoryClosureDay(new Date(2026, 7, 16))).toBe(true);
  });

  it("returns false for Aug 12 (not お盆)", () => {
    expect(isFactoryClosureDay(new Date(2026, 7, 12))).toBe(false);
  });

  it("returns false for a normal weekday", () => {
    expect(isFactoryClosureDay(new Date(2026, 5, 15))).toBe(false); // June 15
  });
});

// ─── getFactoryClosureDays ─────────────────────────────────────────

describe("getFactoryClosureDays", () => {
  it("returns a Set of date strings for the given year", () => {
    const closures = getFactoryClosureDays(2026);
    expect(closures).toBeInstanceOf(Set);
    // Jan 1-3
    expect(closures.has("2026-01-01")).toBe(true);
    expect(closures.has("2026-01-03")).toBe(true);
    // Dec 29-31
    expect(closures.has("2026-12-29")).toBe(true);
    expect(closures.has("2026-12-31")).toBe(true);
    // GW
    expect(closures.has("2026-04-29")).toBe(true);
    expect(closures.has("2026-05-03")).toBe(true);
    expect(closures.has("2026-05-06")).toBe(true);
    // Obon
    expect(closures.has("2026-08-13")).toBe(true);
    expect(closures.has("2026-08-16")).toBe(true);
  });

  it("does not include normal days", () => {
    const closures = getFactoryClosureDays(2026);
    expect(closures.has("2026-06-15")).toBe(false);
    expect(closures.has("2026-01-04")).toBe(false);
  });
});

// ─── subtractBusinessDays ──────────────────────────────────────────

describe("subtractBusinessDays", () => {
  it("subtracts 2 business days from a Wednesday (no weekend)", () => {
    // 2026-04-08 is Wednesday -> -2 biz = Monday 2026-04-06
    const result = subtractBusinessDays(new Date(2026, 3, 8), 2);
    expect(toLocalDateStr(result)).toBe("2026-04-06");
  });

  it("skips weekends when subtracting", () => {
    // 2026-04-06 is Monday -> -2 biz = Thursday 2026-04-02
    const result = subtractBusinessDays(new Date(2026, 3, 6), 2);
    expect(toLocalDateStr(result)).toBe("2026-04-02");
  });

  it("skips weekends when start is Monday and subtracting 1", () => {
    // 2026-04-06 is Monday -> -1 biz = Friday 2026-04-03
    const result = subtractBusinessDays(new Date(2026, 3, 6), 1);
    expect(toLocalDateStr(result)).toBe("2026-04-03");
  });

  it("skips factory closure days (年末年始)", () => {
    // 2026-01-05 is Monday -> -1 biz should skip Jan 1-3 (closure) + Jan 4 (Sun)
    // Actually Jan 4 2026 is Sunday, Jan 3 Sat, so:
    // Jan 5 Mon -> -1 day = Jan 4 Sun (skip) -> Jan 3 Sat (skip) -> Jan 2 Fri (closure, skip) -> Jan 1 Thu (closure, skip) -> Dec 31 Wed (closure, skip) -> Dec 30 Tue (closure, skip) -> Dec 29 Mon (closure, skip) -> Dec 28 Sun (skip) -> Dec 27 Sat (skip) -> Dec 26 Fri = result
    const result = subtractBusinessDays(new Date(2026, 0, 5), 1);
    expect(toLocalDateStr(result)).toBe("2025-12-26");
  });

  it("skips GW closure days", () => {
    // 2026-05-07 is Thursday -> -1 biz should skip May 6 (closure), May 5 (closure), May 4 (closure), May 3 (closure Sun), May 2 (Sat)...
    // May 7 Thu -> May 6 Wed (closure, skip) -> May 5 Tue (closure, skip) -> May 4 Mon (closure, skip) -> May 3 Sun (skip) -> May 2 Sat (skip) -> May 1 Fri = result
    const result = subtractBusinessDays(new Date(2026, 4, 7), 1);
    expect(toLocalDateStr(result)).toBe("2026-05-01");
  });

  it("skips お盆 closure days", () => {
    // 2026-08-17 is Monday -> -1 biz should skip Aug 16 (Sun+closure), 15 (Sat+closure), 14 (Fri closure), 13 (Thu closure) -> Aug 12 Wed
    const result = subtractBusinessDays(new Date(2026, 7, 17), 1);
    expect(toLocalDateStr(result)).toBe("2026-08-12");
  });

  it("handles 0 business days (returns same date)", () => {
    const result = subtractBusinessDays(new Date(2026, 3, 8), 0);
    expect(toLocalDateStr(result)).toBe("2026-04-08");
  });
});

// ─── calculateContractDate ─────────────────────────────────────────

describe("calculateContractDate", () => {
  it("returns startDate - 2 business days", () => {
    // 2026-04-08 Wed -> -2 biz = 2026-04-06 Mon
    expect(calculateContractDate("2026-04-08")).toBe("2026-04-06");
  });

  it("skips weekends correctly", () => {
    // 2026-04-07 Tue -> -2 biz: Mon Apr 6 (-1), Fri Apr 3 (-2)
    expect(calculateContractDate("2026-04-07")).toBe("2026-04-03");
  });

  it("handles month boundary", () => {
    // 2026-05-01 Fri -> -2 biz: Apr 30 Thu = closure? No (Apr 30 is normal) -> Apr 29 Wed = closure (GW)! -> Apr 28 Tue
    // May 1 Fri -> Apr 30 Thu (-1), Apr 29 Wed (closure, skip) -> Apr 28 Tue (-2)
    expect(calculateContractDate("2026-05-01")).toBe("2026-04-28");
  });
});

// ─── calculateNotificationDate ─────────────────────────────────────

describe("calculateNotificationDate", () => {
  it("returns startDate - 3 business days", () => {
    // 2026-04-08 Wed -> -3 biz: Mon Apr 6 (-1), Fri Apr 3 (-2), Thu Apr 2 (-3)... wait
    // Apr 8 Wed -> Apr 7 Tue (-1), Apr 6 Mon (-2), Apr 3 Fri (-3)
    expect(calculateNotificationDate("2026-04-08")).toBe("2026-04-03");
  });

  it("skips weekends correctly", () => {
    // 2026-04-06 Mon -> -3 biz: Fri Apr 3 (-1), Thu Apr 2 (-2), Wed Apr 1 (-3)
    expect(calculateNotificationDate("2026-04-06")).toBe("2026-04-01");
  });
});

// ─── calculateContractDates ────────────────────────────────────────

describe("calculateContractDates", () => {
  it("returns all four dates", () => {
    const result = calculateContractDates("2026-04-08", "2026-06-30");
    expect(result).toEqual({
      startDate: "2026-04-08",
      endDate: "2026-06-30",
      contractDate: "2026-04-06",
      notificationDate: "2026-04-03",
    });
  });

  it("preserves endDate as-is", () => {
    const result = calculateContractDates("2026-04-01", "2026-09-30");
    expect(result.endDate).toBe("2026-09-30");
  });
});
