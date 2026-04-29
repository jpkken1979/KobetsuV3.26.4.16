/**
 * Tests for pdf-data-builders.ts — functions that transform common data + contract
 * into PDF-specific data objects.
 */
import { describe, it, expect } from "vitest";
import {
  buildKoritsuKobetsuData,
  buildKoritsuTsuchishoData,
  buildKoritsuDaichoData,
  buildStandardKobetsuData,
  buildStandardTsuchishoData,
  buildStandardDaichoData,
  buildHakenmotoDaichoData,
} from "../services/pdf-data-builders.js";
import type { CommonData } from "../services/pdf-data-builders.js";
import type { PDFEmployeeData } from "../services/employee-mapper.js";

// ─── Fixtures ───────────────────────────────────────────────────────

function makeCommonData(overrides: Partial<CommonData> = {}): CommonData {
  return {
    companyName: "テスト株式会社",
    companyAddress: "愛知県名古屋市中区1-1",
    companyPhone: "052-000-0001",
    factoryName: "第一工場",
    factoryAddress: "愛知県豊田市XX町1-2",
    factoryPhone: "0565-00-0001",
    department: "製造部",
    lineName: "ライン1",
    contractDate: "2026-03-30",
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    jobDescription: "組立作業",
    calendar: "月～金",
    workHours: "【昼勤】08:00～17:00",
    breakTime: "60分",
    overtimeHours: "月40時間まで",
    hourlyRate: 1500,
    conflictDate: "2027-06-30",
    closingDay: "当月末",
    paymentDay: "翌月20日",
    bankAccount: "三菱UFJ銀行 名古屋支店",
    timeUnit: "15",
    supervisorDept: "製造部",
    supervisorName: "田中太郎",
    supervisorPhone: "0565-00-0002",
    supervisorRole: "課長",
    hakensakiManagerDept: "総務部",
    hakensakiManagerName: "鈴木花子",
    hakensakiManagerPhone: "0565-00-0003",
    hakensakiManagerRole: "部長",
    complaintClientDept: "人事部",
    complaintClientName: "佐藤一郎",
    complaintClientPhone: "0565-00-0004",
    complaintUnsDept: "営業部",
    complaintUnsName: "山田次郎",
    complaintUnsPhone: "052-000-0005",
    managerUnsDept: "営業部",
    managerUnsName: "高橋三郎",
    managerUnsPhone: "052-000-0006",
    managerUnsAddress: "愛知県名古屋市中区2-2",
    complaintUnsAddress: "愛知県名古屋市中区3-3",
    hasRobotTraining: false,
    ...overrides,
  } as CommonData;
}

function makeEmployee(overrides: Partial<PDFEmployeeData> = {}): PDFEmployeeData {
  return {
    fullName: "グエン・バン・テスト",
    katakanaName: "グエンバンテスト",
    gender: "male",
    birthDate: "1990-05-15",
    actualHireDate: "2026-03-01",
    hireDate: "2026-03-01",
    hourlyRate: 1000,
    billingRate: 1500,
    nationality: "Vietnamese",
    individualStartDate: null,
    individualEndDate: null,
    employeeNumber: "E001",
    clientEmployeeId: "C-001",
    ...overrides,
  };
}

