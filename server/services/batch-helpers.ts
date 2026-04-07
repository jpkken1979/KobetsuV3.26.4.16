/**
 * Shared helpers for batch contract analysis (used by analyzeBatch & analyzeNewHires).
 * Eliminates duplicated logic between the two analysis paths.
 */
import { db } from "../db/index.js";
import { factories, employees, contracts } from "../db/schema.js";
import { eq, and, ne, lte, gte, inArray } from "drizzle-orm";
import { toLocalDateStr } from "./contract-dates.js";
import type { Factory, Employee } from "../db/schema.js";

// ─── Types ────────────────────────────────────────────────────────────

export interface RateGroup {
  rate: number;
  employees: (Employee & { effectiveHireDate?: string })[];
  employeeCount: number;
  overtimeRate: number;
  nightShiftRate: number;
  holidayRate: number;
  sixtyHourRate: number;
}

export interface AnalysisLine {
  factory: Factory;
  effectiveEndDate: string;
  capped?: boolean;
  autoCalculated?: boolean;
  contractPeriod?: string | null;
  conflictDate?: string | null;
  rateGroups: RateGroup[];
  totalEmployees: number;
  totalContracts: number;
  duplicates?: DuplicateInfo[];
  workStartTime: string;
  workEndTime: string;
  participationRate?: number;
  isExempt?: boolean;
  exemptionReason?: string;
}

export interface DuplicateInfo {
  id: number;
  contractNumber: string;
  startDate: string;
  endDate: string;
  status: string;
  employeeCount: number;
}

export interface SkipRecord {
  factoryId: number;
  factoryName: string;
  department: string | null;
  lineName: string | null;
  reason: string;
}

export interface AnalysisResult {
  lines: AnalysisLine[];
  skipped: SkipRecord[];
}

// ─── Regex (pre-compiled) ────────────────────────────────────────────

// Match patterns: "7時00分～15時30分", "7:00～15:30", "07:00~15:30", "7時～15時30分"
const WORK_HOURS_REGEX = /(\d{1,2})[時:](\d{1,2})分?[～~ー-](\d{1,2})[時:](\d{1,2})/;
// Also match simplified patterns like "7時～15時" (no minutes)
const WORK_HOURS_SIMPLE_REGEX = /(\d{1,2})時[～~ー-](\d{1,2})時/;

// ─── Shared functions ────────────────────────────────────────────────

/** Get target factories for a company, optionally filtered by IDs */
export async function getTargetFactories(companyId: number, factoryIds?: number[]): Promise<Factory[]> {
  const all = await db.query.factories.findMany({
    where: and(eq(factories.companyId, companyId), eq(factories.isActive, true)),
  });
  if (factoryIds && factoryIds.length > 0) {
    return all.filter((f) => factoryIds.includes(f.id));
  }
  return all;
}

/** Calculate endDate per factory based on its contractPeriod setting */
export function calculateEndDateForFactory(factory: Factory, startDate: string, globalEndDate?: string): string {
  const period = factory.contractPeriod;
  let endDate: string;

  if (period === "teishokubi" && factory.conflictDate) {
    endDate = factory.conflictDate;
  } else if (period === "1month" || period === "3months" || period === "6months" || period === "1year") {
    // Parse as local date to avoid UTC timezone issues
    const [y, m, d] = startDate.split("-").map(Number);
    const start = new Date(y, m - 1, d);
    if (Number.isNaN(start.getTime())) return globalEndDate || startDate;
    const months = period === "1month" ? 1 : period === "3months" ? 3 : period === "6months" ? 6 : 12;
    start.setMonth(start.getMonth() + months);
    start.setDate(start.getDate() - 1);
    endDate = toLocalDateStr(start);
  } else {
    endDate = globalEndDate || startDate;
  }

  // Always cap at conflictDate if it exists and is earlier
  if (factory.conflictDate && endDate > factory.conflictDate) {
    endDate = factory.conflictDate;
  }

  return endDate;
}

/** Parse work hours from factory workHours string.
 *  Supports: "7時00分～15時30分", "7:00～15:30", "7時～15時", multi-shift (takes first match)
 */
export function parseWorkHours(workHoursStr: string | null): { workStartTime: string; workEndTime: string } {
  if (!workHoursStr) return { workStartTime: "", workEndTime: "" };

  // Try full pattern first (with minutes)
  const m = workHoursStr.match(WORK_HOURS_REGEX);
  if (m) {
    return {
      workStartTime: `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}`,
      workEndTime: `${m[3].padStart(2, "0")}:${m[4].padStart(2, "0")}`,
    };
  }

  // Try simplified pattern (hours only, no minutes)
  const s = workHoursStr.match(WORK_HOURS_SIMPLE_REGEX);
  if (s) {
    return {
      workStartTime: `${s[1].padStart(2, "0")}:00`,
      workEndTime: `${s[2].padStart(2, "0")}:00`,
    };
  }

  return { workStartTime: "", workEndTime: "" };
}

/** Calculate labor participation rate (actual work / total elapsed time) */
export function calculateParticipation(workHoursStr: string | null, breakMins: number | null): number {
  if (!workHoursStr) return 0;
  const { workStartTime, workEndTime } = parseWorkHours(workHoursStr);
  if (!workStartTime || !workEndTime) return 0;

  const [startH, startM] = workStartTime.split(":").map(Number);
  const [endH, endM] = workEndTime.split(":").map(Number);
  let totalMins = endH * 60 + endM - (startH * 60 + startM);
  if (totalMins < 0) totalMins += 24 * 60; // Handles night shifts

  if (totalMins <= 0) return 0;
  const actualWork = totalMins - (breakMins || 0);
  return actualWork / totalMins;
}

