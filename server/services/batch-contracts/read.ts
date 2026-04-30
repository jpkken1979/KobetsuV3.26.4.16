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
  groupEmployeesByLineRate,
  buildRateGroupList,
  createSkipRecord,
  findDuplicateContractsBulk,
  getActiveEmployeesByFactories,
  calculateParticipation,
  checkExemption,
  type AnalysisLine,
  type LineGroup,
  type SkipRecord,
  type AnalysisResult,
} from "../batch-helpers.js";

// ─── Re-export types that routes need ────────────────────────────────
export type { AnalysisResult, AnalysisLine, SkipRecord, LineGroup };

// ─── Shared imports for this module ──────────────────────────────────
import {
  toLocalDateStr,
  subtractMonths,
  subtractDays,
} from "../contract-dates.js";
import type { MidHiresLine, ByIdsGroup } from "./types.js";
import type { MidHiresResult } from "./types.js";
import type {
  SmartBatchEmployee,
  SmartBatchLine,
  SmartBatchResult,
  SmartBatchParams,
} from "./types.js";

/**
 * Normaliza un valor de fecha proveniente de la DB a YYYY-MM-DD.
 * Acepta formatos: "YYYY-MM-DD" (passthrough) o "YYYY年MM月DD日" (legacy seed).
 * Devuelve null si no es parseable.
 */
function normalizeHireDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return null;
}