function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    contractNumber: "KOB-202604-0001",
    status: "active",
    companyId: 1,
    factoryId: 1,
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    contractDate: "2026-03-30",
    notificationDate: "2026-03-27",
    workDays: "月～金",
    workStartTime: "08:00",
    workEndTime: "17:00",
    breakMinutes: 60,
    supervisorName: "田中太郎",
    supervisorDept: "製造部",
    supervisorPhone: "0565-00-0002",
    complaintHandlerClient: "佐藤一郎",
    complaintHandlerUns: "山田次郎",
    hakenmotoManager: "高橋三郎",
    safetyMeasures: "安全措置",
    terminationMeasures: "解除措置",
    jobDescription: "組立作業",
    responsibilityLevel: "指示を受けて行う",
    overtimeMax: "月40時間",
    welfare: "派遣先の福利厚生施設の利用可",
    isKyoteiTaisho: true,
    hourlyRate: 1500,
    overtimeRate: 1875,
    nightShiftRate: 375,
    holidayRate: 2025,
    previousContractId: null,
    pdfPath: null,
    notes: null,
    createdAt: "2026-03-30",
    updatedAt: "2026-03-30",
    company: {
      id: 1,
      name: "テスト株式会社",
      address: "愛知県名古屋市中区1-1",
      phone: "052-000-0001",
    },
    factory: {
      id: 1,
      factoryName: "第一工場",
      address: "愛知県豊田市XX町1-2",
      phone: "0565-00-0001",
      department: "製造部",
      lineName: "ライン1",
      workHours: null,
      workHoursDay: "08:00～17:00",
      workHoursNight: null,
      breakTime: 60,
      breakTimeDay: "60分",
      breakTimeNight: null,
      overtimeHours: "月40時間",
      overtimeOutsideDays: "1ヶ月に2日の範囲内で命ずることがある。",
      supervisorDept: "製造部",
      supervisorName: "田中太郎",
      supervisorPhone: "0565-00-0002",
      supervisorRole: "課長",
      hakensakiManagerDept: "総務部",
      hakensakiManagerName: "鈴木花子",
      hakensakiManagerPhone: "0565-00-0003",
      hakensakiManagerRole: "部長",
      hourlyRate: 1500,
      jobDescription: "組立作業",
      hasRobotTraining: false,
    },
    employees: [],
    ...overrides,
  } as any;
}

// ─── Koritsu data builders ──────────────────────────────────────────

describe("buildKoritsuKobetsuData", () => {
  it("maps all required fields from common data", () => {
    const common = makeCommonData();
    const contract = makeContract();
    const empList = [makeEmployee()];

    const result = buildKoritsuKobetsuData(common, contract, empList);

    expect(result.companyName).toBe("テスト株式会社");
    expect(result.contractNumber).toBe("KOB-202604-0001");
    expect(result.startDate).toBe("2026-04-01");
    expect(result.endDate).toBe("2026-06-30");
    expect(result.employeeCount).toBe(1);
    expect(result.hourlyRate).toBe(1500);
    expect(result.commanderName).toBe("田中太郎");
    expect(result.hakensakiManagerName).toBe("鈴木花子");
    expect(result.managerUnsName).toBe("高橋三郎");
  });

  it("handles empty employee list", () => {
    const result = buildKoritsuKobetsuData(makeCommonData(), makeContract(), []);
    expect(result.employeeCount).toBe(0);
  });

  it("handles multiple employees", () => {
    const empList = [
      makeEmployee({ fullName: "Worker A" }),
      makeEmployee({ fullName: "Worker B" }),
      makeEmployee({ fullName: "Worker C" }),
    ];
    const result = buildKoritsuKobetsuData(makeCommonData(), makeContract(), empList);
    expect(result.employeeCount).toBe(3);
  });
});

describe("buildKoritsuTsuchishoData", () => {
  it("includes employee list and contract dates", () => {
    const empList = [makeEmployee(), makeEmployee({ fullName: "Worker B", employeeNumber: "E002" })];
    const result = buildKoritsuTsuchishoData(makeCommonData(), makeContract(), empList);

    expect(result.companyName).toBe("テスト株式会社");
    expect(result.contractDate).toBe("2026-03-30");
    expect(result.employees).toHaveLength(2);
    expect(result.managerUnsAddress).toBe("愛知県名古屋市中区2-2");
  });
});

describe("buildKoritsuDaichoData", () => {
  it("marks current employee with isFirstContract", () => {
    const emp1 = makeEmployee({ fullName: "Worker A" });
    const emp2 = makeEmployee({ fullName: "Worker B" });
    const empList = [emp1, emp2];

    const result = buildKoritsuDaichoData(makeCommonData(), makeContract(), empList, emp1);

    expect(result.employees).toHaveLength(2);
    const mapped1 = result.employees.find((e) => e.fullName === "Worker A");
    const mapped2 = result.employees.find((e) => e.fullName === "Worker B");
    expect(mapped1?.isFirstContract).toBe(true);
    expect(mapped2?.isFirstContract).toBe(false);
  });

  it("includes factory and contract details", () => {
    const emp = makeEmployee();
    const result = buildKoritsuDaichoData(makeCommonData(), makeContract(), [emp], emp);

    expect(result.factoryName).toBe("第一工場");
    expect(result.contractNumber).toBe("KOB-202604-0001");
    expect(result.hakensakiManagerName).toBe("鈴木花子");
    expect(result.managerUnsName).toBe("高橋三郎");
  });
});

