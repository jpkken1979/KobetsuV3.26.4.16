/**
 * Tests for employee-mapper — rate priority chain
 *
 * Source: server/services/employee-mapper.ts
 *
 * The billing rate written to the PDF follows this priority:
 *   ce.hourlyRate (junction/contract-level rate)
 *   ?? ce.employee.billingRate (employee-level 単価)
 *   ?? ce.employee.hourlyRate (employee-level 時給 — last resort)
 *
 * IMPORTANT: ?? is nullish coalescing — 0 is NOT nullish and will NOT fall through.
 */
import { describe, it, expect } from "vitest";
import { mapContractEmployeeToPDF } from "../services/employee-mapper.js";

// Helper to build minimal ContractEmployeeRelation objects
function makeRelation(overrides: {
  junctionRate?: number | null;
  empBillingRate?: number | null;
  empHourlyRate?: number | null;
  junctionStartDate?: string | null;
  junctionEndDate?: string | null;
}) {
  return {
    hourlyRate: overrides.junctionRate ?? null,
    individualStartDate: overrides.junctionStartDate ?? null,
    individualEndDate: overrides.junctionEndDate ?? null,
    employee: {
      fullName: "テスト太郎",
      katakanaName: "テストタロウ",
      gender: "男" as const,
      birthDate: "1990-01-01",
      actualHireDate: "2023-04-01",
      hireDate: "2023-04-01",
      hourlyRate: overrides.empHourlyRate ?? null,
      billingRate: overrides.empBillingRate ?? null,
      nationality: "ベトナム",
      employeeNumber: null,
      clientEmployeeId: null,
    },
  };
}

describe("mapContractEmployeeToPDF — rate priority chain", () => {
  // ─── Priority 1: junction rate ───────────────────────────────────────────
  it("使用する contract-level rate (junction) があれば それを billingRate に使う", () => {
    const ce = makeRelation({ junctionRate: 1800, empBillingRate: 1600, empHourlyRate: 1400 });
    const result = mapContractEmployeeToPDF(ce);
    expect(result.billingRate).toBe(1800);
  });

  // ─── Priority 2: employee.billingRate ────────────────────────────────────
  it("junction rate が null のとき employee.billingRate にフォールバックする", () => {
    const ce = makeRelation({ junctionRate: null, empBillingRate: 1609, empHourlyRate: 1400 });
    const result = mapContractEmployeeToPDF(ce);
    expect(result.billingRate).toBe(1609);
  });

  // ─── Priority 3: employee.hourlyRate ─────────────────────────────────────
  it("junction rate と billingRate が両方 null のとき employee.hourlyRate にフォールバックする", () => {
    const ce = makeRelation({ junctionRate: null, empBillingRate: null, empHourlyRate: 1550 });
    const result = mapContractEmployeeToPDF(ce);
    expect(result.billingRate).toBe(1550);
  });

  // ─── All null → null ─────────────────────────────────────────────────────
  it("全て null のとき billingRate は null になる", () => {
    const ce = makeRelation({ junctionRate: null, empBillingRate: null, empHourlyRate: null });
    const result = mapContractEmployeeToPDF(ce);
    expect(result.billingRate).toBeNull();
  });

  // ─── Edge case: junction rate = 0 ────────────────────────────────────────
  // NOTE: ?? は nullish coalescing (null/undefined のみ) なので 0 はフォールスルーしない。
  // junction rate = 0 の場合、billingRate = 0 となる。これは仕様か潜在的バグか要確認。
  it("junction rate が 0 のとき billingRate は 0 になる (0 は nullish でないため)", () => {
    const ce = makeRelation({ junctionRate: 0, empBillingRate: 1600, empHourlyRate: 1400 });
    const result = mapContractEmployeeToPDF(ce);
    // ?? は 0 をフォールスルーしない → billingRate = 0 (empBillingRate=1600 にはならない)
    expect(result.billingRate).toBe(0);
  });

  // ─── Non-rate fields passthrough ─────────────────────────────────────────
  it("employee の基本情報はそのまま渡される", () => {
    const ce = makeRelation({ junctionRate: 1700 });
    const result = mapContractEmployeeToPDF(ce);
    expect(result.fullName).toBe("テスト太郎");
    expect(result.katakanaName).toBe("テストタロウ");
    expect(result.nationality).toBe("ベトナム");
    expect(result.birthDate).toBe("1990-01-01");
  });

  it("katakanaName が null のとき空文字列になる", () => {
    const ce = {
      hourlyRate: null,
      individualStartDate: null,
      individualEndDate: null,
      employee: {
        fullName: "テスト次郎",
        katakanaName: null,
        gender: null,
        birthDate: null,
        actualHireDate: null,
        hireDate: null,
        hourlyRate: null,
        billingRate: null,
        nationality: null,
        employeeNumber: null,
        clientEmployeeId: null,
      },
    };
    const result = mapContractEmployeeToPDF(ce);
    expect(result.katakanaName).toBe("");
  });

  // ─── individual dates passthrough ────────────────────────────────────────
  it("individualStartDate / individualEndDate は junction から渡される", () => {
    const ce = makeRelation({
      junctionStartDate: "2026-04-01",
      junctionEndDate: "2026-06-30",
    });
    const result = mapContractEmployeeToPDF(ce);
    expect(result.individualStartDate).toBe("2026-04-01");
    expect(result.individualEndDate).toBe("2026-06-30");
  });

  it("individualStartDate が空文字のとき null に正規化される", () => {
    const ce = {
      hourlyRate: null,
      individualStartDate: "",
      individualEndDate: "",
      employee: {
        fullName: "テスト三郎",
        katakanaName: "テストサブロウ",
        gender: null,
        birthDate: null,
        actualHireDate: null,
        hireDate: null,
        hourlyRate: 1400,
        billingRate: 1600,
        nationality: null,
        employeeNumber: null,
        clientEmployeeId: null,
      },
    };
    const result = mapContractEmployeeToPDF(ce);
    expect(result.individualStartDate).toBeNull();
    expect(result.individualEndDate).toBeNull();
  });

  // ─── employee.hourlyRate is always passed through (for payroll display) ──
  it("employee.hourlyRate は billingRate と別に保持される", () => {
    const ce = makeRelation({ junctionRate: 1800, empBillingRate: 1600, empHourlyRate: 1400 });
    const result = mapContractEmployeeToPDF(ce);
    // billingRate は junctionRate=1800 を使うが hourlyRate は employee 元の値をそのまま保持
    expect(result.billingRate).toBe(1800);
    expect(result.hourlyRate).toBe(1400);
  });
});
