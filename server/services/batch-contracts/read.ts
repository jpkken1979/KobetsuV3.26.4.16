/**
 * Read/analysis functions for batch contracts.
 */
import { db } from "../../db/index.js";
import { employees, factories, clientCompanies } from "../../db/schema.js";
import { inArray, eq } from "drizzle-orm";
import {
  buildBatchContext,
  calculateEndDateForFactory,
  parseWorkHours,
  groupEmployeesByRate,
  buildRateGroupList,
  createSkipRecord,
  findDuplicateContractsBulk,
  getActiveEmployeesByFactories,
  calculateParticipation,
  checkExemption,
  type AnalysisLine,
  type SkipRecord,
  type AnalysisResult,
} from "../batch-helpers.js";

// ─── Re-export types that routes need ────────────────────────────────
export type { AnalysisResult, AnalysisLine, SkipRecord };

// ─── Shared imports for this module ──────────────────────────────────
import {
  toLocalDateStr,
  subtractMonths,
  subtractDays,
} from "../contract-dates.js";
import type { MidHiresLine, ByIdsGroup } from "./types.js";
import type { MidHiresResult } from "./types.js";

/** Shared batch analysis logic (used by both preview and create) */
export async function analyzeBatch(
  companyId: number,
  factoryIds: number[] | undefined,
  startDate: string,
  globalEndDate?: string,
): Promise<AnalysisResult> {
  const { targetFactories } = await buildBatchContext(companyId, startDate, factoryIds);
  const lines: AnalysisLine[] = [];
  const skipped: SkipRecord[] = [];

  const allFactoryIds = targetFactories.map((f) => f.id);
  const empsByFactory = await getActiveEmployeesByFactories(allFactoryIds);

  // Pre-compute end dates and fetch all duplicates in a single bulk query
  const endDateByFactory = new Map<number, string>();
  for (const factory of targetFactories) {
    endDateByFactory.set(factory.id, calculateEndDateForFactory(factory, startDate, globalEndDate));
  }
  const maxEndDate = Array.from(endDateByFactory.values()).reduce((a, b) => (a > b ? a : b), startDate);
  const dupsByFactory = await findDuplicateContractsBulk(allFactoryIds, startDate, maxEndDate);

  for (const factory of targetFactories) {
    const factoryEmps = empsByFactory.get(factory.id) ?? [];
    const effectiveEndDate = endDateByFactory.get(factory.id)!;

    if (factoryEmps.length === 0) {
      skipped.push(createSkipRecord(factory, "社員なし"));
      continue;
    }

    const rateGroups = groupEmployeesByRate(factoryEmps, factory.hourlyRate);
    if (rateGroups.size === 0) {
      skipped.push(createSkipRecord(factory, "単価未設定"));
      continue;
    }

    // Filter bulk duplicates to only those overlapping this factory's specific date range
    const allDups = dupsByFactory.get(factory.id) ?? [];
    const duplicates = allDups.filter((d) => d.startDate <= effectiveEndDate && d.endDate >= startDate);
    const workHours = parseWorkHours(factory.workHours);
    const participationRate = calculateParticipation(factory.workHours, factory.breakTime);
    const exemption = checkExemption(factory);

    const rateGroupList = buildRateGroupList(rateGroups);
    const capped = !!(factory.conflictDate && effectiveEndDate <= factory.conflictDate && (globalEndDate ? globalEndDate > factory.conflictDate : false));
    const autoCalculated = !!factory.contractPeriod;

    lines.push({
      factory,
      effectiveEndDate,
      capped,
      autoCalculated,
      contractPeriod: factory.contractPeriod,
      conflictDate: factory.conflictDate,
      rateGroups: rateGroupList,
      totalEmployees: factoryEmps.length,
      totalContracts: rateGroupList.length,
      duplicates,
      workStartTime: workHours.workStartTime,
      workEndTime: workHours.workEndTime,
      participationRate,
      isExempt: exemption.isExempt,
      exemptionReason: exemption.reason,
    });
  }

  return { lines, skipped };
}

