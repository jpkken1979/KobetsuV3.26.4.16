// Shared utilities for PDF document generation — extracted from documents-generate.ts
import { db } from "../db/index.js";
import { contracts } from "../db/schema.js";
import { eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZipFile } from "yazl";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const FONT_PATH = path.join(__dirname, "..", "pdf", "fonts", "NotoSansJP-Regular.ttf");
export const MINCHO_FONT_PATH = path.join(__dirname, "..", "pdf", "fonts", "BIZUDMincho-0.ttf");
const GOTHIC_FONT_PATH = path.join(__dirname, "..", "pdf", "fonts", "MSGothic.ttf");
const CENTURY_FONT_PATH = path.join(__dirname, "..", "pdf", "fonts", "CenturySchoolbook.ttf");
const PMINCHO_FONT_PATH = path.join(__dirname, "..", "pdf", "fonts", "MSPMincho.ttf");
const OUTPUT_DIR = path.join(__dirname, "..", "..", "output");
export const KOBETSU_OUTPUT_DIR = path.join(OUTPUT_DIR, "kobetsu");
export const ROUDOU_OUTPUT_DIR = path.join(OUTPUT_DIR, "roudou");
export const KORITSU_OUTPUT_DIR = path.join(OUTPUT_DIR, "koritsu");
const INDEX_DIR = path.join(OUTPUT_DIR, ".index");

/** Create a PDFDocument with Japanese font registered */
export function createDoc(): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  if (fs.existsSync(FONT_PATH)) {
    doc.registerFont("JP", FONT_PATH);
    doc.font("JP");
  }
  if (fs.existsSync(MINCHO_FONT_PATH)) {
    doc.registerFont("JP-Mincho", MINCHO_FONT_PATH);
  }
  if (fs.existsSync(GOTHIC_FONT_PATH)) {
    doc.registerFont("Gothic", GOTHIC_FONT_PATH);
  }
  if (fs.existsSync(CENTURY_FONT_PATH)) {
    doc.registerFont("Century", CENTURY_FONT_PATH);
  }
  if (fs.existsSync(PMINCHO_FONT_PATH)) {
    doc.registerFont("PMincho", PMINCHO_FONT_PATH);
  }
  return doc;
}

/** Create a PDFDocument in LANDSCAPE with Japanese fonts */
export function createDocLandscape(): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
  if (fs.existsSync(FONT_PATH)) {
    doc.registerFont("JP", FONT_PATH);
    doc.font("JP");
  }
  if (fs.existsSync(MINCHO_FONT_PATH)) {
    doc.registerFont("JP-Mincho", MINCHO_FONT_PATH);
  }
  if (fs.existsSync(GOTHIC_FONT_PATH)) {
    doc.registerFont("Gothic", GOTHIC_FONT_PATH);
  }
  if (fs.existsSync(CENTURY_FONT_PATH)) {
    doc.registerFont("Century", CENTURY_FONT_PATH);
  }
  if (fs.existsSync(PMINCHO_FONT_PATH)) {
    doc.registerFont("PMincho", PMINCHO_FONT_PATH);
  }
  return doc;
}

/** Write doc to file and return a promise that resolves when done */
export function writeToFile(doc: InstanceType<typeof PDFDocument>, filepath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);
    doc.end();
    stream.on("finish", () => resolve(filepath));
    stream.on("error", reject);
  });
}

export async function readContractDocIndex(contractId: number): Promise<string[]> {
  const indexPath = path.join(INDEX_DIR, `${contractId}.json`);
  if (!fs.existsSync(indexPath)) return [];
  try {
    const raw = await fs.promises.readFile(indexPath, "utf-8");
    const parsed = JSON.parse(raw) as { files?: unknown };
    if (!Array.isArray(parsed.files)) return [];
    return parsed.files.filter((f): f is string => typeof f === "string");
  } catch {
    return [];
  }
}

export async function appendContractDocIndex(contractId: number, filenames: string[]) {
  if (filenames.length === 0) return;
  if (!fs.existsSync(INDEX_DIR)) {
    fs.mkdirSync(INDEX_DIR, { recursive: true });
  }
  const existing = await readContractDocIndex(contractId);
  const merged = Array.from(new Set([...existing, ...filenames]));
  const indexPath = path.join(INDEX_DIR, `${contractId}.json`);
  await fs.promises.writeFile(indexPath, JSON.stringify({ contractId, files: merged }, null, 2), "utf-8");
}

export function createZipArchive(zipFilename: string, filenames: string[], baseDir: string = KOBETSU_OUTPUT_DIR): Promise<string> {
  return new Promise((resolve, reject) => {
    if (filenames.length === 0) {
      reject(new Error("No files to zip"));
      return;
    }

    const zipPath = path.join(baseDir, zipFilename);
    const zip = new ZipFile();
    const stream = fs.createWriteStream(zipPath);

    stream.on("error", reject);
    stream.on("finish", () => resolve(zipPath));
    zip.outputStream.on("error", reject);

    for (const filename of filenames) {
      const filePath = path.join(baseDir, filename);
      if (!fs.existsSync(filePath)) continue;
      zip.addFile(filePath, filename);
    }

    zip.outputStream.pipe(stream);
    zip.end();
  });
}

// ─── Fetch full contract data with relations ────────────────────────

export async function getContractData(contractId: number) {
  const contract = await db.query.contracts.findFirst({
    where: eq(contracts.id, contractId),
    with: {
      company: true,
      factory: true,
      employees: { with: { employee: true } },
    },
  });
  return contract;
}

// ─── Build common data from contract ────────────────────────────────

