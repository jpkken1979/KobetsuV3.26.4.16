/**
 * Smoke tests for all 9 PDF generators + content validation.
 *
 * Smoke tests: build a minimal but valid data object, call the generator,
 * collect the output into a Buffer, and assert:
 *   1. The buffer has length > 0
 *   2. The buffer starts with %PDF (PDF magic bytes)
 *
 * Content validation: parse the generated PDF buffer with pdfjs-dist to extract
 * text content and verify expected strings are present.
 */
import { describe, it, expect, beforeAll } from "vitest";
import PDFDocument from "pdfkit";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

// ─── PDF text extraction ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.mjs") as {
  getDocument: (opts: { data: Uint8Array; useSystemFonts?: boolean; standardFontDataUrl?: string }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str: string }[] }> }> }> };
};
const standardFontsDir = path.resolve("node_modules/pdfjs-dist/standard_fonts");
const STANDARD_FONT_DATA_URL = `${pathToFileURL(standardFontsDir).href}/`;

/** Extract all text from a PDF buffer using pdfjs-dist. */
async function extractPDFText(buf: Buffer): Promise<string> {
  const uint8 = new Uint8Array(buf);
  const pdf = await pdfjsLib.getDocument({ data: uint8, useSystemFonts: true, standardFontDataUrl: STANDARD_FONT_DATA_URL }).promise;
  const texts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texts.push(content.items.map((item: { str: string }) => item.str).join(""));
  }
  return texts.join("\n");
}

// ─── Generators ─────────────────────────────────────────────────────

import { generateKobetsuPDF, type KobetsuData } from "../pdf/kobetsu-pdf";
import { generateTsuchishoPDF, type TsuchishoData } from "../pdf/tsuchisho-pdf";
import { generateKeiyakushoPDF, type KeiyakushoData } from "../pdf/keiyakusho-pdf";
import { generateShugyoJokenMeijishoPDF, type ShugyoJokenData } from "../pdf/shugyojoken-pdf";
import { generateHakensakiKanriDaichoPDF, type DaichoData } from "../pdf/hakensakikanridaicho-pdf";
import { generateHakenmotoKanriDaichoPDF, type HakenmotoDaichoData } from "../pdf/hakenmotokanridaicho-pdf";
import { generateKoritsuKobetsuPDF, type KoritsuKobetsuData } from "../pdf/koritsu-kobetsu-pdf";
import { generateKoritsuDaichoPDF, type KoritsuDaichoData } from "../pdf/koritsu-hakensakidaicho-pdf";
import { generateKoritsuTsuchishoPDF, type KoritsuTsuchishoData } from "../pdf/koritsu-tsuchisho-pdf";

// ─── Font paths ─────────────────────────────────────────────────────

const FONT_DIR = path.resolve("server/pdf/fonts");
const JP_FONT = path.join(FONT_DIR, "NotoSansJP-Regular.ttf");
const MINCHO_FONT = path.join(FONT_DIR, "BIZUDMincho-0.ttf");
const GOTHIC_FONT = path.join(FONT_DIR, "MSGothic.ttf");
const CENTURY_FONT = path.join(FONT_DIR, "CenturySchoolbook.ttf");
const PMINCHO_FONT = path.join(FONT_DIR, "MSPMincho.ttf");

// ─── Helpers ────────────────────────────────────────────────────────

/** Create a PDFDocument with all required fonts registered. */
function createDoc(opts?: { layout?: "portrait" | "landscape" }) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    layout: opts?.layout ?? "portrait",
  });
  if (fs.existsSync(JP_FONT)) {
    doc.registerFont("JP", JP_FONT);
    doc.font("JP");
  }
  if (fs.existsSync(MINCHO_FONT)) doc.registerFont("JP-Mincho", MINCHO_FONT);
  if (fs.existsSync(GOTHIC_FONT)) doc.registerFont("Gothic", GOTHIC_FONT);
  if (fs.existsSync(CENTURY_FONT)) doc.registerFont("Century", CENTURY_FONT);
  if (fs.existsSync(PMINCHO_FONT)) doc.registerFont("PMincho", PMINCHO_FONT);
  return doc;
}

