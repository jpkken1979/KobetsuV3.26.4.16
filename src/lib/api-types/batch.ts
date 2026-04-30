/**
 * Batch contract creation: payloads, previews y resultados de los flujos
 * batch (estándar, new-hires, mid-hires, by-line, smart-batch).
 */
import type { Contract, Factory } from "./entities";

export interface BatchCreateResult {
  created: number;
  skipped: number;
  contracts: (Contract | { id: number; contractNumber: string; factoryName?: string; department?: string | null; lineName?: string | null; endDate: string; hourlyRate?: number | null; employees?: number })[];
  contractIds: number[];
  skippedDetails?: { factoryId: number; factoryName: string; reason: string }[];
  pdfFiles?: { path: string; filename: string; downloadUrl?: string }[];
}

export interface BatchDocumentResult {
  files: { filename: string; downloadUrl: string; type: string; path: string }[];
  contractCount: number;
  employeeCount: number;
  summary?: { total: number; errors: number };
}

export interface GenerateGroupedResult {
  success: boolean;
  contractCount: number;
  files: { type: string; filename: string; path: string }[];
  groupBy: "kobetsu" | "tsuchisho" | "daicho" | "all";
}

export interface LaborHistoryFile {
  filename: string;
  path: string;
  size?: number;
  createdAt?: string;
  type?: "keiyakusho" | "shugyojoken";
}

export interface BatchPreviewRateGroup {
  rate: number;
  count: number;
  overtimeRate?: number;
  holidayRate?: number;
  employeeNames?: string[];
  employees?: { fullName: string; employeeNumber: string }[];
}

export interface BatchPreviewDuplicate {
  id?: number;
  contractNumber: string;
  startDate?: string;
  endDate: string;
  employeeCount?: number;
}

export interface BatchPreviewLine {
  factoryId: number;
  factoryName: string;
  department: string | null;
  lineName: string | null;
  effectiveEndDate?: string;
  capped?: boolean | string | null;
  autoCalculated?: boolean;
  contractPeriod?: string | null;
  conflictDate?: string | null;
  totalEmployees?: number;
  totalContracts?: number;
  participationRate?: number;
  isExempt?: boolean;
  exemptionReason?: string;
  rateGroups?: BatchPreviewRateGroup[];
  duplicates?: BatchPreviewDuplicate[];
  contracts?: number;
  employees?: number;
  rates?: { rate: number; count: number }[];
}

export interface BatchPreviewResult {
  preview: boolean;
  totalContracts: number;
  totalEmployees: number;
  totalDuplicates?: number;
  lines: BatchPreviewLine[];
  skipped?: { factoryName: string; reason: string }[];
}

// ─── New Hires ─────────────────────────────────────────────────────────

export interface NewHiresPreviewEmployee {
  id: number;
  fullName: string;
  employeeNumber: string;
  effectiveHireDate: string;
  billingRate: number | null;
  hourlyRate: number | null;
  visaExpiry: string | null;
  nationality: string | null;
}

export interface NewHiresRateGroup {
  rate: number;
  count: number;
  overtimeRate: number;
  holidayRate: number;
  employees: NewHiresPreviewEmployee[];
}

export interface NewHiresPreviewLine {
  factoryId: number;
  factoryName: string;
  department: string | null;
  lineName: string | null;
  effectiveEndDate: string;
  conflictDate: string | null;
  totalEmployees: number;
  totalContracts: number;
  participationRate: number;
  isExempt: boolean;
  exemptionReason: string | null;
  rateGroups: NewHiresRateGroup[];
}

export interface NewHiresPreviewResult {
  preview: true;
  hireDateFrom: string;
  hireDateTo: string;
  totalContracts: number;
  totalEmployees: number;
  lines: NewHiresPreviewLine[];
  skipped: { factoryId?: number; factoryName: string; lineName?: string; reason: string }[];
}

export interface NewHiresCreatedContract {
  id: number;
  contractNumber: string;
  factoryName: string;
  department: string | null;
  lineName: string | null;
  hourlyRate: number;
  startDate: string;
  endDate: string;
  employees: { id: number; fullName: string; individualStartDate: string }[];
  employeeCount: number;
}

export interface NewHiresCreateResult {
  created: number;
  skipped: number;
  contracts: NewHiresCreatedContract[];
  skippedDetails: { factoryId?: number; factoryName: string; lineName?: string; reason: string }[];
  contractIds: number[];
  generateDocs: boolean;
  pdfFiles?: BatchDocumentResult["files"];
}

// ─── Mid-Hires (途中入社) ────────────────────────────────────────────