// ─── Standard data builders ─────────────────────────────────────────

describe("buildStandardKobetsuData", () => {
  it("spreads common data and adds contract-specific fields", () => {
    const result = buildStandardKobetsuData(makeCommonData(), makeContract(), [makeEmployee()]);

    expect(result.companyName).toBe("テスト株式会社");
    expect(result.employeeCount).toBe(1);
    expect(result.responsibilityLevel).toBe("指示を受けて行う");
    expect(result.overtimeOutsideDays).toBe("1ヶ月に2日の範囲内で命ずることがある。");
    expect(result.isKyoteiTaisho).toBe(true);
    expect(result.welfare).toBe("派遣先の福利厚生施設の利用可");
  });

  it("defaults isKyoteiTaisho to true when null", () => {
    const contract = makeContract({ isKyoteiTaisho: null });
    const result = buildStandardKobetsuData(makeCommonData(), contract, []);
    expect(result.isKyoteiTaisho).toBe(true);
  });

  it("defaults isKyoteiTaisho to true when undefined (falsy but not false)", () => {
    const contract = makeContract({ isKyoteiTaisho: undefined });
    const result = buildStandardKobetsuData(makeCommonData(), contract, []);
    expect(result.isKyoteiTaisho).toBe(true);
  });

  it("respects isKyoteiTaisho = false", () => {
    const contract = makeContract({ isKyoteiTaisho: false });
    const result = buildStandardKobetsuData(makeCommonData(), contract, []);
    expect(result.isKyoteiTaisho).toBe(false);
  });
});

describe("buildStandardTsuchishoData", () => {
  it("maps company name, dates and employees", () => {
    const empList = [makeEmployee()];
    const result = buildStandardTsuchishoData(makeCommonData(), empList);

    expect(result.companyName).toBe("テスト株式会社");
    expect(result.contractDate).toBe("2026-03-30");
    expect(result.startDate).toBe("2026-04-01");
    expect(result.endDate).toBe("2026-06-30");
    expect(result.employees).toHaveLength(1);
  });

  it("handles empty employee list", () => {
    const result = buildStandardTsuchishoData(makeCommonData(), []);
    expect(result.employees).toHaveLength(0);
  });
});

describe("buildStandardDaichoData", () => {
  it("includes employee and commander data", () => {
    const emp = makeEmployee();
    const result = buildStandardDaichoData(makeCommonData(), emp);

    expect(result.employee).toBe(emp);
    expect(result.commanderName).toBe("田中太郎");
    expect(result.commanderDept).toBe("製造部");
    expect(result.commanderPhone).toBe("0565-00-0002");
    expect(result.hakensakiManagerName).toBe("鈴木花子");
  });

  it("preserves all common data fields via spread", () => {
    const common = makeCommonData();
    const result = buildStandardDaichoData(common, makeEmployee());

    expect(result.companyName).toBe("テスト株式会社");
    expect(result.factoryAddress).toBe("愛知県豊田市XX町1-2");
  });
});

describe("buildHakenmotoDaichoData", () => {
  it("includes employee and common data", () => {
    const emp = makeEmployee();
    const result = buildHakenmotoDaichoData(makeCommonData(), emp);

    expect(result.employee).toBe(emp);
    expect(result.companyName).toBe("テスト株式会社");
    expect(result.managerUnsName).toBe("高橋三郎");
  });

  it("handles null fields in common data", () => {
    const common = makeCommonData({
      factoryAddress: "",
      factoryPhone: "",
    });
    const result = buildHakenmotoDaichoData(common, makeEmployee());
    expect(result.factoryAddress).toBe("");
  });
});
