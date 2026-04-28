/**
 * Shared types for batch contracts service.
 */
import type { Factory } from "../../db/schema.js";
import type {
  AnalysisLine,
  SkipRecord,
  AnalysisResult,
} from "../../services/batch-helpers.js";

// Re-export from batch-helpers
export type { AnalysisLine, SkipRecord, AnalysisResult };

// ─── Mid-Hires types ────────────────────────────────────────────────

export interface MidHiresLine {
  factory: Factory;
  contractStartDate: string;
  contractEndDate: string;
  effectiveConflictDate: string;
  periodStart: string;
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

// ─── Individual batch params ─────────────────────────────────────────

export interface IndividualBatchParams {
  companyId: number;
  factoryId: number;
  employeeIds: number[];
  startDate: string;
  endDate: string;
  billingRate?: number;
}

// ─── By-Line batch (selección manual + fechas individuales) ─────────

export interface ByLineEmployeeInput {
  employeeId: number;
  startDate: string;
  endDate: string;
}

export interface ByLineParams {
  companyId: number;
  factoryId: number;
  employees: ByLineEmployeeInput[];
}

export interface ByLineGroup {
  rate: number;
  startDate: string;
  endDate: string;
  count: number;
}

export interface ByLineCreateResult {
  contracts: HiresCreateResult[];
  groups: ByLineGroup[];
}