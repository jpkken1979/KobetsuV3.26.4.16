import { z } from "zod";

// ─── Shared helpers ──────────────────────────────────────────────────

const optionalStr = z.string().optional().nullable();
const optionalNum = z.number().optional().nullable();
const optionalInt = z.number().int().optional().nullable();
const optionalBool = z.boolean().optional().nullable();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format");
const optionalDate = dateStr.optional().nullable();

// ─── Company ─────────────────────────────────────────────────────────

export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  nameKana: optionalStr,
  shortName: optionalStr,
  address: optionalStr,
  phone: optionalStr,
  representative: optionalStr,
  isActive: z.boolean().optional(),
});

export const updateCompanySchema = createCompanySchema.partial();

// ─── Factory ─────────────────────────────────────────────────────────

export const createFactorySchema = z.object({
  companyId: z.number().int().positive("companyId is required"),
  factoryName: z.string().min(1, "Factory name is required"),
  address: optionalStr,
  phone: optionalStr,
  department: optionalStr,
  lineName: optionalStr,
  supervisorDept: optionalStr,
  supervisorName: optionalStr,
  supervisorPhone: optionalStr,
  complaintClientName: optionalStr,
  complaintClientPhone: optionalStr,
  complaintClientDept: optionalStr,
  complaintUnsName: optionalStr,
  complaintUnsPhone: optionalStr,
  complaintUnsDept: optionalStr,
  managerUnsName: optionalStr,
  managerUnsPhone: optionalStr,
  managerUnsDept: optionalStr,
  managerUnsAddress: optionalStr,
  complaintUnsAddress: optionalStr,
  hakensakiManagerName: optionalStr,
  hakensakiManagerPhone: optionalStr,
  hakensakiManagerDept: optionalStr,
  hourlyRate: optionalNum,
  jobDescription: optionalStr,
  shiftPattern: optionalStr,
  workHours: optionalStr,
  workHoursDay: optionalStr,
  workHoursNight: optionalStr,
  breakTime: optionalInt,
  breakTimeDay: optionalStr,
  breakTimeNight: optionalStr,
  overtimeHours: optionalStr,
  overtimeOutsideDays: optionalStr,
  workDays: optionalStr,
  conflictDate: optionalDate,
  contractPeriod: z.enum(["teishokubi", "1month", "3months", "6months", "1year"]).optional().nullable(),
  calendar: optionalStr,
  closingDay: optionalInt,
  closingDayText: optionalStr,
  paymentDay: optionalInt,
  paymentDayText: optionalStr,
  bankAccount: optionalStr,
  timeUnit: optionalStr,
  workerClosingDay: optionalStr,
  workerPaymentDay: optionalStr,
  workerCalendar: optionalStr,
  agreementPeriodEnd: optionalStr,
  explainerName: optionalStr,
  hasRobotTraining: z.boolean().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateFactorySchema = createFactorySchema.partial();

// ─── Employee ────────────────────────────────────────────────────────

export const createEmployeeSchema = z.object({
  employeeNumber: z.string().min(1, "Employee number is required"),
  fullName: z.string().min(1, "Full name is required"),
  status: z.enum(["active", "inactive", "onLeave"]).optional(),
  katakanaName: optionalStr,
  nationality: optionalStr,
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  birthDate: optionalDate,
  hireDate: optionalDate,
  actualHireDate: optionalDate,
  hourlyRate: optionalNum,
  billingRate: optionalNum,
  clientEmployeeId: optionalStr,
  visaExpiry: optionalDate,
  visaType: optionalStr,
  address: optionalStr,
  postalCode: optionalStr,
  companyId: optionalInt,
  factoryId: optionalInt,
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

// ─── Contract ────────────────────────────────────────────────────────

const employeeAssignment = z.object({
  employeeId: z.number().int().positive(),
  hourlyRate: z.number().optional(),
  individualStartDate: dateStr.optional(),
  individualEndDate: dateStr.optional(),
  isIndefinite: z.boolean().optional(),
});

export const createContractSchema = z.object({
  contractNumber: z.string().optional(),
  status: z.enum(["draft", "active", "expired", "cancelled", "renewed"]).optional(),
  companyId: z.number().int().positive("companyId is required"),
  factoryId: z.number().int().positive("factoryId is required"),
  startDate: dateStr,
  endDate: dateStr,
  contractDate: dateStr,
  notificationDate: dateStr,
  conflictDateOverride: z.string().nullable().optional(),
  workDays: optionalStr,
  workStartTime: optionalStr,
  workEndTime: optionalStr,
  breakMinutes: optionalInt,
  supervisorName: optionalStr,
  supervisorDept: optionalStr,
  supervisorPhone: optionalStr,
  complaintHandlerClient: optionalStr,
  complaintHandlerUns: optionalStr,
  hakenmotoManager: optionalStr,
  safetyMeasures: optionalStr,
  terminationMeasures: optionalStr,
  jobDescription: optionalStr,
  responsibilityLevel: optionalStr,
  overtimeMax: optionalStr,
  welfare: optionalStr,
  isKyoteiTaisho: optionalBool,
  hourlyRate: optionalNum,
  overtimeRate: optionalNum,
  nightShiftRate: optionalNum,
  holidayRate: optionalNum,
  previousContractId: optionalInt,
  pdfPath: optionalStr,
  notes: optionalStr,
  employeeAssignments: z.array(employeeAssignment).optional(),
  employeeIds: z.array(z.number().int().positive()).optional(),
});

export const updateContractSchema = createContractSchema.partial();

// ─── Calendar ────────────────────────────────────────────────────────

export const createCalendarSchema = z.object({
  factoryId: z.number().int().positive("factoryId is required"),
  year: z.number().int().min(2020).max(2100),
  holidays: z.union([z.string(), z.array(z.string())]),
  description: optionalStr,
});
