/**
 * Tests for server-side fixes: validation, dates, rate calculator, like escaping
 */
import { describe, it, expect } from "vitest";
import {
  toLocalDateStr,
  subtractBusinessDays,
  calculateContractDate,
  calculateNotificationDate,
  calculateContractDates,
} from "../services/contract-dates";
import {
  createCompanySchema,
  updateCompanySchema,
  createFactorySchema,
  createEmployeeSchema,
  createContractSchema,
  updateContractSchema,
  createCalendarSchema,
} from "../validation";
import {
  formatEmployeeLabel,
  getDuplicateEmployeeIds,
  getEmployeesOutsideFactory,
  getMissingEmployeeIds,
  getSelectedEmployeeIds,
} from "../services/contract-assignment";
import path from "node:path";

// ─── toLocalDateStr ──────────────────────────────────────────────────

describe("toLocalDateStr", () => {
  it("formats a date as YYYY-MM-DD using local timezone", () => {
    const d = new Date(2026, 2, 10); // March 10, 2026 local
    expect(toLocalDateStr(d)).toBe("2026-03-10");
  });

  it("pads single-digit month and day", () => {
    const d = new Date(2026, 0, 5); // January 5
    expect(toLocalDateStr(d)).toBe("2026-01-05");
  });

  it("handles Dec 31 correctly", () => {
    const d = new Date(2026, 11, 31);
    expect(toLocalDateStr(d)).toBe("2026-12-31");
  });

  it("does NOT shift date across timezone boundary", () => {
    // Create a date at midnight local time — toISOString would shift to previous day in UTC+9
    const d = new Date(2026, 2, 10, 0, 0, 0);
    expect(toLocalDateStr(d)).toBe("2026-03-10");
  });
});

// ─── subtractBusinessDays ────────────────────────────────────────────

describe("subtractBusinessDays", () => {
  it("subtracts 2 business days from a Wednesday → Monday", () => {
    // 2026-03-11 is Wednesday
    const from = new Date(2026, 2, 11);
    const result = subtractBusinessDays(from, 2);
    expect(toLocalDateStr(result)).toBe("2026-03-09"); // Monday
  });

  it("skips weekends when subtracting", () => {
    // 2026-03-09 is Monday, subtract 1 → Friday
    const from = new Date(2026, 2, 9);
    const result = subtractBusinessDays(from, 1);
    expect(toLocalDateStr(result)).toBe("2026-03-06"); // Friday
  });

  it("subtracts 3 business days over a weekend", () => {
    // 2026-03-10 is Tuesday, -3 biz days → Wed Mar 4? Let's check:
    // Tue Mar 10 → Mon Mar 9 (1) → Fri Mar 6 (2) → Thu Mar 5 (3)
    const from = new Date(2026, 2, 10);
    const result = subtractBusinessDays(from, 3);
    expect(toLocalDateStr(result)).toBe("2026-03-05");
  });

  it("handles 0 business days (returns same date)", () => {
    const from = new Date(2026, 2, 10);
    const result = subtractBusinessDays(from, 0);
    expect(toLocalDateStr(result)).toBe("2026-03-10");
  });
});

// ─── calculateContractDate / calculateNotificationDate ───────────────

describe("calculateContractDate", () => {
  it("returns start_date - 2 business days", () => {
    // 2026-04-01 (Wednesday) - 2 = Monday 2026-03-30
    expect(calculateContractDate("2026-04-01")).toBe("2026-03-30");
  });
});

describe("calculateNotificationDate", () => {
  it("returns start_date - 3 business days", () => {
    // 2026-04-01 (Wednesday) - 3 = Friday 2026-03-27? Let's verify:
    // Wed Apr 1 → Tue Mar 31 (1) → Mon Mar 30 (2) → Fri Mar 27 (3)
    expect(calculateNotificationDate("2026-04-01")).toBe("2026-03-27");
  });
});

describe("calculateContractDates", () => {
  it("returns all dates calculated from start and end", () => {
    const result = calculateContractDates("2026-04-01", "2026-06-30");
    expect(result.startDate).toBe("2026-04-01");
    expect(result.endDate).toBe("2026-06-30");
    expect(result.contractDate).toBe("2026-03-30");
    expect(result.notificationDate).toBe("2026-03-27");
  });
});

// ─── Zod Validation: Companies ──────────────────────────────────────

