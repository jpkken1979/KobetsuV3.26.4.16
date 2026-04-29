/**
 * Entities core: tablas principales del dominio (companies, factories,
 * employees, contracts) y configuración por compañía/factory.
 */

export interface Company {
  id: number;
  name: string;
  nameKana: string | null;
  shortName: string | null;
  address: string | null;
  phone: string | null;
  representative: string | null;
  conflictDate: string | null;
  contractPeriod: number | null;
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
  conflictDateOverride: string | null;
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
  // Latest kobetsu PDF generation timestamp (SQLite UTC, "YYYY-MM-DD HH:MM:SS") — populated by GET /api/contracts
  lastKobetsuAt?: string | null;
  // Relations (populated by API joins)
  company?: Company;
  factory?: Factory;
  employees?: (Employee | ContractEmployee)[];
}

export interface PdfVersion {
  id: number;
  pdfType: string;
  contractId: number | null;
  factoryId: number | null;
  sha256: string;
  byteLength: number;
  generatedAt: string;
  generatedBy: string | null;
  regeneratedFrom: number | null;
  metadata: string | null;
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

export interface FactoryYearlyConfig {
  id: number;
  factoryId: number;
  fiscalYear: number;
  sagyobiText: string | null;
  kyujitsuText: string | null;
  kyuukashori: string | null;
  supervisorName: string | null;
  supervisorDept: string | null;
  supervisorRole: string | null;
  supervisorPhone: string | null;
  hakensakiManagerName: string | null;
  hakensakiManagerDept: string | null;
  hakensakiManagerRole: string | null;
  hakensakiManagerPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FactoryYearlyConfigCreate {
  factoryId: number;
  fiscalYear: number;
  sagyobiText?: string | null;
  kyujitsuText?: string | null;
  kyuukashori?: string | null;
  supervisorName?: string | null;
  supervisorDept?: string | null;
  supervisorRole?: string | null;
  supervisorPhone?: string | null;
  hakensakiManagerName?: string | null;
  hakensakiManagerDept?: string | null;
  hakensakiManagerRole?: string | null;
  hakensakiManagerPhone?: string | null;
}

export type FactoryYearlyConfigUpdate = Omit<Partial<FactoryYearlyConfigCreate>, "factoryId" | "fiscalYear">;

export interface CompanyYearlyConfig {
  id: number;
  companyId: number;
  fiscalYear: number;
  kyujitsuText: string | null;
  kyuukashori: string | null;
  hakensakiManagerName: string | null;
  hakensakiManagerDept: string | null;
  hakensakiManagerRole: string | null;
  hakensakiManagerPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyYearlyConfigCreate {
  companyId: number;
  fiscalYear: number;
  kyujitsuText?: string | null;
  kyuukashori?: string | null;
  hakensakiManagerName?: string | null;
  hakensakiManagerDept?: string | null;
  hakensakiManagerRole?: string | null;
  hakensakiManagerPhone?: string | null;
}

export type CompanyYearlyConfigUpdate = Omit<Partial<CompanyYearlyConfigCreate>, "companyId" | "fiscalYear">;

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

export interface CascadeData {
  flat: Factory[];
  grouped: Record<string, Record<string, Factory[]>>;
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
