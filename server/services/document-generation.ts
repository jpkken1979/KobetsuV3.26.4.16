// Shared utilities for PDF document generation — extracted from documents-generate.ts
import { db } from "../db/index.js";
import { contracts, type FactoryYearlyConfig, type CompanyYearlyConfig } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getConfigForYear, getCompanyConfigForYear, getFiscalYear } from "./factory-yearly-config.js";
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZipFile } from "yazl";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/** Ruta al font MSGothic para PDFs. */
export const FONT_PATH = path.join(__dirname, "..", "pdf", "fonts", "MSGothic.ttf");
/** Ruta al font BIZ UD Mincho para PDFs. */
export const MINCHO_FONT_PATH = path.join(__dirname, "..", "pdf", "fonts", "BIZUDMincho-0.ttf");
const GOTHIC_FONT_PATH = path.join(__dirname, "..", "pdf", "fonts", "MSGothic.ttf");
const CENTURY_FONT_PATH = path.join(__dirname, "..", "pdf", "fonts", "CenturySchoolbook.ttf");
const PMINCHO_FONT_PATH = path.join(__dirname, "..", "pdf", "fonts", "MSPMincho.ttf");
const OUTPUT_DIR = path.join(__dirname, "..", "..", "output");
/** Directorio de salida para PDFs de 個別契約書 Kobetsu. */
export const KOBETSU_OUTPUT_DIR = path.join(OUTPUT_DIR, "kobetsu");
/** Directorio de salida para PDFs de 労働契約書. */
export const ROUDOU_OUTPUT_DIR = path.join(OUTPUT_DIR, "roudou");
/** Directorio de salida para PDFs de コーリツ. */
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

/**
 * Lee el indice de archivos generados para un contrato desde el archivo JSON en output/.index/.
 */
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

/**
 * Agrega filenames al indice de archivos de un contrato, evitando duplicados.
 */
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

/**
 * Crea un archivo ZIP con los PDFs indicados y lo guarda en baseDir.
 */
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

/**
 * Obtiene un contrato con todas sus relaciones (company, factory, employees + employee).
 */
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

/**
 * Wrapper async: obtiene yearly config según startDate del contrato y llama buildCommonData.
 * Usar este en todos los route handlers para aplicar overrides anuales automáticamente.
 */
/**
 * Wrapper asincrono: obtiene la config anual segun startDate y luego llama a buildCommonData.
 * Usar en todos los route handlers para aplicar overrides anuales automaticamente.
 */
export async function buildCommonDataForPDF(
  contract: NonNullable<Awaited<ReturnType<typeof getContractData>>>
) {
  const yearlyConfig = await getConfigForYear(contract.factoryId, contract.startDate);
  const fiscalYear = getFiscalYear(contract.startDate);
  const companyConfig = await getCompanyConfigForYear(contract.companyId, fiscalYear);
  return buildCommonData(contract, yearlyConfig, companyConfig);
}

/**
 * Construye el objeto de datos comun para todos los PDFs a partir de un contrato + configs anuales.
 * Aplica cascade: factory yearly config → company yearly config → factory static fields.
 */
