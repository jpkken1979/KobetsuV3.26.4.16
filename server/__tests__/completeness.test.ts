import { describe, it, expect } from "vitest";
import { calcCompleteness, getMissingFields, REQUIRED_EMPLOYEE_FIELDS, REQUIRED_FACTORY_FIELDS } from "../services/completeness.js";

describe("calcCompleteness", () => {
  const fullEmployee = {
    fullName: "テスト太郎", katakanaName: "テストタロウ",
    nationality: "ベトナム", gender: "male", birthDate: "1995-01-01",
    hireDate: "2024-04-01",
    billingRate: 1600, hourlyRate: 1200, factoryId: 1,
  };
  const fullFactory = {
    address: "愛知県名古屋市中区1-1-1", phone: "052-123-4567", jobDescription: "製造業務",
    supervisorName: "山田", supervisorDept: "製造部", supervisorPhone: "052-111-1111",
    hakensakiManagerName: "鈴木", hakensakiManagerDept: "総務部", hakensakiManagerPhone: "052-222-2222",
    managerUnsName: "高橋", managerUnsDept: "営業部", managerUnsPhone: "052-333-3333",
    complaintClientName: "田中", complaintClientDept: "人事部", complaintClientPhone: "052-444-4444",
    complaintUnsName: "佐藤", complaintUnsDept: "管理部", complaintUnsPhone: "052-555-5555",
    workHours: "8:00~17:00", breakTimeDay: "60分", conflictDate: "2027-03-31",
    closingDayText: "当月末", paymentDayText: "翌月20日", calendar: "2026",
  };

  it("returns gray when factoryId is null", () => {
    expect(calcCompleteness({ ...fullEmployee, factoryId: null }, null)).toBe("gray");
  });

  it("returns green when both employee and factory are complete", () => {
    expect(calcCompleteness(fullEmployee, fullFactory)).toBe("green");
  });

  it("returns yellow when employee OK but factory missing supervisorName", () => {
    expect(calcCompleteness(fullEmployee, { ...fullFactory, supervisorName: null })).toBe("yellow");
  });

  it("returns yellow when factory OK but employee missing nationality", () => {
    expect(calcCompleteness({ ...fullEmployee, nationality: null }, fullFactory)).toBe("yellow");
  });

  it("returns red when both incomplete", () => {
    expect(calcCompleteness(
      { ...fullEmployee, nationality: null },
      { ...fullFactory, supervisorName: null }
    )).toBe("red");
  });

  it("accepts hourlyRate as fallback when billingRate is null", () => {
    expect(calcCompleteness(
      { ...fullEmployee, billingRate: null, hourlyRate: 1200 },
      fullFactory
    )).toBe("green");
  });

  it("returns yellow when both rates are null (employee incomplete)", () => {
    expect(calcCompleteness(
      { ...fullEmployee, billingRate: null, hourlyRate: null },
      fullFactory
    )).toBe("yellow");
  });

  it("exports required field lists", () => {
    expect(REQUIRED_EMPLOYEE_FIELDS.length).toBeGreaterThan(0);
    expect(REQUIRED_FACTORY_FIELDS.length).toBeGreaterThan(0);
  });
});

describe("getMissingFields", () => {
  it("returns empty arrays when all fields present", () => {
    const emp = { fullName: "A", katakanaName: "A", nationality: "B", gender: "male", birthDate: "2000-01-01", hireDate: "2024-04-01", billingRate: 1600, factoryId: 1 };
    const fac = { address: "X", phone: "X", jobDescription: "X", supervisorName: "X", supervisorDept: "X", supervisorPhone: "X", hakensakiManagerName: "X", hakensakiManagerDept: "X", hakensakiManagerPhone: "X", managerUnsName: "X", managerUnsDept: "X", managerUnsPhone: "X", complaintClientName: "X", complaintClientDept: "X", complaintClientPhone: "X", complaintUnsName: "X", complaintUnsDept: "X", complaintUnsPhone: "X", workHours: "8-17", breakTimeDay: "60", conflictDate: "2027-01-01", closingDayText: "末", paymentDayText: "翌20", calendar: "2026" };
    const result = getMissingFields(emp, fac);
    expect(result.missingEmployee).toEqual([]);
    expect(result.missingFactory).toEqual([]);
  });

  it("lists missing employee fields", () => {
    const emp = { fullName: "A", katakanaName: null, nationality: null, gender: "male", birthDate: "2000-01-01", billingRate: null, hourlyRate: null, factoryId: 1 };
    const result = getMissingFields(emp, {});
    expect(result.missingEmployee).toContain("katakanaName");
    expect(result.missingEmployee).toContain("nationality");
    expect(result.missingEmployee).toContain("billingRate|hourlyRate");
  });

  it("lists missing factory fields", () => {
    const fac = { supervisorName: null, hakensakiManagerName: "X", managerUnsName: null, complaintClientName: "X", complaintUnsName: "X", workHours: "8-17", conflictDate: null };
    const result = getMissingFields({}, fac);
    expect(result.missingFactory).toContain("supervisorName");
    expect(result.missingFactory).toContain("managerUnsName");
    expect(result.missingFactory).toContain("conflictDate");
  });
});
