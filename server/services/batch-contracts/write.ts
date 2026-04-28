/**
 * Write functions for batch contracts (transactional creation).
 */
import crypto from "node:crypto";
import { db, sqlite } from "../../db/index.js";
import {
  contracts,
  contractEmployees,
  auditLog,
  employees,
  factories,
} from "../../db/schema.js";
import { inArray, eq } from "drizzle-orm";
import { generateContractNumber } from "../contract-number.js";
import {
  calculateContractDate,
  calculateNotificationDate,
} from "../contract-dates.js";
import {
  createSkipRecord,
  type AnalysisLine,
  type SkipRecord,
  type AnalysisResult,
} from "../batch-helpers.js";
import type {
  BatchCreateResult,
  HiresCreateResult,
  IndividualBatchParams,
  MidHiresLine,
  ByLineParams,
  ByLineGroup,
  ByLineCreateResult,
  SmartBatchLine,
  SmartBatchEmployee,
} from "./types.js";

// ─── Build contract values (shared helper) ───────────────────────────

export type { IndividualBatchParams };

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

// ─── Execute functions ────────────────────────────────────────────────

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
    const res: HiresCreateResult[] = [];

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

        res.push({
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
      detail: `途中入社一括作成完了: ${res.length}件 (会社ID: ${companyId})`,
      userName: "system",
      operationId,
    }).run();

    return res;
  })();
}

/** Creates exactly 1 contract per employee in employeeIds */
export function executeIndividualBatchCreate(
  params: IndividualBatchParams,
): HiresCreateResult[] {
  const { companyId, factoryId, employeeIds, startDate, endDate, billingRate } = params;

  if (employeeIds.length === 0) return [];

  const contractDate = calculateContractDate(startDate);
  const notificationDate = calculateNotificationDate(startDate);
  const operationId = crypto.randomUUID();

  return sqlite.transaction(() => {
    const results: HiresCreateResult[] = [];

    const factory = db
      .select()
      .from(factories)
      .where(eq(factories.id, factoryId))
      .get();

    if (!factory) throw new Error(`Factory ${factoryId} not found`);

    const emps = db
      .select()
      .from(employees)
      .where(inArray(employees.id, employeeIds))
      .all();

    const empMap = new Map(emps.map((e) => [e.id, e]));

    for (const empId of employeeIds) {
      const emp = empMap.get(empId);
      if (!emp) {
        db.insert(auditLog).values({
          action: "create",
          entityType: "contract",
          entityId: 0,
          detail: `個別batch: employee ${empId} not found — skipped`,
          userName: "system",
          operationId,
        }).run();
        continue;
      }

      const effectiveRate = billingRate ?? emp.billingRate ?? emp.hourlyRate ?? factory.hourlyRate ?? 0;
      if (!effectiveRate) {
        db.insert(auditLog).values({
          action: "create",
          entityType: "contract",
          entityId: 0,
          detail: `個別batch: employee ${empId} has no billingRate — skipped`,
          userName: "system",
          operationId,
        }).run();
        continue;
      }

      const contractNumber = generateContractNumber(startDate);

      const contract = db.insert(contracts).values({
        contractNumber,
        status: "active",
        companyId,
        factoryId,
        startDate,
        endDate,
        contractDate,
        notificationDate,
        workDays: factory.workDays || "",
        workStartTime: null,
        workEndTime: null,
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
        hourlyRate: effectiveRate,
        overtimeRate: null,
        nightShiftRate: null,
        holidayRate: null,
        notes: `個別batch作成 (employeeIds: ${employeeIds.length}名)`,
      }).returning().get();

      db.insert(contractEmployees).values({
        contractId: contract.id,
        employeeId: empId,
        hourlyRate: effectiveRate,
        individualStartDate: startDate,
        individualEndDate: endDate,
        isIndefinite: false,
      }).run();

      db.insert(auditLog).values({
        action: "create",
        entityType: "contract",
        entityId: contract.id,
        detail: `個別batch: ${contractNumber} (${factory.factoryName}, ${emp.fullName}, ¥${effectiveRate}/h)`,
        userName: "system",
        operationId,
      }).run();

      results.push({
        id: contract.id,
        contractNumber: contract.contractNumber,
        factoryName: factory.factoryName,
        department: factory.department,
        lineName: factory.lineName,
        hourlyRate: effectiveRate,
        startDate,
        endDate,
        employees: [{ id: empId, fullName: emp.fullName, individualStartDate: startDate }],
        employeeCount: 1,
      });
    }

    db.insert(auditLog).values({
      action: "create",
      entityType: "contract",
      entityId: 0,
      detail: `個別batch作成完了: ${results.length}件 (会社ID: ${companyId}, 社員IDs: ${employeeIds.length}名)`,
      userName: "system",
      operationId,
    }).run();

    return results;
  })() as unknown as HiresCreateResult[];
}

// ─── By-Line: agrupa por (rate, startDate, endDate) — fechas individuales ───

/**
 * Crea contratos para los empleados seleccionados de UNA línea, agrupando
 * por (billingRate efectivo, startDate, endDate). Empleados con misma terna
 * van al mismo contrato; cualquier diferencia => contrato separado.
 *
 * El billingRate por empleado se resuelve con la cadena estándar:
 *   employee.billingRate ?? employee.hourlyRate ?? factory.hourlyRate
 *
 * Toda la creación pasa en una única transacción atómica.
 */
