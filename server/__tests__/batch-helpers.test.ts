import { describe, it, expect } from "vitest";
import {
  calculateEndDateForFactory,
  parseWorkHours,
  groupEmployeesByRate,
  buildRateGroupList,
  createSkipRecord,
  checkExemption,
} from "../services/batch-helpers.js";
import type { Factory, Employee } from "../db/schema.js";

// ─── Helper: minimal factory for testing ────────────────────────────

function makeFactory(overrides: Partial<Factory> = {}): Factory {
  return {
    id: 1,
    companyId: 1,
    factoryName: "TestFactory",
    address: null,
    phone: null,
    department: "Dept",
    lineName: "Line1",
    supervisorDept: null,
    supervisorName: null,
    supervisorPhone: null,
    complaintClientName: null,
    complaintClientPhone: null,
    complaintClientDept: null,
    complaintUnsName: null,
    complaintUnsPhone: null,
    complaintUnsDept: null,
    managerUnsName: null,
    managerUnsPhone: null,
    managerUnsDept: null,
    managerUnsAddress: null,
    complaintUnsAddress: null,
    hakensakiManagerName: null,
    hakensakiManagerPhone: null,
    hakensakiManagerDept: null,
    hakensakiManagerRole: null,
    supervisorRole: null,
    hourlyRate: 1500,
    jobDescription: null,
    shiftPattern: null,
    workHours: null,
    workHoursDay: null,
    workHoursNight: null,
    breakTime: null,
    breakTimeDay: null,
    breakTimeNight: null,
    overtimeHours: null,
    overtimeOutsideDays: null,
    workDays: null,
    jobDescription2: null,
    conflictDate: null,
    contractPeriod: null,
    calendar: null,
    closingDay: null,
    closingDayText: null,
    paymentDay: null,
    paymentDayText: null,
    bankAccount: null,
    timeUnit: null,
    workerClosingDay: null,
    workerPaymentDay: null,
    workerCalendar: null,
    agreementPeriodEnd: null,
    explainerName: null,
    hasRobotTraining: false,
    isActive: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 1,
    employeeNumber: "E001",
    status: "active",
    fullName: "Test Worker",
    katakanaName: null,
    nationality: null,
    gender: null,
    birthDate: null,
    hireDate: null,
    actualHireDate: null,
    hourlyRate: 1000,
    billingRate: 1500,
    clientEmployeeId: null,
    visaExpiry: null,
    visaType: null,
    address: null,
    postalCode: null,
    companyId: 1,
    factoryId: 1,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

// ─── calculateEndDateForFactory ─────────────────────────────────────

describe("calculateEndDateForFactory", () => {
  it("uses conflictDate when period is teishokubi", () => {
    const factory = makeFactory({ contractPeriod: "teishokubi", conflictDate: "2027-06-30" });
    expect(calculateEndDateForFactory(factory, "2026-04-01")).toBe("2027-06-30");
  });

  it("calculates 1 month period", () => {
    const factory = makeFactory({ contractPeriod: "1month" });
    expect(calculateEndDateForFactory(factory, "2026-04-01")).toBe("2026-04-30");
  });

  it("calculates 3 months period", () => {
    const factory = makeFactory({ contractPeriod: "3months" });
    expect(calculateEndDateForFactory(factory, "2026-04-01")).toBe("2026-06-30");
  });

  it("calculates 6 months period", () => {
    const factory = makeFactory({ contractPeriod: "6months" });
    expect(calculateEndDateForFactory(factory, "2026-04-01")).toBe("2026-09-30");
  });

  it("calculates 1 year period", () => {
    const factory = makeFactory({ contractPeriod: "1year" });
    expect(calculateEndDateForFactory(factory, "2026-04-01")).toBe("2027-03-31");
  });

  it("caps at conflictDate when calculated endDate exceeds it", () => {
    const factory = makeFactory({ contractPeriod: "1year", conflictDate: "2026-08-15" });
    expect(calculateEndDateForFactory(factory, "2026-04-01")).toBe("2026-08-15");
  });

  it("uses globalEndDate as fallback when no period set", () => {
    const factory = makeFactory({ contractPeriod: null });
    expect(calculateEndDateForFactory(factory, "2026-04-01", "2026-12-31")).toBe("2026-12-31");
  });

  it("uses startDate as last resort when no period and no globalEndDate", () => {
    const factory = makeFactory({ contractPeriod: null });
    expect(calculateEndDateForFactory(factory, "2026-04-01")).toBe("2026-04-01");
  });

  it("caps globalEndDate at conflictDate", () => {
    const factory = makeFactory({ contractPeriod: null, conflictDate: "2026-06-30" });
    expect(calculateEndDateForFactory(factory, "2026-04-01", "2026-12-31")).toBe("2026-06-30");
  });

  it("teishokubi without conflictDate falls back to globalEndDate", () => {
    const factory = makeFactory({ contractPeriod: "teishokubi", conflictDate: null });
    expect(calculateEndDateForFactory(factory, "2026-04-01", "2026-09-30")).toBe("2026-09-30");
  });
});

// ─── parseWorkHours ─────────────────────────────────────────────────

describe("parseWorkHours", () => {
  it("parses standard format: 8時00分～17時00分", () => {
    expect(parseWorkHours("8時00分～17時00分")).toEqual({
      workStartTime: "08:00",
      workEndTime: "17:00",
    });
  });

  it("parses colon format: 7:00～15:30", () => {
    expect(parseWorkHours("7:00～15:30")).toEqual({
      workStartTime: "07:00",
      workEndTime: "15:30",
    });
  });

  it("parses with tilde: 19:00~3:30", () => {
    expect(parseWorkHours("19:00~3:30")).toEqual({
      workStartTime: "19:00",
      workEndTime: "03:30",
    });
  });

  it("returns empty strings for null input", () => {
    expect(parseWorkHours(null)).toEqual({ workStartTime: "", workEndTime: "" });
  });

  it("returns empty strings for unparseable input", () => {
    expect(parseWorkHours("unknown format")).toEqual({ workStartTime: "", workEndTime: "" });
  });
});

// ─── groupEmployeesByRate ───────────────────────────────────────────

describe("groupEmployeesByRate", () => {
  it("groups by billingRate when available", () => {
    const emps = [
      makeEmployee({ id: 1, billingRate: 1600, hourlyRate: 1000 }),
      makeEmployee({ id: 2, billingRate: 1600, hourlyRate: 1100 }),
      makeEmployee({ id: 3, billingRate: 1800, hourlyRate: 1200 }),
    ];
    const groups = groupEmployeesByRate(emps, null);
    expect(groups.size).toBe(2);
    expect(groups.get(1600)?.length).toBe(2);
    expect(groups.get(1800)?.length).toBe(1);
  });

  it("falls back to hourlyRate when billingRate is null", () => {
    const emps = [
      makeEmployee({ id: 1, billingRate: null, hourlyRate: 1200 }),
      makeEmployee({ id: 2, billingRate: null, hourlyRate: 1200 }),
    ];
    const groups = groupEmployeesByRate(emps, null);
    expect(groups.size).toBe(1);
    expect(groups.get(1200)?.length).toBe(2);
  });

  it("falls back to factory rate when both are null", () => {
    const emps = [
      makeEmployee({ id: 1, billingRate: null, hourlyRate: null }),
    ];
    const groups = groupEmployeesByRate(emps, 1500);
    expect(groups.size).toBe(1);
    expect(groups.get(1500)?.length).toBe(1);
  });

  it("skips employees with 0 effective rate", () => {
    const emps = [
      makeEmployee({ id: 1, billingRate: null, hourlyRate: null }),
    ];
    const groups = groupEmployeesByRate(emps, null);
    expect(groups.size).toBe(0);
  });

  it("groups mixed rate sources correctly", () => {
    const emps = [
      makeEmployee({ id: 1, billingRate: 1600, hourlyRate: 1000 }),  // uses billingRate
      makeEmployee({ id: 2, billingRate: null, hourlyRate: 1600 }),   // uses hourlyRate = same group
      makeEmployee({ id: 3, billingRate: null, hourlyRate: null }),   // uses fallback
    ];
    const groups = groupEmployeesByRate(emps, 1600);
    // All three end up in rate=1600 group
    expect(groups.size).toBe(1);
    expect(groups.get(1600)?.length).toBe(3);
  });
});

// ─── buildRateGroupList ─────────────────────────────────────────────

describe("buildRateGroupList", () => {
  it("calculates OT and holiday rates correctly", () => {
    const groups = new Map<number, Employee[]>();
    groups.set(1600, [makeEmployee()]);

    const list = buildRateGroupList(groups);
    expect(list).toHaveLength(1);
    expect(list[0].rate).toBe(1600);
    expect(list[0].overtimeRate).toBe(2000); // 1600 * 1.25
    expect(list[0].holidayRate).toBe(2160);  // 1600 * 1.35
    expect(list[0].employeeCount).toBe(1);
  });

  it("calculates sixtyHourRate at 150% (労基法37条第1項但書)", () => {
    const groups = new Map<number, Employee[]>();
    groups.set(1600, [makeEmployee()]);

    const list = buildRateGroupList(groups);
    expect(list[0].sixtyHourRate).toBe(2400); // 1600 * 1.5
  });

  it("rounds sixtyHourRate for non-integer results", () => {
    const groups = new Map<number, Employee[]>();
    groups.set(1333, [makeEmployee()]);

    const list = buildRateGroupList(groups);
    expect(list[0].sixtyHourRate).toBe(Math.round(1333 * 1.5)); // 2000
  });

  it("handles multiple rate groups", () => {
    const groups = new Map<number, Employee[]>();
    groups.set(1500, [makeEmployee({ id: 1 }), makeEmployee({ id: 2 })]);
    groups.set(1800, [makeEmployee({ id: 3 })]);

    const list = buildRateGroupList(groups);
    expect(list).toHaveLength(2);

    const r1500 = list.find((g) => g.rate === 1500)!;
    const r1800 = list.find((g) => g.rate === 1800)!;
    expect(r1500.employeeCount).toBe(2);
    expect(r1800.employeeCount).toBe(1);
    expect(r1800.overtimeRate).toBe(2250); // 1800 * 1.25
    expect(r1800.holidayRate).toBe(2430);  // 1800 * 1.35
    expect(r1500.sixtyHourRate).toBe(2250); // 1500 * 1.5
    expect(r1800.sixtyHourRate).toBe(2700); // 1800 * 1.5
  });

  it("returns empty array for empty map", () => {
    const groups = new Map<number, Employee[]>();
    expect(buildRateGroupList(groups)).toEqual([]);
  });
});

// ─── createSkipRecord ───────────────────────────────────────────────

describe("createSkipRecord", () => {
  it("creates a properly structured skip record", () => {
    const factory = makeFactory({ id: 5, factoryName: "Factory5", department: "DeptA", lineName: "Line2" });
    const record = createSkipRecord(factory, "社員なし");
    expect(record).toEqual({
      factoryId: 5,
      factoryName: "Factory5",
      department: "DeptA",
      lineName: "Line2",
      reason: "社員なし",
    });
  });

  it("handles null department and lineName", () => {
    const factory = makeFactory({ department: null, lineName: null });
    const record = createSkipRecord(factory, "単価未設定");
    expect(record.department).toBeNull();
    expect(record.lineName).toBeNull();
  });
});

// ─── checkExemption ──────────────────────────────────────────

describe("checkExemption", () => {
  it("returns not exempt for a standard factory with normal department", () => {
    const factory = makeFactory({ factoryName: "ABC工場", department: "製造部", lineName: "ライン1" });
    const result = checkExemption(factory);
    expect(result.isExempt).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it("returns exempt when department contains 請負", () => {
    const factory = makeFactory({ factoryName: "XYZ工場", department: "請負部門", lineName: "ライン2" });
    const result = checkExemption(factory);
    expect(result.isExempt).toBe(true);
    expect(result.reason).toContain("請負");
  });

  it("returns exempt when lineName contains 請負", () => {
    const factory = makeFactory({ factoryName: "DEF工場", department: "製造部", lineName: "請負ライン" });
    const result = checkExemption(factory);
    expect(result.isExempt).toBe(true);
    expect(result.reason).toContain("請負");
  });

  it("returns exempt for 高雄工業岡山工場 (always Ukeoi)", () => {
    const factory = makeFactory({ factoryName: "高雄工業岡山工場", department: "製造部", lineName: "ライン1" });
    const result = checkExemption(factory);
    expect(result.isExempt).toBe(true);
    expect(result.reason).toContain("高雄工業岡山工場");
  });

  it("returns exempt for factory name containing 岡山工場", () => {
    const factory = makeFactory({ factoryName: "某社岡山工場", department: "組立部", lineName: "A" });
    const result = checkExemption(factory);
    expect(result.isExempt).toBe(true);
  });

  it("returns exempt for 日清食品 with 請負 department", () => {
    const factory = makeFactory({ factoryName: "日清食品工場", department: "請負部", lineName: "ライン1" });
    const result = checkExemption(factory);
    expect(result.isExempt).toBe(true);
    expect(result.reason).toContain("日清食品");
  });

  it("returns NOT exempt for 日清食品 with normal department", () => {
    const factory = makeFactory({ factoryName: "日清食品工場", department: "通常部門", lineName: "ライン1" });
    const result = checkExemption(factory);
    expect(result.isExempt).toBe(false);
  });

  it("returns exempt when department contains Ukeoi", () => {
    const factory = makeFactory({ factoryName: "GHI工場", department: "Ukeoi Section", lineName: "L1" });
    const result = checkExemption(factory);
    expect(result.isExempt).toBe(true);
  });

  it("handles null department and lineName gracefully", () => {
    const factory = makeFactory({ department: null, lineName: null });
    const result = checkExemption(factory);
    expect(result.isExempt).toBe(false);
  });
});