describe("createCompanySchema", () => {
  it("accepts valid company data", () => {
    const result = createCompanySchema.safeParse({ name: "テスト会社" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createCompanySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = createCompanySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts optional fields as null", () => {
    const result = createCompanySchema.safeParse({
      name: "テスト",
      nameKana: null,
      shortName: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("updateCompanySchema", () => {
  it("allows partial updates (name optional)", () => {
    const result = updateCompanySchema.safeParse({ shortName: "TST" });
    expect(result.success).toBe(true);
  });

  it("allows empty object", () => {
    const result = updateCompanySchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ─── Zod Validation: Factories ──────────────────────────────────────

describe("createFactorySchema", () => {
  it("accepts valid factory data", () => {
    const result = createFactorySchema.safeParse({
      companyId: 1,
      factoryName: "本社工場",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing companyId", () => {
    const result = createFactorySchema.safeParse({ factoryName: "工場" });
    expect(result.success).toBe(false);
  });

  it("rejects negative companyId", () => {
    const result = createFactorySchema.safeParse({ companyId: -1, factoryName: "工場" });
    expect(result.success).toBe(false);
  });

  it("validates contractPeriod enum", () => {
    const valid = createFactorySchema.safeParse({
      companyId: 1,
      factoryName: "工場",
      contractPeriod: "3months",
    });
    expect(valid.success).toBe(true);

    const invalid = createFactorySchema.safeParse({
      companyId: 1,
      factoryName: "工場",
      contractPeriod: "2weeks",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates conflictDate format YYYY-MM-DD", () => {
    const valid = createFactorySchema.safeParse({
      companyId: 1,
      factoryName: "工場",
      conflictDate: "2027-03-01",
    });
    expect(valid.success).toBe(true);

    const invalid = createFactorySchema.safeParse({
      companyId: 1,
      factoryName: "工場",
      conflictDate: "March 1, 2027",
    });
    expect(invalid.success).toBe(false);
  });
});

// ─── Zod Validation: Employees ──────────────────────────────────────

describe("createEmployeeSchema", () => {
  it("accepts valid employee", () => {
    const result = createEmployeeSchema.safeParse({
      employeeNumber: "EMP001",
      fullName: "グエン・バン・A",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing employeeNumber", () => {
    const result = createEmployeeSchema.safeParse({ fullName: "テスト" });
    expect(result.success).toBe(false);
  });

  it("rejects missing fullName", () => {
    const result = createEmployeeSchema.safeParse({ employeeNumber: "E01" });
    expect(result.success).toBe(false);
  });

  it("validates gender enum", () => {
    expect(createEmployeeSchema.safeParse({
      employeeNumber: "E01",
      fullName: "Test",
      gender: "male",
    }).success).toBe(true);

    expect(createEmployeeSchema.safeParse({
      employeeNumber: "E01",
      fullName: "Test",
      gender: "unknown",
    }).success).toBe(false);
  });

  it("validates date format for hireDate", () => {
    expect(createEmployeeSchema.safeParse({
      employeeNumber: "E01",
      fullName: "Test",
      hireDate: "2026-01-15",
    }).success).toBe(true);

    expect(createEmployeeSchema.safeParse({
      employeeNumber: "E01",
      fullName: "Test",
      hireDate: "not-a-date",
    }).success).toBe(false);
  });
});

// ─── Zod Validation: Contracts ──────────────────────────────────────

describe("createContractSchema", () => {
  const validContract = {
    companyId: 1,
    factoryId: 5,
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    contractDate: "2026-03-30",
    notificationDate: "2026-03-27",
  };

  it("accepts valid contract", () => {
    expect(createContractSchema.safeParse(validContract).success).toBe(true);
  });

  it("rejects missing required dates", () => {
    const { startDate: _startDate, ...noStart } = validContract;
    expect(createContractSchema.safeParse(noStart).success).toBe(false);
  });

  it("rejects invalid date format", () => {
    expect(createContractSchema.safeParse({
      ...validContract,
      startDate: "April 1",
    }).success).toBe(false);
  });

  it("accepts employeeAssignments with rates", () => {
    const result = createContractSchema.safeParse({
      ...validContract,
      employeeAssignments: [
        { employeeId: 1, hourlyRate: 1550 },
        { employeeId: 2, hourlyRate: 1609 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts employeeIds (legacy format)", () => {
    const result = createContractSchema.safeParse({
      ...validContract,
      employeeIds: [1, 2, 3],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(createContractSchema.safeParse({
      ...validContract,
      status: "pending",
    }).success).toBe(false);
  });

  it("accepts valid status values", () => {
    for (const status of ["draft", "active", "expired", "cancelled", "renewed"]) {
      expect(createContractSchema.safeParse({
        ...validContract,
        status,
      }).success).toBe(true);
    }
  });
});

describe("updateContractSchema", () => {
  it("allows partial update with just status", () => {
    expect(updateContractSchema.safeParse({ status: "active" }).success).toBe(true);
  });

  it("allows empty object", () => {
    expect(updateContractSchema.safeParse({}).success).toBe(true);
  });
});

// ─── Contract Assignment Helpers ────────────────────────────────────

describe("contract assignment helpers", () => {
  it("prefers employeeAssignments when extracting selected ids", () => {
    expect(
      getSelectedEmployeeIds({
        employeeAssignments: [{ employeeId: 11 }, { employeeId: 12 }],
        employeeIds: [99],
      }),
    ).toEqual([11, 12]);
  });

  it("falls back to legacy employeeIds when assignments are absent", () => {
    expect(getSelectedEmployeeIds({ employeeIds: [3, 4] })).toEqual([3, 4]);
  });

  it("detects duplicate employee ids", () => {
    expect(getDuplicateEmployeeIds([1, 2, 2, 3, 1])).toEqual([1, 2]);
  });

  it("detects missing employee ids from fetched records", () => {
    expect(getMissingEmployeeIds([10, 11, 12], [10, 12])).toEqual([11]);
  });

  it("finds employees assigned outside the selected factory", () => {
    expect(
      getEmployeesOutsideFactory(
        [
          { id: 1, factoryId: 5, fullName: "A", employeeNumber: "E001" },
          { id: 2, factoryId: null, fullName: "B", employeeNumber: "E002" },
          { id: 3, factoryId: 7, fullName: "C", employeeNumber: "E003" },
        ],
        5,
      ).map((employee) => employee.id),
    ).toEqual([2, 3]);
  });

  it("formats employee labels with both name and employee number", () => {
    expect(
      formatEmployeeLabel({ fullName: "グエン", employeeNumber: "EMP-001" }),
    ).toBe("グエン (EMP-001)");
  });
});

// ─── Zod Validation: Calendars ──────────────────────────────────────

describe("createCalendarSchema", () => {
  it("accepts valid calendar with array holidays", () => {
    const result = createCalendarSchema.safeParse({
      factoryId: 1,
      year: 2026,
      holidays: ["2026-01-01", "2026-05-03"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid calendar with string holidays (JSON)", () => {
    const result = createCalendarSchema.safeParse({
      factoryId: 1,
      year: 2026,
      holidays: '["2026-01-01"]',
    });
    expect(result.success).toBe(true);
  });

  it("rejects year outside range", () => {
    expect(createCalendarSchema.safeParse({
      factoryId: 1,
      year: 2019,
      holidays: [],
    }).success).toBe(false);

    expect(createCalendarSchema.safeParse({
      factoryId: 1,
      year: 2101,
      holidays: [],
    }).success).toBe(false);
  });
});

// ─── Path Traversal Prevention ──────────────────────────────────────

describe("path traversal prevention logic", () => {
  const OUTPUT_DIR = "/home/user/JP-v26.3.10/output";

  it("allows normal filenames", () => {
    const filename = "個別契約書_テスト_2026-03-10.pdf";
    const filepath = path.resolve(OUTPUT_DIR, filename);
    expect(filepath.startsWith(path.resolve(OUTPUT_DIR))).toBe(true);
  });

  it("blocks ../../../etc/passwd traversal", () => {
    const filename = "../../../etc/passwd";
    const filepath = path.resolve(OUTPUT_DIR, filename);
    expect(filepath.startsWith(path.resolve(OUTPUT_DIR))).toBe(false);
  });

  it("blocks encoded traversal %2e%2e%2f", () => {
    const filename = decodeURIComponent("%2e%2e%2f%2e%2e%2fetc%2fpasswd");
    const filepath = path.resolve(OUTPUT_DIR, filename);
    expect(filepath.startsWith(path.resolve(OUTPUT_DIR))).toBe(false);
  });

  it("blocks absolute path injection", () => {
    const filename = "/etc/passwd";
    const filepath = path.resolve(OUTPUT_DIR, filename);
    expect(filepath.startsWith(path.resolve(OUTPUT_DIR))).toBe(false);
  });
});

// ─── NaN parseFloat handling (import logic) ─────────────────────────

describe("NaN-safe parseFloat (import pattern)", () => {
  // Replicate the exact pattern used in import.ts
  const safeParseRate = (val: string | undefined | null) => {
    const v = parseFloat(val as string);
    return Number.isNaN(v) ? null : v;
  };

  it("parses valid number", () => {
    expect(safeParseRate("1550")).toBe(1550);
    expect(safeParseRate("1609.5")).toBe(1609.5);
  });

  it("returns null for empty string", () => {
    expect(safeParseRate("")).toBe(null);
  });

  it("returns null for undefined", () => {
    expect(safeParseRate(undefined)).toBe(null);
  });

  it("returns null for non-numeric string", () => {
    expect(safeParseRate("abc")).toBe(null);
  });

  it("does NOT return 0 for empty string (old bug)", () => {
    // Old code: parseFloat("") || null → NaN || null → null (worked by accident)
    // But parseFloat("0") || null → 0 || null → null (BUG! lost valid 0)
    // New code: Number.isNaN check handles 0 correctly
    expect(safeParseRate("0")).toBe(0);
  });
});

// ─── Like wildcard escaping ─────────────────────────────────────────

describe("escapeLike", () => {
  // Replicate the exact function used in employees.ts and dashboard.ts
  function escapeLike(s: string): string {
    return s.replace(/[%_\\]/g, "\\$&");
  }

  it("escapes % wildcard", () => {
    expect(escapeLike("50%")).toBe("50\\%");
  });

  it("escapes _ wildcard", () => {
    expect(escapeLike("test_name")).toBe("test\\_name");
  });

  it("escapes backslash", () => {
    expect(escapeLike("path\\file")).toBe("path\\\\file");
  });

  it("leaves normal text unchanged", () => {
    expect(escapeLike("グエン")).toBe("グエン");
    expect(escapeLike("田中太郎")).toBe("田中太郎");
  });

  it("escapes multiple wildcards", () => {
    expect(escapeLike("50%_off")).toBe("50\\%\\_off");
  });
});
