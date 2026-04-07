/**
 * Business logic for batch contract operations.
 * Extracted from routes/contracts-batch.ts — analysis, grouping, and creation logic.
 */
import crypto from "node:crypto";
import { db, sqlite } from "../db/index.js";
import {
  contracts,
  contractEmployees,
  auditLog,
  employees,
  factories,
  clientCompanies,
} from "../db/schema.js";
import { inArray, eq } from "drizzle-orm";
import { generateContractNumber } from "./contract-number.js";
import {
  calculateContractDate,
  calculateNotificationDate,
  toLocalDateStr,
} from "./contract-dates.js";
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
} from "./batch-helpers.js";

// ─── Re-export types that routes need ────────────────────────────────
export type { AnalysisResult, AnalysisLine, SkipRecord };

// ─── Mid-Hires types ────────────────────────────────────────────────

export interface MidHiresLine {
  factory: Awaited<ReturnType<typeof buildBatchContext>>["targetFactories"][number];
  contractStartDate: string;
  contractEndDate: string;
  totalEmployees: number;
  totalContracts: number;
  rateGroups: Array<{
    rate: number;
    employeeCount: number;
    overtimeRate: number | null;
    nightShiftRate: number | null;
    holidayRate: number | null;
    employees: Array<{
      id: number;
      fullName: string | null;
      employeeNumber: string | null;
      billingRate: number | null;
      hourlyRate: number | null;
      visaExpiry: string | null;
      nationality: string | null;
      effectiveHireDate: string;
    }>;
  }>;
  workStartTime: string | null;
  workEndTime: string | null;
  participationRate: number;
  isExempt: boolean;
  exemptionReason: string | null;
}

export interface MidHiresResult {
  lines: MidHiresLine[];
  skipped: SkipRecord[];
}

// ─── By-IDs types ───────────────────────────────────────────────────

export type ByIdsGroup = {
  groupKey: string;
  factoryId: number;
  factoryName: string | null;
  department: string | null;
  lineName: string | null;
  companyId: number;
  companyName: string;
  billingRate: number;
  startDate: string;
  endDate: string;
  employees: {
    id: number;
    employeeNumber: string;
    clientEmployeeId: string | null;
    fullName: string;
    katakanaName: string | null;
    hireDate: string | null;
    billingRate: number | null;
    hourlyRate: number | null;
  }[];
};

// ─── Result types for batch creation ────────────────────────────────

export interface BatchCreateResult {
  id: number;
  contractNumber: string;
  factoryName: string | null;
  department: string | null;
  lineName: string | null;
  hourlyRate: number;
  employees: number;
  employeeNames: (string | null)[];
  endDate: string;
}

export interface HiresCreateResult {
  id: number;
  contractNumber: string;
  factoryName: string | null;
  department: string | null;
  lineName: string | null;
  hourlyRate: number;
  startDate: string;
  endDate: string;
  employees: { id: number; fullName: string | null; individualStartDate: string | undefined }[];
  employeeCount: number;
}

// ═══════════════════════════════════════════════════════════════════════
// Analysis functions
// ═══════════════════════════════════════════════════════════════════════

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