/** Collect PDFDocument output into a Buffer. */
function collectPDF(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

// ─── Shared test data building blocks ────────────────────────────────

const baseEmployee = {
  fullName: "グエン　ヴァン　アン",
  katakanaName: "グエン ヴァン アン",
  gender: "male",
  birthDate: "1995-03-15",
  actualHireDate: "2020-04-01",
  hireDate: "2020-04-01",
};

const supervisors = {
  supervisorDept: "III本部",
  supervisorName: "伊藤英昭",
  supervisorPhone: "0567-56-6711",
  hakensakiManagerDept: "III本部",
  hakensakiManagerName: "伊藤英昭",
  hakensakiManagerPhone: "0567-56-6711",
  complaintClientDept: "III本部",
  complaintClientName: "伊藤英昭",
  complaintClientPhone: "0567-56-6711",
  complaintUnsDept: "営業部",
  complaintUnsName: "中山　欣英",
  complaintUnsPhone: "052-938-8840",
  managerUnsDept: "営業部",
  managerUnsName: "中山　欣英",
  managerUnsPhone: "052-938-8840",
};

const facility = {
  companyName: "テスト株式会社",
  companyAddress: "愛知県弥富市六條町大崎11番地1",
  companyPhone: "0567-56-6711",
  factoryName: "テスト工場",
  factoryAddress: "愛知県弥富市六條町大崎11番地1",
  factoryPhone: "0567-56-6711",
  department: "製造1課",
  lineName: "1ライン",
};

const contractDates = {
  startDate: "2026-04-01",
  endDate: "2026-06-30",
  contractDate: "2026-03-28",
  conflictDate: "2027-03-31",
};

const workConditions = {
  jobDescription: "コイル製作・加工業務",
  calendar: "月～金（シフトに準ずる）",
  workHours: "8:00～17:00",
  breakTime: "12:00～13:00（60分）",
  overtimeHours: "3時間/日, 42時間/月, 320時間/年とする。",
  hourlyRate: 1600,
};

// ─── Tests ───────────────────────────────────────────────────────────

describe("PDF Generators", () => {
  beforeAll(() => {
    // Ensure at least the primary JP font exists (tests will fail with garbled output otherwise)
    if (!fs.existsSync(JP_FONT)) {
      throw new Error(`Required font not found: ${JP_FONT}`);
    }
  });

  it("generateKobetsuPDF — 個別契約書", async () => {
    const data: KobetsuData = {
      ...facility,
      ...supervisors,
      ...contractDates,
      ...workConditions,
      responsibilityLevel: "担当者業務",
      employeeCount: 3,
      overtimeOutsideDays: "1ヶ月に2日の範囲内で命ずることがある。",
      timeUnit: "15",
      closingDay: "末日",
      paymentDay: "翌月末日",
      bankAccount: "三菱UFJ銀行 名古屋営業部 普通 1234567",
      isKyoteiTaisho: true,
      welfare: "なし",
    };

    const doc = createDoc();
    generateKobetsuPDF(doc, data);
    const buf = await collectPDF(doc);

    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("generateTsuchishoPDF — 通知書", async () => {
    const data: TsuchishoData = {
      companyName: facility.companyName,
      contractDate: contractDates.contractDate,
      startDate: contractDates.startDate,
      endDate: contractDates.endDate,
      employees: [baseEmployee],
    };

    const doc = createDoc();
    generateTsuchishoPDF(doc, data);
    const buf = await collectPDF(doc);

    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("generateKeiyakushoPDF — 契約書", async () => {
    const data: KeiyakushoData = {
      ...facility,
      ...supervisors,
      ...contractDates,
      ...workConditions,
      workHoursDay: "8:00～17:00",
      workHoursNight: "",
      breakTimeDay: "12:00～13:00（60分）",
      breakTimeNight: "",
      shiftPattern: "日勤",
      closingDay: "末日",
      paymentDay: "翌月末日",
      employee: {
        ...baseEmployee,
        employeeNumber: "E001",
        romajiName: "NGUYEN VAN ANH",
        nationality: "ベトナム",
        address: "愛知県弥富市六條町大崎22番地5",
        postalCode: "498-0011",
        hourlyRate: 1500,
        billingRate: 1600,
        visaExpiry: "2027-03-31",
        visaType: "技能",
      },
    };

    const doc = createDoc({ layout: "landscape" });
    generateKeiyakushoPDF(doc, data);
    const buf = await collectPDF(doc);

    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("generateShugyoJokenMeijishoPDF — 就業条件明示書", async () => {
    const data: ShugyoJokenData = {
      ...facility,
      ...supervisors,
      ...contractDates,
      ...workConditions,
      closingDay: "末日",
      paymentDay: "翌月末日",
      employee: {
        ...baseEmployee,
        hourlyRate: 1500,
      },
    };

    const doc = createDoc();
    generateShugyoJokenMeijishoPDF(doc, data);
    const buf = await collectPDF(doc);

    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("generateHakensakiKanriDaichoPDF — 派遣先管理台帳", async () => {
    const data: DaichoData = {
      ...facility,
      ...supervisors,
      ...contractDates,
      ...workConditions,
      commanderDept: supervisors.supervisorDept,
      commanderName: supervisors.supervisorName,
      commanderPhone: supervisors.supervisorPhone,
      employee: {
        ...baseEmployee,
        isFirstContract: false,
      },
    };

    const doc = createDoc();
    generateHakensakiKanriDaichoPDF(doc, data);
    const buf = await collectPDF(doc);

    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("generateHakenmotoKanriDaichoPDF — 派遣元管理台帳", async () => {
    const data: HakenmotoDaichoData = {
      ...facility,
      ...supervisors,
      ...contractDates,
      ...workConditions,
      employee: {
        ...baseEmployee,
        hourlyRate: 1500,
        billingRate: 1600,
        nationality: "ベトナム",
      },
    };

    const doc = createDoc();
    generateHakenmotoKanriDaichoPDF(doc, data);
    const buf = await collectPDF(doc);

    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("generateKoritsuKobetsuPDF — コーリツ個別契約書", async () => {
    const data: KoritsuKobetsuData = {
      companyName: "株式会社　コーリツ",
      companyAddress: "愛知県刈谷市小垣江町本郷下33番地3",
      companyPhone: "0566-21-5139",
      factoryName: "州の崎工場",
      factoryAddress: "愛知県半田市州の崎町2番171",
      factoryPhone: "0569-20-0332",
      department: "製造2課",
      lineName: "２工区",
      commanderDept: "州の崎工場 製造2課 ２工区",
      commanderName: "鳥居 英司",
      commanderTitle: "工長",
      commanderPhone: "0569-20-0332",
      hakensakiManagerDept: "州の崎工場 製造2課",
      hakensakiManagerTitle: "課長",
      hakensakiManagerName: "坪井 友和",
      hakensakiManagerPhone: "0569-20-0332",
      complaintClientDept: "財務部 リスク管理課",
      complaintClientTitle: "課長",
      complaintClientName: "大場 明宏",
      complaintClientPhone: "0566-21-5139",
      contractNumber: "8210004",
      jobDescription: "オートマチックトランスミッション部品の製造を行う業務",
      ...contractDates,
      employeeCount: 1,
      hourlyRate: 2225,
      closingDay: "末日締め",
      paymentDay: "翌月15日",
    };

    const doc = createDoc();
    generateKoritsuKobetsuPDF(doc, data);
    const buf = await collectPDF(doc);

    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("generateKoritsuDaichoPDF — コーリツ派遣先管理台帳", async () => {
    const data: KoritsuDaichoData = {
      companyName: "株式会社　コーリツ",
      factoryName: "州の崎工場",
      factoryAddress: "愛知県半田市州の崎町2番171",
      factoryPhone: "0569-20-0332",
      department: "製造2課",
      lineName: "２工区",
      contractNumber: "8210004",
      contractDate: contractDates.contractDate,
      startDate: contractDates.startDate,
      endDate: contractDates.endDate,
      jobDescription: "オートマチックトランスミッション部品の製造を行う業務",
      hakensakiManagerDept: "州の崎工場 製造2課",
      hakensakiManagerTitle: "課長",
      hakensakiManagerName: "坪井 友和",
      hakensakiManagerPhone: "0569-20-0332",
      employees: [{
        ...baseEmployee,
        isFirstContract: false,
      }],
    };

    const doc = createDoc();
    generateKoritsuDaichoPDF(doc, data);
    const buf = await collectPDF(doc);

    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("generateKoritsuTsuchishoPDF — コーリツ派遣先通知書", async () => {
    const data: KoritsuTsuchishoData = {
      companyName: "株式会社　コーリツ",
      contractNumber: "8210004",
      contractDate: contractDates.contractDate,
      startDate: contractDates.startDate,
      endDate: contractDates.endDate,
      employees: [baseEmployee],
    };

    const doc = createDoc();
    generateKoritsuTsuchishoPDF(doc, data);
    const buf = await collectPDF(doc);

    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });
});

// ─── Content Validation Tests ────────────────────────────────────────

describe("PDF Content Validation", () => {
  beforeAll(() => {
    if (!fs.existsSync(JP_FONT)) {
      throw new Error(`Required font not found: ${JP_FONT}`);
    }
  });

  it("個別契約書 contains company name, rate and supervisors", async () => {
    const data: KobetsuData = {
      ...facility,
      ...supervisors,
      ...contractDates,
      ...workConditions,
      responsibilityLevel: "担当者業務",
      employeeCount: 3,
      overtimeOutsideDays: "1ヶ月に2日の範囲内で命ずることがある。",
      timeUnit: "15",
      closingDay: "末日",
      paymentDay: "翌月末日",
      bankAccount: "三菱UFJ銀行 名古屋営業部 普通 1234567",
      isKyoteiTaisho: true,
      welfare: "なし",
    };

    const doc = createDoc();
    generateKobetsuPDF(doc, data);
    const buf = await collectPDF(doc);
    const text = await extractPDFText(buf);

    expect(text).toContain("テスト株式会社");
    expect(text).toContain("1,600");
    expect(text).toContain("2026");
    expect(text).toContain("製造1課");
    expect(text).toContain("テスト工場");
    expect(text).toContain("中山");
  });

  it("通知書 contains employee name and company", async () => {
    const data: TsuchishoData = {
      companyName: facility.companyName,
      contractDate: contractDates.contractDate,
      startDate: contractDates.startDate,
      endDate: contractDates.endDate,
      employees: [baseEmployee],
    };

    const doc = createDoc();
    generateTsuchishoPDF(doc, data);
    const buf = await collectPDF(doc);
    const text = await extractPDFText(buf);

    expect(text).toContain("グエン");
    expect(text).toContain("テスト株式会社");
  });

  it("派遣先管理台帳 contains supervisor info", async () => {
    const data: DaichoData = {
      ...facility,
      ...supervisors,
      ...contractDates,
      ...workConditions,
      commanderDept: supervisors.supervisorDept,
      commanderName: supervisors.supervisorName,
      commanderPhone: supervisors.supervisorPhone,
      employee: {
        ...baseEmployee,
        isFirstContract: false,
      },
    };

    const doc = createDoc();
    generateHakensakiKanriDaichoPDF(doc, data);
    const buf = await collectPDF(doc);
    const text = await extractPDFText(buf);

    expect(text).toContain("伊藤英昭");
    expect(text).toContain("テスト工場");
    expect(text).toContain("テスト株式会社");
  });

  it("派遣元管理台帳 contains employee rate and nationality", async () => {
    const data: HakenmotoDaichoData = {
      ...facility,
      ...supervisors,
      ...contractDates,
      ...workConditions,
      employee: {
        ...baseEmployee,
        hourlyRate: 1500,
        billingRate: 1600,
        nationality: "ベトナム",
      },
    };

    const doc = createDoc();
    generateHakenmotoKanriDaichoPDF(doc, data);
    const buf = await collectPDF(doc);
    const text = await extractPDFText(buf);

    expect(text).toContain("グエン");
    expect(text).toContain("ベトナム");
  });

  it("契約書 contains company name and employee romaji", async () => {
    const data: KeiyakushoData = {
      ...facility,
      ...supervisors,
      ...contractDates,
      ...workConditions,
      workHoursDay: "8:00～17:00",
      workHoursNight: "",
      breakTimeDay: "12:00～13:00（60分）",
      breakTimeNight: "",
      shiftPattern: "日勤",
      closingDay: "末日",
      paymentDay: "翌月末日",
      employee: {
        ...baseEmployee,
        employeeNumber: "E001",
        romajiName: "NGUYEN VAN ANH",
        nationality: "ベトナム",
        address: "愛知県弥富市六條町大崎22番地5",
        postalCode: "498-0011",
        hourlyRate: 1500,
        billingRate: 1600,
        visaExpiry: "2027-03-31",
        visaType: "技能",
      },
    };

    const doc = createDoc({ layout: "landscape" });
    generateKeiyakushoPDF(doc, data);
    const buf = await collectPDF(doc);
    const text = await extractPDFText(buf);

    expect(text).toContain("テスト株式会社");
    expect(text).toContain("NGUYEN VAN ANH");
  });

  it("就業条件明示書 contains work conditions", async () => {
    const data: ShugyoJokenData = {
      ...facility,
      ...supervisors,
      ...contractDates,
      ...workConditions,
      closingDay: "末日",
      paymentDay: "翌月末日",
      employee: {
        ...baseEmployee,
        hourlyRate: 1500,
      },
    };

    const doc = createDoc();
    generateShugyoJokenMeijishoPDF(doc, data);
    const buf = await collectPDF(doc);
    const text = await extractPDFText(buf);

    expect(text).toContain("テスト株式会社");
    expect(text).toContain("コイル製作");
  });

  it("コーリツ個別契約書 contains Koritsu company and contract number", async () => {
    const data: KoritsuKobetsuData = {
      companyName: "株式会社　コーリツ",
      companyAddress: "愛知県刈谷市小垣江町本郷下33番地3",
      companyPhone: "0566-21-5139",
      factoryName: "州の崎工場",
      factoryAddress: "愛知県半田市州の崎町2番171",
      factoryPhone: "0569-20-0332",
      department: "製造2課",
      lineName: "２工区",
      commanderDept: "州の崎工場 製造2課 ２工区",
      commanderName: "鳥居 英司",
      commanderTitle: "工長",
      commanderPhone: "0569-20-0332",
      hakensakiManagerDept: "州の崎工場 製造2課",
      hakensakiManagerTitle: "課長",
      hakensakiManagerName: "坪井 友和",
      hakensakiManagerPhone: "0569-20-0332",
      complaintClientDept: "財務部 リスク管理課",
      complaintClientTitle: "課長",
      complaintClientName: "大場 明宏",
      complaintClientPhone: "0566-21-5139",
      contractNumber: "8210004",
      jobDescription: "オートマチックトランスミッション部品の製造を行う業務",
      ...contractDates,
      employeeCount: 1,
      hourlyRate: 2225,
      closingDay: "末日締め",
      paymentDay: "翌月15日",
    };

    const doc = createDoc();
    generateKoritsuKobetsuPDF(doc, data);
    const buf = await collectPDF(doc);
    const text = await extractPDFText(buf);

    expect(text).toContain("コーリツ");
    expect(text).toContain("8210004");
  });

  it("コーリツ派遣先管理台帳 contains factory info", async () => {
    const data: KoritsuDaichoData = {
      companyName: "株式会社　コーリツ",
      factoryName: "州の崎工場",
      factoryAddress: "愛知県半田市州の崎町2番171",
      factoryPhone: "0569-20-0332",
      department: "製造2課",
      lineName: "２工区",
      contractNumber: "8210004",
      contractDate: contractDates.contractDate,
      startDate: contractDates.startDate,
      endDate: contractDates.endDate,
      jobDescription: "オートマチックトランスミッション部品の製造を行う業務",
      hakensakiManagerDept: "州の崎工場 製造2課",
      hakensakiManagerTitle: "課長",
      hakensakiManagerName: "坪井 友和",
      hakensakiManagerPhone: "0569-20-0332",
      employees: [{
        ...baseEmployee,
        isFirstContract: false,
      }],
    };

    const doc = createDoc();
    generateKoritsuDaichoPDF(doc, data);
    const buf = await collectPDF(doc);
    const text = await extractPDFText(buf);

    expect(text).toContain("コーリツ");
    expect(text).toContain("州の崎工場");
    expect(text).toContain("坪井 友和");
  });

  it("コーリツ派遣先通知書 contains employee and contract info", async () => {
    const data: KoritsuTsuchishoData = {
      companyName: "株式会社　コーリツ",
      contractNumber: "8210004",
      contractDate: contractDates.contractDate,
      startDate: contractDates.startDate,
      endDate: contractDates.endDate,
      employees: [baseEmployee],
    };

    const doc = createDoc();
    generateKoritsuTsuchishoPDF(doc, data);
    const buf = await collectPDF(doc);
    const text = await extractPDFText(buf);

    expect(text).toContain("コーリツ");
    expect(text).toContain("グエン");
  });
});
