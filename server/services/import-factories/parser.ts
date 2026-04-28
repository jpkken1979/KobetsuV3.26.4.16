/**
 * Excel parsing for factory import (TBKaisha).
 * Pure transformation: Excel row → data structure. No business logic.
 */
import { normalizeWidth } from "../import-utils.js";
import type { NewFactory } from "../../db/schema.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extracts the N-th shift time (HH:MM～HH:MM) from workHours text. */
export function deriveShiftTime(workHoursText: string, index: number): string | null {
  if (!workHoursText) return null;
  const re = /(\d{1,2})[時:](\d{2})分?\s*[～~ー-]\s*(\d{1,2})[時:](\d{2})/g;
  let match;
  let i = 0;
  while ((match = re.exec(workHoursText)) !== null) {
    if (i === index) {
      return `${match[1].padStart(2, "0")}:${match[2]}～${match[3].padStart(2, "0")}:${match[4]}`;
    }
    i++;
  }
  return null;
}

/** Normalizes a date value (Date, "2028/12/15", or ISO) to "YYYY-MM-DD". */
export function normalizeDateValue(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split("T")[0];
  const s = String(val).trim();
  if (!s) return null;
  const slashMatch = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) return `${slashMatch[1]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[3].padStart(2, "0")}`;
  return s;
}

/** Builds a factory data object from a normalized Excel row. */
export function buildFactoryData(
  row: Record<string, unknown>,
  companyId: number,
): NewFactory {
  const parseNum = (v: unknown) => {
    const n = parseFloat(String(v));
    return Number.isNaN(n) ? null : n;
  };
  const parseIntVal = (v: unknown) => {
    const n = parseInt(String(v), 10);
    return Number.isNaN(n) ? null : n;
  };
  const s = (key: string) => String(row[key] || "").trim() || null;
  const workHoursRaw = s("就業時間") || s("workHours") || "";

  return {
    companyId,
    factoryName: s("工場名") || s("factoryName") || "",
    department: s("部署") || s("department") || null,
    lineName: s("ライン名") || s("lineName") || null,
    address: s("住所") || s("address") || null,
    phone: s("TEL") || s("phone") || null,
    supervisorDept: s("指揮命令者部署") || s("supervisorDept") || null,
    supervisorName: s("指揮命令者氏名") || s("supervisorName") || null,
    supervisorPhone: s("指揮命令者TEL") || s("supervisorPhone") || null,
    supervisorRole: s("指揮命令者役職") || s("supervisorRole") || null,
    complaintClientDept: s("苦情処理(派遣先)部署") || s("complaintClientDept") || null,
    complaintClientName: s("苦情処理(派遣先)氏名") || s("complaintClientName") || null,
    complaintClientPhone: s("苦情処理(派遣先)TEL") || s("complaintClientPhone") || null,
    complaintUnsDept: s("苦情処理(派遣元)部署") || s("complaintUnsDept") || null,
    complaintUnsName: s("苦情処理(派遣元)氏名") || s("complaintUnsName") || null,
    complaintUnsPhone: s("苦情処理(派遣元)TEL") || s("complaintUnsPhone") || null,
    complaintUnsAddress: s("苦情処理(派遣元)所在地") || s("complaintUnsAddress") || null,
    managerUnsDept: s("派遣元責任者部署") || s("managerUnsDept") || null,
    managerUnsName: s("派遣元責任者氏名") || s("managerUnsName") || null,
    managerUnsPhone: s("派遣元責任者TEL") || s("managerUnsPhone") || null,
    managerUnsAddress: s("派遣元責任者所在地") || s("managerUnsAddress") || null,
    hakensakiManagerDept: s("派遣先責任者部署") || s("hakensakiManagerDept") || null,
    hakensakiManagerName: s("派遣先責任者氏名") || s("hakensakiManagerName") || null,
    hakensakiManagerPhone: s("派遣先責任者TEL") || s("hakensakiManagerPhone") || null,
    hakensakiManagerRole: s("派遣先責任者役職") || s("hakensakiManagerRole") || null,
    jobDescription: s("仕事内容") || s("jobDescription") || null,
    shiftPattern: s("シフト") || s("shiftPattern") || null,
    workHours: workHoursRaw || null,
    workHoursDay: s("昼勤時間") || s("workHoursDay") || deriveShiftTime(workHoursRaw, 0) || null,
    workHoursNight: s("夜勤時間") || s("workHoursNight") || deriveShiftTime(workHoursRaw, 1) || null,
    breakTimeDay: s("休憩時間") || s("breakTimeDay") || null,
    breakTimeNight: s("夜勤休憩") || s("breakTimeNight") || null,
    breakTime: parseIntVal(row["休憩(分)"] ?? row.breakTime),
    overtimeHours: s("時間外") || s("overtimeHours") || null,
    overtimeOutsideDays: s("就業日外労働") || s("overtimeOutsideDays") || null,
    workDays: s("就業日") || s("workDays") || null,
    hourlyRate: parseNum(row["単価"] ?? row.hourlyRate),
    conflictDate: normalizeDateValue(row["抵触日"] ?? row.conflictDate),
    contractPeriod: s("契約期間") || s("contractPeriod") || null,
    calendar: s("カレンダー") || s("calendar") || null,
    // closingDay/paymentDay: el campo *Text es la fuente de verdad ("当月末",
    // "翌月20日"). Si el Excel solo provee numérico, derivamos el texto como
    // `${n}日` para no perder el dato. Ver A-1 en auditoría 2026-04-28.
    closingDay: parseIntVal(row["締め日"] ?? row.closingDay),
    closingDayText:
      s("締め日テキスト") ||
      s("closingDayText") ||
      (() => {
        const n = parseIntVal(row["締め日"] ?? row.closingDay);
        return n != null ? `${n}日` : null;
      })(),
    paymentDay: parseIntVal(row["支払日"] ?? row.paymentDay),
    paymentDayText:
      s("支払日テキスト") ||
      s("paymentDayText") ||
      (() => {
        const n = parseIntVal(row["支払日"] ?? row.paymentDay);
        return n != null ? `${n}日` : null;
      })(),
    bankAccount: s("銀行口座") || s("bankAccount") || null,
    timeUnit: s("時間単位") || s("timeUnit") || null,
    workerClosingDay: s("作業者締め日") || s("workerClosingDay") || null,
    workerPaymentDay: s("作業者支払日") || s("workerPaymentDay") || null,
    workerCalendar: s("作業者カレンダー") || s("workerCalendar") || null,
    agreementPeriodEnd: s("当該協定期間") || s("agreementPeriodEnd") || null,
    explainerName: s("説明者") || s("explainerName") || null,
    hasRobotTraining: (() => {
      const raw = row["産業用ロボット特別教育"] ?? row.hasRobotTraining;
      if (raw == null || raw === "") return null;
      const val = String(raw).trim().toLowerCase();
      return val === "1" || val === "true" || val === "○";
    })(),
    updatedAt: new Date().toISOString(),
  };
}

