// server/services/validation.ts
// R17: Pre-PDF validation service. Checks factory + employee data completeness
// before allowing document generation.

export interface PrePdfValidationResult {
  valid: boolean;
  errors: string[];
}

interface FactoryLike {
  supervisorName: string | null;
  supervisorPhone: string | null;
  hakensakiManagerName: string | null;
  hakensakiManagerPhone: string | null;
  address: string | null;
  workHours: string | null;
  conflictDate: string | null;
  closingDayText: string | null;
  paymentDayText: string | null;
  managerUnsName: string | null;
  managerUnsPhone: string | null;
  complaintUnsName: string | null;
  complaintUnsPhone: string | null;
  complaintClientName: string | null;
  complaintClientPhone: string | null;
}

interface ContractLike {
  startDate: string;
  endDate: string;
  safetyMeasures: string | null;
  terminationMeasures: string | null;
  jobDescription: string | null;
}

interface EmployeeLike {
  fullName: string;
  billingRate: number | null;
  hourlyRate: number | null;
}

/**
 * Validate factory + employee data completeness before PDF generation.
 * Used by unit tests in `server/__tests__/validation.test.ts`.
 * Production PDF handlers read field-by-field and surface friendly errors directly.
 */
export function validateForPdf(
  factory: FactoryLike | null,
  employees: EmployeeLike[],
): PrePdfValidationResult {
  const errors: string[] = [];

  if (!factory) {
    errors.push("工場情報が見つかりません");
    return { valid: false, errors };
  }

  // Factory required fields
  if (!factory.supervisorName) errors.push("指揮命令者氏名が未入力です");
  if (!factory.supervisorPhone) errors.push("指揮命令者電話番号が未入力です");
  if (!factory.hakensakiManagerName) errors.push("派遣先責任者氏名が未入力です");
  if (!factory.hakensakiManagerPhone) errors.push("派遣先責任者電話番号が未入力です");
  if (!factory.address) errors.push("就業場所住所が未入力です");
  if (!factory.workHours) errors.push("就業時間が未入力です");
  if (!factory.conflictDate) errors.push("抵触日が未入力です");
  if (!factory.closingDayText) errors.push("締日が未入力です");
  if (!factory.paymentDayText) errors.push("支払日が未入力です");
  if (!factory.managerUnsName) errors.push("派遣元責任者氏名が未入力です");
  if (!factory.managerUnsPhone) errors.push("派遣元責任者電話番号が未入力です");
  if (!factory.complaintUnsName) errors.push("苦情処理担当者(UNS)氏名が未入力です");
  if (!factory.complaintUnsPhone) errors.push("苦情処理担当者(UNS)電話番号が未入力です");
  if (!factory.complaintClientName) errors.push("苦情処理担当者(派遣先)氏名が未入力です");
  if (!factory.complaintClientPhone) errors.push("苦情処理担当者(派遣先)電話番号が未入力です");

  // 抵触日 must not have already passed at generation time (派遣法第40条の2)
  if (factory.conflictDate) {
    const conflict = new Date(factory.conflictDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!isNaN(conflict.getTime()) && conflict < today) {
      errors.push(`抵触日(${factory.conflictDate})が既に経過しています`);
    }
  }

  // Employee required fields
  for (const emp of employees) {
    // billingRate ?? hourlyRate — use nullish coalescing, NEVER ||
    const rate = emp.billingRate ?? emp.hourlyRate;
    if (rate === null || rate === undefined) {
      errors.push(`${emp.fullName}: 単価または時給が未設定です`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a contract for 派遣法第26条 compliance before PDF generation.
 * Use in addition to validateForPdf when the contract is already persisted.
 */
export function validateContractForPdf(contract: ContractLike | null): PrePdfValidationResult {
  const errors: string[] = [];

  if (!contract) {
    errors.push("契約情報が見つかりません");
    return { valid: false, errors };
  }

  if (!contract.jobDescription) errors.push("業務内容が未入力です (26条1号)");
  if (!contract.safetyMeasures) errors.push("安全衛生措置が未入力です (26条7号)");
  if (!contract.terminationMeasures) errors.push("契約解除措置が未入力です (26条8号)");

  // Sanity check on dates (DB CHECK is the real guard, but we also surface a friendly error)
  const start = new Date(contract.startDate);
  const end = new Date(contract.endDate);
  if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start) {
    errors.push(`契約終了日(${contract.endDate})が開始日(${contract.startDate})より前です`);
  }

  return { valid: errors.length === 0, errors };
}