/** Analyze mid-term hires: employees hired within an existing contract period */
export async function analyzeMidHires(
  companyId: number,
  factoryIds: number[] | undefined,
  startDate: string,
  endDate: string,
): Promise<MidHiresResult> {
  const today = toLocalDateStr(new Date());
  const { targetFactories } = await buildBatchContext(companyId, startDate, factoryIds);
  const lines: MidHiresLine[] = [];
  const skipped: SkipRecord[] = [];

  const allFactoryIds = targetFactories.map((f) => f.id);
  const empsByFactory = await getActiveEmployeesByFactories(allFactoryIds);

  for (const factory of targetFactories) {
    const factoryEmps = empsByFactory.get(factory.id) ?? [];

    // Filter: employees hired between startDate and today (inclusive)
    const eligible = factoryEmps.filter((emp) => {
      const hireDate = emp.actualHireDate || emp.hireDate;
      if (!hireDate) return false;
      return hireDate >= startDate && hireDate <= today;
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
        effectiveHireDate: emp.actualHireDate || emp.hireDate || startDate,
      })),
    }));

    lines.push({
      factory,
      contractStartDate: startDate,
      contractEndDate: endDate,
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

// ═══════════════════════════════════════════════════════════════════════
// Creation functions (transactional)
// ═══════════════════════════════════════════════════════════════════════

/** Build common contract values from a factory record */
function buildContractValues(
  factory: AnalysisLine["factory"],
  rg: { rate: number; overtimeRate: number; nightShiftRate: number; holidayRate: number },
  params: {
    companyId: number;
    startDate: string;
    endDate: string;
    contractDate: string;
    notificationDate: string;
    contractNumber: string;
    workStartTime: string;
    workEndTime: string;
    notes: string;
  },
) {
  return {
    contractNumber: params.contractNumber,
    status: "active" as const,
    companyId: params.companyId,
    factoryId: factory.id,
    startDate: params.startDate,
    endDate: params.endDate,
    contractDate: params.contractDate,
    notificationDate: params.notificationDate,
    workDays: factory.workDays || "",
    workStartTime: params.workStartTime,
    workEndTime: params.workEndTime,
    breakMinutes: factory.breakTime || 60,
    supervisorName: factory.supervisorName || "",
    supervisorDept: factory.supervisorDept || "",
    supervisorPhone: factory.supervisorPhone || "",
    complaintHandlerClient: factory.complaintClientName || "",
    complaintHandlerUns: factory.complaintUnsName || "",
    hakenmotoManager: factory.managerUnsName || "",
    safetyMeasures: "派遣先責任者の指示に従い安全衛生に関する法令を遵守する",
    terminationMeasures: "契約期間中に契約を解除する場合は、30日以上前に予告する",
    jobDescription: factory.jobDescription || "",
    responsibilityLevel: "指示を受けて行う",
    overtimeMax: factory.overtimeHours || "",
    welfare: "派遣先の福利厚生施設の利用可",
    isKyoteiTaisho: true,
    hourlyRate: rg.rate,
    overtimeRate: rg.overtimeRate,
    nightShiftRate: rg.nightShiftRate,
    holidayRate: rg.holidayRate,
    notes: params.notes,
  };
}

/** Execute standard batch creation inside a transaction */
export function executeBatchCreate(
  companyId: number,
  startDate: string,
  lines: AnalysisResult["lines"],
  skipped: SkipRecord[],
): { created: BatchCreateResult[]; skipped: SkipRecord[] } {
  // Filter out lines with duplicates
  const creatableLines = lines.filter((line) => {
    if (!line.duplicates || line.duplicates.length === 0) {
      return true;
    }
    skipped.push(createSkipRecord(line.factory, `重複契約あり(${line.duplicates.length}件)`));
    return false;
  });

  const contractDate = calculateContractDate(startDate);
  const notificationDate = calculateNotificationDate(startDate);
  const operationId = crypto.randomUUID();

  const created = sqlite.transaction(() => {
    const results: BatchCreateResult[] = [];

    for (const line of creatableLines) {
      const factory = line.factory;
      const effectiveEndDate = line.effectiveEndDate;

      for (const rg of line.rateGroups) {
        const contractNumber = generateContractNumber(startDate);
        const values = buildContractValues(factory, rg, {
          companyId,
          startDate,
          endDate: effectiveEndDate,
          contractDate,
          notificationDate,
          contractNumber,
          workStartTime: line.workStartTime,
          workEndTime: line.workEndTime,
          notes: `一括作成`,
        });

        const contract = db.insert(contracts).values(values).returning().get();

        const assignments = rg.employees.map((emp) => ({
          contractId: contract.id,
          employeeId: emp.id,
          hourlyRate: emp.billingRate ?? emp.hourlyRate ?? rg.rate,
        }));
        db.insert(contractEmployees).values(assignments).run();

        db.insert(auditLog).values({
          action: "create",
          entityType: "contract",
          entityId: contract.id,
          detail: `一括作成: ${contractNumber} (${factory.factoryName} ${factory.lineName || ""}, ¥${rg.rate}/h, ${rg.employeeCount}名)`,
          userName: "system",
          operationId,
        }).run();

        results.push({
          id: contract.id,
          contractNumber: contract.contractNumber,
          factoryName: factory.factoryName,
          department: factory.department,
          lineName: factory.lineName,
          hourlyRate: rg.rate,
          employees: rg.employeeCount,
          employeeNames: rg.employees.map((e) => e.fullName),
          endDate: effectiveEndDate,
        });
      }
    }

    db.insert(auditLog).values({
      action: "create",
      entityType: "contract",
      entityId: 0,
      detail: `一括作成完了: ${results.length}件の契約を作成 (会社ID: ${companyId}, ${startDate})`,
      userName: "system",
      operationId,
    }).run();

    return results;
  })();

  return { created, skipped };
}

/** Execute new-hires batch creation inside a transaction */
export function executeNewHiresCreate(
  companyId: number,
  hireDateFrom: string,
  hireDateTo: string,
  lines: AnalysisResult["lines"],
): HiresCreateResult[] {
  const operationId = crypto.randomUUID();

  return sqlite.transaction(() => {
    const results: HiresCreateResult[] = [];

    for (const line of lines) {
      const factory = line.factory;

      for (const rg of line.rateGroups) {
        const earliestHire = rg.employees
          .map((e) => e.effectiveHireDate)
          .sort()[0]!;

        const contractDate = calculateContractDate(earliestHire);
        const notificationDate = calculateNotificationDate(earliestHire);
        const contractNumber = generateContractNumber(earliestHire);

        const values = buildContractValues(factory, rg, {
          companyId,
          startDate: earliestHire,
          endDate: line.effectiveEndDate,
          contractDate,
          notificationDate,
          contractNumber,
          workStartTime: line.workStartTime,
          workEndTime: line.workEndTime,
          notes: `新規入社一括作成 (${hireDateFrom}～${hireDateTo})`,
        });

        const contract = db.insert(contracts).values(values).returning().get();

        const assignments = rg.employees.map((emp) => ({
          contractId: contract.id,
          employeeId: emp.id,
          hourlyRate: emp.billingRate ?? emp.hourlyRate ?? rg.rate,
          individualStartDate: emp.effectiveHireDate,
          individualEndDate: line.effectiveEndDate,
          isIndefinite: false,
        }));
        db.insert(contractEmployees).values(assignments).run();

        db.insert(auditLog).values({
          action: "create",
          entityType: "contract",
          entityId: contract.id,
          detail: `新規入社一括: ${contractNumber} (${factory.factoryName} ${factory.lineName || ""}, ¥${rg.rate}/h, ${rg.employeeCount}名, 入社日${hireDateFrom}～${hireDateTo})`,
          userName: "system",
          operationId,
        }).run();

        results.push({
          id: contract.id,
          contractNumber: contract.contractNumber,
          factoryName: factory.factoryName,
          department: factory.department,
          lineName: factory.lineName,
          hourlyRate: rg.rate,
          startDate: earliestHire,
          endDate: line.effectiveEndDate,
          employees: rg.employees.map((e) => ({
            id: e.id,
            fullName: e.fullName,
            individualStartDate: e.effectiveHireDate,
          })),
          employeeCount: rg.employeeCount,
        });
      }
    }

    db.insert(auditLog).values({
      action: "create",
      entityType: "contract",
      entityId: 0,
      detail: `新規入社一括作成完了: ${results.length}件 (会社ID: ${companyId}, 入社日${hireDateFrom}～${hireDateTo})`,
      userName: "system",
      operationId,
    }).run();

    return results;
  })();
}

/** Execute mid-hires batch creation inside a transaction */
export function executeMidHiresCreate(
  companyId: number,
  lines: MidHiresLine[],
): HiresCreateResult[] {
  const operationId = crypto.randomUUID();

  return sqlite.transaction(() => {
    const results: HiresCreateResult[] = [];

    for (const line of lines) {
      const factory = line.factory;

      for (const rg of line.rateGroups) {
        const earliestHire = rg.employees
          .map((e) => e.effectiveHireDate)
          .sort()[0]!;

        const contractDate = calculateContractDate(earliestHire);
        const notificationDate = calculateNotificationDate(earliestHire);
        const contractNumber = generateContractNumber(earliestHire);

        const contract = db.insert(contracts).values({
          contractNumber,
          status: "active",
          companyId,
          factoryId: factory.id,
          startDate: earliestHire,
          endDate: line.contractEndDate,
          contractDate,
          notificationDate,
          workDays: factory.workDays || "",
          workStartTime: line.workStartTime,
          workEndTime: line.workEndTime,
          breakMinutes: factory.breakTime || 60,
          supervisorName: factory.supervisorName || "",
          supervisorDept: factory.supervisorDept || "",
          supervisorPhone: factory.supervisorPhone || "",
          complaintHandlerClient: factory.complaintClientName || "",
          complaintHandlerUns: factory.complaintUnsName || "",
          hakenmotoManager: factory.managerUnsName || "",
          safetyMeasures: "派遣先責任者の指示に従い安全衛生に関する法令を遵守する",
          terminationMeasures: "契約期間中に契約を解除する場合は、30日以上前に予告する",
          jobDescription: factory.jobDescription || "",
          responsibilityLevel: "指示を受けて行う",
          overtimeMax: factory.overtimeHours || "",
          welfare: "派遣先の福利厚生施設の利用可",
          isKyoteiTaisho: true,
          hourlyRate: rg.rate,
          overtimeRate: rg.overtimeRate,
          nightShiftRate: rg.nightShiftRate,
          holidayRate: rg.holidayRate,
          notes: `途中入社一括作成`,
        }).returning().get();

        const assignments = rg.employees.map((emp) => ({
          contractId: contract.id,
          employeeId: emp.id,
          hourlyRate: emp.billingRate ?? emp.hourlyRate ?? rg.rate,
          individualStartDate: emp.effectiveHireDate,
          individualEndDate: line.contractEndDate,
          isIndefinite: false,
        }));
        db.insert(contractEmployees).values(assignments).run();

        db.insert(auditLog).values({
          action: "create",
          entityType: "contract",
          entityId: contract.id,
          detail: `途中入社一括: ${contractNumber} (${factory.factoryName} ${factory.lineName || ""}, ¥${rg.rate}/h, ${rg.employeeCount}名)`,
          userName: "system",
          operationId,
        }).run();

        results.push({
          id: contract.id,
          contractNumber: contract.contractNumber,
          factoryName: factory.factoryName,
          department: factory.department,
          lineName: factory.lineName,
          hourlyRate: rg.rate,
          startDate: earliestHire,
          endDate: line.contractEndDate,
          employees: rg.employees.map((e) => ({
            id: e.id,
            fullName: e.fullName,
            individualStartDate: e.effectiveHireDate,
          })),
          employeeCount: rg.employeeCount,
        });
      }
    }

    db.insert(auditLog).values({
      action: "create",
      entityType: "contract",
      entityId: 0,
      detail: `途中入社一括作成完了: ${results.length}件 (会社ID: ${companyId})`,
      userName: "system",
      operationId,
    }).run();

    return results;
  })();
}