/** Builds a company info record from Sheet 2 (企業情報) row. */
export function buildCompanyInfo(
  row: Record<string, unknown>,
): {
  address: string | null;
  phone: string | null;
  representative: string | null;
  nameKana: string | null;
  shortName: string | null;
} {
  const s = (key: string) => String(row[key] || "").trim() || null;
  return {
    address: s("住所") || s("address") || null,
    phone: s("TEL") || s("phone") || null,
    representative: s("代表者") || s("representative") || null,
    nameKana: s("会社名カナ") || s("nameKana") || null,
    shortName: s("略称") || s("shortName") || null,
  };
}

/**
 * Generates strict matching key for a factory.
 * Format: companyId|factoryName|department|lineName
 */
export function factoryKey(cId: number, fn: string, dept: string, ln: string): string {
  return `${cId}|${normalizeWidth(fn || "")}|${normalizeWidth(dept || "")}|${normalizeWidth(ln || "")}`;
}

/**
 * Generates relaxed matching key (ignores department).
 * Format: companyId|factoryName|lineName
 */
export function relaxedKey(cId: number, fn: string, ln: string): string {
  return `${cId}|${normalizeWidth(fn || "")}|${normalizeWidth(ln || "")}`;
}

/** Normalizes a company name for lookup. */
export { normalizeCompanyName } from "../import-utils.js";