export interface MidHiresPreviewEmployee {
  id: number;
  fullName: string | null;
  employeeNumber: string | null;
  effectiveHireDate: string;
  billingRate: number | null;
  hourlyRate: number | null;
  visaExpiry: string | null;
  nationality: string | null;
}

export interface MidHiresRateGroup {
  rate: number;
  count: number;
  overtimeRate: number | null;
  holidayRate: number | null;
  employees: MidHiresPreviewEmployee[];
}

export interface MidHiresPreviewLine {
  factoryId: number;
  factoryName: string;
  department: string | null;
  lineName: string | null;
  contractStartDate: string;
  contractEndDate: string;
  totalEmployees: number;
  totalContracts: number;
  participationRate: number | null;
  isExempt: boolean;
  exemptionReason: string | null;
  rateGroups: MidHiresRateGroup[];
  effectiveConflictDate: string;
  periodStart: string;
}

export interface MidHiresPreviewResult {
  preview: true;
  totalContracts: number;
  totalEmployees: number;
  lines: MidHiresPreviewLine[];
  skipped: { factoryId?: number; factoryName: string; lineName?: string; reason: string }[];
}

export interface MidHiresCreatedContract {
  id: number;
  contractNumber: string;
  factoryName: string | null;
  department: string | null;
  lineName: string | null;
  hourlyRate: number;
  startDate: string;
  endDate: string;
  employees: { id: number; fullName: string | null; individualStartDate: string }[];
  employeeCount: number;
}

export interface MidHiresCreateResult {
  created: number;
  skipped: number;
  contracts: MidHiresCreatedContract[];
  skippedDetails: { factoryId?: number; factoryName: string; lineName?: string; reason: string }[];
  contractIds: number[];
  generateDocs: boolean;
  pdfFiles?: BatchDocumentResult["files"];
}

// ─── By-Line Batch (selección manual + fechas individuales) ─────────

export interface ByLineEmployeeInput {
  employeeId: number;
  startDate: string;
  endDate: string;
}

export interface ByLineBatchPayload {
  companyId: number;
  factoryId: number;
  employees: ByLineEmployeeInput[];
  generatePdf?: boolean;
}

export interface ByLineGroup {
  rate: number;
  startDate: string;
  endDate: string;
  count: number;
}

export interface ByLineCreatedContract {
  id: number;
  contractNumber: string;
  factoryName: string | null;
  department: string | null;
  lineName: string | null;
  hourlyRate: number;
  startDate: string;
  endDate: string;
  employees: { id: number; fullName: string | null; individualStartDate: string }[];
  employeeCount: number;
}

export interface ByLineBatchResult {
  created: number;
  contracts: ByLineCreatedContract[];
  contractIds: number[];
  groups: ByLineGroup[];
  generatePdf: boolean;
  pdfFiles?: BatchDocumentResult["files"];
}

// ─── Smart-Batch (ikkatsu por fábrica + auto-clasificación) ─────────

export type SmartBatchEmpKind = "continuation" | "mid-hire" | "future-skip";

export interface SmartBatchEmployee {
  id: number;
  fullName: string | null;
  employeeNumber: string | null;
  billingRate: number | null;
  hourlyRate: number | null;
  effectiveHireDate: string | null;
  kind: SmartBatchEmpKind;
  contractStartDate: string;
  contractEndDate: string;
}

export interface SmartBatchPreviewLine {
  factory: Factory;
  globalStartDate: string;
  globalEndDate: string;
  continuation: SmartBatchEmployee[];
  midHires: SmartBatchEmployee[];
  futureSkip: SmartBatchEmployee[];
  totalEligible: number;
  estimatedContracts: number;
}

export interface SmartBatchPreviewResult {
  lines: SmartBatchPreviewLine[];
  skipped: { factoryId?: number; factoryName: string; lineName?: string; reason: string }[];
  totals: {
    contracts: number;
    continuation: number;
    midHires: number;
    futureSkip: number;
  };
}

export interface SmartBatchPerFactory {
  factoryId: number;
  factoryName: string | null;
  continuationCount: number;
  midHireCount: number;
  contractsCreated: number;
}

export interface SmartBatchCreateResult {
  created: number;
  contracts: ByLineCreatedContract[];
  contractIds: number[];
  perFactory: SmartBatchPerFactory[];
  skippedDetails: { factoryId?: number; factoryName: string; lineName?: string; reason: string }[];
  generateDocs: boolean;
  pdfFiles?: BatchDocumentResult["files"];
}

export interface SmartBatchPayload {
  companyId: number;
  factoryIds?: number[];
  globalStartDate: string;
  globalEndDate: string;
  generateDocs?: boolean;
  groupByLine?: boolean;
}
