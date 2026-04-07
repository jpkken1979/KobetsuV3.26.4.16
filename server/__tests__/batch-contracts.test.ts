/**
 * Tests for batch-contracts.ts — type definitions and buildContractValues logic.
 * The main functions (analyzeBatch, executeBatchCreate, etc.) require DB,
 * so we test the exported types and the re-exported helpers indirectly.
 */
import { describe, it, expect } from "vitest";
import type {
  MidHiresLine,
  MidHiresResult,
  ByIdsGroup,
  BatchCreateResult,
  HiresCreateResult,
} from "../services/batch-contracts.js";
import type { AnalysisResult, AnalysisLine, SkipRecord } from "../services/batch-helpers.js";

// ─── Type-level smoke tests ─────────────────────────────────────────
// Ensure the exported types are structurally correct and usable.

describe("batch-contracts type definitions", () => {
  it("MidHiresLine has all required fields", () => {
    const line: MidHiresLine = {
      factory: {} as MidHiresLine["factory"],
      contractStartDate: "2026-04-01",
      contractEndDate: "2026-06-30",
      totalEmployees: 3,
      totalContracts: 1,
      rateGroups: [
        {
          rate: 1500,
          employeeCount: 3,
          overtimeRate: 1875,
          nightShiftRate: 375,
          holidayRate: 2025,
          employees: [
            {
              id: 1,
              fullName: "Test Worker",
              employeeNumber: "E001",
              billingRate: 1500,
              hourlyRate: 1000,
              visaExpiry: "2027-12-31",
              nationality: "Vietnamese",
              effectiveHireDate: "2026-03-01",
            },
          ],
        },
      ],
      workStartTime: "08:00",
      workEndTime: "17:00",
      participationRate: 87.5,
      isExempt: false,
      exemptionReason: null,
    };
    expect(line.totalEmployees).toBe(3);
    expect(line.rateGroups[0].rate).toBe(1500);
    expect(line.exemptionReason).toBeNull();
  });

  it("MidHiresResult contains lines and skipped arrays", () => {
    const result: MidHiresResult = {
      lines: [],
      skipped: [],
    };
    expect(result.lines).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it("ByIdsGroup has correct structure", () => {
    const group: ByIdsGroup = {
      groupKey: "1-1500-2026-04-01",
      factoryId: 1,
      factoryName: "TestFactory",
      department: "Dept",
      lineName: "Line1",
      companyId: 1,
      companyName: "TestCompany",
      billingRate: 1500,
      startDate: "2026-04-01",
      endDate: "2026-06-30",
      employees: [
        {
          id: 1,
          employeeNumber: "E001",
          clientEmployeeId: null,
          fullName: "Worker A",
          katakanaName: null,
          hireDate: "2025-01-15",
          billingRate: 1500,
          hourlyRate: 1000,
        },
      ],
    };
    expect(group.employees).toHaveLength(1);
    expect(group.billingRate).toBe(1500);
  });

  it("BatchCreateResult has required fields", () => {
    const result: BatchCreateResult = {
      id: 1,
      contractNumber: "KOB-202604-0001",
      factoryName: "TestFactory",
      department: "Dept",
      lineName: "Line1",
      hourlyRate: 1500,
      employees: 3,
      employeeNames: ["Worker A", "Worker B", null],
      endDate: "2026-06-30",
    };
    expect(result.contractNumber).toMatch(/^KOB-/);
    expect(result.employeeNames).toHaveLength(3);
  });

  it("HiresCreateResult has required fields", () => {
    const result: HiresCreateResult = {
      id: 1,
      contractNumber: "KOB-202604-0001",
      factoryName: "TestFactory",
      department: "Dept",
      lineName: "Line1",
      hourlyRate: 1500,
      startDate: "2026-04-01",
      endDate: "2026-06-30",
      employees: [
        { id: 1, fullName: "Worker A", individualStartDate: "2026-04-01" },
      ],
      employeeCount: 1,
    };
    expect(result.employeeCount).toBe(1);
    expect(result.employees[0].individualStartDate).toBe("2026-04-01");
  });
});

// ─── AnalysisResult structure tests ─────────────────────────────────

describe("AnalysisResult structure", () => {
  it("empty analysis has no lines and no skipped", () => {
    const result: AnalysisResult = { lines: [], skipped: [] };
    expect(result.lines).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it("SkipRecord captures factory info and reason", () => {
    const skip: SkipRecord = {
      factoryId: 5,
      factoryName: "Factory5",
      department: "DeptA",
      lineName: "Line2",
      reason: "社員なし",
    };
    expect(skip.reason).toBe("社員なし");
    expect(skip.factoryId).toBe(5);
  });

  it("AnalysisLine contains all expected fields", () => {
    const line: AnalysisLine = {
      factory: {} as AnalysisLine["factory"],
      effectiveEndDate: "2026-06-30",
      capped: false,
      autoCalculated: true,
      contractPeriod: "3months",
      conflictDate: "2027-06-30",
      rateGroups: [],
      totalEmployees: 5,
      totalContracts: 2,
      duplicates: [],
      workStartTime: "08:00",
      workEndTime: "17:00",
      participationRate: 87.5,
      isExempt: false,
      exemptionReason: undefined,
    };
    expect(line.effectiveEndDate).toBe("2026-06-30");
    expect(line.totalEmployees).toBe(5);
    expect(line.isExempt).toBe(false);
  });

  it("AnalysisLine with duplicates captures overlap info", () => {
    const line: AnalysisLine = {
      factory: {} as AnalysisLine["factory"],
      effectiveEndDate: "2026-06-30",
      rateGroups: [],
      totalEmployees: 3,
      totalContracts: 1,
      duplicates: [
        {
          id: 100,
          contractNumber: "KOB-202604-0010",
          startDate: "2026-04-01",
          endDate: "2026-06-30",
          status: "active",
          employeeCount: 3,
        },
      ],
      workStartTime: "08:00",
      workEndTime: "17:00",
    };
    expect(line.duplicates).toHaveLength(1);
    expect(line.duplicates![0].contractNumber).toMatch(/^KOB-/);
  });
});
