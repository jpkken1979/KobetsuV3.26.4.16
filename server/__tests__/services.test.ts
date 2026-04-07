/**
 * Integration tests for untested server services:
 * - dispatch-mapping (resolveDispatch, getAllDispatchKeys, getFullDispatchMap)
 * - contract-dates (calculateContractDate, calculateNotificationDate)
 */
import { describe, it, expect } from "vitest";
import {
  resolveDispatch,
  getAllDispatchKeys,
  getFullDispatchMap,
} from "../services/dispatch-mapping";
import {
  calculateContractDate,
  calculateNotificationDate,
  isFactoryClosureDay,
  getFactoryClosureDays,
} from "../services/contract-dates";
// ─── Dispatch Mapping ────────────────────────────────────────────────

describe("resolveDispatch", () => {
  it("resolves exact match for single-location company", () => {
    const result = resolveDispatch("瑞陵精機");
    expect(result.companyName).toBe("瑞陵精機株式会社");
    expect(result.factoryName).toBe("恵那工場");
    expect(result.verified).toBe(true);
  });

  it("resolves exact match for multi-location company", () => {
    const result = resolveDispatch("高雄工業 本社");
    expect(result.companyName).toBe("高雄工業株式会社");
    expect(result.factoryName).toBe("本社工場");
    expect(result.verified).toBe(true);
  });

  it("resolves all 5 高雄工業 locations correctly", () => {
    const locations = ["本社", "海南第一", "海南第二", "静岡", "岡山"];
    for (const loc of locations) {
      const result = resolveDispatch(`高雄工業 ${loc}`);
      expect(result.companyName).toBe("高雄工業株式会社");
      expect(result.verified).toBe(true);
    }
  });

  it("resolves half-width katakana (TK Engineering)", () => {
    const result = resolveDispatch("ﾃｨｰｹｰｴﾝｼﾞﾆｱﾘﾝｸﾞ");
    expect(result.companyName).toBe("ﾃｨｰｹｰｴﾝｼﾞﾆｱﾘﾝｸﾞ株式会社");
    expect(result.verified).toBe(true);
  });

  it("resolves full-width alias for TK Engineering", () => {
    const result = resolveDispatch("ティーケーエンジニアリング");
    expect(result.companyName).toBe("ﾃｨｰｹｰｴﾝｼﾞﾆｱﾘﾝｸﾞ株式会社");
    expect(result.verified).toBe(true);
  });

  it("fuzzy matches when input is prefix of a key", () => {
    const result = resolveDispatch("高雄工業");
    expect(result.companyName).toBe("高雄工業株式会社");
  });

  it("handles trimming of whitespace", () => {
    const result = resolveDispatch("  瑞陵精機  ");
    expect(result.companyName).toBe("瑞陵精機株式会社");
  });

  it("returns unverified fallback for unknown companies", () => {
    const result = resolveDispatch("存在しない会社");
    expect(result.companyName).toBe("存在しない会社");
    expect(result.factoryName).toBeNull();
    expect(result.verified).toBe(false);
  });

  it("splits unknown input on space for factory hint", () => {
    const result = resolveDispatch("未知企業 東京工場");
    expect(result.companyName).toBe("未知企業");
    expect(result.factoryName).toBe("東京工場");
    expect(result.verified).toBe(false);
  });

  it("marks unverified factories correctly", () => {
    const result = resolveDispatch("ユアサ工機 御津");
    expect(result.verified).toBe(false);
    expect(result.factoryName).toBeNull();
  });

  it("resolves コーリツ locations", () => {
    const locations = ["本社", "州の崎", "亀崎", "乙川"];
    for (const loc of locations) {
      const result = resolveDispatch(`コーリツ ${loc}`);
      expect(result.companyName).toBe("コーリツ株式会社");
      expect(result.verified).toBe(true);
    }
  });

  it("resolves ワーク locations", () => {
    const result = resolveDispatch("ワーク 志紀");
    expect(result.companyName).toBe("ワーク株式会社");
    expect(result.factoryName).toBe("志紀");
  });
});

describe("getAllDispatchKeys", () => {
  it("returns all known abbreviations", () => {
    const keys = getAllDispatchKeys();
    expect(keys.length).toBeGreaterThanOrEqual(35);
    expect(keys).toContain("瑞陵精機");
    expect(keys).toContain("高雄工業 本社");
    expect(keys).toContain("PATEC");
  });
});

