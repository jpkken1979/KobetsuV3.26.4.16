/**
 * Inputs: payloads de creación/actualización de entidades + filtros y
 * resultados de import (Excel).
 */

/** Input for creating a company */
export interface CompanyCreate {
  name: string;
  nameKana?: string | null;
  shortName?: string | null;
  address?: string | null;
  phone?: string | null;
  representative?: string | null;
  conflictDate?: string | null;
  contractPeriod?: number | null;
}

/** Input for updating a company */
export type CompanyUpdate = Partial<CompanyCreate>;

/** Input for creating a factory */
export interface FactoryCreate {
  companyId: number;
  factoryName: string;
  department?: string | null;
  lineName?: string | null;
  address?: string | null;
  phone?: string | null;
  hourlyRate?: number | null;
  jobDescription?: string | null;
  jobDescription2?: string | null;
  shiftPattern?: string | null;
  workHours?: string | null;
  workHoursDay?: string | null;
  workHoursNight?: string | null;
  breakTime?: number | null;
  breakTimeDay?: string | null;
  breakTimeNight?: string | null;
  overtimeHours?: string | null;
  overtimeOutsideDays?: string | null;
  workDays?: string | null;
  conflictDate?: string | null;
  contractPeriod?: string | null;
  calendar?: string | null;
  closingDay?: number | null;
  closingDayText?: string | null;
  paymentDay?: number | null;
  paymentDayText?: string | null;
  bankAccount?: string | null;
  timeUnit?: string | null;
  supervisorDept?: string | null;
  supervisorName?: string | null;
  supervisorPhone?: string | null;
  supervisorRole?: string | null;
  complaintClientName?: string | null;
  complaintClientPhone?: string | null;
  complaintClientDept?: string | null;
  complaintUnsName?: string | null;
  complaintUnsPhone?: string | null;
  complaintUnsDept?: string | null;
  complaintUnsAddress?: string | null;
  managerUnsName?: string | null;
  managerUnsPhone?: string | null;
  managerUnsDept?: string | null;
  managerUnsAddress?: string | null;
  hakensakiManagerName?: string | null;
  hakensakiManagerPhone?: string | null;
  hakensakiManagerDept?: string | null;
  hakensakiManagerRole?: string | null;
  workerClosingDay?: string | null;
  workerPaymentDay?: string | null;
  workerCalendar?: string | null;
  agreementPeriodEnd?: string | null;
  explainerName?: string | null;
  hasRobotTraining?: boolean | null;
}

/** Input for updating a factory — same as FactoryCreate but all fields optional */
export type FactoryUpdate = Partial<FactoryCreate>;

/** Input for creating an employee */
export interface EmployeeCreate {
  employeeNumber: string;
  status?: string;
  fullName: string;
  katakanaName?: string | null;
  nationality?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  hireDate?: string | null;
  actualHireDate?: string | null;
  hourlyRate?: number | null;
  billingRate?: number | null;
  clientEmployeeId?: string | null;
  visaExpiry?: string | null;
  visaType?: string | null;
  address?: string | null;
  postalCode?: string | null;
  companyId?: number | null;
  factoryId?: number | null;
}

/** Input for updating an employee — all fields optional */
export type EmployeeUpdate = Partial<EmployeeCreate>;

/** Filter params for employee queries */
export interface EmployeeFilterParams {
  companyId?: number;
  factoryId?: number;
  search?: string;
  status?: string;
}

/** Badge status for factory cards (R24) */
export interface FactoryBadgeStatus {
  factoryId: number;
  factoryName: string;
  department: string | null;
  lineName: string | null;
  employeeCount: number;
  contractCount?: number;
  isActive?: boolean;
  lastContractEnd?: string | null;
  dataComplete: "ok" | "warning" | "error";
  hasCalendar: boolean;
  conflictDate?: string | null;
  missingFields?: string[];
}

/** Result of a factory import preview or apply */
export interface FactoryImportPreview {
  newCount: number;
  updateCount: number;
  unchangedCount: number;
  diffs: {
    factoryId?: number;
    company: string;
    factory: string;
    dept: string | null;
    line: string | null;
    changes?: Record<string, { old: unknown; new: unknown }>;
  }[];
}

export interface ImportResult {
  success: boolean;
  summary: { total: number; inserted: number; updated: number; deleted: number; skipped: number; errors: number; warnings: number; companiesUpdated?: number };
  errors: string[];
  warnings?: string[];
}

export interface DiffChange { old: unknown; new: unknown }

export interface EmployeeDiffResult {
  inserts: Array<{ employeeNumber: string; fullName: string; company: string | null; factory: string | null }>;
  updates: Array<{
    employeeNumber: string; fullName: string; company: string | null; factory: string | null;
    changes: Record<string, DiffChange>;
  }>;
  unchanged: number;
  skipped: number;
  errors: string[];
}

export interface DiffResult {
  inserts: { company: string; factory: string; dept: string | null; line: string | null }[];
  updates: { factoryId: number; company: string; factory: string; dept: string | null; line: string | null; changes: Record<string, DiffChange> }[];
  unchanged: number;
  missing: { factoryId: number; company: string; companyId: number; factory: string; dept: string | null; line: string | null }[];
  companyErrors: string[];
}