export function buildCommonData(
  contract: NonNullable<Awaited<ReturnType<typeof getContractData>>>,
  yearlyConfig?: FactoryYearlyConfig | null,
  companyConfig?: CompanyYearlyConfig | null
) {
  const c = contract;
  const company = c.company;
  const factory = c.factory;

  // ─── Shift detection helpers ────────────────
  // Detect named shifts (昼勤①, 交替勤務②, A勤務, シフト1...) followed by a time pattern.
  // Works regardless of separator (、 / 　 / \n) — replaces the old whitespace-only heuristic.
  // Match: 昼勤 8:30~17:00, ①8時00分~17時00分, 1 08:00~17:00, A勤務 7:00-15:30
  // Handles: named shift prefix + time range with various separators (：:~-)
  // Match patterns like: 昼勤 8:30~17:00, 昼勤：7時00分~15時30分, ①8時00分~17時00分, 1 08:00~17:00
// Handles: named shift prefix + time range with various separators (：:~-)
const NAMED_SHIFT_RE = /(?:[A-Za-z]+[勤務番]*|交替|[一-鿿]+[勤直務]+|①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)[①-⑩0-9]*\s*[：:ー]?\s*\d{1,2}\s*[時:：]*\s*\d{2}分?\s*[～~ー-]\s*\d{1,2}\s*[時:：]*\s*\d{2}分?|[0-9①-⑩]\d?\s*\d{1,2}:?\d{2}\s*[～~ー-]\s*\d{1,2}:?\d{2}/gu;
  const countNamedShifts = (text: string): number => {
    if (!text) return 0;
    return (text.match(NAMED_SHIFT_RE) || []).length;
  };
  // Normalize separators to \n so renderMultiShift puts one shift per line.
  // Only kicks in when the text already has named shifts — leaves single-shift text alone.
  const normalizeShiftText = (text: string): string => {
    if (!text || text.includes("\n")) return text || "";
    if (countNamedShifts(text) < 2) return text;
    return text.replace(/、/g, "\n").trim();
  };

  // Build comprehensive workHours string — prefer canonical workHours when it has named shifts.
  let workHours = "";
  const fullWorkHours = factory.workHours || "";
  const namedShiftCount = countNamedShifts(fullWorkHours);

  // Only use workHoursDay/Night as source of truth when workHours is empty OR
  // when both Day/Night are populated AND different (2-shift factory).
  // Never use Day/Night when workHours is a simple single-shift text (高雄 workaround).
  const hasDayNight = factory.workHoursDay || factory.workHoursNight;
  const dayNightDifferent = factory.workHoursDay && factory.workHoursNight &&
    factory.workHoursDay !== factory.workHoursNight;

  if (namedShiftCount >= 2) {
    // Canonical multi-shift text (六甲: "昼勤①…、交替勤務②…", 高雄: "A勤務：…　B勤務：…")
    workHours = normalizeShiftText(fullWorkHours);
  } else if (hasDayNight && dayNightDifferent) {
    // Two distinct shift times — use Day/Night with labels ONLY if workHours is empty
    // (arubaito/part-time factories intentionally have different Day/Night but only ONE
    // shift is actually used — prefer the existing workHours text to avoid showing
    // two shifts when only one applies)
    if (fullWorkHours && fullWorkHours.trim().length > 0) {
      workHours = fullWorkHours;
    } else {
      const parts: string[] = [];
      if (factory.workHoursDay) parts.push(`【昼勤】${factory.workHoursDay}`);
      if (factory.workHoursNight) parts.push(`【夜勤】${factory.workHoursNight}`);
      workHours = parts.join("\n");
    }
  } else if (hasDayNight && !dayNightDifferent) {
    // Only one shift populated (e.g., same time for both) — use workHours directly
    workHours = fullWorkHours || factory.workHoursDay || "";
  } else if (hasDayNight && !fullWorkHours) {
    // workHours empty but Day/Night exist — use Day with label as fallback
    workHours = fullWorkHours || `【昼勤】${factory.workHoursDay}`;
  } else if (c.workStartTime && c.workEndTime) {
    workHours = `${c.workStartTime} ～ ${c.workEndTime}`;
  } else {
    workHours = fullWorkHours;
  }

  // Build comprehensive breakTime string — same detection strategy.
  let breakTime = "";
  const breakDayText = factory.breakTimeDay || "";
  const breakNightText = factory.breakTimeNight || "";
  const breakDayCount = countNamedShifts(breakDayText);
  const breakNightCount = countNamedShifts(breakNightText);

  if (breakDayCount >= 2) {
    // Canonical multi-shift breaks live in breakTimeDay (六甲, 高雄).
    // Ignore breakTimeNight to avoid duplicating the legacy 2-shift fallback.
    breakTime = normalizeShiftText(breakDayText);
  } else if (breakDayCount + breakNightCount >= 2) {
    // Multi-shift split across both legacy fields (rare).
    breakTime = normalizeShiftText([breakDayText, breakNightText].filter(Boolean).join("\n"));
  } else if (breakDayText || breakNightText) {
    // Use whatever break times exist — with labels only if 2 shifts are active
    const parts: string[] = [];
    if (breakDayText) parts.push(dayNightDifferent ? `【昼勤】${breakDayText}` : breakDayText);
    if (breakNightText) parts.push(dayNightDifferent ? `【夜勤】${breakNightText}` : breakNightText);
    breakTime = parts.join("\n");
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
    calendar: yearlyConfig?.sagyobiText || factory.calendar || c.workDays || "",
    workHours,
    breakTime,
    overtimeHours: factory.overtimeHours || c.overtimeMax || "",
    hourlyRate: c.hourlyRate ?? (() => {
      // Infer from contract_employees assignments when contract.hourlyRate is null
      // (legacy contracts created before hourlyRate was set at contract level)
      if (c.employees && c.employees.length > 0) {
        const rates = c.employees.map((ce) => ce.hourlyRate ?? ce.employee.billingRate ?? ce.employee.hourlyRate ?? null).filter((r): r is number => r !== null);
        if (rates.length > 0) {
          // Use the most common rate (mode) from assignments
          const freq = new Map<number, number>();
          for (const r of rates) { freq.set(r, (freq.get(r) ?? 0) + 1); }
          return Array.from(freq.entries()).sort((a, b) => b[1] - a[1])[0]![0];
        }
      }
      return factory.hourlyRate ?? 0;
    })(),
    conflictDate: c.conflictDateOverride ?? factory.conflictDate ?? "",
    closingDay: factory.closingDayText || (factory.closingDay ? `${factory.closingDay}日` : ""),
    paymentDay: factory.paymentDayText || (factory.paymentDay ? `${factory.paymentDay}日` : ""),
    bankAccount: factory.bankAccount || "",
    timeUnit: factory.timeUnit || "15",

    // 指揮命令者 (supervisor) — yearly config overrides factory data when available
    supervisorDept: yearlyConfig?.supervisorDept || factory.supervisorDept || c.supervisorDept || "",
    supervisorName: yearlyConfig?.supervisorName || factory.supervisorName || c.supervisorName || "",
    supervisorPhone: yearlyConfig?.supervisorPhone || factory.supervisorPhone || c.supervisorPhone || "",
    supervisorRole: yearlyConfig?.supervisorRole || factory.supervisorRole || "",

    // 派遣先責任者 — keep role boundaries strict (never fallback to 指揮命令者).
    hakensakiManagerDept: yearlyConfig?.hakensakiManagerDept || companyConfig?.hakensakiManagerDept || factory.hakensakiManagerDept || "",
    hakensakiManagerName: yearlyConfig?.hakensakiManagerName || companyConfig?.hakensakiManagerName || factory.hakensakiManagerName || "",
    hakensakiManagerPhone: yearlyConfig?.hakensakiManagerPhone || companyConfig?.hakensakiManagerPhone || factory.hakensakiManagerPhone || "",
    hakensakiManagerRole: yearlyConfig?.hakensakiManagerRole || companyConfig?.hakensakiManagerRole || factory.hakensakiManagerRole || "",

    // 休日テキスト — factory yearly config → company yearly config → empty
    kyujitsuText: yearlyConfig?.kyujitsuText || companyConfig?.kyujitsuText || "",

    // 休暇処理 — factory yearly config → company yearly config → empty
    kyuukashori: yearlyConfig?.kyuukashori || companyConfig?.kyuukashori || "",

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