/** Check if a factory is exempt from dispatch contracts (e.g. Ukeoi lines) */
export function checkExemption(factory: Factory): { isExempt: boolean; reason?: string } {
  const fName = factory.factoryName || "";
  const dept = factory.department || "";
  const line = factory.lineName || "";

  // 1. 高雄工業岡山工場 (Always Ukeoi)
  if (fName.includes("高雄工業岡山工場") || fName.includes("岡山工場")) {
    return { isExempt: true, reason: "請負 (高雄工業岡山工場)" };
  }

  // 2. 日清食品 (Specific departments)
  if (fName.includes("日清食品") && (dept.includes("特定") || dept.includes("請負") || dept.includes("Ukeoi"))) {
    return { isExempt: true, reason: "請負 (日清食品)" };
  }

  // 3. その他請負 (General pattern)
  if (dept.includes("請負") || line.includes("請負") || dept.includes("Ukeoi") || line.includes("Ukeoi")) {
    return { isExempt: true, reason: "請負 (Department/Line)" };
  }

  return { isExempt: false };
}

/** Group employees by their effective billing rate */
export function groupEmployeesByRate<T extends { billingRate: number | null; hourlyRate: number | null }>(
  emps: T[],
  fallbackRate: number | null,
): Map<number, T[]> {
  const rateGroups = new Map<number, T[]>();
  for (const emp of emps) {
    const rate = emp.billingRate ?? emp.hourlyRate ?? fallbackRate ?? 0;
    if (rate === 0) continue;
    if (!rateGroups.has(rate)) rateGroups.set(rate, []);
    rateGroups.get(rate)!.push(emp);
  }
  return rateGroups;
}

/** Convert rate groups Map to array with calculated OT/holiday rates */
export function buildRateGroupList<T>(rateGroups: Map<number, T[]>): RateGroup[] {
  return Array.from(rateGroups.entries()).map(([rate, emps]) => ({
    rate,
    employees: emps as RateGroup["employees"],
    employeeCount: emps.length,
    overtimeRate: Math.round(rate * 1.25),
    nightShiftRate: Math.round(rate * 1.25),
    holidayRate: Math.round(rate * 1.35),
    sixtyHourRate: Math.round(rate * 1.5), // 60時間超割増 — 労基法第37条第1項但書
  }));
}

/** Create a skip record for a factory */
export function createSkipRecord(factory: Factory, reason: string): SkipRecord {
  return {
    factoryId: factory.id,
    factoryName: factory.factoryName,
    department: factory.department,
    lineName: factory.lineName,
    reason,
  };
}

/** Check for existing active contracts that overlap with the given period */
export async function findDuplicateContracts(factoryId: number, startDate: string, endDate: string): Promise<DuplicateInfo[]> {
  const existing = await db.query.contracts.findMany({
    where: and(
      eq(contracts.factoryId, factoryId),
      ne(contracts.status, "cancelled"),
      lte(contracts.startDate, endDate),
      gte(contracts.endDate, startDate),
    ),
    with: { employees: true },
  });
  return existing.map((d) => ({
    id: d.id,
    contractNumber: d.contractNumber,
    startDate: d.startDate,
    endDate: d.endDate,
    status: d.status,
    employeeCount: d.employees?.length || 0,
  }));
}

/** Bulk duplicate check — single query for multiple factories, returns Map<factoryId, DuplicateInfo[]> */
export async function findDuplicateContractsBulk(
  factoryIds: number[],
  startDate: string,
  endDate: string,
): Promise<Map<number, DuplicateInfo[]>> {
  const result = new Map<number, DuplicateInfo[]>();
  if (factoryIds.length === 0) return result;
  const existing = await db.query.contracts.findMany({
    where: and(
      inArray(contracts.factoryId, factoryIds),
      ne(contracts.status, "cancelled"),
      lte(contracts.startDate, endDate),
      gte(contracts.endDate, startDate),
    ),
    with: { employees: true },
  });
  for (const d of existing) {
    if (d.factoryId == null) continue;
    const info: DuplicateInfo = {
      id: d.id,
      contractNumber: d.contractNumber,
      startDate: d.startDate,
      endDate: d.endDate,
      status: d.status,
      employeeCount: d.employees?.length || 0,
    };
    const list = result.get(d.factoryId) ?? [];
    list.push(info);
    result.set(d.factoryId, list);
  }
  return result;
}

export interface BatchContext {
  targetFactories: Factory[];
  startDate: string;
}

/**
 * Builds the common context needed by both analyzeBatch and analyzeNewHires.
 * Fetches active factories for the company and validates the start date.
 */
export async function buildBatchContext(
  companyId: number,
  startDate: string,
  factoryIds?: number[],
): Promise<BatchContext> {
  const targetFactories = await getTargetFactories(companyId, factoryIds);
  return { targetFactories, startDate };
}

/**
 * Bulk version of getActiveEmployees — fetches all active employees for multiple factories
 * in a single query and returns a Map<factoryId, Employee[]>.
 */
export async function getActiveEmployeesByFactories(
  factoryIds: number[],
): Promise<Map<number, Employee[]>> {
  if (factoryIds.length === 0) return new Map();
  const rows = await db.query.employees.findMany({
    where: and(
      inArray(employees.factoryId, factoryIds),
      eq(employees.status, "active"),
    ),
  });
  const map = new Map<number, Employee[]>();
  for (const emp of rows) {
    if (emp.factoryId == null) continue;
    const list = map.get(emp.factoryId) ?? [];
    list.push(emp);
    map.set(emp.factoryId, list);
  }
  return map;
}