export function executeByLineCreate(
  params: ByLineParams,
): ByLineCreateResult {
  const { companyId, factoryId, employees: empInputs } = params;

  if (empInputs.length === 0) return { contracts: [], groups: [] };

  const operationId = crypto.randomUUID();

  return sqlite.transaction(() => {
    const factory = db.select().from(factories).where(eq(factories.id, factoryId)).get();
    if (!factory) throw new Error(`Factory ${factoryId} not found`);

    const empIds = empInputs.map((e) => e.employeeId);
    const empRows = db.select().from(employees).where(inArray(employees.id, empIds)).all();
    const empMap = new Map(empRows.map((e) => [e.id, e]));

    type GroupKey = string;
    interface PendingGroup {
      rate: number;
      startDate: string;
      endDate: string;
      members: { emp: typeof empRows[number]; effectiveRate: number }[];
    }
    const groups = new Map<GroupKey, PendingGroup>();

    for (const input of empInputs) {
      const emp = empMap.get(input.employeeId);
      if (!emp) continue;
      const effectiveRate =
        emp.billingRate ?? emp.hourlyRate ?? factory.hourlyRate ?? 0;
      if (!effectiveRate) continue;

      const key = `${effectiveRate}|${input.startDate}|${input.endDate}`;
      const existing = groups.get(key);
      if (existing) {
        existing.members.push({ emp, effectiveRate });
      } else {
        groups.set(key, {
          rate: effectiveRate,
          startDate: input.startDate,
          endDate: input.endDate,
          members: [{ emp, effectiveRate }],
        });
      }
    }

    const results: HiresCreateResult[] = [];
    const groupSummary: ByLineGroup[] = [];

    for (const group of groups.values()) {
      const contractDate = calculateContractDate(group.startDate);
      const notificationDate = calculateNotificationDate(group.startDate);
      const contractNumber = generateContractNumber(group.startDate);

      const contract = db.insert(contracts).values({
        contractNumber,
        status: "active",
        companyId,
        factoryId,
        startDate: group.startDate,
        endDate: group.endDate,
        contractDate,
        notificationDate,
        workDays: factory.workDays || "",
        workStartTime: null,
        workEndTime: null,
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
        hourlyRate: group.rate,
        overtimeRate: null,
        nightShiftRate: null,
        holidayRate: null,
        notes: `ライン個別選択 (${group.members.length}名)`,
      }).returning().get();

      const assignments = group.members.map((m) => ({
        contractId: contract.id,
        employeeId: m.emp.id,
        hourlyRate: m.effectiveRate,
        individualStartDate: group.startDate,
        individualEndDate: group.endDate,
        isIndefinite: false,
      }));
      db.insert(contractEmployees).values(assignments).run();

      db.insert(auditLog).values({
        action: "create",
        entityType: "contract",
        entityId: contract.id,
        detail: `ライン個別: ${contractNumber} (${factory.factoryName} ${factory.lineName || ""}, ¥${group.rate}/h, ${group.members.length}名, ${group.startDate}~${group.endDate})`,
        userName: "system",
        operationId,
      }).run();

      results.push({
        id: contract.id,
        contractNumber: contract.contractNumber,
        factoryName: factory.factoryName,
        department: factory.department,
        lineName: factory.lineName,
        hourlyRate: group.rate,
        startDate: group.startDate,
        endDate: group.endDate,
        employees: group.members.map((m) => ({
          id: m.emp.id,
          fullName: m.emp.fullName,
          individualStartDate: group.startDate,
        })),
        employeeCount: group.members.length,
      });

      groupSummary.push({
        rate: group.rate,
        startDate: group.startDate,
        endDate: group.endDate,
        count: group.members.length,
      });
    }

    db.insert(auditLog).values({
      action: "create",
      entityType: "contract",
      entityId: 0,
      detail: `ライン個別作成完了: ${results.length}件 (会社ID: ${companyId}, 工場ID: ${factoryId}, ${empInputs.length}名選択)`,
      userName: "system",
      operationId,
    }).run();

    return { contracts: results, groups: groupSummary };
  })();
}

// ─── Smart-Batch: ejecuta creación a partir de líneas pre-clasificadas ───

export interface SmartBatchCreateResult {
  contracts: HiresCreateResult[];
  contractIds: number[];
  perFactory: Array<{
    factoryId: number;
    factoryName: string | null;
    continuationCount: number;
    midHireCount: number;
    contractsCreated: number;
  }>;
}

/**
 * Toma el resultado de analyzeSmartBatch y crea los contratos correspondientes.
 * Para cada SmartBatchLine, agrupa los empleados elegibles (continuation + midHires)
 * por su contractStartDate individual y delega a executeByLineCreate para reusar
 * la lógica de agrupación por (rate, startDate, endDate) y la transacción atómica.
 *
 * future-skip se ignora silenciosamente — ya quedó visible en el preview.
 */
export function executeSmartBatch(
  lines: SmartBatchLine[],
): SmartBatchCreateResult {
  const allContracts: HiresCreateResult[] = [];
  const allContractIds: number[] = [];
  const perFactory: SmartBatchCreateResult["perFactory"] = [];

  for (const line of lines) {
    const eligible: SmartBatchEmployee[] = [...line.continuation, ...line.midHires];
    if (eligible.length === 0) continue;

    const empInputs = eligible.map((e) => ({
      employeeId: e.id,
      startDate: e.contractStartDate,
      endDate: e.contractEndDate,
    }));

    const result = executeByLineCreate({
      companyId: line.factory.companyId,
      factoryId: line.factory.id,
      employees: empInputs,
    });

    allContracts.push(...result.contracts);
    allContractIds.push(...result.contracts.map((c) => c.id));
    perFactory.push({
      factoryId: line.factory.id,
      factoryName: line.factory.factoryName,
      continuationCount: line.continuation.length,
      midHireCount: line.midHires.length,
      contractsCreated: result.contracts.length,
    });
  }

  return { contracts: allContracts, contractIds: allContractIds, perFactory };
}