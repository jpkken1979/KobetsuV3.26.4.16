/**
 * Test visual del 労働契約書 (keiyakusho) en 5 escenarios distintos.
 *
 * Genera un PDF por caso para validar que el formato aguanta:
 *   1. 1 turno simple (日勤)
 *   2. 2 turnos (昼勤/夜勤) — caso típico UNS
 *   3. 5 turnos (A-E勤務) — factory con múltiples patrones
 *   4. 9 turnos (A-I勤務) — caso extremo estilo 高雄工業
 *   5. 無期雇用 — empleado con contrato indefinido
 *
 * Salida: output/scenarios/keiyakusho_{1..5}_*.pdf
 *
 * Uso: npx tsx test-keiyakusho-scenarios.ts
 */
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import {
  generateKeiyakushoPDF,
  type KeiyakushoData,
  type KeiyakushoEmployee,
} from "./server/pdf/keiyakusho-pdf.js";

const fontPath = path.join("server", "pdf", "fonts", "NotoSansJP-Regular.ttf");
const minchoPath = path.join("server", "pdf", "fonts", "BIZUDMincho-0.ttf");
const outDir = path.join("output", "scenarios");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function createDocLandscape(): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
  if (fs.existsSync(fontPath)) {
    doc.registerFont("JP", fontPath);
    doc.font("JP");
  }
  if (fs.existsSync(minchoPath)) {
    doc.registerFont("JP-Mincho", minchoPath);
  }
  return doc;
}

async function writePDF(doc: InstanceType<typeof PDFDocument>, name: string): Promise<string> {
  const outPath = path.join(outDir, `${name}.pdf`);
  return new Promise<string>((resolve) => {
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);
    doc.end();
    stream.on("finish", () => {
      const stat = fs.statSync(outPath);
      console.log(`  ✓ ${name}.pdf (${(stat.size / 1024).toFixed(1)} KB)`);
      resolve(outPath);
    });
  });
}

// ─── Bases compartidas ───

const baseEmployee: KeiyakushoEmployee = {
  employeeNumber: "E001",
  fullName: "グエン　ヴァン　アン",
  katakanaName: "グエン ヴァン アン",
  romajiName: "NGUYEN VAN ANH",
  gender: "male",
  birthDate: "1995-03-15",
  nationality: "ベトナム",
  address: "愛知県弥富市六條町大崎22番地5 パレスハウス201",
  postalCode: "498-0011",
  actualHireDate: "2020-04-01",
  hireDate: "2020-04-01",
  hourlyRate: 1500,
  billingRate: 1550,
  visaExpiry: "2027-03-31",
  visaType: "技能",
};

const baseData: Omit<KeiyakushoData, "workHours" | "workHoursDay" | "workHoursNight" | "breakTime" | "breakTimeDay" | "breakTimeNight" | "employee" | "startDate" | "endDate"> = {
  companyName: "ティーケーエンジニアリング株式会社",
  companyAddress: "愛知県弥富市六條町大崎11番地1",
  companyPhone: "0567-56-6711",
  factoryName: "海南第二工場",
  factoryAddress: "愛知県弥富市六條町大崎11番地1",
  department: "IH技術開発部",
  lineName: "CAD",
  conflictDate: "2027-03-31",
  jobDescription: "コイル製作・加工業務",
  calendar: "土曜日・日曜日・年末年始・GW・夏季休暇",
  overtimeHours: "3時間/日, 42時間/月, 320時間/年とする。",
  hourlyRate: 1550,
  shiftPattern: "シフト制",
  closingDay: "末日",
  paymentDay: "翌月末日",
  contractDate: "2026-03-27",
  factoryPhone: "0567-56-6711",
  supervisorDept: "IH本部",
  supervisorName: "課長　山本　大介",
  supervisorPhone: "0567-56-6711",
  hakensakiManagerDept: "IH本部 弥富第二事業所",
  hakensakiManagerName: "伊藤英昭",
  hakensakiManagerPhone: "0567-56-6711",
  complaintClientDept: "人事広報管理部",
  complaintClientName: "部長　山田　茂",
  complaintClientPhone: "0567-68-8110",
  complaintUnsDept: "営業部",
  complaintUnsName: "取締役 部長　中山　欣英",
  complaintUnsPhone: "052-938-8840",
};

// ─── Escenario 1: 1 turno simple ───
async function scenario1_singleShift(): Promise<void> {
  const doc = createDocLandscape();
  generateKeiyakushoPDF(doc, {
    ...baseData,
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    workHours: "日勤：8:00～17:00",
    workHoursDay: "8:00～17:00",
    workHoursNight: "",
    breakTime: "日勤：12:00～13:00（60分）",
    breakTimeDay: "12:00～13:00（60分）",
    breakTimeNight: "",
    employee: baseEmployee,
  });
  await writePDF(doc, "1_single_shift");
}

