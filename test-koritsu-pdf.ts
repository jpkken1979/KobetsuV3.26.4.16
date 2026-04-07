/**
 * Test script: Generate Koritsu PDF samples (個別契約書, 派遣先管理台帳, 派遣先通知書)
 *
 * Usage: npx tsx test-koritsu-pdf.ts
 * Output: output/koritsu-*.pdf
 */
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

import { generateKoritsuKobetsuPDF } from "./server/pdf/koritsu-kobetsu-pdf.js";
import { generateKoritsuDaichoPDF } from "./server/pdf/koritsu-hakensakidaicho-pdf.js";
import { generateKoritsuTsuchishoPDF } from "./server/pdf/koritsu-tsuchisho-pdf.js";

const OUTPUT_DIR = "output";
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Font registration ──────────────────────────────────────────────

const JP_FONT = path.join("server", "pdf", "fonts", "NotoSansJP-Regular.ttf");
const GOTHIC_FONT = path.join("server", "pdf", "fonts", "MSGothic.ttf");
const CENTURY_FONT = path.join("server", "pdf", "fonts", "CenturySchoolbook.ttf");
const PMINCHO_FONT = path.join("server", "pdf", "fonts", "MSPMincho.ttf");

function createDoc(filename: string): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
  doc.registerFont("JP", JP_FONT);
  if (fs.existsSync(GOTHIC_FONT)) doc.registerFont("Gothic", GOTHIC_FONT);
  if (fs.existsSync(CENTURY_FONT)) doc.registerFont("Century", CENTURY_FONT);
  if (fs.existsSync(PMINCHO_FONT)) doc.registerFont("PMincho", PMINCHO_FONT);
  doc.font("JP");
  const out = fs.createWriteStream(path.join(OUTPUT_DIR, filename));
  doc.pipe(out);
  return doc;
}

// ─── Test data (from Excel analysis) ─────────────────────────────────

const SAMPLE_KOBETSU = {
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
  startDate: "2026-01-01",
  endDate: "2026-03-31",
  conflictDate: "2027-10-01",
  contractDate: "2026-01-01",
  employeeCount: 1,
  hourlyRate: 2225,
  closingDay: "末日締め",
  paymentDay: "翌月15日",
};

const SAMPLE_EMPLOYEE = {
  fullName: "NGUYEN DUC THANH",
  katakanaName: "グエン　ドウック　タイン",
  gender: "男",
  birthDate: "1989-08-19",
  actualHireDate: "2021-01-06",
  hireDate: "2021-01-06",
};

// ─── Generate PDFs ──────────────────────────────────────────────────

console.log("Generating Koritsu test PDFs...\n");

// 1. 個別契約書
const doc1 = createDoc("koritsu-kobetsu.pdf");
generateKoritsuKobetsuPDF(doc1, SAMPLE_KOBETSU);
doc1.end();
console.log("✓ koritsu-kobetsu.pdf");

// 2. 派遣先管理台帳
const doc2 = createDoc("koritsu-daicho.pdf");
generateKoritsuDaichoPDF(doc2, {
  companyName: SAMPLE_KOBETSU.companyName,
  factoryName: SAMPLE_KOBETSU.factoryName,
  factoryAddress: SAMPLE_KOBETSU.factoryAddress,
  factoryPhone: SAMPLE_KOBETSU.factoryPhone,
  department: SAMPLE_KOBETSU.department,
  lineName: SAMPLE_KOBETSU.lineName,
  contractNumber: SAMPLE_KOBETSU.contractNumber,
  contractDate: SAMPLE_KOBETSU.contractDate,
  startDate: SAMPLE_KOBETSU.startDate,
  endDate: SAMPLE_KOBETSU.endDate,
  jobDescription: SAMPLE_KOBETSU.jobDescription,
  hakensakiManagerDept: SAMPLE_KOBETSU.hakensakiManagerDept,
  hakensakiManagerTitle: SAMPLE_KOBETSU.hakensakiManagerTitle,
  hakensakiManagerName: SAMPLE_KOBETSU.hakensakiManagerName,
  hakensakiManagerPhone: SAMPLE_KOBETSU.hakensakiManagerPhone,
  employees: [SAMPLE_EMPLOYEE],
});
doc2.end();
console.log("✓ koritsu-daicho.pdf");

// 3. 派遣先通知書
const doc3 = createDoc("koritsu-tsuchisho.pdf");
generateKoritsuTsuchishoPDF(doc3, {
  companyName: SAMPLE_KOBETSU.companyName,
  contractNumber: SAMPLE_KOBETSU.contractNumber,
  contractDate: SAMPLE_KOBETSU.contractDate,
  startDate: SAMPLE_KOBETSU.startDate,
  endDate: SAMPLE_KOBETSU.endDate,
  employees: [SAMPLE_EMPLOYEE],
});
doc3.end();
console.log("✓ koritsu-tsuchisho.pdf");

console.log("\nDone! Check output/ directory.");