export function buildCommonData(contract: NonNullable<Awaited<ReturnType<typeof getContractData>>>) {
  const c = contract;
  const company = c.company;
  const factory = c.factory;

  // Build comprehensive workHours string — prefer full-text workHours if it has more shifts
  let workHours = "";
  const fullWorkHours = factory.workHours || "";
  const fullShiftCount = fullWorkHours.split(/[　\s]+/).filter(s => /[：～]/.test(s)).length;
  if (fullShiftCount > 2 && fullWorkHours) {
    // Factory has 3+ shifts stored in free-text field
    // Split into separate lines by shift name for multi-column PDF layout
    // "A勤務：7:00～15:30　B勤務：15:30～0:00" → "A勤務：...\nB勤務：..."
    workHours = fullWorkHours.includes("\n")
      ? fullWorkHours
      : fullWorkHours.replace(/\s+(?=[A-Za-z\u4e00-\u9fff\d]+[勤直務]：)/g, "\n");
  } else if (factory.workHoursDay || factory.workHoursNight) {
    const parts: string[] = [];
    if (factory.workHoursDay) parts.push(`【昼勤】${factory.workHoursDay}`);
    if (factory.workHoursNight) parts.push(`【夜勤】${factory.workHoursNight}`);
    workHours = parts.join("\n");
  } else if (c.workStartTime && c.workEndTime) {
    workHours = `${c.workStartTime} ～ ${c.workEndTime}`;
  } else if (fullWorkHours) {
    workHours = fullWorkHours;
  }

  // Fix #2: Build comprehensive breakTime string with all shifts
  // Extract shift names from workHours text (e.g., "A勤務：..." → ["A勤務", "D勤務"])
  const shiftNames: string[] = [];
  const snRe = /([A-Za-z\u4e00-\u9fff\d]+[勤直務]|シフト\d?)：/g;
  let snMatch;
  while ((snMatch = snRe.exec(fullWorkHours)) !== null) shiftNames.push(snMatch[1]);

  let breakTime = "";
  if (factory.breakTimeDay || factory.breakTimeNight) {
    const hasName = (text: string) => /^[A-Za-z\u4e00-\u9fff\d]+[勤直務]：/.test(text);
    // If breakTimeDay already contains multi-shift breaks (3+ shifts stored as single field), use as-is
    const dayText = factory.breakTimeDay || "";
    const nightText = factory.breakTimeNight || "";
    if (dayText.includes("\n") || (hasName(dayText) && !nightText)) {
      // All breaks in one field (3+ shifts) — use directly
      breakTime = dayText;
    } else {
      const parts: string[] = [];
      const dayLabel = shiftNames[0] || "昼勤";
      const nightLabel = shiftNames[1] || "夜勤";
      if (dayText) parts.push(hasName(dayText) ? dayText : `【${dayLabel}】${dayText}`);
      if (nightText) parts.push(hasName(nightText) ? nightText : `【${nightLabel}】${nightText}`);
      breakTime = parts.join("\n");
    }
  } else if (c.breakMinutes) {
    breakTime = `${c.breakMinutes}分`;
  } else if (factory.breakTime) {
    breakTime = `${factory.breakTime}分`;
  }

  return {
    companyName: company.name,
    companyAddress: company.address || "",
    companyPhone: company.phone || "",
    factoryName: factory.factoryName,
    // Fix #1: No fallback to company address — factory address only
    factoryAddress: factory.address || "",
    factoryPhone: factory.phone || "",
    department: factory.department || "",
    lineName: factory.lineName || "",
    contractDate: c.contractDate,
    startDate: c.startDate,
    endDate: c.endDate,
    jobDescription: factory.jobDescription || c.jobDescription || "",
    calendar: factory.calendar || c.workDays || "",
    workHours,
    breakTime,
    overtimeHours: factory.overtimeHours || c.overtimeMax || "",
    hourlyRate: c.hourlyRate ?? factory.hourlyRate ?? 0,
    conflictDate: c.conflictDateOverride ?? factory.conflictDate ?? "",
    closingDay: factory.closingDayText || (factory.closingDay ? `${factory.closingDay}日` : ""),
    paymentDay: factory.paymentDayText || (factory.paymentDay ? `${factory.paymentDay}日` : ""),
    bankAccount: factory.bankAccount || "",
    timeUnit: factory.timeUnit || "15",

    // 指揮命令者 (supervisor) — factory-first so updates propagate to existing contracts
    supervisorDept: factory.supervisorDept || c.supervisorDept || "",
    supervisorName: factory.supervisorName || c.supervisorName || "",
    supervisorPhone: factory.supervisorPhone || c.supervisorPhone || "",
    supervisorRole: factory.supervisorRole || "",

    // Fix #3: 派遣先責任者 (separate from 指揮命令者)
    hakensakiManagerDept: factory.hakensakiManagerDept || factory.supervisorDept || "",
    hakensakiManagerName: factory.hakensakiManagerName || factory.supervisorName || "",
    hakensakiManagerPhone: factory.hakensakiManagerPhone || factory.supervisorPhone || "",
    hakensakiManagerRole: factory.hakensakiManagerRole || "",

    complaintClientDept: factory.complaintClientDept || "",
    complaintClientName: factory.complaintClientName || "",
    complaintClientPhone: factory.complaintClientPhone || "",
    complaintUnsDept: factory.complaintUnsDept || "",
    complaintUnsName: factory.complaintUnsName || "",
    complaintUnsPhone: factory.complaintUnsPhone || "",
    managerUnsDept: factory.managerUnsDept || "",
    managerUnsName: factory.managerUnsName || "",
    managerUnsPhone: factory.managerUnsPhone || "",
    managerUnsAddress: factory.managerUnsAddress || "",
    complaintUnsAddress: factory.complaintUnsAddress || "",
    hasRobotTraining: Boolean(factory.hasRobotTraining),
  };
}
