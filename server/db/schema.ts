import { sqliteTable, text, integer, real, uniqueIndex, index, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

// ─── 1. client_companies (14 empresas clientes) ───────────────────────

export const clientCompanies = sqliteTable("client_companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nameKana: text("name_kana"),
  shortName: text("short_name"),
  address: text("address"),
  phone: text("phone"),
  representative: text("representative"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── 2. factories (76 configs — unique: company+factory+dept+line) ───

export const factories = sqliteTable(
  "factories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => clientCompanies.id),
    factoryName: text("factory_name").notNull(),
    address: text("address"),
    phone: text("phone"),
    department: text("department"),
    lineName: text("line_name"),

    // Supervisores (Art. 26 required)
    supervisorDept: text("supervisor_dept"),
    supervisorName: text("supervisor_name"),
    supervisorPhone: text("supervisor_phone"),

    // Complaint handlers (苦情処理)
    complaintClientName: text("complaint_client_name"),
    complaintClientPhone: text("complaint_client_phone"),
    complaintClientDept: text("complaint_client_dept"),
    complaintUnsName: text("complaint_uns_name"),
    complaintUnsPhone: text("complaint_uns_phone"),
    complaintUnsDept: text("complaint_uns_dept"),

    complaintUnsAddress: text("complaint_uns_address"),

    // UNS manager (派遣元責任者)
    managerUnsName: text("manager_uns_name"),
    managerUnsPhone: text("manager_uns_phone"),
    managerUnsDept: text("manager_uns_dept"),
    managerUnsAddress: text("manager_uns_address"),

    // 派遣先責任者 (separate from 指揮命令者)
    hakensakiManagerName: text("hakensaki_manager_name"),
    hakensakiManagerPhone: text("hakensaki_manager_phone"),
    hakensakiManagerDept: text("hakensaki_manager_dept"),
    hakensakiManagerRole: text("hakensaki_manager_role"),

    // 指揮命令者 role/title (e.g., 工長, 班長)
    supervisorRole: text("supervisor_role"),

    // Work conditions
    hourlyRate: real("hourly_rate"),
    jobDescription: text("job_description"),
    shiftPattern: text("shift_pattern"), // 通常, 昼夜2交代, 3交代, 4勤2休, etc.
    workHours: text("work_hours"), // Full text description of all shifts
    workHoursDay: text("work_hours_day"), // Day shift: "7:00~15:30"
    workHoursNight: text("work_hours_night"), // Night shift: "19:00~3:30" (nullable)
    breakTime: integer("break_time"),
    breakTimeDay: text("break_time_day"), // Day break description
    breakTimeNight: text("break_time_night"), // Night break description
    overtimeHours: text("overtime_hours"),
    overtimeOutsideDays: text("overtime_outside_days"), // 就業日外労働
    workDays: text("work_days"),
    jobDescription2: text("job_description_2"), // 仕事内容2

    // Legal & schedule
    conflictDate: text("conflict_date"),
    contractPeriod: text("contract_period"), // "1month" | "3months" | "6months" | "1year"
    calendar: text("calendar"),
    closingDay: integer("closing_day"),
    closingDayText: text("closing_day_text"), // "20日" rich text
    paymentDay: integer("payment_day"),
    paymentDayText: text("payment_day_text"), // "翌月20日" rich text
    bankAccount: text("bank_account"),
    timeUnit: text("time_unit"),

    // Worker-specific schedule (作業者向け)
    workerClosingDay: text("worker_closing_day"), // 作業者締め日
    workerPaymentDay: text("worker_payment_day"), // 作業者支払日
    workerCalendar: text("worker_calendar"), // 作業者カレンダー

    // Agreement & compliance
    agreementPeriodEnd: text("agreement_period_end"), // 当該協定期間
    explainerName: text("explainer_name"), // 説明者

    // Training flags
    hasRobotTraining: integer("has_robot_training", { mode: "boolean" }).default(false), // 産業用ロボット特別教育 required for this line

    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("factory_unique_key").on(
      table.companyId,
      table.factoryName,
      table.department,
      table.lineName
    ),
    index("idx_factories_company").on(table.companyId),
    index("idx_factories_is_active").on(table.isActive),
    index("idx_factories_conflict_date").on(table.conflictDate),
  ]
);

// ─── 3. employees (392 activos) ──────────────────────────────────────

export const employees = sqliteTable(
  "employees",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeNumber: text("employee_number").notNull(),
    status: text("status", {
      enum: ["active", "inactive", "onLeave"],
    })
      .notNull()
      .default("active"),
    fullName: text("full_name").notNull(),
    katakanaName: text("katakana_name"),
    nationality: text("nationality"),
    gender: text("gender", { enum: ["male", "female", "other"] }),
    birthDate: text("birth_date"),
    hireDate: text("hire_date"),
    actualHireDate: text("actual_hire_date"),
    hourlyRate: real("hourly_rate"),
    billingRate: real("billing_rate"),
    clientEmployeeId: text("client_employee_id"), // 派遣先ID — ID assigned by client company
    visaExpiry: text("visa_expiry"),
    visaType: text("visa_type"),
    address: text("address"),
    postalCode: text("postal_code"),
    companyId: integer("company_id").references(() => clientCompanies.id),
    factoryId: integer("factory_id").references(() => factories.id),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("employee_number_unique").on(table.employeeNumber),
    index("idx_employees_company").on(table.companyId),
    index("idx_employees_factory").on(table.factoryId),
    index("idx_employees_status").on(table.status),
    index("idx_employees_company_status").on(table.companyId, table.status),
  ]
);

// ─── 4. contracts (個別契約書) ────────────────────────────────────────

export const contracts = sqliteTable(
  "contracts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contractNumber: text("contract_number").notNull(),
    status: text("status", {
      enum: ["draft", "active", "expired", "cancelled", "renewed"],
    })
      .notNull()
      .default("draft"),
    companyId: integer("company_id")
      .notNull()
      .references(() => clientCompanies.id),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id),

    // Dates
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    contractDate: text("contract_date").notNull(),
    notificationDate: text("notification_date").notNull(),
    conflictDateOverride: text("conflict_date_override"),

    // 16 Art. 26 legal fields (派遣法第26条)
    workDays: text("work_days"),
    workStartTime: text("work_start_time"),
    workEndTime: text("work_end_time"),
    breakMinutes: integer("break_minutes"),
    supervisorName: text("supervisor_name"),
    supervisorDept: text("supervisor_dept"),
    supervisorPhone: text("supervisor_phone"),
    complaintHandlerClient: text("complaint_handler_client"),
    complaintHandlerUns: text("complaint_handler_uns"),
    hakenmotoManager: text("hakenmoto_manager"),
    safetyMeasures: text("safety_measures"),
    terminationMeasures: text("termination_measures"),
    jobDescription: text("job_description"),
    responsibilityLevel: text("responsibility_level"),
    overtimeMax: text("overtime_max"),
    welfare: text("welfare"),
    isKyoteiTaisho: integer("is_kyotei_taisho", { mode: "boolean" }).default(false),

    // Rates
    hourlyRate: real("hourly_rate"),
    overtimeRate: real("overtime_rate"),
    nightShiftRate: real("night_shift_rate"),
    holidayRate: real("holiday_rate"),

    // Renewal chain
    previousContractId: integer("previous_contract_id").references(
      (): AnySQLiteColumn => contracts.id
    ),
    pdfPath: text("pdf_path"),
    notes: text("notes"),

    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("contract_number_unique").on(table.contractNumber),
    index("idx_contracts_company").on(table.companyId),
    index("idx_contracts_factory").on(table.factoryId),
    index("idx_contracts_status").on(table.status),
    index("idx_contracts_end_date").on(table.endDate),
    index("idx_contracts_status_end").on(table.status, table.endDate),
  ]
);