// ─── Escenario 2: 2 turnos (昼/夜) — caso típico ───
async function scenario2_twoShifts(): Promise<void> {
  const doc = createDocLandscape();
  generateKeiyakushoPDF(doc, {
    ...baseData,
    startDate: "2026-04-01",
    endDate: "2026-09-30",
    workHours: "昼勤：7:00～15:30\n夜勤：19:00～3:30",
    workHoursDay: "7:00～15:30",
    workHoursNight: "19:00～3:30",
    breakTime: "昼勤：11:00～11:45（45分）\n夜勤：23:00～23:45（45分）",
    breakTimeDay: "11:00～11:45（45分）",
    breakTimeNight: "23:00～23:45（45分）",
    employee: baseEmployee,
  });
  await writePDF(doc, "2_two_shifts");
}

// ─── Escenario 3: 5 turnos (A-E勤務) ───
async function scenario3_fiveShifts(): Promise<void> {
  const doc = createDocLandscape();
  generateKeiyakushoPDF(doc, {
    ...baseData,
    startDate: "2026-04-01",
    endDate: "2026-09-30",
    workHours:
      "A勤務：7:00～15:30\nB勤務：15:30～0:00\nC勤務：8:30～17:00\nD勤務：15:00～23:30\nE勤務：23:00～7:30",
    workHoursDay: "7:00～15:30",
    workHoursNight: "23:00～7:30",
    breakTime:
      "A勤務：10:30～11:15（45分）\nB勤務：19:00～19:45（45分）\nC勤務：12:00～12:45（45分）\nD勤務：18:30～19:15（45分）\nE勤務：2:30～3:15（45分）",
    breakTimeDay: "10:30～11:15",
    breakTimeNight: "2:30～3:15",
    employee: baseEmployee,
  });
  await writePDF(doc, "3_five_shifts");
}

// ─── Escenario 4: 9 turnos (A-I勤務) — caso extremo estilo 高雄 ───
async function scenario4_nineShifts(): Promise<void> {
  const doc = createDocLandscape();
  generateKeiyakushoPDF(doc, {
    ...baseData,
    companyName: "高雄工業株式会社",
    factoryName: "愛知事業所 海南第一工場",
    department: "製作1課",
    jobDescription:
      "自動車の足回り部分のHUB（ハブベアリング）部品の旋削加工。NC旋盤・CNC旋盤のプログラム入力・変更確認。品質の測定・検査、測定器具使用（マイクロメーター、ノギス、ゲージ等）",
    startDate: "2026-07-16",
    endDate: "2026-09-30",
    workHours:
      "A勤務：7:00～15:30\nB勤務：15:30～0:00\nC勤務：8:30～17:00\nD勤務：15:00～23:30\nE勤務：23:00～7:30\nF勤務：7:00～18:45\nG勤務：19:00～6:45\nH勤務：14:30～23:00\nI勤務：22:45～7:15",
    workHoursDay: "7:00～15:30",
    workHoursNight: "22:45～7:15",
    breakTime:
      "A勤務：10:30～11:15\nB勤務：19:00～19:45\nC勤務：12:00～12:45\nD勤務：18:30～19:15\nE勤務：2:30～3:15\nF勤務：10:00～11:00\nG勤務：22:00～23:00\nH勤務：18:00～18:45\nI勤務：2:00～2:45",
    breakTimeDay: "10:30～11:15",
    breakTimeNight: "2:00～2:45",
    employee: { ...baseEmployee, hourlyRate: 1650, billingRate: 1650 },
  });
  await writePDF(doc, "4_nine_shifts_takao");
}

// ─── Escenario 5: 無期雇用 (contrato indefinido) ───
async function scenario5_indefinite(): Promise<void> {
  const doc = createDocLandscape();
  const longTermEmp: KeiyakushoEmployee = {
    ...baseEmployee,
    fullName: "田中　太郎",
    katakanaName: "タナカ タロウ",
    romajiName: "TANAKA TARO",
    actualHireDate: "2015-04-01",
    hireDate: "2015-04-01",
  };
  generateKeiyakushoPDF(doc, {
    ...baseData,
    startDate: "2015-04-01",
    endDate: "2031-03-31",
    workHours: "日勤：8:00～17:00",
    workHoursDay: "8:00～17:00",
    workHoursNight: "",
    breakTime: "日勤：12:00～13:00（60分）",
    breakTimeDay: "12:00～13:00（60分）",
    breakTimeNight: "",
    employee: longTermEmp,
  });
  await writePDF(doc, "5_indefinite");
}

// ─── Ejecutar todos los escenarios ───
(async () => {
  console.log("Generando 5 escenarios del 労働契約書...\n");
  console.log(`Output: ${path.resolve(outDir)}\n`);

  await scenario1_singleShift();
  await scenario2_twoShifts();
  await scenario3_fiveShifts();
  await scenario4_nineShifts();
  await scenario5_indefinite();

  console.log("\n✓ 5 escenarios generados.");
  console.log("  Abrilos en orden para validar el formato en cada caso.");
})();
