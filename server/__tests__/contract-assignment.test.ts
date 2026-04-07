/**
 * Tests for contract-assignment — pure functions
 * getSelectedEmployeeIds, getDuplicateEmployeeIds, getMissingEmployeeIds,
 * getEmployeesOutsideFactory, formatEmployeeLabel
 */
import { describe, it, expect } from "vitest";
import {
  getSelectedEmployeeIds,
  getDuplicateEmployeeIds,
  getMissingEmployeeIds,
  getEmployeesOutsideFactory,
  formatEmployeeLabel,
} from "../services/contract-assignment.js";

describe("getSelectedEmployeeIds", () => {
  it("returns employeeIds from employeeAssignments", () => {
    const result = getSelectedEmployeeIds({
      employeeAssignments: [{ employeeId: 1 }, { employeeId: 2 }],
    });
    expect(result).toEqual([1, 2]);
  });

  it("returns copy of employeeIds when no assignments", () => {
    const result = getSelectedEmployeeIds({ employeeIds: [5, 6, 7] });
    expect(result).toEqual([5, 6, 7]);
  });

  it("employeeAssignments takes priority over employeeIds", () => {
    const result = getSelectedEmployeeIds({
      employeeAssignments: [{ employeeId: 99 }],
      employeeIds: [1, 2],
    });
    expect(result).toEqual([99]);
  });

  it("returns undefined when neither is provided", () => {
    expect(getSelectedEmployeeIds({})).toBeUndefined();
  });
});

describe("getDuplicateEmployeeIds", () => {
  it("returns empty array when no duplicates", () => {
    expect(getDuplicateEmployeeIds([1, 2, 3])).toEqual([]);
  });

  it("finds single duplicate", () => {
    expect(getDuplicateEmployeeIds([1, 2, 3, 2, 4])).toEqual([2]);
  });

  it("finds multiple duplicates", () => {
    const result = getDuplicateEmployeeIds([1, 2, 3, 1, 2, 4]);
    expect(result).toEqual([1, 2]);
  });

  it("returns sorted ascending", () => {
    const result = getDuplicateEmployeeIds([5, 3, 5, 1, 3]);
    expect(result).toEqual([3, 5]);
  });

  it("handles triplicate (all three same)", () => {
    const result = getDuplicateEmployeeIds([7, 7, 7]);
    expect(result).toEqual([7]);
  });

  it("returns empty for single element", () => {
    expect(getDuplicateEmployeeIds([9])).toEqual([]);
  });

  it("returns empty for empty array", () => {
    expect(getDuplicateEmployeeIds([])).toEqual([]);
  });
});

describe("getMissingEmployeeIds", () => {
  it("returns employees expected but not found", () => {
    const result = getMissingEmployeeIds([1, 2, 3], [1, 3]);
    expect(result).toEqual([2]);
  });

  it("returns empty when all found", () => {
    expect(getMissingEmployeeIds([1, 2], [2, 1])).toEqual([]);
  });

  it("handles duplicate expected (deduplicates)", () => {
    const result = getMissingEmployeeIds([1, 1, 2], [2]);
    expect(result).toEqual([1]);
  });

  it("returns empty when found has extras", () => {
    expect(getMissingEmployeeIds([1, 2], [1, 2, 3, 4])).toEqual([]);
  });

  it("returns empty for empty expected", () => {
    expect(getMissingEmployeeIds([], [1, 2])).toEqual([]);
  });

  it("returns all expected when found is empty", () => {
    const result = getMissingEmployeeIds([1, 2], []);
    expect(result).toEqual([1, 2]);
  });
});

describe("getEmployeesOutsideFactory", () => {
  const employees = [
    { id: 1, factoryId: 10, fullName: "A", employeeNumber: "E1" },
    { id: 2, factoryId: 20, fullName: "B", employeeNumber: "E2" },
    { id: 3, factoryId: 10, fullName: "C", employeeNumber: "E3" },
    { id: 4, factoryId: null, fullName: "D", employeeNumber: "E4" },
  ];

  it("returns employees NOT in the given factory", () => {
    const result = getEmployeesOutsideFactory(employees, 10);
    expect(result.map((e) => e.id)).toEqual([2, 4]);
  });

  it("returns employees when none match factory", () => {
    const result = getEmployeesOutsideFactory(employees, 99);
    expect(result.map((e) => e.id)).toEqual([1, 2, 3, 4]);
  });

  it("returns employees with null factoryId", () => {
    const result = getEmployeesOutsideFactory(employees, 10);
    expect(result.find((e) => e.id === 4)?.factoryId).toBeNull();
  });
});

describe("formatEmployeeLabel", () => {
  it("returns full name with employee number", () => {
    const emp = { fullName: "田中太郎", employeeNumber: "E001" };
    expect(formatEmployeeLabel(emp)).toBe("田中太郎 (E001)");
  });

  it("returns fullName only when employeeNumber is null", () => {
    const emp = { fullName: "山田花子", employeeNumber: null };
    expect(formatEmployeeLabel(emp)).toBe("山田花子");
  });

  it("returns employeeNumber only when fullName is null", () => {
    const emp = { fullName: null, employeeNumber: "E042" };
    expect(formatEmployeeLabel(emp)).toBe("E042");
  });

  it("returns Unknown employee when both are null", () => {
    const emp = { fullName: null, employeeNumber: null };
    expect(formatEmployeeLabel(emp)).toBe("Unknown employee");
  });
});
