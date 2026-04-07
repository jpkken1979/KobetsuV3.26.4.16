import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { generateKobetsuPDF } from "./server/pdf/kobetsu-pdf.js";
import { generateTsuchishoPDF } from "./server/pdf/tsuchisho-pdf.js";
import { generateHakensakiKanriDaichoPDF } from "./server/pdf/hakensakikanridaicho-pdf.js";
import { generateHakenmotoKanriDaichoPDF } from "./server/pdf/hakenmotokanridaicho-pdf.js";

const fontPath = path.join("server", "pdf", "fonts", "NotoSansJP-Regular.ttf");
const minchoPath = path.join("server", "pdf", "fonts", "BIZUDMincho-0.ttf");
const outDir = "output";
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function createDoc() {
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  if (fs.existsSync(fontPath)) {
    doc.registerFont("JP", fontPath);
    doc.font("JP");
  }
  if (fs.existsSync(minchoPath)) {
    doc.registerFont("JP-Mincho", minchoPath);
  }
  return doc;
}

function writePDF(doc: InstanceType<typeof PDFDocument>, name: string) {
  const outPath = path.join(outDir, `TEST_${name}_${Date.now()}.pdf`);
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);
  doc.end();
  stream.on("finish", () => {
    const stat = fs.statSync(outPath);
    console.log(`${name}: ${outPath} (${(stat.size / 1024).toFixed(1)} KB)`);
  });
}

// ─── Shared test data ───────────────────────────────────────────────

const testData = {
  companyName: "ティーケーエンジニアリング株式会社",
  companyAddress: "愛知県弥富市六條町大崎11番地1",
  companyPhone: "0567-56-6711",
  factoryName: "海南第二工場",
  factoryAddress: "愛知県弥富市六條町大崎11番地1",
  factoryPhone: "0567-56-6711",
  department: "IH技術開発部",
  lineName: "CAD",
  conflictDate: "2025年3月31日",
  supervisorDept: "III本部",
  supervisorName: "伊藤英昭",
  supervisorPhone: "0567-56-6711",
  complaintClientDept: "III本部",
  complaintClientName: "伊藤英昭",
  complaintClientPhone: "0567-56-6711",
  complaintUnsDept: "営業部",
  complaintUnsName: "中山　欣英",
  complaintUnsPhone: "052-938-8840",
  managerUnsDept: "営業部",
  managerUnsName: "中山　欣英",
  managerUnsPhone: "052-938-8840",
  jobDescription: "コイル製作・加工業務",
  responsibilityLevel: "担当者業務",
  startDate: "2025年12月16日",
  endDate: "2026年12月15日",
  employeeCount: 10,
  calendar: "月～金（シフトに準ずる）休日は、土曜日・日曜日・年末年始（12月27日～1月4日）・GW(4月29日～5月5日)・夏季休暇（8月8日～8月16日）",
  workHours: "昼勤：7時00分～15時30分　夜勤：19時00分～3時30分",
  breakTime: "昼勤：11時00分～11時45分まで　夜勤：23時00分～23時45分まで　（45分）",
  overtimeOutsideDays: "1ヶ月に2日の範囲内で命ずることがある。",
  overtimeHours: "3時間/日, 42時間/月, 320時間/年とする。",
  hourlyRate: 1500,
  timeUnit: "15",
  closingDay: "末日",
  paymentDay: "翌月末日",
  bankAccount: "三菱UFJ銀行 名古屋営業部 普通 1234567",
  contractDate: "2025年12月11日",
  isKyoteiTaisho: true,
  welfare: "なし",
};

const testEmployees = [
  { fullName: "グエン　ヴァン　アン", katakanaName: "グエン ヴァン アン", gender: "male" as const, birthDate: "1995-03-15", actualHireDate: "2020-04-01", hireDate: "2020-04-01", hourlyRate: 1500, nationality: "ベトナム", isFirstContract: false, employeeNumber: "220101", clientEmployeeId: "8210034" },
  { fullName: "チャン　ティ　ビック", katakanaName: "チャン ティ ビック", gender: "female" as const, birthDate: "1998-07-22", actualHireDate: "2022-06-01", hireDate: "2022-06-01", hourlyRate: 1500, nationality: "ベトナム", isFirstContract: false, employeeNumber: "220102", clientEmployeeId: "8210046" },
  { fullName: "レー　ヴァン　トゥアン", katakanaName: "レー ヴァン トゥアン", gender: "male" as const, birthDate: "1992-11-08", actualHireDate: "2019-01-15", hireDate: "2019-01-15", hourlyRate: 1600, nationality: "ベトナム", isFirstContract: false, employeeNumber: "190105", clientEmployeeId: "8210090" },
  { fullName: "ファム　ティ　フォン", katakanaName: "ファム ティ フォン", gender: "female" as const, birthDate: "1997-01-30", actualHireDate: "2025-12-16", hireDate: "2025-12-16", hourlyRate: 1500, nationality: "ベトナム", isFirstContract: true, employeeNumber: "251201", clientEmployeeId: null },
  { fullName: "ヴォー　ヴァン　ドゥック", katakanaName: "ヴォー ヴァン ドゥック", gender: "male" as const, birthDate: "1990-05-12", actualHireDate: "2018-10-01", hireDate: "2018-10-01", hourlyRate: 1600, nationality: "ベトナム", isFirstContract: false, employeeNumber: "181001", clientEmployeeId: "9330009" },
];

// ─── 1. 個別契約書 + 通知書 (front + back, double-sided) ────────────

const doc1 = createDoc();
generateKobetsuPDF(doc1, testData);
doc1.addPage({ size: "A4", margin: 0 });
generateTsuchishoPDF(doc1, {
  companyName: testData.companyName,
  contractDate: testData.contractDate,
  startDate: testData.startDate,
  endDate: testData.endDate,
  employees: testEmployees,
});
writePDF(doc1, "個別契約書");

// ─── 2. 派遣先管理台帳 (one PDF, one page per employee) ─────────────

const doc2 = createDoc();
testEmployees.forEach((emp, idx) => {
  if (idx > 0) doc2.addPage({ size: "A4", margin: 0 });
  generateHakensakiKanriDaichoPDF(doc2, {
    ...testData,
    commanderDept: testData.supervisorDept,
    commanderName: testData.supervisorName,
    commanderPhone: testData.supervisorPhone,
    employee: emp,
  });
});
writePDF(doc2, "派遣先管理台帳");

// ─── 3. 派遣元管理台帳 (one PDF, one page per employee) ─────────────

const doc3 = createDoc();
testEmployees.forEach((emp, idx) => {
  if (idx > 0) doc3.addPage({ size: "A4", margin: 0 });
  generateHakenmotoKanriDaichoPDF(doc3, {
    ...testData,
    employee: emp,
  });
});
writePDF(doc3, "派遣元管理台帳");
