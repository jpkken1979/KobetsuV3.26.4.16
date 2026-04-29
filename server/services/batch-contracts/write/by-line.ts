/**
 * By-Line: agrupa por (rate, startDate, endDate) — fechas individuales por
 * empleado. Crea contratos para empleados seleccionados de UNA línea,
 * delegando la agrupación a una clave compuesta.
 */
import crypto from "node:crypto";
import { inArray, eq } from "drizzle-orm";
import { db, sqlite } from "../../../db/index.js";
import {
  contracts,
  contractEmployees,
  auditLog,
  employees,
  factories,
} from "../../../db/schema.js";
import { generateContractNumber } from "../../contract-number.js";
import {
  calculateContractDate,
  calculateNotificationDate,
} from "../../contract-dates.js";
import type {
  ByLineParams,
  ByLineGroup,
  ByLineCreateResult,
  HiresCreateResult,
} from "../types.js";

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
