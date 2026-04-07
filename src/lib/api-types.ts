/**
 * Shared TypeScript interfaces and types for the API layer.
 * Extracted from api.ts for separation of concerns.
 * Re-exported from api.ts for backward compatibility.
 */

// ─── Response Types ─────────────────────────────────────────────────

export interface Company {
  id: number;
  name: string;
  nameKana: string | null;
  shortName: string | null;
  address: string | null;
  phone: string | null;
  representative: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  factories?: Factory[];
}

export interface Factory {
  id: number;
  companyId: number;
  factoryName: string;
  department: string | null;
  lineName: string | null;
  address: string | null;
  phone: string | null;
  hourlyRate: number | null;
  jobDescription: string | null;
  jobDescription2: string | null;
  shiftPattern: string | null;
  workHours: string | null;
  workHoursDay: string | null;
  workHoursNight: string | null;
  breakTime: number | null;
  breakTimeDay: string | null;
  breakTimeNight: string | null;
  overtimeHours: string | null;
  overtimeOutsideDays: string | null;
  workDays: string | null;
  conflictDate: string | null;
  contractPeriod: string | null;
  calendar: string | null;
  closingDay: number | null;
  closingDayText: string | null;
  paymentDay: number | null;
  paymentDayText: string | null;
  bankAccount: string | null;
  timeUnit: string | null;
  supervisorDept: string | null;
  supervisorName: string | null;
  supervisorPhone: string | null;
  complaintClientName: string | null;
  complaintClientPhone: string | null;
  complaintClientDept: string | null;
  complaintUnsName: string | null;
  complaintUnsPhone: string | null;
  complaintUnsDept: string | null;
  managerUnsName: string | null;
  managerUnsPhone: string | null;
  managerUnsDept: string | null;
  managerUnsAddress: string | null;
  complaintUnsAddress: string | null;
  hakensakiManagerName: string | null;
  hakensakiManagerPhone: string | null;
  hakensakiManagerDept: string | null;
  hakensakiManagerRole: string | null;
  supervisorRole: string | null;
  workerClosingDay: string | null;
  workerPaymentDay: string | null;
  workerCalendar: string | null;
  agreementPeriodEnd: string | null;
  explainerName: string | null;
  hasRobotTraining: boolean | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  company?: Company;
}

export interface Employee {
  id: number;
  employeeNumber: string;
  status: string;
  fullName: string;
  katakanaName: string | null;
  nationality: string | null;
  gender: string | null;
  birthDate: string | null;
  hireDate: string | null;
  actualHireDate: string | null;
  hourlyRate: number | null;
  billingRate: number | null;
  clientEmployeeId: string | null;
  visaExpiry: string | null;
  visaType: string | null;
  address: string | null;
  postalCode: string | null;
  companyId: number | null;
  factoryId: number | null;
  createdAt: string;
  updatedAt: string;
  company?: Company;
  factory?: Factory;
}

export interface Contract {
  id: number;
  contractNumber: string;
  status: string;
  companyId: number;
  factoryId: number;
  startDate: string;
  endDate: string;
  contractDate: string | null;
  notificationDate: string | null;
  // Art. 26 legal fields (派遣法第26条)
  workDays: string | null;
  workStartTime: string | null;
  workEndTime: string | null;
  breakMinutes: number | null;
  supervisorName: string | null;
  supervisorDept: string | null;
  supervisorPhone: string | null;
  complaintHandlerClient: string | null;
  complaintHandlerUns: string | null;
  hakenmotoManager: string | null;
  safetyMeasures: string | null;
  terminationMeasures: string | null;
  jobDescription: string | null;
  responsibilityLevel: string | null;
  overtimeMax: string | null;
  welfare: string | null;
  isKyoteiTaisho: boolean;
  // Rates
  hourlyRate: number | null;
  overtimeRate: number | null;
  nightShiftRate: number | null;
  holidayRate: number | null;
  // Renewal chain
  previousContractId: number | null;
  pdfPath: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations (populated by API joins)
  company?: Company;
  factory?: Factory;
  employees?: (Employee | ContractEmployee)[];
}

export interface ContractEmployee {
  id: number;
  contractId: number;
  employeeId: number;
  hourlyRate: number | null;
  individualStartDate: string | null;
  individualEndDate: string | null;
  isIndefinite: boolean;
}

export interface FactoryCalendar {
  id: number;
  factoryId: number;
  year: number;
  holidays: string;
  description: string | null;
  totalWorkDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: number | null;
  detail: string | null;
  userName: string | null;
  operationId: string | null;
}

