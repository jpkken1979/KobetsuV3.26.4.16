/**
 * Test: Multi-shift PDF layout
 *
 * Generates 個別契約書 + 派遣元管理台帳 + 就業条件明示書 with 2, 3, 4, and 5 shifts
 * to verify smart adaptive layout in all PDF generators.
 */
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { generateKobetsuPDF } from "./server/pdf/kobetsu-pdf.js";
import { generateHakenmotoKanriDaichoPDF } from "./server/pdf/hakenmotokanridaicho-pdf.js";
import { generateShugyoJokenMeijishoPDF } from "./server/pdf/shugyojoken-pdf.js";

const fontPath = path.join("server", "pdf", "fonts", "NotoSansJP-Regular.ttf");
const minchoPath = path.join("server", "pdf", "fonts", "BIZUDMincho-0.ttf");
const outDir = "output";
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function createDoc(landscape = false) {
  const doc = new PDFDocument({ size: "A4", margin: 0, layout: landscape ? "landscape" : "portrait" });
  if (fs.existsSync(fontPath)) { doc.registerFont("JP", fontPath); doc.font("JP"); }
  if (fs.existsSync(minchoPath)) { doc.registerFont("JP-Mincho", minchoPath); }
  return doc;
}

function writePDF(doc: InstanceType<typeof PDFDocument>, name: string) {
  const outPath = path.join(outDir, `TEST_MULTISHIFT_${name}.pdf`);
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);
  doc.end();
  stream.on("finish", () => {
    const stat = fs.statSync(outPath);
    console.log(`✓ ${name}: ${outPath} (${(stat.size / 1024).toFixed(1)} KB)`);
  });
}

// ─── Base data ──────────────────────────────────────────────────────

const base = {
  companyName: "テスト工業株式会社",
  companyAddress: "愛知県名古屋市東区徳川2-18-18",
  companyPhone: "052-000-1111",
  factoryName: "第一工場",
  factoryAddress: "愛知県豊田市トヨタ町1番地",
  factoryPhone: "0565-00-2222",
  department: "製造1課",
  lineName: "Aライン",
  conflictDate: "2027-03-31",
  supervisorDept: "生産管理部",
  supervisorName: "田中太郎",
  supervisorPhone: "0565-00-3333",
  complaintClientDept: "総務部",
  complaintClientName: "鈴木花子",
  complaintClientPhone: "0565-00-4444",
  complaintUnsDept: "営業部",
  complaintUnsName: "中山　欣英",
  complaintUnsPhone: "052-938-8840",
  managerUnsDept: "営業部",
  managerUnsName: "取締役 部長　中山　欣英",
  managerUnsPhone: "052-938-8840",
  hakensakiManagerDept: "生産管理部",
  hakensakiManagerName: "田中太郎",
  hakensakiManagerPhone: "0565-00-3333",
  jobDescription: "自動車部品組立・検査業務",
  responsibilityLevel: "担当者業務",
  startDate: "2026-04-01",
  endDate: "2026-06-30",
  employeeCount: 5,
  calendar: "月～金（シフトに準ずる）",
  overtimeOutsideDays: "1ヶ月に2日の範囲内",
  overtimeHours: "3時間/日, 42時間/月, 320時間/年",
  hourlyRate: 1600,
  timeUnit: "15",
  closingDay: "末日",
  paymentDay: "翌月20日",
  bankAccount: "三菱UFJ銀行 名古屋営業部",
  contractDate: "2026-03-27",
  isKyoteiTaisho: true,
  welfare: "なし",
};

const testEmployee = {
  fullName: "グエン　ヴァン　アン",
  katakanaName: "グエン ヴァン アン",
  gender: "male" as const,
  birthDate: "1995-03-15",
  actualHireDate: "2020-04-01",
  hireDate: "2020-04-01",
  hourlyRate: 1600,
  billingRate: 1800,
  nationality: "ベトナム",
};

// ─── Shift scenarios ────────────────────────────────────────────────

const scenarios = [
  {
    name: "2turnos",
    label: "2交代（昼夜）",
    workHours: "昼勤：7時00分～15時30分\n夜勤：19時00分～3時30分",
    breakTime: "昼勤：11時00分～11時45分（45分）\n夜勤：23時00分～23時45分（45分）",
  },
  {
    name: "3turnos",
    label: "3交代",
    workHours: "1直：6時00分～14時00分\n2直：14時00分～22時00分\n3直：22時00分～6時00分",
    breakTime: "1直：10時00分～10時45分（45分）\n2直：18時00分～18時45分（45分）\n3直：2時00分～2時45分（45分）",
  },
  {
    name: "4turnos",
    label: "4交代",
    workHours: "A勤務：7時00分～15時30分\nB勤務：15時00分～23時30分\nC勤務：23時00分～7時30分\nD勤務：8時00分～20時00分",
    breakTime: "A勤務：11時00分～11時45分（45分）\nB勤務：19時00分～19時45分（45分）\nC勤務：3時00分～3時45分（45分）\nD勤務：12時00分～12時45分・16時00分～16時15分（60分）",
  },
  {
    name: "5turnos",
    label: "5交代",
    workHours: "1直：6時00分～14時00分\n2直：14時00分～22時00分\n3直：22時00分～6時00分\n早番：5時00分～13時30分\n遅番：13時00分～21時30分",
    breakTime: "1直：10時00分～10時45分（45分）\n2直：18時00分～18時45分（45分）\n3直：2時00分～2時45分（45分）\n早番：9時00分～9時45分（45分）\n遅番：17時00分～17時45分（45分）",
  },
];

// ─── Generate PDFs ──────────────────────────────────────────────────

console.log("=== Multi-shift PDF layout test ===\n");

// 1. 個別契約書: all scenarios on separate pages in one PDF
const docKobetsu = createDoc();
scenarios.forEach((s, idx) => {
  if (idx > 0) docKobetsu.addPage({ size: "A4", margin: 0 });
  generateKobetsuPDF(docKobetsu, {
    ...base,
    workHours: s.workHours,
    breakTime: s.breakTime,
  });
});
writePDF(docKobetsu, "個別契約書");

// 2. 派遣元管理台帳: all scenarios on separate pages
//    Page 3 (4交代) includes hasRobotTraining=true to test ロボット特別教育 auto-fill
const docDaicho = createDoc();
scenarios.forEach((s, idx) => {
  if (idx > 0) docDaicho.addPage({ size: "A4", margin: 0 });
  generateHakenmotoKanriDaichoPDF(docDaicho, {
    ...base,
    workHours: s.workHours,
    breakTime: s.breakTime,
    hasRobotTraining: idx === 2, // 4交代 page shows robot training
    employee: testEmployee,
  });
});
writePDF(docDaicho, "派遣元管理台帳");

// 3. 就業条件明示書: all scenarios on separate pages
const docShugyojoken = createDoc();
scenarios.forEach((s, idx) => {
  if (idx > 0) docShugyojoken.addPage({ size: "A4", margin: 0 });
  generateShugyoJokenMeijishoPDF(docShugyojoken, {
    ...base,
    workHours: s.workHours,
    breakTime: s.breakTime,
    employee: testEmployee,
  });
});
writePDF(docShugyojoken, "就業条件明示書");

console.log("\nDone! Check output/ folder for results.");
console.log("Each PDF has 4 pages: 2交代 → 3交代 → 4交代 → 5交代");
