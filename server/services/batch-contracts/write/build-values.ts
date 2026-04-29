import type { AnalysisLine } from "../../batch-helpers.js";

/**
 * Construye los valores compartidos para insertar en `contracts` para flujos
 * estándar (batch / new-hires). Centralizado para que `standard-batches.ts`
 * no repita el mismo objeto en varias funciones.
 */
export function buildContractValues(
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