// ─── 5. contract_employees (N:M) ─────────────────────────────────────

export const contractEmployees = sqliteTable(
  "contract_employees",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contractId: integer("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    hourlyRate: real("hourly_rate"),
    individualStartDate: text("individual_start_date"),
    individualEndDate: text("individual_end_date"),
    isIndefinite: integer("is_indefinite", { mode: "boolean" }).default(false),
  },
  (table) => [
    index("idx_ce_contract").on(table.contractId),
    index("idx_ce_employee").on(table.employeeId),
    uniqueIndex("idx_ce_contract_employee").on(table.contractId, table.employeeId),
  ]
);

// ─── 6. factory_calendars (días de descanso por fábrica/año) ──────────

export const factoryCalendars = sqliteTable(
  "factory_calendars",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    holidays: text("holidays").notNull(), // JSON array of date strings ["2025-01-01", "2025-01-02", ...]
    description: text("description"), // "年末年始、GW、夏季休業" etc.
    totalWorkDays: integer("total_work_days"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("factory_calendar_unique").on(table.factoryId, table.year),
    index("idx_calendars_factory").on(table.factoryId),
  ]
);

// ─── 7. shift_templates (reusable shift/break patterns) ──────────────

export const shiftTemplates = sqliteTable("shift_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  workHours: text("work_hours").notNull(),
  breakTime: text("break_time").notNull(),
  shiftCount: integer("shift_count").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── 8. audit_log ────────────────────────────────────────────────────

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: text("timestamp").notNull().default(sql`(datetime('now'))`),
  action: text("action", {
    enum: ["create", "update", "delete", "export", "import"],
  }).notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  detail: text("detail"),
  userName: text("user_name").default("system"),
  operationId: text("operation_id"),
}, (table) => [
  index("idx_audit_timestamp").on(table.timestamp),
  index("idx_audit_operation_id").on(table.operationId),
]);