export interface ShiftTemplate {
  id: number;
  name: string;
  workHours: string;
  breakTime: string;
  shiftCount: number;
  createdAt: string;
}

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

// Mid-Hires (途中入社) types
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
  participationRate: number;
  isExempt: boolean;
  exemptionReason: string | null;
  rateGroups: MidHiresRateGroup[];
}

export interface MidHiresPreviewResult {
  preview: true;
  totalContracts: number;
  totalEmployees: number;
  startDate: string;
  endDate: string;
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

// ─── Factory-level document generation ──────────────────────────────

export interface GenerateFactoryResult {
  success: boolean;
  factoryId: number;
  factoryName: string;
  department: string | null;
  lineName: string | null;
  contractCount: number;
  employeeCount: number;
  fileCount: number;
  kobetsuCopies: 1 | 2;
  zipFilename: string;
  zipPath: string;
}

export interface DashboardStats {
  totalContracts: number;
  activeContracts: number;
  activeEmployees: number;
  companies: number;
  factories: number;
  expiringInDays: number;
}

export interface CascadeData {
  flat: Factory[];
  grouped: Record<string, Record<string, Factory[]>>;
}

export interface ImportResult {
  success: boolean;
  summary: { total: number; inserted: number; updated: number; deleted: number; skipped: number; errors: number; companiesUpdated?: number };
  errors: string[];
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

// Factory-level role summary types
export type RoleKey = "hakensakiManager" | "complaintClient" | "complaintUns" | "managerUns";

export interface RoleValue {
  name: string | null;
  dept: string | null;
  phone: string | null;
  address?: string | null;
}

export interface RoleOverride {
  lineId: number;
  lineName: string | null;
  department: string | null;
  value: RoleValue;
}

export interface RoleSummary {
  shared: boolean;
  majority: RoleValue;
  overrides: RoleOverride[];
}

export interface FactoryGroupRoles {
  factoryName: string;
  lineCount: number;
  address: string | null;
  roles: Record<RoleKey, RoleSummary>;
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

// ─── Generate By IDs ─────────────────────────────────────────────────

export interface ByIdsEmployee {
  id: number;
  employeeNumber: string;
  clientEmployeeId: string | null;
  fullName: string;
  katakanaName: string | null;
  hireDate: string | null;
  billingRate: number | null;
  hourlyRate: number | null;
}

export interface ByIdsGroup {
  groupIndex: number;
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
  employees: ByIdsEmployee[];
}

export interface PreviewByIdsResult {
  groups: ByIdsGroup[];
  notFoundIds: string[];
  totalEmployees: number;
}

export interface GenerateByIdsResult {
  success: boolean;
  contractCount: number;
  employeeCount: number;
  fileCount: number;
  kobetsuCopies: 1 | 2;
  notFoundIds: string[];
  zipFilename: string | null;
  zipPath: string | null;
  contracts: {
    id: number;
    contractNumber: string;
    factoryName: string | null;
    startDate: string;
    endDate: string;
    employeeCount: number;
  }[];
}

// ─── Create / Update input types ────────────────────────────────────

/** Input for creating a company */
export interface CompanyCreate {
  name: string;
  nameKana?: string | null;
  shortName?: string | null;
  address?: string | null;
  phone?: string | null;
  representative?: string | null;
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

// ─── Admin panel types ───────────────────────────────────────────────

export interface AdminColumnMeta {
  name: string;
  type: "text" | "integer" | "real" | "boolean";
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: { table: string; column: string };
}

export interface AdminTableMeta {
  name: string;
  displayName: string;
  count: number;
  columns: AdminColumnMeta[];
  foreignKeys: { column: string; refs: { table: string; column: string } }[];
}

export interface AdminQueryParams {
  table: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  filters?: Record<string, string>;
}

export interface AdminRowResult {
  rows: Record<string, unknown>[];
  total: number;
  columns: AdminColumnMeta[];
  page: number;
  pageSize: number;
}

export interface AdminSqlResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  time: number;
}

export interface AdminStats {
  counts: Record<string, number>;
  contractStatusDistribution: Record<string, number>;
  employeeStatusDistribution: Record<string, number>;
  nationalityDistribution: { nationality: string; count: number }[];
  monthlyContracts: { month: string; count: number }[];
  topFactories: {
    factoryId: number;
    factoryName: string;
    companyName: string;
    employeeCount: number;
  }[];
  nullCounts: { table: string; column: string; nullCount: number }[];
  expiringContracts: {
    contractId: number;
    contractNumber: string;
    endDate: string;
    companyName: string;
    factoryName: string;
  }[];
}
