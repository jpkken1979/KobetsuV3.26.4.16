/**
 * Tests for contract-writes — buildContractEmployeeRows priority
 *
 * Source: server/services/contract-writes.ts
 *
 * Priority logic:
 *   1. employeeAssignments (length > 0) → uses assignments, ignores employeeIds
 *   2. employeeAssignments empty []     → falls through to employeeIds check
 *   3. only employeeIds                 → uses ids with null rates
 *   4. neither (or both empty)          → returns []
 *
 * NOTE: empty assignments array [] does NOT win over employeeIds — the guard
 * is `employeeAssignments && employeeAssignments.length > 0`, so an empty array
 * falls through to the employeeIds branch.
 */
import { describe, it, expect } from "vitest";
import { buildContractEmployeeRows } from "../services/contract-writes.js";

describe("buildContractEmployeeRows — assignment priority", () => {
  // ─── employeeAssignments wins ─────────────────────────────────────────────
  it("employeeAssignments に要素があれば assignments を使う (employeeIds は無視)", () => {
    const rows = buildContractEmployeeRows({
      contractId: 42,
      employeeAssignments: [
        { employeeId: 1, hourlyRate: 1800 },
        { employeeId: 2, hourlyRate: 1609 },
      ],
      employeeIds: [99, 100],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ contractId: 42, employeeId: 1, hourlyRate: 1800 });
    expect(rows[1]).toMatchObject({ contractId: 42, employeeId: 2, hourlyRate: 1609 });
    // employeeIds=99,100 は無視される
    expect(rows.find((r) => r.employeeId === 99)).toBeUndefined();
  });

  it("assignments の hourlyRate が undefined のとき null になる", () => {
    const rows = buildContractEmployeeRows({
      contractId: 1,
      employeeAssignments: [{ employeeId: 5 }],
    });
    expect(rows[0].hourlyRate).toBeNull();
  });

  it("assignments の hourlyRate が null のとき null になる", () => {
    const rows = buildContractEmployeeRows({
      contractId: 1,
      employeeAssignments: [{ employeeId: 5, hourlyRate: null }],
    });
    expect(rows[0].hourlyRate).toBeNull();
  });

  it("assignments の isIndefinite が未指定のとき false になる", () => {
    const rows = buildContractEmployeeRows({
      contractId: 1,
      employeeAssignments: [{ employeeId: 7 }],
    });
    expect(rows[0].isIndefinite).toBe(false);
  });

  it("assignments の isIndefinite=true が正しく渡される", () => {
    const rows = buildContractEmployeeRows({
      contractId: 1,
      employeeAssignments: [{ employeeId: 7, isIndefinite: true }],
    });
    expect(rows[0].isIndefinite).toBe(true);
  });

  it("assignments の individualStartDate / individualEndDate が正しく渡される", () => {
    const rows = buildContractEmployeeRows({
      contractId: 1,
      employeeAssignments: [
        { employeeId: 8, individualStartDate: "2026-04-01", individualEndDate: "2026-06-30" },
      ],
    });
    expect(rows[0].individualStartDate).toBe("2026-04-01");
    expect(rows[0].individualEndDate).toBe("2026-06-30");
  });

  // ─── empty employeeAssignments [] ────────────────────────────────────────
  // BEHAVIOR: empty [] は employeeIds branch に fallthrough する
  it("employeeAssignments が空配列 [] のとき employeeIds にフォールバックする", () => {
    const rows = buildContractEmployeeRows({
      contractId: 10,
      employeeAssignments: [],
      employeeIds: [3, 4],
    });
    // 空配列は length > 0 を満たさないので employeeIds が使われる
    expect(rows).toHaveLength(2);
    expect(rows[0].employeeId).toBe(3);
    expect(rows[1].employeeId).toBe(4);
  });

  it("employeeAssignments が空配列 [] かつ employeeIds も空のとき [] を返す", () => {
    const rows = buildContractEmployeeRows({
      contractId: 10,
      employeeAssignments: [],
      employeeIds: [],
    });
    expect(rows).toHaveLength(0);
  });

  // ─── only employeeIds ────────────────────────────────────────────────────
  it("employeeAssignments がなく employeeIds のみのとき ids を使う", () => {
    const rows = buildContractEmployeeRows({
      contractId: 20,
      employeeIds: [10, 11, 12],
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ contractId: 20, employeeId: 10, hourlyRate: null });
    expect(rows[1].employeeId).toBe(11);
    expect(rows[2].employeeId).toBe(12);
  });

  it("employeeIds のみのとき hourlyRate は全て null になる (legacy 互換)", () => {
    const rows = buildContractEmployeeRows({
      contractId: 5,
      employeeIds: [1, 2],
    });
    expect(rows.every((r) => r.hourlyRate === null)).toBe(true);
    expect(rows.every((r) => r.isIndefinite === false)).toBe(true);
    expect(rows.every((r) => r.individualStartDate === null)).toBe(true);
    expect(rows.every((r) => r.individualEndDate === null)).toBe(true);
  });

  // ─── neither assignments nor ids ─────────────────────────────────────────
  it("両方とも渡されないとき空配列を返す", () => {
    const rows = buildContractEmployeeRows({ contractId: 99 });
    expect(rows).toHaveLength(0);
  });

  it("employeeAssignments=undefined かつ employeeIds=[] のとき空配列を返す", () => {
    const rows = buildContractEmployeeRows({ contractId: 99, employeeIds: [] });
    expect(rows).toHaveLength(0);
  });

  // ─── contractId propagation ───────────────────────────────────────────────
  it("全ての行に contractId が正しく設定される", () => {
    const rows = buildContractEmployeeRows({
      contractId: 777,
      employeeAssignments: [
        { employeeId: 1, hourlyRate: 1500 },
        { employeeId: 2, hourlyRate: 1600 },
        { employeeId: 3, hourlyRate: 1700 },
      ],
    });
    expect(rows.every((r) => r.contractId === 777)).toBe(true);
  });
});