/** Detect new hires by actualHireDate/hireDate within a date range */
export async function analyzeNewHires(
  companyId: number,
  factoryIds: number[] | undefined,
  hireDateFrom: string,
  hireDateTo: string,
  globalEndDate?: string,
): Promise<AnalysisResult> {
  const { targetFactories } = await buildBatchContext(companyId, hireDateFrom, factoryIds);
  const lines: AnalysisLine[] = [];
  const skipped: SkipRecord[] = [];

  const allFactoryIds = targetFactories.map((f) => f.id);
  const empsByFactory = await getActiveEmployeesByFactories(allFactoryIds);

  for (const factory of targetFactories) {
    const factoryEmps = empsByFactory.get(factory.id) ?? [];

    // Filter by hire date range (prefer actualHireDate, fallback to hireDate)
    const newHires = factoryEmps.filter((emp) => {
      const hireRef = emp.actualHireDate || emp.hireDate;
      if (!hireRef) return false;
      return hireRef >= hireDateFrom && hireRef <= hireDateTo;
    });

    if (newHires.length === 0) {
      skipped.push(createSkipRecord(factory, "該当する新規入社者なし"));
      continue;
    }

    // Determine endDate: factory conflictDate > global override > default
    const effectiveEndDate = globalEndDate
      ? (factory.conflictDate && factory.conflictDate < globalEndDate ? factory.conflictDate : globalEndDate)
      : calculateEndDateForFactory(factory, hireDateFrom, undefined);

    const rateGroups = groupEmployeesByRate(newHires, factory.hourlyRate);
    if (rateGroups.size === 0) {
      skipped.push(createSkipRecord(factory, "単価未設定"));
      continue;
    }

    const workHours = parseWorkHours(factory.workHours);
    const workStartTime = workHours.workStartTime;
    const workEndTime = workHours.workEndTime;
    const participationRate = calculateParticipation(factory.workHours, factory.breakTime);
    const exemption = checkExemption(factory);

    // Build rate group list with effectiveHireDate attached to employees
    const rateGroupList = buildRateGroupList(rateGroups).map((rg) => ({
      ...rg,
      employees: rg.employees.map((emp) => ({
        ...emp,
        effectiveHireDate: emp.actualHireDate || emp.hireDate || hireDateFrom,
      })),
    }));

    lines.push({
      factory,
      effectiveEndDate,
      conflictDate: factory.conflictDate,
      rateGroups: rateGroupList,
      totalEmployees: newHires.length,
      totalContracts: rateGroupList.length,
      workStartTime,
      workEndTime,
      participationRate,
      isExempt: exemption.isExempt,
      exemptionReason: exemption.reason,
    });
  }

  return { lines, skipped };
}

/** Analyze mid-term hires: employees hired within the auto-calculated period based on 抵触日 */
export async function analyzeMidHires(params: {
  companyId: number;
  factoryIds?: number[];
  conflictDateOverrides?: Record<string, string>; // factoryId.toString() → "YYYY-MM-DD"
  startDateOverride?: string; // override manual de periodStart
}): Promise<MidHiresResult> {
  const { companyId, factoryIds, conflictDateOverrides = {}, startDateOverride } = params;
  const today = toLocalDateStr(new Date());

  // Cargar empresa para obtener conflictDate y contractPeriod
  const companyRows = await db
    .select({
      id: clientCompanies.id,
      conflictDate: clientCompanies.conflictDate,
      contractPeriod: clientCompanies.contractPeriod,
    })
    .from(clientCompanies)
    .where(eq(clientCompanies.id, companyId));

  const company = companyRows[0];
  if (!company) throw new Error(`Company ${companyId} not found`);

  const { targetFactories } = await buildBatchContext(companyId, today, factoryIds);
  const lines: MidHiresLine[] = [];
  const skipped: SkipRecord[] = [];

  const allFactoryIds = targetFactories.map((f) => f.id);
  const empsByFactory = await getActiveEmployeesByFactories(allFactoryIds);

  for (const factory of targetFactories) {
    // 1. Determinar 抵触日 efectiva: override > fábrica > empresa
    const effectiveConflictDate =
      conflictDateOverrides[String(factory.id)] ??
      factory.conflictDate ??
      company.conflictDate ??
      null;

    if (!effectiveConflictDate) {
      skipped.push(createSkipRecord(factory, "抵触日未設定"));
      continue;
    }

    // 2. contractEnd = effectiveConflictDate - 1 día
    const contractEnd = subtractDays(effectiveConflictDate, 1);

    // 3. periodStart = override manual ?? conflictDate - contractPeriod meses
    const contractPeriod = company.contractPeriod ?? 12;
    const periodStart = startDateOverride ?? subtractMonths(effectiveConflictDate, contractPeriod);

    // 4. Filtrar empleados con hireDate en [periodStart, today]
    const factoryEmps = empsByFactory.get(factory.id) ?? [];
    const eligible = factoryEmps.filter((emp) => {
      const hireDate = emp.actualHireDate ?? emp.hireDate;
      if (!hireDate) return false;
      return hireDate >= periodStart && hireDate <= today;
    });

    if (eligible.length === 0) {
      skipped.push(createSkipRecord(factory, "対象期間内の入社者なし"));
      continue;
    }

    const rateGroups = groupEmployeesByRate(eligible, factory.hourlyRate);
    if (rateGroups.size === 0) {
      skipped.push(createSkipRecord(factory, "単価未設定"));
      continue;
    }

    const workHours = parseWorkHours(factory.workHours);
    const participationRate = calculateParticipation(factory.workHours, factory.breakTime);
    const exemption = checkExemption(factory);

    const rateGroupList = buildRateGroupList(rateGroups).map((rg) => ({
      ...rg,
      employees: rg.employees.map((emp) => ({
        ...emp,
        effectiveHireDate: emp.actualHireDate ?? emp.hireDate ?? periodStart,
      })),
    }));

    lines.push({
      factory,
      contractStartDate: periodStart,
      contractEndDate: contractEnd,
      effectiveConflictDate,
      periodStart,
      totalEmployees: eligible.length,
      totalContracts: rateGroupList.length,
      rateGroups: rateGroupList as MidHiresLine["rateGroups"],
      workStartTime: workHours.workStartTime,
      workEndTime: workHours.workEndTime,
      participationRate,
      isExempt: exemption.isExempt,
      exemptionReason: exemption.reason ?? null,
    });
  }

  return { lines, skipped };
}