describe("getFullDispatchMap", () => {
  it("returns a copy, not the original", () => {
    const map1 = getFullDispatchMap();
    const map2 = getFullDispatchMap();
    expect(map1).toEqual(map2);
    expect(map1).not.toBe(map2);
  });

  it("contains verified and unverified entries", () => {
    const map = getFullDispatchMap();
    const verified = Object.values(map).filter((v) => v.verified);
    const unverified = Object.values(map).filter((v) => !v.verified);
    expect(verified.length).toBeGreaterThan(0);
    expect(unverified.length).toBeGreaterThan(0);
  });
});

// ─── Contract Dates Edge Cases ───────────────────────────────────────

describe("contract date edge cases", () => {
  it("contractDate is 2 business days before start (Monday start, no holidays)", () => {
    // 2026-04-06 is Monday → Thu 2026-04-02 (no holidays in between)
    const result = calculateContractDate("2026-04-06");
    expect(result).toBe("2026-04-02");
  });

  it("notificationDate is 3 business days before start (Monday start, no holidays)", () => {
    // 2026-04-06 is Monday → Wed 2026-04-01 (no holidays in between)
    const result = calculateNotificationDate("2026-04-06");
    expect(result).toBe("2026-04-01");
  });

  it("contractDate skips weekends (Wednesday start)", () => {
    // 2026-04-01 is Wednesday → Mon 2026-03-30 (no holidays in between)
    const result = calculateContractDate("2026-04-01");
    expect(result).toBe("2026-03-30");
  });

  it("notificationDate skips weekends (Wednesday start)", () => {
    // 2026-04-01 is Wednesday → Fri 2026-03-27 (春分の日 is Mar 20, not in range)
    const result = calculateNotificationDate("2026-04-01");
    expect(result).toBe("2026-03-27");
  });
});

// ─── Factory Closure Days (工場休業日) ──────────────────────────────

describe("isFactoryClosureDay", () => {
  it("年末年始: Dec 29–31 are closure days", () => {
    expect(isFactoryClosureDay(new Date(2026, 11, 29))).toBe(true);
    expect(isFactoryClosureDay(new Date(2026, 11, 30))).toBe(true);
    expect(isFactoryClosureDay(new Date(2026, 11, 31))).toBe(true);
  });

  it("年末年始: Jan 1–3 are closure days", () => {
    expect(isFactoryClosureDay(new Date(2026, 0, 1))).toBe(true);
    expect(isFactoryClosureDay(new Date(2026, 0, 2))).toBe(true);
    expect(isFactoryClosureDay(new Date(2026, 0, 3))).toBe(true);
  });

  it("年末年始: Jan 4 is NOT a closure day", () => {
    expect(isFactoryClosureDay(new Date(2026, 0, 4))).toBe(false);
  });

  it("GW: Apr 29 is a closure day (昭和の日)", () => {
    expect(isFactoryClosureDay(new Date(2026, 3, 29))).toBe(true);
  });

  it("GW: Apr 30 is NOT a closure day", () => {
    expect(isFactoryClosureDay(new Date(2026, 3, 30))).toBe(false);
  });

  it("GW: May 3–6 are closure days", () => {
    expect(isFactoryClosureDay(new Date(2026, 4, 3))).toBe(true);
    expect(isFactoryClosureDay(new Date(2026, 4, 4))).toBe(true);
    expect(isFactoryClosureDay(new Date(2026, 4, 5))).toBe(true);
    expect(isFactoryClosureDay(new Date(2026, 4, 6))).toBe(true);
  });

  it("GW: May 7 is NOT a closure day", () => {
    expect(isFactoryClosureDay(new Date(2026, 4, 7))).toBe(false);
  });

  it("お盆: Aug 13–16 are closure days", () => {
    expect(isFactoryClosureDay(new Date(2026, 7, 13))).toBe(true);
    expect(isFactoryClosureDay(new Date(2026, 7, 14))).toBe(true);
    expect(isFactoryClosureDay(new Date(2026, 7, 15))).toBe(true);
    expect(isFactoryClosureDay(new Date(2026, 7, 16))).toBe(true);
  });

  it("お盆: Aug 12 and Aug 17 are NOT closure days", () => {
    expect(isFactoryClosureDay(new Date(2026, 7, 12))).toBe(false);
    expect(isFactoryClosureDay(new Date(2026, 7, 17))).toBe(false);
  });

  it("regular national holidays are NOT closure days (海の日, 敬老の日, etc.)", () => {
    expect(isFactoryClosureDay(new Date(2026, 1, 11))).toBe(false);  // 建国記念の日
    expect(isFactoryClosureDay(new Date(2026, 1, 23))).toBe(false);  // 天皇誕生日
    expect(isFactoryClosureDay(new Date(2026, 6, 20))).toBe(false);  // 海の日
    expect(isFactoryClosureDay(new Date(2026, 8, 21))).toBe(false);  // 敬老の日
    expect(isFactoryClosureDay(new Date(2026, 9, 12))).toBe(false);  // スポーツの日
    expect(isFactoryClosureDay(new Date(2026, 10, 3))).toBe(false);  // 文化の日
    expect(isFactoryClosureDay(new Date(2026, 10, 23))).toBe(false); // 勤労感謝の日
  });
});

