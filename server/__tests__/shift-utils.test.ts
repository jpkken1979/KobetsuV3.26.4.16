import { describe, it, expect } from "vitest";
import {
  NAMED_SHIFT_RE,
  countNamedShifts,
  normalizeShiftText,
  parseWorkHours,
  parseBreakTime,
  inferContractHourlyRate,
} from "../services/shift-utils.js";

describe("NAMED_SHIFT_RE", () => {
  const cases: Array<[string, number]> = [
    // 昼勤 patterns
    ["昼勤 8:30~17:00", 1],
    ["昼勤：7時00分~15時30分", 1],
    ["昼勤①8時00分~17時00分", 1],
    // 夜勤 patterns
    ["夜勤 22:00~7:00", 1],
    ["夜勤：22時00分~7時00分", 1],
    // Circled number patterns
    ["①8時00分~17時00分", 1],
    ["②9時00分~18時00分", 1],
    ["①②8時00分~17時00分", 1], // adjacent circled numbers are one match if no separator
    // Letter prefixes
    ["A勤務：8時00分~17時00分", 1],
    ["B勤務：9時00分~18時00分", 1],
    // Digit prefixes
    ["1 08:00~17:00", 1],
    ["2 09:00~18:00", 1],
    // 交替勤務
    ["交替勤務①8時00分~17時00分", 1],
    ["交替勤務②9時00分~18時00分", 1],
    // Multiple shifts
    ["昼勤①8時00分~17時00分、交替勤務②9時00分~18時00分", 2],
    // No match
    ["8:00~17:00", 0],
    ["regular hours", 0],
    ["", 0],
  ];

  it.each(cases)("matches '%s' → %d", (text, expected) => {
    NAMED_SHIFT_RE.lastIndex = 0;
    const matches = text.match(NAMED_SHIFT_RE) || [];
    expect(matches.length).toBe(expected);
  });
});

describe("countNamedShifts", () => {
  it("returns 0 for null/undefined/empty", () => {
    expect(countNamedShifts(null)).toBe(0);
    expect(countNamedShifts(undefined)).toBe(0);
    expect(countNamedShifts("")).toBe(0);
  });

  it("counts single shift", () => {
    expect(countNamedShifts("昼勤 8:30~17:00")).toBe(1);
  });

  it("counts multiple shifts", () => {
    expect(countNamedShifts("昼勤①8時00分~17時00分、交替勤務②9時00分~18時00分")).toBe(2);
  });
});

describe("normalizeShiftText", () => {
  it("returns empty string for null/undefined", () => {
    expect(normalizeShiftText(null)).toBe("");
    expect(normalizeShiftText(undefined)).toBe("");
  });

  it("returns text as-is for single shift", () => {
    const text = "昼勤 8:30~17:00";
    expect(normalizeShiftText(text)).toBe(text);
  });

  it("returns text as-is if already has newlines", () => {
    const text = "昼勤①\n交替勤務②";
    expect(normalizeShiftText(text)).toBe(text);
  });

  it("splits multiple shifts on 、", () => {
    const text = "昼勤①8時00分~17時00分、交替勤務②9時00分~18時00分";
    const result = normalizeShiftText(text);
    expect(result).toContain("\n");
    expect(result.split("\n").length).toBe(2);
  });
});

describe("parseWorkHours", () => {
  it("uses workHours when it has 2+ named shifts", () => {
    const result = parseWorkHours({
      workHours: "昼勤①8時00分~17時00分、交替勤務②9時00分~18時00分",
      workHoursDay: "8:00~17:00",
      workHoursNight: "22:00~7:00",
    });
    expect(result).toContain("昼勤");
    expect(result).toContain("\n");
  });

  it("prefers workHours when populated even if Day!=Night (arubaito)", () => {
    const result = parseWorkHours({
      workHours: "7時00分~15時30分",
      workHoursDay: "8:00~17:00",
      workHoursNight: "22:00~7:00",
    });
    expect(result).toBe("7時00分~15時30分");
  });

  it("combines Day/Night with labels when workHours empty and Day!=Night", () => {
    const result = parseWorkHours({
      workHours: "",
      workHoursDay: "8:00~17:00",
      workHoursNight: "22:00~7:00",
    });
    expect(result).toContain("昼勤");
    expect(result).toContain("夜勤");
    expect(result).toContain("\n");
  });

  it("uses workHoursDay when Day==Night", () => {
    const result = parseWorkHours({
      workHours: "",
      workHoursDay: "8:00~17:00",
      workHoursNight: "8:00~17:00",
    });
    expect(result).toBe("8:00~17:00");
  });

  it("falls back to contract times", () => {
    const result = parseWorkHours({
      workHours: "",
      workHoursDay: "",
      workHoursNight: "",
      contractStartTime: "9:00",
      contractEndTime: "18:00",
    });
    expect(result).toBe("9:00 ～ 18:00");
  });

  it("returns empty workHours when nothing available", () => {
    const result = parseWorkHours({
      workHours: "",
      workHoursDay: "",
      workHoursNight: "",
    });
    expect(result).toBe("");
  });
});

describe("parseBreakTime", () => {
  it("uses breakTimeDay when it has 2+ shifts", () => {
    const result = parseBreakTime({
      breakTimeDay: "昼勤①12時00分~12時45分、交替勤務②12時45分~13時30分",
      breakTimeNight: "",
    });
    expect(result).toContain("\n");
  });

  it("combines Day+Night when total is 2+", () => {
    const result = parseBreakTime({
      breakTimeDay: "昼勤①12時00分~12時45分",
      breakTimeNight: "交替勤務②12時45分~13時30分",
    });
    expect(result).toContain("昼勤");
    expect(result).toContain("交替");
  });

  it("uses breakMinutes as fallback", () => {
    const result = parseBreakTime({
      breakTimeDay: "",
      breakTimeNight: "",
      breakMinutes: 60,
    });
    expect(result).toBe("60分");
  });

  it("uses factory breakTime as final fallback", () => {
    const result = parseBreakTime({
      breakTimeDay: "",
      breakTimeNight: "",
      breakTime: 45,
    });
    expect(result).toBe("45分");
  });

  it("adds labels for 2-shift factory", () => {
    const result = parseBreakTime({
      breakTimeDay: "12:00~13:00",
      breakTimeNight: "0:00~1:00",
      isTwoShiftFactory: true,
    });
    expect(result).toContain("昼勤");
    expect(result).toContain("夜勤");
  });
});

describe("inferContractHourlyRate", () => {
  it("returns contract rate when present", () => {
    const result = inferContractHourlyRate(1200, [], 1000);
    expect(result).toBe(1200);
  });

  it("infers from employees when contract rate is null", () => {
    const employees = [
      { hourlyRate: 1100, employee: { billingRate: 1200, hourlyRate: null } },
      { hourlyRate: 1100, employee: { billingRate: 1300, hourlyRate: null } },
    ];
    const result = inferContractHourlyRate(null, employees, 1000);
    expect(result).toBe(1100); // most common
  });

  it("falls back to factory rate when no employees", () => {
    const result = inferContractHourlyRate(null, [], 1000);
    expect(result).toBe(1000);
  });

  it("returns 0 when nothing available", () => {
    const result = inferContractHourlyRate(null, [], null);
    expect(result).toBe(0);
  });
});
