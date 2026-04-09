/**
 * Tests for document-generation.ts — buildCommonData and utility functions.
 */
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildCommonData, readContractDocIndex, appendContractDocIndex } from "../services/document-generation.js";

// ─── Fixtures ───────────────────────────────────────────────────────

function makeContractWithRelations(overrides: Record<string, unknown> = {}) {
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
    safetyMeasures: "",
    terminationMeasures: "",
    jobDescription: "組立作業",
    responsibilityLevel: "指示を受けて行う",
    overtimeMax: "月40時間",
    welfare: "福利厚生施設の利用可",
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
      nameKana: null,
      shortName: null,
      representative: null,
      isActive: true,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
    factory: {
      id: 1,
      companyId: 1,
      factoryName: "第一工場",
      address: "愛知県豊田市XX町1-2",
      phone: "0565-00-0001",
      department: "製造部",
      lineName: "ライン1",
      workHours: null,
      workHoursDay: "08:00～17:00",
      workHoursNight: "20:00～05:00",
      breakTime: 60,
      breakTimeDay: "60分",
      breakTimeNight: "45分",
      overtimeHours: "月40時間まで",
      overtimeOutsideDays: "1ヶ月に2日",
      workDays: "月～金",
      hourlyRate: 1500,
      jobDescription: "組立作業",
      conflictDate: "2027-06-30",
      closingDay: null,
      closingDayText: "当月末",
      paymentDay: null,
      paymentDayText: "翌月20日",
      bankAccount: "三菱UFJ銀行",
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
      complaintUnsAddress: "名古屋市中区3-3",
      managerUnsDept: "営業部",
      managerUnsName: "高橋三郎",
      managerUnsPhone: "052-000-0006",
      managerUnsAddress: "名古屋市中区2-2",
      calendar: "月～金",
      contractPeriod: "3months",
      shiftPattern: null,
      hasRobotTraining: false,
      isActive: true,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      closingDay_old: null,
      paymentDay_old: null,
      workerClosingDay: null,
      workerPaymentDay: null,
      workerCalendar: null,
      agreementPeriodEnd: null,
      explainerName: null,
    },
    employees: [],
    ...overrides,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// ─── buildCommonData ────────────────────────────────────────────────

describe("buildCommonData", () => {
  it("extracts company and factory info correctly", () => {
    const contract = makeContractWithRelations();
    const result = buildCommonData(contract);

    expect(result.companyName).toBe("テスト株式会社");
    expect(result.companyAddress).toBe("愛知県名古屋市中区1-1");
    expect(result.factoryName).toBe("第一工場");
    expect(result.factoryAddress).toBe("愛知県豊田市XX町1-2");
    expect(result.department).toBe("製造部");
    expect(result.lineName).toBe("ライン1");
  });

  it("returns factory address only (no fallback to company)", () => {
    const contract = makeContractWithRelations();
    contract.factory.address = "";
    const result = buildCommonData(contract);
    expect(result.factoryAddress).toBe("");
  });

  it("builds workHours from day/night shifts", () => {
    const contract = makeContractWithRelations();
    const result = buildCommonData(contract);

    expect(result.workHours).toContain("昼勤");
    expect(result.workHours).toContain("08:00～17:00");
    expect(result.workHours).toContain("夜勤");
    expect(result.workHours).toContain("20:00～05:00");
  });

  it("uses contract workStartTime/workEndTime when no factory shifts", () => {
    const contract = makeContractWithRelations();
    contract.factory.workHours = null;
    contract.factory.workHoursDay = null;
    contract.factory.workHoursNight = null;
    const result = buildCommonData(contract);

    expect(result.workHours).toBe("08:00 ～ 17:00");
  });

  it("builds breakTime from day/night breaks", () => {
    const contract = makeContractWithRelations();
    const result = buildCommonData(contract);

    expect(result.breakTime).toContain("60分");
    expect(result.breakTime).toContain("45分");
  });

  it("falls back to contract breakMinutes when factory has no break data", () => {
    const contract = makeContractWithRelations();
    contract.factory.breakTimeDay = null;
    contract.factory.breakTimeNight = null;
    contract.factory.breakTime = null;
    const result = buildCommonData(contract);

    expect(result.breakTime).toBe("60分");
  });

  it("maps supervisor (指揮命令者) from factory first", () => {
    const contract = makeContractWithRelations();
    const result = buildCommonData(contract);

    expect(result.supervisorName).toBe("田中太郎");
    expect(result.supervisorDept).toBe("製造部");
    expect(result.supervisorRole).toBe("課長");
  });

  it("maps 派遣先責任者 separately from 指揮命令者", () => {
    const contract = makeContractWithRelations();
    const result = buildCommonData(contract);

    expect(result.hakensakiManagerName).toBe("鈴木花子");
    expect(result.hakensakiManagerDept).toBe("総務部");
    expect(result.hakensakiManagerRole).toBe("部長");
  });

  it("falls back to supervisor for hakensakiManager when not set", () => {
    const contract = makeContractWithRelations();
    contract.factory.hakensakiManagerDept = null;
    contract.factory.hakensakiManagerName = null;
    contract.factory.hakensakiManagerPhone = null;
    const result = buildCommonData(contract);

    expect(result.hakensakiManagerName).toBe("田中太郎");
    expect(result.hakensakiManagerDept).toBe("製造部");
    expect(result.hakensakiManagerPhone).toBe("0565-00-0002");
  });

  it("uses closingDayText and paymentDayText as text fields", () => {
    const contract = makeContractWithRelations();
    const result = buildCommonData(contract);

    expect(result.closingDay).toBe("当月末");
    expect(result.paymentDay).toBe("翌月20日");
  });

  it("falls back to closingDay number when closingDayText is empty", () => {
    const contract = makeContractWithRelations();
    contract.factory.closingDayText = null;
    contract.factory.closingDay = 25;
    contract.factory.paymentDayText = null;
    contract.factory.paymentDay = 10;
    const result = buildCommonData(contract);

    expect(result.closingDay).toBe("25日");
    expect(result.paymentDay).toBe("10日");
  });

  it("maps UNS manager and complaint handler fields", () => {
    const contract = makeContractWithRelations();
    const result = buildCommonData(contract);

    expect(result.managerUnsName).toBe("高橋三郎");
    expect(result.managerUnsAddress).toBe("名古屋市中区2-2");
    expect(result.complaintUnsName).toBe("山田次郎");
    expect(result.complaintUnsAddress).toBe("名古屋市中区3-3");
  });

  it("handles 3+ shifts in workHours (free-text)", () => {
    const contract = makeContractWithRelations();
    contract.factory.workHours = "A勤務：07:00～15:30　B勤務：15:30～0:00　C勤務：0:00～07:00";
    contract.factory.workHoursDay = null;
    contract.factory.workHoursNight = null;
    const result = buildCommonData(contract);

    // Should split into separate lines by shift name
    expect(result.workHours).toContain("A勤務");
    expect(result.workHours).toContain("B勤務");
    expect(result.workHours).toContain("C勤務");
  });

  it("handles null/empty factory fields gracefully", () => {
    const contract = makeContractWithRelations();
    contract.factory.jobDescription = null;
    contract.factory.calendar = null;
    contract.factory.overtimeHours = null;
    contract.factory.conflictDate = null;
    contract.factory.bankAccount = null;
    contract.factory.timeUnit = null;
    const result = buildCommonData(contract);

    // Should fall back to contract values or empty strings
    expect(result.jobDescription).toBe("組立作業"); // from contract
    expect(result.calendar).toBe("月～金"); // from contract.workDays
    expect(result.overtimeHours).toBe("月40時間"); // from contract.overtimeMax
    expect(result.conflictDate).toBe("");
    expect(result.bankAccount).toBe("");
    expect(result.timeUnit).toBe("15"); // default
  });

  it("maps hasRobotTraining as boolean", () => {
    const contract = makeContractWithRelations();
    contract.factory.hasRobotTraining = 1; // SQLite stores as integer
    const result = buildCommonData(contract);
    expect(result.hasRobotTraining).toBe(true);

    contract.factory.hasRobotTraining = 0;
    const result2 = buildCommonData(contract);
    expect(result2.hasRobotTraining).toBe(false);
  });

  it("uses hourlyRate from contract first, then factory", () => {
    const contract = makeContractWithRelations();
    contract.hourlyRate = 1800;
    contract.factory.hourlyRate = 1500;
    const result = buildCommonData(contract);
    expect(result.hourlyRate).toBe(1800);
  });

  it("falls back to factory hourlyRate when contract has null", () => {
    const contract = makeContractWithRelations();
    contract.hourlyRate = null;
    contract.factory.hourlyRate = 1500;
    const result = buildCommonData(contract);
    expect(result.hourlyRate).toBe(1500);
  });

  it("returns 0 when both hourlyRates are null", () => {
    const contract = makeContractWithRelations();
    contract.hourlyRate = null;
    contract.factory.hourlyRate = null;
    const result = buildCommonData(contract);
    expect(result.hourlyRate).toBe(0);
  });
});

// ─── readContractDocIndex / appendContractDocIndex ─────────────────────
describe("readContractDocIndex", () => {
  const TEST_CONTRACT_ID = 999999;

  afterEach(() => {
    const outputDir = path.resolve("output");
    const indexFile = path.join(outputDir, ".index", `${TEST_CONTRACT_ID}.json`);
    if (fs.existsSync(indexFile)) fs.unlinkSync(indexFile);
  });

  it("returns empty array when no index file exists", async () => {
    const result = await readContractDocIndex(TEST_CONTRACT_ID);
    expect(result).toEqual([]);
  });

  it("returns empty array for malformed JSON in index file", async () => {
    const outputDir = path.resolve("output");
    const indexDir = path.join(outputDir, ".index");
    if (!fs.existsSync(indexDir)) fs.mkdirSync(indexDir, { recursive: true });
    fs.writeFileSync(path.join(indexDir, `${TEST_CONTRACT_ID}.json`), "NOT_JSON");
    const result = await readContractDocIndex(TEST_CONTRACT_ID);
    expect(result).toEqual([]);
  });

  it("returns empty array when JSON has no files array", async () => {
    const outputDir = path.resolve("output");
    const indexDir = path.join(outputDir, ".index");
    if (!fs.existsSync(indexDir)) fs.mkdirSync(indexDir, { recursive: true });
    fs.writeFileSync(path.join(indexDir, `${TEST_CONTRACT_ID}.json`), JSON.stringify({ contractId: TEST_CONTRACT_ID }));
    const result = await readContractDocIndex(TEST_CONTRACT_ID);
    expect(result).toEqual([]);
  });
});

describe("appendContractDocIndex", () => {
  const TEST_CONTRACT_ID = 999998;

  afterEach(() => {
    const outputDir = path.resolve("output");
    const indexFile = path.join(outputDir, ".index", `${TEST_CONTRACT_ID}.json`);
    if (fs.existsSync(indexFile)) fs.unlinkSync(indexFile);
  });

  it("creates index file with filenames when it does not exist", async () => {
    await appendContractDocIndex(TEST_CONTRACT_ID, ["contract_1.pdf", "notice_1.pdf"]);
    const outputDir = path.resolve("output");
    const indexFile = path.join(outputDir, ".index", `${TEST_CONTRACT_ID}.json`);
    expect(fs.existsSync(indexFile)).toBe(true);
    const content = JSON.parse(fs.readFileSync(indexFile, "utf-8")) as { files: string[] };
    expect(content.files).toContain("contract_1.pdf");
    expect(content.files).toContain("notice_1.pdf");
  });

  it("merges new filenames with existing ones (deduplicates)", async () => {
    await appendContractDocIndex(TEST_CONTRACT_ID, ["a.pdf", "b.pdf"]);
    await appendContractDocIndex(TEST_CONTRACT_ID, ["b.pdf", "c.pdf"]);
    const result = await readContractDocIndex(TEST_CONTRACT_ID);
    expect(result).toEqual(["a.pdf", "b.pdf", "c.pdf"]);
  });

  it("does nothing when filenames array is empty", async () => {
    await appendContractDocIndex(TEST_CONTRACT_ID, []);
    const outputDir = path.resolve("output");
    const indexFile = path.join(outputDir, ".index", `${TEST_CONTRACT_ID}.json`);
    expect(fs.existsSync(indexFile)).toBe(false);
  });
});