describe("getFactoryClosureDays", () => {
  it("returns correct number of closure days for a year", () => {
    const closures = getFactoryClosureDays(2026);
    // 年末年始: 6 (Jan 1-3 + Dec 29-31), GW: 5 (Apr 29 + May 3-6), お盆: 4 (Aug 13-16)
    expect(closures.size).toBe(15);
  });

  it("contains expected dates", () => {
    const closures = getFactoryClosureDays(2026);
    expect(closures.has("2026-01-01")).toBe(true);
    expect(closures.has("2026-04-29")).toBe(true);
    expect(closures.has("2026-05-05")).toBe(true);
    expect(closures.has("2026-08-15")).toBe(true);
    expect(closures.has("2026-12-31")).toBe(true);
  });
});

describe("contract dates skip factory closure periods", () => {
  it("contractDate does NOT skip 建国記念の日 (Feb 11)", () => {
    // 2026-02-12 is Thursday. Factories work on 建国記念の日.
    // 2 business days back: Feb 11 (Wed) = 1, Feb 10 (Tue) = 2
    const result = calculateContractDate("2026-02-12");
    expect(result).toBe("2026-02-10");
  });

  it("contractDate skips GW closure (May 2026)", () => {
    // 2026-05-07 is Thursday. Going back:
    // May 6 (Wed) = closure, May 5 (Tue) = closure, May 4 (Mon) = closure,
    // May 3 (Sun) = weekend, May 2 (Sat) = weekend,
    // May 1 (Fri) = 1, Apr 30 (Thu) = 2
    const result = calculateContractDate("2026-05-07");
    expect(result).toBe("2026-04-30");
  });

  it("notificationDate skips GW closure including 昭和の日 (May 2026)", () => {
    // 2026-05-07 is Thursday. 3 business days back:
    // May 6-3 closure/weekend, May 2-1 weekend/Sat,
    // May 1 (Fri) = 1, Apr 30 (Thu) = 2, Apr 29 (Wed) = closure (昭和の日),
    // Apr 28 (Tue) = 3
    const result = calculateNotificationDate("2026-05-07");
    expect(result).toBe("2026-04-28");
  });

  it("contractDate skips 年末年始 (Jan 2026)", () => {
    // 2026-01-05 is Monday. Going back:
    // Jan 4 (Sun) = weekend, Jan 3 (Sat) = weekend+closure,
    // Jan 2 (Fri) = closure, Jan 1 (Thu) = closure,
    // Dec 31 (Wed) = closure, Dec 30 (Tue) = closure, Dec 29 (Mon) = closure,
    // Dec 28 (Sun) = weekend, Dec 27 (Sat) = weekend,
    // Dec 26 (Fri) = 1, Dec 25 (Thu) = 2
    const result = calculateContractDate("2026-01-05");
    expect(result).toBe("2025-12-25");
  });

  it("contractDate skips お盆 (Aug 2026)", () => {
    // 2026-08-17 is Monday. Going back:
    // Aug 16 (Sun) = weekend+closure, Aug 15 (Sat) = weekend+closure,
    // Aug 14 (Fri) = closure, Aug 13 (Thu) = closure,
    // Aug 12 (Wed) = 1, Aug 11 (Tue) = 2
    const result = calculateContractDate("2026-08-17");
    expect(result).toBe("2026-08-11");
  });
});

