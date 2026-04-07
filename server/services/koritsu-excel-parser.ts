/**
 * Koritsu Excel Parser — extracts ALL factory data from コーリツ's Excel workbook:
 *   - 派遣先責任者 指揮命令者 sheet: supervisors, managers, phones, addresses, 抵触日, 業務内容
 *   - 派遣元 sheet: UNS manager and complaint handler data
 *   - 労働者派遣個別契約書 sheet: work conditions (就業時間, 休憩, 時間外, 就業日)
 */

import type { KoritsuParsedFactory } from "./koritsu-pdf-parser.js";

// ─── Column indices (1-based) in 派遣先責任者 指揮命令者 ─────────────────────

const COL = {
  DATE: 1,              // 更新日
  FACTORY: 2,           // 工場
  DEPT: 3,              // 責任者配属先
  MANAGER_NAME: 4,      // 責任者課長
  MANAGER_ROLE: 5,      // 責任者(課長) — 派遣先責任者の役職
  LINE: 6,              // 指揮命令配属先
  SUPERVISOR: 7,        // 指揮命令氏名
  SUPERVISOR_ROLE: 8,   // 指揮命令役職 — 指揮命令者の役職
  PHONE: 9,             // 電話番号
  JOB_DESC: 10,         // 業務内容
  WORK_ADDRESS: 15,     // 就業場所住所
  UNS_NAME: 17,         // 派遣元責任者（名称）
  UNS_ADDRESS: 18,      // 派遣元責任者（住所）
  UNS_PHONE: 19,        // 派遣元責任者（TEL）
  UNS_MGR_ROLE: 20,     // 派遣元責任者（製造業務専門役職）
  UNS_MGR_NAME: 21,     // 派遣元責任者（製造業務専門氏名）
  UNS_COMPLAINT_DEPT: 22, // 派遣元責任者（苦情部署）
  UNS_COMPLAINT_ROLE: 23, // 派遣元責任者（苦情役職）
  UNS_COMPLAINT_NAME: 24, // 派遣元責任者（苦情氏名）
  COMPLAINT_DEPT: 28,   // 派遣先（苦情部署）
  COMPLAINT_NAME: 30,   // 派遣先（苦情氏名）
  COMPLAINT_PHONE: 31,  // 派遣先（苦情TEL）
  CONFLICT_DATE: 35,    // 抵触日
} as const;

const ADMIN_DEPARTMENTS = new Set(["財務部", "経営企画部", "業務部"]);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KoritsuExcelFactory extends KoritsuParsedFactory {
  address: string | null;
  conflictDate: string | null;
  jobDescription: string | null;
}