/** Group employees by IDs (hakensaki or hakenmoto) for preview-by-ids */
export async function groupEmployeesByIds(
  ids: string[],
  idType: "hakensaki" | "hakenmoto",
  contractStart: string,
  contractEnd: string,
): Promise<{ groups: ByIdsGroup[]; notFoundIds: string[] }> {
  if (ids.length === 0) return { groups: [], notFoundIds: [] };

  const whereClause = idType === "hakensaki"
    ? inArray(employees.clientEmployeeId, ids)
    : inArray(employees.employeeNumber, ids);

  const rows = await db
    .select({
      empId: employees.id,
      employeeNumber: employees.employeeNumber,
      clientEmployeeId: employees.clientEmployeeId,
      fullName: employees.fullName,
      katakanaName: employees.katakanaName,
      hireDate: employees.hireDate,
      billingRate: employees.billingRate,
      hourlyRate: employees.hourlyRate,
      factoryId: employees.factoryId,
      factoryName: factories.factoryName,
      factoryHourlyRate: factories.hourlyRate,
      department: factories.department,
      lineName: factories.lineName,
      companyId: clientCompanies.id,
      companyName: clientCompanies.name,
    })
    .from(employees)
    .leftJoin(factories, eq(employees.factoryId, factories.id))
    .leftJoin(clientCompanies, eq(factories.companyId, clientCompanies.id))
    .where(whereClause);

  // Track which IDs were NOT found
  const foundIds = new Set(rows.map((r) =>
    idType === "hakensaki" ? (r.clientEmployeeId ?? "") : r.employeeNumber
  ));
  const notFoundIds = ids.filter((id) => !foundIds.has(id));

  // Group by (factoryId, billingRate, effectiveStartDate)
  const groupMap = new Map<string, ByIdsGroup>();

  for (const row of rows) {
    if (!row.factoryId || !row.companyId) continue;

    const rate = row.billingRate ?? row.hourlyRate ?? row.factoryHourlyRate ?? 0;

    // Parse Japanese date format (YYYY年MM月DD日) → YYYY-MM-DD for comparison
    let hireDateNorm: string | null = null;
    if (row.hireDate) {
      const m = row.hireDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (m) {
        hireDateNorm = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
      } else {
        hireDateNorm = row.hireDate; // already YYYY-MM-DD
      }
    }

    // effectiveStartDate: if hireDate falls within [contractStart, contractEnd], use it; otherwise use contractStart
    const effectiveStart =
      hireDateNorm && hireDateNorm >= contractStart && hireDateNorm <= contractEnd
        ? hireDateNorm
        : contractStart;

    const key = `${row.factoryId}-${rate}-${effectiveStart}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        groupKey: key,
        factoryId: row.factoryId,
        factoryName: row.factoryName ?? null,
        department: row.department ?? null,
        lineName: row.lineName ?? null,
        companyId: row.companyId,
        companyName: row.companyName ?? "",
        billingRate: rate,
        startDate: effectiveStart,
        endDate: contractEnd,
        employees: [],
      });
    }

    groupMap.get(key)!.employees.push({
      id: row.empId,
      employeeNumber: row.employeeNumber,
      clientEmployeeId: row.clientEmployeeId ?? null,
      fullName: row.fullName,
      katakanaName: row.katakanaName ?? null,
      hireDate: hireDateNorm,
      billingRate: row.billingRate ?? null,
      hourlyRate: row.hourlyRate ?? null,
    });
  }

  return { groups: [...groupMap.values()], notFoundIds };
}