import { describe, it, expect } from "vitest";
import {
  calcMinsBetween,
  composeWorkHoursText,
  composeBreakForShift,
  composeFullBreakText,
  primaryBreakMins,
  parseExistingShifts,
  sortShiftEntries,
  uid,
  type ShiftEntry,
} from "../shift-utils";

// ─── uid ───────────────────────────────────────────────────────────

describe("uid", () => {
  it("returns unique IDs on successive calls", () => {
    const a = uid();
    const b = uid();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^_\d+$/);
  });
});

// ─── calcMinsBetween ───────────────────────────────────────────────

describe("calcMinsBetween", () => {
  it("calculates minutes for a normal day shift", () => {
    expect(calcMinsBetween("08:00", "17:00")).toBe(540); // 9h
  });

  it("calculates minutes for a night shift crossing midnight", () => {
    expect(calcMinsBetween("20:00", "05:00")).toBe(540); // 9h
  });

  it("handles same start and end as 24h (1440 min)", () => {
    expect(calcMinsBetween("08:00", "08:00")).toBe(1440);
  });

  it("returns 0 for empty start", () => {
    expect(calcMinsBetween("", "17:00")).toBe(0);
  });

  it("returns 0 for empty end", () => {
    expect(calcMinsBetween("08:00", "")).toBe(0);
  });

  it("returns 0 for both empty", () => {
    expect(calcMinsBetween("", "")).toBe(0);
  });

  it("calculates short break (60 min)", () => {
    expect(calcMinsBetween("12:00", "13:00")).toBe(60);
  });

  it("handles single-digit hours", () => {
    expect(calcMinsBetween("8:00", "9:30")).toBe(90);
  });
});

// ─── composeWorkHoursText ──────────────────────────────────────────

describe("composeWorkHoursText", () => {
  it("composes text for a single day shift", () => {
    const shifts: ShiftEntry[] = [
      { id: "1", name: "日勤", startTime: "08:00", endTime: "17:00", breaks: [] },
    ];
    expect(composeWorkHoursText(shifts)).toBe("日勤：8時00分～17時00分");
  });

  it("composes text for two shifts separated by full-width space", () => {
    const shifts: ShiftEntry[] = [
      { id: "1", name: "昼勤", startTime: "08:00", endTime: "17:00", breaks: [] },
      { id: "2", name: "夜勤", startTime: "20:00", endTime: "05:00", breaks: [] },
    ];
    const result = composeWorkHoursText(shifts);
    expect(result).toBe("昼勤：8時00分～17時00分　夜勤：20時00分～5時00分");
  });

  it("skips shifts with empty times", () => {
    const shifts: ShiftEntry[] = [
      { id: "1", name: "日勤", startTime: "08:00", endTime: "17:00", breaks: [] },
      { id: "2", name: "シフト1", startTime: "", endTime: "", breaks: [] },
    ];
    expect(composeWorkHoursText(shifts)).toBe("日勤：8時00分～17時00分");
  });

  it("returns empty string for no valid shifts", () => {
    const shifts: ShiftEntry[] = [
      { id: "1", name: "シフト1", startTime: "", endTime: "", breaks: [] },
    ];
    expect(composeWorkHoursText(shifts)).toBe("");
  });
});

// ─── composeBreakForShift ──────────────────────────────────────────

describe("composeBreakForShift", () => {
  it("composes break text with total minutes", () => {
    const shift: ShiftEntry = {
      id: "1",
      name: "日勤",
      startTime: "08:00",
      endTime: "17:00",
      breaks: [{ id: "b1", startTime: "12:00", endTime: "13:00" }],
    };
    expect(composeBreakForShift(shift)).toBe("日勤：12時00分～13時00分（60分）　合計60分");
  });

  it("composes multiple breaks joined by ・", () => {
    const shift: ShiftEntry = {
      id: "1",
      name: "昼勤",
      startTime: "08:00",
      endTime: "17:00",
      breaks: [
        { id: "b1", startTime: "10:00", endTime: "10:15" },
        { id: "b2", startTime: "12:00", endTime: "12:45" },
      ],
    };
    const result = composeBreakForShift(shift);
    expect(result).toContain("10時00分～10時15分（15分）");
    expect(result).toContain("12時00分～12時45分（45分）");
    expect(result).toContain("合計60分");
    expect(result).toContain("・");
  });

  it("returns empty string when no valid breaks", () => {
    const shift: ShiftEntry = {
      id: "1",
      name: "日勤",
      startTime: "08:00",
      endTime: "17:00",
      breaks: [{ id: "b1", startTime: "", endTime: "" }],
    };
    expect(composeBreakForShift(shift)).toBe("");
  });
});

// ─── composeFullBreakText ──────────────────────────────────────────