// ─── 9. pdf_versions (trazabilidad legal de PDFs generados) ──────────
// Registra el hash SHA256 de cada PDF generado. No almacena el binario —
// solo el fingerprint para probar qué se entregó en qué momento.

export const PDF_TYPES = [
  "kobetsu",
  "tsuchisho",
  "keiyakusho",
  "shugyojoken",
  "hakensakikanridaicho",
  "hakenmotokanridaicho",
  "koritsu_kobetsu",
  "koritsu_tsuchisho",
  "koritsu_hakensakidaicho",
] as const;

export type PdfType = (typeof PDF_TYPES)[number];

export const pdfVersions = sqliteTable(
  "pdf_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pdfType: text("pdf_type").notNull(),
    contractId: integer("contract_id").references(() => contracts.id, {
      onDelete: "set null",
    }),
    factoryId: integer("factory_id").references(() => factories.id, {
      onDelete: "set null",
    }),
    sha256: text("sha256").notNull(),
    byteLength: integer("byte_length").notNull(),
    generatedAt: text("generated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    generatedBy: text("generated_by").default("system"),
    regeneratedFrom: integer("regenerated_from").references(
      (): AnySQLiteColumn => pdfVersions.id,
      { onDelete: "set null" }
    ),
    metadata: text("metadata"), // JSON string con datos extra (employee count, period, etc.)
  },
  (table) => [
    index("idx_pdf_versions_type_contract").on(table.pdfType, table.contractId),
    index("idx_pdf_versions_generated_at").on(table.generatedAt),
  ]
);

// ─── Relations ───────────────────────────────────────────────────────

export const clientCompaniesRelations = relations(clientCompanies, ({ many }) => ({
  factories: many(factories),
  employees: many(employees),
  contracts: many(contracts),
}));

export const factoriesRelations = relations(factories, ({ one, many }) => ({
  company: one(clientCompanies, {
    fields: [factories.companyId],
    references: [clientCompanies.id],
  }),
  employees: many(employees),
  contracts: many(contracts),
  calendars: many(factoryCalendars),
}));

export const factoryCalendarsRelations = relations(factoryCalendars, ({ one }) => ({
  factory: one(factories, {
    fields: [factoryCalendars.factoryId],
    references: [factories.id],
  }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  company: one(clientCompanies, {
    fields: [employees.companyId],
    references: [clientCompanies.id],
  }),
  factory: one(factories, {
    fields: [employees.factoryId],
    references: [factories.id],
  }),
  contractAssignments: many(contractEmployees),
}));

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  company: one(clientCompanies, {
    fields: [contracts.companyId],
    references: [clientCompanies.id],
  }),
  factory: one(factories, {
    fields: [contracts.factoryId],
    references: [factories.id],
  }),
  previousContract: one(contracts, {
    fields: [contracts.previousContractId],
    references: [contracts.id],
  }),
  employees: many(contractEmployees),
}));

export const contractEmployeesRelations = relations(contractEmployees, ({ one }) => ({
  contract: one(contracts, {
    fields: [contractEmployees.contractId],
    references: [contracts.id],
  }),
  employee: one(employees, {
    fields: [contractEmployees.employeeId],
    references: [employees.id],
  }),
}));

// ─── Type exports ────────────────────────────────────────────────────

export type ClientCompany = typeof clientCompanies.$inferSelect;
export type NewClientCompany = typeof clientCompanies.$inferInsert;
export type Factory = typeof factories.$inferSelect;
export type NewFactory = typeof factories.$inferInsert;
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
export type ContractEmployee = typeof contractEmployees.$inferSelect;
export type NewContractEmployee = typeof contractEmployees.$inferInsert;
export type FactoryCalendar = typeof factoryCalendars.$inferSelect;
export type NewFactoryCalendar = typeof factoryCalendars.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
export type ShiftTemplate = typeof shiftTemplates.$inferSelect;
export type NewShiftTemplate = typeof shiftTemplates.$inferInsert;
export type PdfVersion = typeof pdfVersions.$inferSelect;
export type NewPdfVersion = typeof pdfVersions.$inferInsert;