export interface KoritsuExcelResult {
  period: string;
  factories: KoritsuExcelFactory[];
  addresses: Record<string, string>;
  complaint: { name: string | null; dept: string | null; phone: string | null; fax: string | null };
  overtime: { regular: string | null; threeShift: string | null };
  availableDates: string[];
  selectedDate: string;
  // UNS (派遣元) data — global, same for all lines
  uns: {
    managerName: string | null;
    managerDept: string | null;
    managerPhone: string | null;
    managerAddress: string | null;
    complaintName: string | null;
    complaintDept: string | null;
    complaintPhone: string | null;
  };
  // Work conditions — global, same for all lines
  workConditions: {
    workDays: string | null;
    workHours: string | null;
    breakTime: string | null;
    overtimeHours: string | null;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type RowLike = { getCell(col: number): { value: unknown } };
type WorksheetLike = { rowCount: number; getRow(n: number): RowLike };

function cellStr(row: RowLike, col: number): string | null {
  const val = row.getCell(col).value;
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date) return val.toISOString().split("T")[0];
  if (typeof val === "object" && val !== null && "richText" in val) {
    return (val as { richText: Array<{ text: string }> }).richText.map((rt) => rt.text).join("").trim() || null;
  }
  if (typeof val === "object" && val !== null && "result" in val) {
    const r = (val as { result: unknown }).result;
    return r === null || r === undefined ? null : String(r).trim() || null;
  }
  return String(val).trim() || null;
}

function parseDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, "0")}-${String(val.getDate()).padStart(2, "0")}`;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(trimmed)) return trimmed.replace(/\//g, "-");
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return parseDate(d);
  }
  if (typeof val === "number") {
    const d = new Date(new Date(Date.UTC(1899, 11, 30)).getTime() + val * 86400000);
    if (!Number.isNaN(d.getTime())) return parseDate(d);
  }
  return null;
}

function normalizeDept(dept: string): string {
  return dept.replace(/\s+/g, "").trim();
}

function formatPeriod(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  return `${y}年 ${parseInt(m, 10)}月`;
}

/**
 * Resolve the REAL factory name based on the work address.
 * The Excel groups under 2 names, but there are 4 physical factories:
 *   本社工場 + address contains "古浜町" → 乙川工場
 *   州の崎工場 + address contains "亀崎" → 亀崎工場
 */
function resolveRealFactory(excelFactoryName: string, workAddress: string | null): string {
  if (!workAddress) return excelFactoryName;
  if (excelFactoryName === "本社工場" && workAddress.includes("古浜町")) return "乙川工場";
  if (excelFactoryName === "州の崎工場" && workAddress.includes("亀崎")) return "亀崎工場";
  return excelFactoryName;
}

// ─── Work Conditions Parser ──────────────────────────────────────────────────

function parseWorkConditions(ws: WorksheetLike | undefined): KoritsuExcelResult["workConditions"] {
  const result = { workDays: null as string | null, workHours: null as string | null, breakTime: null as string | null, overtimeHours: null as string | null };
  if (!ws) return result;

  // Work conditions are in rows 24-30 of 労働者派遣個別契約書 as richText in col 13+
  const lines: string[] = [];
  for (let r = 24; r <= 32; r++) {
    const text = cellStr(ws.getRow(r), 13);
    if (text) lines.push(text.trim());
  }

  if (lines.length >= 1) result.workDays = lines[0]; // 就業日
  if (lines.length >= 4) {
    // Lines 1-3 are 就業・休憩時間 (combine into workHours + breakTime)
    const workParts: string[] = [];
    const breakParts: string[] = [];
    for (let i = 1; i <= 3 && i < lines.length; i++) {
      const line = lines[i];
      const workMatch = line.match(/（就業時間）(.+?)(?:・|$)/);
      const breakMatch = line.match(/（休憩時間）(.+?)$/);
      const altWorkMatch = line.match(/（\s*〃\s*）(.+?)(?:・|$)/);
      const altBreakMatch = line.match(/（\s*〃\s*）(.+?)$/);

      if (workMatch) workParts.push((line.match(/【.+?】/)?.[0] ?? "") + workMatch[1].trim());
      else if (altWorkMatch) workParts.push((line.match(/【.+?】/)?.[0] ?? "") + altWorkMatch[1].trim());

      if (breakMatch) breakParts.push(breakMatch[1].trim());
      else if (altBreakMatch) breakParts.push(altBreakMatch[1].trim());
    }
    if (workParts.length > 0) result.workHours = workParts.join("　");
    if (breakParts.length > 0) result.breakTime = breakParts.join("　");
  }
  if (lines.length >= 7) {
    // Lines 4-6 are 時間外労働
    result.overtimeHours = lines.slice(4, 7).join("　");
  }

  return result;
}

// ─── Main Parser ─────────────────────────────────────────────────────────────

interface KoritsuWorkbook {
  worksheets: Array<{ name: string; rowCount: number; getRow(n: number): RowLike }>;
  getWorksheet(name: string): WorksheetLike | undefined;
}

/**
 * Parse the entire Koritsu Excel workbook.
 * Reads: 派遣先責任者 指揮命令者, 派遣元, 労働者派遣個別契約書
 */
export function parseKoritsuExcelWorkbook(
  workbook: KoritsuWorkbook,
  targetDate?: string,
): KoritsuExcelResult {
  // Find sheets
  const mainSheet = workbook.worksheets.find((s) => s.name.includes("派遣先責任者"));
  const contractSheet = workbook.worksheets.find((s) => s.name.includes("労働者派遣個別契約書")) as WorksheetLike | undefined;
  const unsSheet = workbook.worksheets.find((s) => s.name === "派遣元") as WorksheetLike | undefined;

  const result: KoritsuExcelResult = {
    period: "",
    factories: [],
    addresses: {},
    complaint: { name: null, dept: null, phone: null, fax: null },
    overtime: { regular: null, threeShift: null },
    availableDates: [],
    selectedDate: "",
    uns: { managerName: null, managerDept: null, managerPhone: null, managerAddress: null, complaintName: null, complaintDept: null, complaintPhone: null },
    workConditions: parseWorkConditions(contractSheet),
  };

  if (!mainSheet) return result;

  // ── Read UNS data from 派遣元 sheet ──
  if (unsSheet && unsSheet.rowCount >= 2) {
    const r = unsSheet.getRow(2);
    result.uns.managerName = cellStr(r, 6);     // 製造業務専門氏名
    result.uns.managerDept = cellStr(r, 5);     // 製造業務専門役職
    result.uns.managerPhone = cellStr(r, 4);    // TEL
    result.uns.managerAddress = cellStr(r, 3);  // 住所
    result.uns.complaintName = cellStr(r, 9);   // 苦情氏名
    result.uns.complaintDept = cellStr(r, 7);   // 苦情部署
    result.uns.complaintPhone = cellStr(r, 8);  // 苦情TEL
  }

  // ── Pass 1: Collect unique dates ──
  const dateSet = new Set<string>();
  for (let r = 2; r <= mainSheet.rowCount; r++) {
    const dateStr = parseDate(mainSheet.getRow(r).getCell(COL.DATE).value);
    if (dateStr) dateSet.add(dateStr);
  }
  const allDates = [...dateSet].sort();
  result.availableDates = allDates;
  if (allDates.length === 0) return result;

  const selectedDate = targetDate && allDates.includes(targetDate)
    ? targetDate
    : allDates[allDates.length - 1];
  result.selectedDate = selectedDate;
  result.period = formatPeriod(selectedDate);

  // ── Pass 2: Parse rows ──
  const addressMap = new Map<string, string>();
  const seenKeys = new Set<string>();

  // Also read UNS data from first matching row (cols 17-24) as fallback
  let unsFromRow = false;

  for (let r = 2; r <= mainSheet.rowCount; r++) {
    const row = mainSheet.getRow(r);
    const dateStr = parseDate(row.getCell(COL.DATE).value);
    if (dateStr !== selectedDate) continue;

    const factoryName = cellStr(row, COL.FACTORY);
    if (!factoryName) continue;

    const rawDept = cellStr(row, COL.DEPT) ?? "";
    const department = normalizeDept(rawDept);
    const lineName = cellStr(row, COL.LINE);
    const managerName = cellStr(row, COL.MANAGER_NAME);
    const managerRole = cellStr(row, COL.MANAGER_ROLE);
    const supervisorName = cellStr(row, COL.SUPERVISOR);
    const supervisorRole = cellStr(row, COL.SUPERVISOR_ROLE);
    const phone = cellStr(row, COL.PHONE);
    const workAddress = cellStr(row, COL.WORK_ADDRESS);
    const jobDescription = cellStr(row, COL.JOB_DESC);
    const conflictDate = parseDate(row.getCell(COL.CONFLICT_DATE).value);

    // Complaint handler (派遣先 side)
    const complaintName = cellStr(row, COL.COMPLAINT_NAME);
    const complaintDept = cellStr(row, COL.COMPLAINT_DEPT);
    const complaintPhone = cellStr(row, COL.COMPLAINT_PHONE);
    if (complaintName && !result.complaint.name) {
      result.complaint.name = complaintName;
      result.complaint.dept = complaintDept;
      result.complaint.phone = complaintPhone;
    }

    // UNS data fallback from row (in case 派遣元 sheet is missing)
    if (!unsFromRow && !result.uns.managerName) {
      result.uns.managerName = cellStr(row, COL.UNS_MGR_NAME);
      result.uns.managerDept = cellStr(row, COL.UNS_MGR_ROLE);
      result.uns.managerPhone = cellStr(row, COL.UNS_PHONE);
      result.uns.managerAddress = cellStr(row, COL.UNS_ADDRESS);
      result.uns.complaintName = cellStr(row, COL.UNS_COMPLAINT_NAME);
      result.uns.complaintDept = cellStr(row, COL.UNS_COMPLAINT_DEPT);
      result.uns.complaintPhone = cellStr(row, COL.UNS_PHONE);
      unsFromRow = true;
    }

    if (ADMIN_DEPARTMENTS.has(factoryName)) continue;

    const realFactoryName = resolveRealFactory(factoryName, workAddress);

    if (workAddress && !addressMap.has(realFactoryName)) {
      addressMap.set(realFactoryName, workAddress);
    }

    const dedupeKey = `${realFactoryName}|${department}|${lineName ?? ""}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    result.factories.push({
      factoryName: realFactoryName,
      department,
      lineName,
      hakensakiManagerName: managerName,
      hakensakiManagerDept: department,
      hakensakiManagerRole: managerRole,
      supervisorName,
      supervisorDept: lineName,
      supervisorRole,
      phone,
      address: workAddress,
      conflictDate,
      jobDescription,
    });
  }

  result.addresses = Object.fromEntries(addressMap);
  return result;
}

