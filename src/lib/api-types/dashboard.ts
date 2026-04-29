/**
 * Dashboard widgets, alerts y data-check.
 */
import type { Company, Employee, Factory } from "./entities";

export interface DashboardStats {
  totalContracts: number;
  activeContracts: number;
  activeEmployees: number;
  companies: number;
  factories: number;
  expiringInDays: number;
}

export interface ResetAllDeletedCounts {
  clientCompanies: number;
  factories: number;
  employees: number;
  contracts: number;
  contractEmployees: number;
  factoryCalendars: number;
  shiftTemplates: number;
  pdfVersions: number;
}

export interface ResetAllResponse {
  success: true;
  deleted: ResetAllDeletedCounts;
}

export interface TeishokubiAlert {
  id: number;
  factoryName: string;
  department: string | null;
  lineName: string | null;
  conflictDate: string;
  company?: { name: string };
}

export interface ExpiringContract {
  id: number;
  contractNumber: string;
  endDate: string;
  company?: { name: string };
}

export interface VisaExpiryAlert {
  id: number;
  fullName: string;
  visaExpiry: string;
  company?: { name: string };
}

export interface NationalityStat {
  nationality: string;
  count: number;
}

export interface CompanyStat {
  companyName: string;
  companyShortName?: string;
  count: number;
}

// ─── Data Check ─────────────────────────────────────────────────────

export interface DataCheckEmployee extends Omit<Employee, "company" | "factory"> {
  company: Company | null;
  factory: Factory | null;
  completeness: "green" | "yellow" | "red" | "gray";
  missingEmployee: string[];
  missingFactory: string[];
}

export interface DataCheckResponse {
  employees: DataCheckEmployee[];
  stats: { green: number; yellow: number; red: number; gray: number; total: number };
}

export type CompletenessLevel = "green" | "yellow" | "red" | "gray";

export interface CompletenessRow {
  employeeId: number;
  employeeNumber: string;
  fullName: string;
  factoryName: string | null;
  companyName: string | null;
  level: CompletenessLevel;
  missingEmployee: string[];
  missingFactory: string[];
}

// ─── Takao Re-Entry ─────────────────────────────────────────────────

export interface TakaoReEntry {
  employeeNumber: string;
  fullName: string;
  companyName: string;
  previousFactory: string | null;
  newFactory: string | null;
  exitDate: string;
  reEntryDate: string;
  actualHireDate: string;
  gapDays: number;
}