describe("composeFullBreakText", () => {
  it("joins break text from multiple shifts with newlines", () => {
    const shifts: ShiftEntry[] = [
      {
        id: "1", name: "昼勤", startTime: "08:00", endTime: "17:00",
        breaks: [{ id: "b1", startTime: "12:00", endTime: "13:00" }],
      },
      {
        id: "2", name: "夜勤", startTime: "20:00", endTime: "05:00",
        breaks: [{ id: "b2", startTime: "00:00", endTime: "01:00" }],
      },
    ];
    const result = composeFullBreakText(shifts);
    const lines = result.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("昼勤");
    expect(lines[1]).toContain("夜勤");
  });

  it("skips shifts with no valid breaks", () => {
    const shifts: ShiftEntry[] = [
      {
        id: "1", name: "昼勤", startTime: "08:00", endTime: "17:00",
        breaks: [{ id: "b1", startTime: "12:00", endTime: "13:00" }],
      },
      {
        id: "2", name: "夜勤", startTime: "20:00", endTime: "05:00",
        breaks: [],
      },
    ];
    const result = composeFullBreakText(shifts);
    expect(result).not.toContain("夜勤");
  });
});

// ─── primaryBreakMins ──────────────────────────────────────────────

describe("primaryBreakMins", () => {
  it("returns total break minutes for the first shift", () => {
    const shifts: ShiftEntry[] = [
      {
        id: "1", name: "日勤", startTime: "08:00", endTime: "17:00",
        breaks: [
          { id: "b1", startTime: "10:00", endTime: "10:15" },
          { id: "b2", startTime: "12:00", endTime: "12:45" },
        ],
      },
      {
        id: "2", name: "夜勤", startTime: "20:00", endTime: "05:00",
        breaks: [{ id: "b3", startTime: "00:00", endTime: "01:00" }],
      },
    ];
    expect(primaryBreakMins(shifts)).toBe(60); // 15 + 45
  });

  it("returns 0 for empty shifts array", () => {
    expect(primaryBreakMins([])).toBe(0);
  });

  it("returns 0 when first shift has no breaks", () => {
    const shifts: ShiftEntry[] = [
      { id: "1", name: "日勤", startTime: "08:00", endTime: "17:00", breaks: [] },
    ];
    expect(primaryBreakMins(shifts)).toBe(0);
  });
});

// ─── parseExistingShifts ───────────────────────────────────────────

describe("parseExistingShifts", () => {
  it("parses workHours text with custom shift names", () => {
    const shifts = parseExistingShifts({
      workHours: "昼勤：8時00分～17時00分　夜勤：20時00分～5時00分",
    });
    expect(shifts).toHaveLength(2);
    expect(shifts[0].name).toBe("昼勤");
    expect(shifts[0].startTime).toBe("08:00");
    expect(shifts[0].endTime).toBe("17:00");
    expect(shifts[1].name).toBe("夜勤");
    expect(shifts[1].startTime).toBe("20:00");
    expect(shifts[1].endTime).toBe("05:00");
  });

  it("parses 3-shift pattern from workHours", () => {
    const shifts = parseExistingShifts({
      workHours: "1直：6時00分～14時00分　2直：14時00分～22時00分　3直：22時00分～6時00分",
    });
    expect(shifts).toHaveLength(3);
    expect(shifts[0].name).toBe("1直");
    expect(shifts[1].name).toBe("2直");
    expect(shifts[2].name).toBe("3直");
  });

  it("falls back to workHoursDay/Night when workHours is empty", () => {
    const shifts = parseExistingShifts({
      workHours: "",
      workHoursDay: "8時00分～17時00分",
      workHoursNight: "20時00分～5時00分",
    });
    expect(shifts).toHaveLength(2);
    expect(shifts[0].name).toBe("昼勤");
    expect(shifts[0].startTime).toBe("08:00");
    expect(shifts[1].name).toBe("夜勤");
    expect(shifts[1].startTime).toBe("20:00");
  });

  it("returns default empty shift when no data available", () => {
    const shifts = parseExistingShifts({});
    expect(shifts).toHaveLength(1);
    expect(shifts[0].name).toBe("日勤");
    expect(shifts[0].startTime).toBe("");
    expect(shifts[0].endTime).toBe("");
  });

  it("returns default empty shift for null values", () => {
    const shifts = parseExistingShifts({
      workHours: null,
      workHoursDay: null,
      workHoursNight: null,
    });
    expect(shifts).toHaveLength(1);
    expect(shifts[0].name).toBe("日勤");
  });

  it("assigns break text to matching shift by name", () => {
    const shifts = parseExistingShifts({
      workHours: "昼勤：8時00分～17時00分　夜勤：20時00分～5時00分",
      breakTimeDay: "昼勤：12時00分～13時00分",
      breakTimeNight: "夜勤：0時00分～1時00分",
    });
    expect(shifts[0].breaks).toHaveLength(1);
    expect(shifts[0].breaks[0].startTime).toBe("12:00");
    expect(shifts[1].breaks).toHaveLength(1);
    expect(shifts[1].breaks[0].startTime).toBe("00:00");
  });

  it("assigns unnamed breaks to first shift without breaks", () => {
    const shifts = parseExistingShifts({
      workHours: "日勤：8時00分～17時00分",
      breakTimeDay: "12時00分～13時00分",
    });
    expect(shifts[0].breaks).toHaveLength(1);
    expect(shifts[0].breaks[0].startTime).toBe("12:00");
  });

  it("parses day-only from fallback fields", () => {
    const shifts = parseExistingShifts({
      workHoursDay: "8時00分～17時00分",
      breakTimeDay: "12時00分～12時45分",
    });
    expect(shifts).toHaveLength(1);
    expect(shifts[0].name).toBe("昼勤");
    expect(shifts[0].breaks).toHaveLength(1);
    expect(shifts[0].breaks[0].startTime).toBe("12:00");
    expect(shifts[0].breaks[0].endTime).toBe("12:45");
  });
});