/** Shared batch analysis logic (used by both preview and create) */
export async function analyzeBatch(
  companyId: number,
  factoryIds: number[] | undefined,
  startDate: string,
  globalEndDate?: string,
  groupByLine?: boolean,
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

    // Choose grouping strategy: by rate only, or by (department, lineName, rate)
    let rateGroupList;
    if (groupByLine) {
      const lineGroups = groupEmployeesByLineRate(factoryEmps, factory.hourlyRate);
      if (lineGroups.length === 0) {
        skipped.push(createSkipRecord(factory, "単価未設定"));
        continue;
      }
      rateGroupList = lineGroups.map((lg) => ({
        rate: lg.rate,
        employees: lg.employees,
        employeeCount: lg.employeeCount,
        overtimeRate: lg.overtimeRate,
        nightShiftRate: lg.nightShiftRate,
        holidayRate: lg.holidayRate,
        sixtyHourRate: lg.sixtyHourRate,
        department: lg.department,
        lineName: lg.lineName,
      }));
    } else {
      const rateGroups = groupEmployeesByRate(factoryEmps, factory.hourlyRate);
      if (rateGroups.size === 0) {
        skipped.push(createSkipRecord(factory, "単価未設定"));
        continue;
      }
      rateGroupList = buildRateGroupList(rateGroups);
    }

    // Filter bulk duplicates to only those overlapping this factory's specific date range
    const allDups = dupsByFactory.get(factory.id) ?? [];
    const duplicates = allDups.filter((d) => d.startDate <= effectiveEndDate && d.endDate >= startDate);
    const workHours = parseWorkHours(factory.workHours);
    const participationRate = calculateParticipation(factory.workHours, factory.breakTime);
    const exemption = checkExemption(factory);

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
  groupByLine?: boolean,
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

    // Choose grouping strategy: by rate only, or by (department, lineName, rate)
    let rateGroupList;
    if (groupByLine) {
      const lineGroups = groupEmployeesByLineRate(newHires, factory.hourlyRate);
      if (lineGroups.length === 0) {
        skipped.push(createSkipRecord(factory, "単価未設定"));
        continue;
      }
      rateGroupList = lineGroups.map((lg) => ({
        rate: lg.rate,
        employees: lg.employees.map((emp) => ({
          ...emp,
          effectiveHireDate: emp.actualHireDate || emp.hireDate || hireDateFrom,
        })),
        employeeCount: lg.employeeCount,
        overtimeRate: lg.overtimeRate,
        nightShiftRate: lg.nightShiftRate,
        holidayRate: lg.holidayRate,
        sixtyHourRate: lg.sixtyHourRate,
        department: lg.department,
        lineName: lg.lineName,
      }));
    } else {
      const rateGroups = groupEmployeesByRate(newHires, factory.hourlyRate);
      if (rateGroups.size === 0) {
        skipped.push(createSkipRecord(factory, "単価未設定"));
        continue;
      }
      rateGroupList = buildRateGroupList(rateGroups).map((rg) => ({
        ...rg,
        employees: rg.employees.map((emp) => ({
          ...emp,
          effectiveHireDate: emp.actualHireDate || emp.hireDate || hireDateFrom,
        })),
      }));
    }

    const workHours = parseWorkHours(factory.workHours);
    const workStartTime = workHours.workStartTime;
    const workEndTime = workHours.workEndTime;
    const participationRate = calculateParticipation(factory.workHours, factory.breakTime);
    const exemption = checkExemption(factory);

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
  groupByLine?: boolean; // if true, group by (department, lineName, rate) instead of just rate
}): Promise<MidHiresResult> {
  const { companyId, factoryIds, conflictDateOverrides = {}, startDateOverride, groupByLine = false } = params;
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

    // Build rate group list: either by rate (default) or by line+rate (groupByLine)
    const rateGroupList = (() => {
      if (groupByLine) {
        // groupEmployeesByLineRate returns LineGroup[], but we need to map to MidHiresLine["rateGroups"]
        const lineGroups = groupEmployeesByLineRate(eligible, factory.hourlyRate);
        return lineGroups.map((lg) => ({
          rate: lg.rate,
          employees: lg.employees.map((emp) => ({
            ...emp,
            effectiveHireDate: emp.actualHireDate ?? emp.hireDate ?? periodStart,
          })),
          employeeCount: lg.employeeCount,
          overtimeRate: lg.overtimeRate,
          nightShiftRate: lg.nightShiftRate,
          holidayRate: lg.holidayRate,
          sixtyHourRate: lg.sixtyHourRate,
        }));
      }
      return buildRateGroupList(rateGroups).map((rg) => ({
        ...rg,
        employees: rg.employees.map((emp) => ({
          ...emp,
          effectiveHireDate: emp.actualHireDate ?? emp.hireDate ?? periodStart,
        })),
      }));
    })();

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

// ─── Smart-Batch: ikkatsu por fábrica con auto-clasificación 継続/途中 ───

/**
 * Analiza una fábrica (o varias) y clasifica cada empleado activo según su
 * 入社日 (effectiveHireDate = actualHireDate ?? hireDate) contra el rango
 * solicitado [globalStartDate, globalEndDate]:
 *
 *   • effectiveHireDate < globalStartDate (o null)   → "continuation" (継続)
 *       contractStart = globalStartDate
 *   • globalStartDate ≤ effectiveHireDate ≤ globalEndDate → "mid-hire" (途中入社者)
 *       contractStart = effectiveHireDate
 *   • effectiveHireDate > globalEndDate              → "future-skip"
 *       no se incluye en la creación, queda en preview como warning
 *
 * En todos los casos contractEnd = globalEndDate. NO aplica cap automático
 * por 抵触日 — si el caller quiere ese cap, lo hace antes de llamar.
 *
 * Empleados sin factoryId asignado (未配属) o con status != "active" no
 * aparecen en el resultado (los filtra getActiveEmployeesByFactories).
 */
export async function analyzeSmartBatch(
  params: SmartBatchParams,
): Promise<SmartBatchResult> {
  const { companyId, factoryIds, globalStartDate, globalEndDate, groupByLine = false } = params;

  if (globalStartDate > globalEndDate) {
    throw new Error("globalStartDate debe ser <= globalEndDate");
  }

  const { targetFactories } = await buildBatchContext(companyId, globalStartDate, factoryIds);
  const lines: SmartBatchLine[] = [];
  const skipped: SkipRecord[] = [];

  const allFactoryIds = targetFactories.map((f) => f.id);
  const empsByFactory = await getActiveEmployeesByFactories(allFactoryIds);

  for (const factory of targetFactories) {
    const factoryEmps = empsByFactory.get(factory.id) ?? [];

    if (factoryEmps.length === 0) {
      skipped.push(createSkipRecord(factory, "社員なし"));
      continue;
    }

    const continuation: SmartBatchEmployee[] = [];
    const midHires: SmartBatchEmployee[] = [];
    const futureSkip: SmartBatchEmployee[] = [];

    for (const emp of factoryEmps) {
      const effectiveHireDate =
        normalizeHireDate(emp.actualHireDate) ?? normalizeHireDate(emp.hireDate);

      // future-skip: hireDate posterior al fin del rango → no se crea contrato
      if (effectiveHireDate && effectiveHireDate > globalEndDate) {
        futureSkip.push({
          id: emp.id,
          fullName: emp.fullName,
          employeeNumber: emp.employeeNumber,
          billingRate: emp.billingRate,
          hourlyRate: emp.hourlyRate,
          effectiveHireDate,
          kind: "future-skip",
          contractStartDate: globalStartDate, // no se usa, pero el tipo lo requiere
          contractEndDate: globalEndDate,
        });
        continue;
      }

      // mid-hire: hireDate dentro del rango → contrato truncado al ingreso
      if (effectiveHireDate && effectiveHireDate >= globalStartDate) {
        midHires.push({
          id: emp.id,
          fullName: emp.fullName,
          employeeNumber: emp.employeeNumber,
          billingRate: emp.billingRate,
          hourlyRate: emp.hourlyRate,
          effectiveHireDate,
          kind: "mid-hire",
          contractStartDate: effectiveHireDate,
          contractEndDate: globalEndDate,
        });
        continue;
      }

      // continuation: hireDate < globalStart o null → contrato del rango completo
      continuation.push({
        id: emp.id,
        fullName: emp.fullName,
        employeeNumber: emp.employeeNumber,
        billingRate: emp.billingRate,
        hourlyRate: emp.hourlyRate,
        effectiveHireDate,
        kind: "continuation",
        contractStartDate: globalStartDate,
        contractEndDate: globalEndDate,
      });
    }

    const totalEligible = continuation.length + midHires.length;
    if (totalEligible === 0) {
      skipped.push(createSkipRecord(factory, "対象期間に該当する社員なし"));
      continue;
    }

    // Estimación de contratos: agrupando por (rate, startDate, endDate) o por (dept, line, rate, startDate, endDate).
    // Replicamos la cadena de prioridad de executeByLineCreate para preview.
    const groupKeys = new Set<string>();
    for (const e of [...continuation, ...midHires]) {
      const rate = e.billingRate ?? e.hourlyRate ?? factory.hourlyRate ?? 0;
      if (!rate) continue; // executeByLineCreate descarta empleados sin rate
      if (groupByLine) {
        // group by (department, lineName, rate, startDate, endDate)
        groupKeys.add(`${factory.department ?? ""}|${factory.lineName ?? ""}|${rate}|${e.contractStartDate}|${e.contractEndDate}`);
      } else {
        groupKeys.add(`${rate}|${e.contractStartDate}|${e.contractEndDate}`);
      }
    }

    lines.push({
      factory,
      globalStartDate,
      globalEndDate,
      continuation,
      midHires,
      futureSkip,
      totalEligible,
      estimatedContracts: groupKeys.size,
    });
  }

  return { lines, skipped };
}