// ─── sortShiftEntries ─────────────────────────────────────────────
//
// Orden canonico: 日勤 → 昼勤 → 夕勤 → 夜勤 → 深夜 → kanji numerados →
// letras latinas (A-Z) → otros kanji. Dentro de cada nombre, por ①②③ o
// numero trailing.

describe("sortShiftEntries", () => {
  const names = <T extends { name: string }>(arr: T[]) => arr.map((s) => s.name);

  it("orders mixed kanji + letter + numbered shifts canonically", () => {
    const input = [
      { name: "深夜" },
      { name: "A勤務" },
      { name: "C勤務" },
      { name: "昼勤①" },
      { name: "昼勤②" },
      { name: "B勤務" },
    ];
    expect(names(sortShiftEntries(input))).toEqual([
      "昼勤①",
      "昼勤②",
      "深夜",
      "A勤務",
      "B勤務",
      "C勤務",
    ]);
  });

  it("keeps Takao A-I shifts in alphabetic order", () => {
    const input = ["I勤務", "A勤務", "E勤務", "C勤務", "B勤務", "H勤務", "G勤務", "F勤務", "D勤務"].map((n) => ({ name: n }));
    expect(names(sortShiftEntries(input))).toEqual([
      "A勤務", "B勤務", "C勤務", "D勤務", "E勤務", "F勤務", "G勤務", "H勤務", "I勤務",
    ]);
  });

  it("orders kanji time names by day→night priority", () => {
    const input = [{ name: "深夜" }, { name: "日勤" }, { name: "夜勤" }, { name: "夕勤" }, { name: "昼勤" }];
    expect(names(sortShiftEntries(input))).toEqual(["日勤", "昼勤", "夕勤", "夜勤", "深夜"]);
  });

  it("orders numbered 直 shifts by number", () => {
    const input = [{ name: "3直" }, { name: "1直" }, { name: "2直" }];
    expect(names(sortShiftEntries(input))).toEqual(["1直", "2直", "3直"]);
  });

  it("orders シフト1, シフト2 by number", () => {
    const input = [{ name: "シフト2" }, { name: "シフト1" }];
    expect(names(sortShiftEntries(input))).toEqual(["シフト1", "シフト2"]);
  });

  it("places kanji group before latin group", () => {
    const input = [{ name: "A勤務" }, { name: "昼勤" }, { name: "Z勤務" }, { name: "深夜" }];
    expect(names(sortShiftEntries(input))).toEqual(["昼勤", "深夜", "A勤務", "Z勤務"]);
  });

  it("does not mutate the input array", () => {
    const input = [{ name: "B勤務" }, { name: "A勤務" }];
    sortShiftEntries(input);
    expect(names(input)).toEqual(["B勤務", "A勤務"]);
  });
});

// ─── composeWorkHoursText normalizes ordering on save ────────────

describe("composeWorkHoursText with canonical order", () => {
  it("outputs shifts in canonical order even when input is bara-bara", () => {
    const shifts: ShiftEntry[] = [
      { id: "_1", name: "深夜", startTime: "19:00", endTime: "03:30", breaks: [] },
      { id: "_2", name: "A勤務", startTime: "07:00", endTime: "15:30", breaks: [] },
      { id: "_3", name: "昼勤①", startTime: "07:00", endTime: "15:30", breaks: [] },
      { id: "_4", name: "B勤務", startTime: "15:00", endTime: "23:30", breaks: [] },
    ];
    const out = composeWorkHoursText(shifts);
    expect(out).toBe(
      "昼勤①：7時00分～15時30分　深夜：19時00分～3時30分　A勤務：7時00分～15時30分　B勤務：15時00分～23時30分",
    );
  });
});
