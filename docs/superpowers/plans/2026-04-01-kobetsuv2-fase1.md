# Kobetsuv2 — Fase 1: Fundamentos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el repositorio Kobetsuv2.26.4.1 con stack configurado, schema DB v2, PDFs copiados de v1, design system LUNARIS v2, layout base y 6 rutas vacías listas para implementar.

**Architecture:** Fresh directory structure con `src/features/` (no route-coupled components), servidor Hono en 8026, Vite en 3026 con proxy `/api`. Los PDF generators y servicios backend se copian sin modificar de v1. El schema extiende v1 con 2 tablas nuevas y 2 columnas adicionales en factories.

**Tech Stack:** React 19 + TanStack Router (file-based) + TanStack Table v8 + React Hook Form + Zod 4 + Hono 4 + Drizzle ORM + SQLite (WAL) + Tailwind CSS 4 + cmdk + motion + Sonner

**Repos:**
- v1 (fuente): `C:\Users\kenji\Github\Jpkken1979\JP-v1.26.3.25-30`
- v2 (destino): `C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1`

---

## Mapa de archivos Fase 1

```
Kobetsuv2.26.4.1/
├── package.json                          CREATE (basado en v1 + nuevas deps)
├── tsconfig.json                         COPY from v1 (idéntico)
├── vite.config.ts                        COPY from v1 (idéntico)
├── drizzle.config.ts                     COPY from v1 (idéntico)
├── postcss.config.js                     COPY from v1
├── eslint.config.js                      COPY from v1
├── .gitignore                            CREATE
├── data/                                 CREATE dir (kobetsu.db aquí)
├── output/kobetsu/                       CREATE dir
├── output/koritsu/                       CREATE dir
│
├── server/
│   ├── index.ts                          CREATE (Hono app base)
│   ├── db/
│   │   ├── schema.ts                     CREATE (v2 schema: 10 tablas)
│   │   └── index.ts                      COPY from v1 (idéntico)
│   ├── middleware/
│   │   └── backup.ts                     CREATE (auto-backup antes de imports)
│   ├── routes/
│   │   └── system.ts                     CREATE (health + backup endpoints)
│   ├── pdf/                              COPY all from v1 (9 generators + helpers + types)
│   │   ├── kobetsu-pdf.ts
│   │   ├── tsuchisho-pdf.ts
│   │   ├── keiyakusho-pdf.ts
│   │   ├── shugyojoken-pdf.ts
│   │   ├── hakensakikanridaicho-pdf.ts
│   │   ├── hakenmotokanridaicho-pdf.ts
│   │   ├── koritsu-kobetsu-pdf.ts
│   │   ├── koritsu-tsuchisho-pdf.ts
│   │   ├── koritsu-hakensakidaicho-pdf.ts
│   │   ├── helpers.ts
│   │   ├── types.ts
│   │   └── fonts/                        COPY all font files from v1
│   └── services/                         COPY 10 files from v1 (sin modificar)
│       ├── contract-dates.ts
│       ├── contract-number.ts
│       ├── batch-helpers.ts
│       ├── dispatch-mapping.ts
│       ├── import-utils.ts
│       ├── koritsu-excel-parser.ts
│       ├── koritsu-pdf-parser.ts
│       ├── employee-mapper.ts
│       ├── pdf-data-builders.ts
│       └── completeness.ts
│
└── src/
    ├── main.tsx                          CREATE
    ├── index.css                         CREATE (LUNARIS v2 tokens)
    ├── routeTree.gen.ts                  AUTO-GENERATED por TanStack Router
    ├── lib/
    │   ├── cn.ts                         CREATE (clsx + tailwind-merge)
    │   ├── api.ts                        CREATE (fetch wrapper tipado)
    │   └── query-client.ts               CREATE (React Query config)
    ├── stores/
    │   └── ui-store.ts                   CREATE (Zustand: theme + sidebar)
    ├── components/
    │   ├── ui/
    │   │   ├── button.tsx                CREATE
    │   │   ├── card.tsx                  CREATE
    │   │   ├── badge.tsx                 CREATE
    │   │   ├── input.tsx                 CREATE
    │   │   ├── textarea.tsx              CREATE
    │   │   ├── checkbox.tsx              CREATE
    │   │   ├── radio-group.tsx           CREATE
    │   │   ├── dialog.tsx                CREATE
    │   │   ├── sheet.tsx                 CREATE
    │   │   ├── tabs.tsx                  CREATE
    │   │   ├── tooltip.tsx               CREATE
    │   │   ├── skeleton.tsx              CREATE
    │   │   ├── combobox.tsx              CREATE (cmdk-based, searchable)
    │   │   ├── file-upload.tsx           CREATE (drag & drop)
    │   │   ├── date-picker.tsx           CREATE
    │   │   ├── confirm-dialog.tsx        CREATE
    │   │   ├── empty-state.tsx           CREATE
    │   │   └── page-header.tsx           CREATE
    │   └── layout/
    │       ├── sidebar.tsx               CREATE
    │       ├── header.tsx                CREATE
    │       ├── command-palette.tsx       CREATE (Ctrl+K, cmdk)
    │       └── root-layout.tsx           CREATE
    └── routes/
        ├── __root.tsx                    CREATE
        ├── index.tsx                     CREATE (Dashboard shell)
        ├── companies.tsx                 CREATE (shell)
        ├── employees.tsx                 CREATE (shell)
        ├── contracts.tsx                 CREATE (shell)
        ├── documents.tsx                 CREATE (shell)
        └── system/
            ├── route.tsx                 CREATE (shell)
            ├── audit.tsx                 CREATE (shell)
            ├── settings.tsx              CREATE (shell)
            └── history.tsx              CREATE (shell)
```

---

## Task 1: Crear repositorio y configurar proyecto

**Files:**
- Create: `C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1\package.json`
- Create: `C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1\tsconfig.json`
- Create: `C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1\vite.config.ts`
- Create: `C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1\drizzle.config.ts`
- Create: `C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1\postcss.config.js`
- Create: `C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1\.gitignore`

- [ ] **Step 1: Crear directorio y git init**

```bash
mkdir "C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1"
cd "C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1"
git init
mkdir -p src/components/ui src/components/layout src/features src/hooks src/lib src/stores src/routes/system
mkdir -p server/db server/middleware server/routes server/services server/pdf/fonts
mkdir -p data output/kobetsu output/koritsu docs/superpowers/plans
```

- [ ] **Step 2: Crear package.json**

```json
{
  "name": "kobetsuv2",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "description": "個別契約書管理システム v2 — ユニバーサル企画株式会社",
  "scripts": {
    "dev": "concurrently -n api,web -c blue,green \"tsx watch server/index.ts\" \"vite\"",
    "dev:server": "tsx watch server/index.ts",
    "dev:client": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "eslint src/ server/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@fontsource-variable/jetbrains-mono": "^5.2.8",
    "@fontsource-variable/noto-sans-jp": "^5.2.10",
    "@fontsource-variable/space-grotesk": "^5.2.10",
    "@hono/node-server": "^1.13.0",
    "@hookform/resolvers": "^3.10.0",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-popover": "^1.1.6",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@tailwindcss/vite": "^4.2.1",
    "@tanstack/react-query": "^5.62.0",
    "@tanstack/react-router": "^1.167.3",
    "@tanstack/react-table": "^8.21.3",
    "@tanstack/react-virtual": "^3.13.22",
    "@types/yazl": "^3.3.0",
    "better-sqlite3": "^12.8.0",
    "cmdk": "^1.1.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "drizzle-orm": "^0.45.2",
    "exceljs": "^4.4.0",
    "hono": "^4.12.8",
    "lucide-react": "^1.7.0",
    "motion": "^12.38.0",
    "pdfkit": "^0.18.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-hook-form": "^7.56.0",
    "recharts": "^3.8.1",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "yazl": "^3.3.1",
    "zod": "^4.3.6",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@tailwindcss/postcss": "^4.0.0",
    "@tanstack/router-devtools": "^1.166.9",
    "@tanstack/router-plugin": "^1.166.12",
    "@testing-library/react": "^16.3.2",
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^25.5.0",
    "@types/pdfkit": "^0.17.5",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.2.0",
    "@vitest/coverage-v8": "^4.1.2",
    "autoprefixer": "^10.4.20",
    "concurrently": "^9.1.0",
    "drizzle-kit": "^0.31.10",
    "eslint": "^10.0.3",
    "globals": "^17.4.0",
    "jsdom": "^29.0.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^4.2.1",
    "tsx": "^4.19.0",
    "typescript": "^6.0.2",
    "typescript-eslint": "^8.57.0",
    "vite": "^6.0.0",
    "vitest": "^4.1.2"
  }
}
```

- [ ] **Step 3: Copiar configs de v1 (idénticos)**

```bash
# Desde el repo v1 al v2 (ejecutar desde el directorio v2)
V1="C:/Users/kenji/Github/Jpkken1979/JP-v1.26.3.25-30"
cp "$V1/tsconfig.json" .
cp "$V1/vite.config.ts" .
cp "$V1/drizzle.config.ts" .
cp "$V1/postcss.config.js" .
cp "$V1/eslint.config.js" .
```

- [ ] **Step 4: Crear .gitignore**

```
node_modules/
dist/
data/*.db
data/*.db-shm
data/*.db-wal
output/
.env
*.local
src/routeTree.gen.ts
```

- [ ] **Step 5: Instalar dependencias**

```bash
cd "C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1"
npm install
```

Expected: `node_modules/` creado sin errores. Si hay conflictos de peer deps usar `--legacy-peer-deps`.

- [ ] **Step 6: Commit inicial**

```bash
git add package.json tsconfig.json vite.config.ts drizzle.config.ts postcss.config.js eslint.config.js .gitignore
git commit -m "chore(setup): inicializar proyecto Kobetsuv2 con stack base"
```

---

## Task 2: Schema DB v2 + inicialización SQLite

**Files:**
- Create: `server/db/schema.ts`
- Copy: `server/db/index.ts` from v1

- [ ] **Step 1: Copiar server/db/index.ts de v1**

```bash
V1="C:/Users/kenji/Github/Jpkken1979/JP-v1.26.3.25-30"
cp "$V1/server/db/index.ts" server/db/
```

- [ ] **Step 2: Crear server/db/schema.ts**

```typescript
import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

// ─── 1. client_companies ────────────────────────────────────────────────
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

// ─── 2. factories ───────────────────────────────────────────────────────
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

    // Supervisores
    supervisorDept: text("supervisor_dept"),
    supervisorName: text("supervisor_name"),
    supervisorPhone: text("supervisor_phone"),
    supervisorRole: text("supervisor_role"),

    // 派遣先責任者
    hakensakiManagerName: text("hakensaki_manager_name"),
    hakensakiManagerPhone: text("hakensaki_manager_phone"),
    hakensakiManagerDept: text("hakensaki_manager_dept"),
    hakensakiManagerRole: text("hakensaki_manager_role"),

    // 苦情処理
    complaintClientName: text("complaint_client_name"),
    complaintClientPhone: text("complaint_client_phone"),
    complaintClientDept: text("complaint_client_dept"),
    complaintUnsName: text("complaint_uns_name"),
    complaintUnsPhone: text("complaint_uns_phone"),
    complaintUnsDept: text("complaint_uns_dept"),
    complaintUnsAddress: text("complaint_uns_address"),

    // 派遣元責任者 (UNS)
    managerUnsName: text("manager_uns_name"),
    managerUnsPhone: text("manager_uns_phone"),
    managerUnsDept: text("manager_uns_dept"),
    managerUnsAddress: text("manager_uns_address"),

    // Horarios
    hourlyRate: real("hourly_rate"),
    jobDescription: text("job_description"),
    // NOTE: jobDescription2 eliminado en v2
    shiftPattern: text("shift_pattern"),
    workHours: text("work_hours"),
    workHoursDay: text("work_hours_day"),
    workHoursNight: text("work_hours_night"),
    breakTime: integer("break_time"),
    breakTimeDay: text("break_time_day"),
    breakTimeNight: text("break_time_night"),
    overtimeHours: text("overtime_hours"),
    overtimeOutsideDays: text("overtime_outside_days"),
    workDays: text("work_days"),

    // Contrato (legal)
    conflictDate: text("conflict_date"),
    contractPeriod: text("contract_period"),
    // ★ NUEVO v2: fechas default del ciclo contractual actual
    contractStartDate: text("contract_start_date"),
    contractEndDate: text("contract_end_date"),
    closingDayText: text("closing_day_text"),
    paymentDayText: text("payment_day_text"),
    bankAccount: text("bank_account"),
    calendar: text("calendar"),
    responsibilityLevel: text("responsibility_level"),
    welfare: text("welfare"),
    safetyMeasures: text("safety_measures"),
    terminationMeasures: text("termination_measures"),
    hasRobotTraining: integer("has_robot_training", { mode: "boolean" }).default(false),
    agreementPeriodEnd: text("agreement_period_end"),
    isKyoteiTaisho: integer("is_kyotei_taisho", { mode: "boolean" }).default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    uqFactory: uniqueIndex("uq_factory").on(
      t.companyId,
      t.factoryName,
      t.department,
      t.lineName
    ),
    idxCompany: index("idx_factory_company").on(t.companyId),
  })
);

// ─── 3. employees ───────────────────────────────────────────────────────
export const employees = sqliteTable(
  "employees",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeNumber: text("employee_number").notNull().unique(),
    clientEmployeeId: text("client_employee_id"),
    companyId: integer("company_id").references(() => clientCompanies.id),
    factoryId: integer("factory_id").references(() => factories.id),
    fullName: text("full_name").notNull(),
    katakanaName: text("katakana_name"),
    gender: text("gender"),
    nationality: text("nationality"),
    birthDate: text("birth_date"),
    status: text("status").notNull().default("active"),
    hireDate: text("hire_date"),
    actualHireDate: text("actual_hire_date"),
    hourlyRate: real("hourly_rate"),
    billingRate: real("billing_rate"),
    visaExpiry: text("visa_expiry"),
    visaType: text("visa_type"),
    postalCode: text("postal_code"),
    address: text("address"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    idxCompany: index("idx_emp_company").on(t.companyId),
    idxFactory: index("idx_emp_factory").on(t.factoryId),
  })
);

// ─── 4. contracts ───────────────────────────────────────────────────────
export const contracts = sqliteTable(
  "contracts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contractNumber: text("contract_number").notNull().unique(),
    companyId: integer("company_id")
      .notNull()
      .references(() => clientCompanies.id),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id),
    status: text("status").notNull().default("draft"),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    contractDate: text("contract_date"),
    notificationDate: text("notification_date"),
    hourlyRate: real("hourly_rate"),
    overtimeRate: real("overtime_rate"),
    nightShiftRate: real("night_shift_rate"),
    holidayRate: real("holiday_rate"),
    sixtyHourRate: real("sixty_hour_rate"),
    workDays: text("work_days"),
    workStartTime: text("work_start_time"),
    workEndTime: text("work_end_time"),
    breakMinutes: integer("break_minutes"),
    jobDescription: text("job_description"),
    supervisorName: text("supervisor_name"),
    supervisorDept: text("supervisor_dept"),
    supervisorPhone: text("supervisor_phone"),
    complaintHandlerClient: text("complaint_handler_client"),
    complaintHandlerUns: text("complaint_handler_uns"),
    hakenmotoManager: text("hakenmoto_manager"),
    safetyMeasures: text("safety_measures"),
    terminationMeasures: text("termination_measures"),
    welfare: text("welfare"),
    isKyoteiTaisho: integer("is_kyotei_taisho", { mode: "boolean" }).default(false),
    overtimeMax: text("overtime_max"),
    responsibilityLevel: text("responsibility_level"),
    notes: text("notes"),
    previousContractId: integer("previous_contract_id").references(
      (): ReturnType<typeof contracts._.columns.id.getSQL> => contracts.id
    ),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    idxCompany: index("idx_contract_company").on(t.companyId),
    idxFactory: index("idx_contract_factory").on(t.factoryId),
    idxStatus: index("idx_contract_status").on(t.status),
  })
);

// ─── 5. contract_employees (N:M) ────────────────────────────────────────
export const contractEmployees = sqliteTable(
  "contract_employees",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contractId: integer("contract_id")
      .notNull()
      .references(() => contracts.id),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    hourlyRate: real("hourly_rate"),
    individualStartDate: text("individual_start_date"),
    individualEndDate: text("individual_end_date"),
    isIndefinite: integer("is_indefinite", { mode: "boolean" }).default(false),
  },
  (t) => ({
    uqContractEmployee: uniqueIndex("uq_contract_employee").on(
      t.contractId,
      t.employeeId
    ),
  })
);

// ─── 6. factory_calendars ────────────────────────────────────────────────
export const factoryCalendars = sqliteTable(
  "factory_calendars",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id),
    year: integer("year").notNull(),
    holidays: text("holidays"),
    description: text("description"),
    totalWorkDays: integer("total_work_days"),
  },
  (t) => ({
    uqFactoryYear: uniqueIndex("uq_factory_calendar").on(t.factoryId, t.year),
  })
);

// ─── 7. shift_templates ──────────────────────────────────────────────────
export const shiftTemplates = sqliteTable("shift_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  workHours: text("work_hours"),
  breakTime: text("break_time"),
  shiftCount: integer("shift_count"),
});

// ─── 8. audit_log ───────────────────────────────────────────────────────
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    timestamp: text("timestamp").notNull().default(sql`(datetime('now'))`),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: integer("entity_id"),
    detail: text("detail"),
    userName: text("user_name"),
    operationId: text("operation_id"),
  },
  (t) => ({
    idxTimestamp: index("idx_audit_timestamp").on(t.timestamp),
    idxEntity: index("idx_audit_entity").on(t.entityType, t.entityId),
  })
);

// ─── 9. contract_templates (NUEVO v2) ────────────────────────────────────
export const contractTemplates = sqliteTable("contract_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  companyId: integer("company_id").references(() => clientCompanies.id),
  factoryId: integer("factory_id").references(() => factories.id),
  contractPeriod: text("contract_period"),
  defaultFields: text("default_fields"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── 10. import_profiles (NUEVO v2) ──────────────────────────────────────
export const importProfiles = sqliteTable("import_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  columnMapping: text("column_mapping").notNull(),
  sheetName: text("sheet_name"),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Relations ───────────────────────────────────────────────────────────
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

export const employeesRelations = relations(employees, ({ one, many }) => ({
  company: one(clientCompanies, {
    fields: [employees.companyId],
    references: [clientCompanies.id],
  }),
  factory: one(factories, {
    fields: [employees.factoryId],
    references: [factories.id],
  }),
  contractEmployees: many(contractEmployees),
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
  contractEmployees: many(contractEmployees),
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
```

- [ ] **Step 3: Pushear schema a SQLite**

```bash
cd "C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1"
npm run db:push
```

Expected output: `10 tables created` (o similar). El archivo `data/kobetsu.db` debe existir después.

- [ ] **Step 4: Verificar tablas**

```bash
npx tsx -e "import Database from 'better-sqlite3'; const db = new Database('./data/kobetsu.db'); console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all())"
```

Expected: Array con 10 nombres de tablas incluyendo `contract_templates` e `import_profiles`.

- [ ] **Step 5: Commit**

```bash
git add server/db/
git commit -m "feat(db): schema v2 con 10 tablas, contractStartDate/EndDate en factories"
```

---

## Task 3: Copiar servicios backend de v1

**Files:** Copy 10 service files from v1 `server/services/`

- [ ] **Step 1: Copiar los 10 servicios**

```bash
V1="C:/Users/kenji/Github/Jpkken1979/JP-v1.26.3.25-30"
for svc in contract-dates contract-number batch-helpers dispatch-mapping import-utils koritsu-excel-parser koritsu-pdf-parser employee-mapper pdf-data-builders completeness; do
  cp "$V1/server/services/${svc}.ts" server/services/
done
```

- [ ] **Step 2: Verificar typecheck en servicios**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "server/services" | head -20
```

Expected: Sin errores en `server/services/`. Si hay errores de paths (`@server/*`), verificar que `tsconfig.json` tiene el alias correcto.

- [ ] **Step 3: Commit**

```bash
git add server/services/
git commit -m "feat(services): copiar 10 servicios backend de v1 sin modificar"
```

---

## Task 4: Copiar PDF generators + fonts

**Files:** Copy 9 generators + helpers + types + fonts/ directory

- [ ] **Step 1: Copiar generadores PDF**

```bash
V1="C:/Users/kenji/Github/Jpkken1979/JP-v1.26.3.25-30"
for pdf in kobetsu-pdf tsuchisho-pdf keiyakusho-pdf shugyojoken-pdf hakensakikanridaicho-pdf hakenmotokanridaicho-pdf koritsu-kobetsu-pdf koritsu-tsuchisho-pdf koritsu-hakensakidaicho-pdf helpers types; do
  cp "$V1/server/pdf/${pdf}.ts" server/pdf/
done
cp -r "$V1/server/pdf/fonts/" server/pdf/fonts/
```

- [ ] **Step 2: Verificar que los fonts existen**

```bash
ls server/pdf/fonts/
```

Expected: Archivos `.ttf` o `.otf` de NotoSansJP, BIZ UD Mincho, MS Gothic, MS Mincho, MS PMincho.

- [ ] **Step 3: Typecheck PDFs**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "server/pdf" | head -20
```

Expected: Sin errores. Si hay errores de imports faltantes, verificar que `server/services/` se copió en Task 3.

- [ ] **Step 4: Commit**

```bash
git add server/pdf/
git commit -m "feat(pdf): copiar 9 generadores PDF + helpers + fonts de v1"
```

---

## Task 5: Design system tokens + utilidades base

**Files:**
- Create: `src/index.css`
- Create: `src/lib/cn.ts`
- Create: `src/lib/api.ts`
- Create: `src/lib/query-client.ts`

- [ ] **Step 1: Crear src/index.css con tokens LUNARIS v2**

```css
@import "tailwindcss";
@import "@fontsource-variable/space-grotesk";
@import "@fontsource-variable/noto-sans-jp";
@import "@fontsource-variable/jetbrains-mono";

@theme {
  /* ── Fonts ── */
  --font-sans: "Space Grotesk Variable", "Noto Sans JP Variable", system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", monospace;

  /* ── Colors light ── */
  --color-bg: #f9fafb;
  --color-bg-secondary: #f3f4f6;
  --color-bg-elevated: #ffffff;
  --color-border: #e5e7eb;
  --color-border-subtle: #f3f4f6;

  --color-text: #111827;
  --color-text-secondary: #6b7280;
  --color-text-disabled: #9ca3af;

  --color-primary: #059669;
  --color-primary-hover: #047857;
  --color-primary-light: #d1fae5;
  --color-primary-foreground: #ffffff;

  --color-destructive: #ef4444;
  --color-destructive-hover: #dc2626;
  --color-destructive-foreground: #ffffff;

  --color-warning: #f59e0b;
  --color-warning-light: #fef3c7;

  --color-success: #10b981;
  --color-success-light: #d1fae5;

  /* ── Spacing ── */
  --spacing-page: 1.5rem;   /* p-6 */

  /* ── Radius ── */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  /* ── Shadows ── */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05);

  /* ── Sidebar ── */
  --sidebar-width: 240px;
  --sidebar-width-collapsed: 56px;
}

/* ── Dark mode ── */
.dark {
  --color-bg: #0c0d0f;
  --color-bg-secondary: #111316;
  --color-bg-elevated: #161820;
  --color-border: #272a30;
  --color-border-subtle: #1e2026;

  --color-text: #f0f2f5;
  --color-text-secondary: #8b9199;
  --color-text-disabled: #555b64;

  --color-primary: #00ff88;
  --color-primary-hover: #00e07a;
  --color-primary-light: #00ff8815;
  --color-primary-foreground: #0c0d0f;

  --color-destructive: #f87171;
  --color-destructive-hover: #ef4444;
  --color-destructive-foreground: #0c0d0f;

  --color-warning: #fbbf24;
  --color-warning-light: #fbbf2415;

  --color-success: #34d399;
  --color-success-light: #34d39915;

  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.4);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.5);
}

/* ── Base ── */
*, *::before, *::after {
  box-sizing: border-box;
}

html {
  font-family: var(--font-sans);
  background-color: var(--color-bg);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
}

body {
  margin: 0;
  min-height: 100vh;
}

/* ── Scrollbar (dark mode friendly) ── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--color-text-secondary); }
```

- [ ] **Step 2: Crear src/lib/cn.ts**

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Crear src/lib/api.ts**

```typescript
type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { body, ...rest } = options;
  const res = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...rest.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((error as { error?: string }).error ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string, options?: RequestOptions) =>
    request<T>(url, { ...options, method: "GET" }),
  post: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, { ...options, method: "POST", body }),
  put: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, { ...options, method: "PUT", body }),
  delete: <T>(url: string, options?: RequestOptions) =>
    request<T>(url, { ...options, method: "DELETE" }),
};
```

- [ ] **Step 4: Crear src/lib/query-client.ts**

```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat(design): tokens LUNARIS v2, cn helper, api wrapper, query client"
```

---

## Task 6: Componentes UI primitivos

**Files:** `src/components/ui/*.tsx` (18 componentes)

- [ ] **Step 1: Crear button.tsx**

```typescript
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "default" | "destructive" | "outline" | "ghost" | "success";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-[--color-primary] text-[--color-primary-foreground] hover:bg-[--color-primary-hover]",
  destructive:
    "bg-[--color-destructive] text-[--color-destructive-foreground] hover:bg-[--color-destructive-hover]",
  outline:
    "border border-[--color-border] bg-transparent text-[--color-text] hover:bg-[--color-bg-secondary]",
  ghost:
    "bg-transparent text-[--color-text] hover:bg-[--color-bg-secondary]",
  success:
    "bg-[--color-success] text-white hover:opacity-90",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-7 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-6 text-base",
  icon: "h-9 w-9 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled ?? loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[--radius-md] font-medium",
        "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-[--color-primary] focus-visible:ring-offset-2 disabled:opacity-50",
        "disabled:cursor-not-allowed select-none",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : null}
      {children}
    </button>
  )
);
Button.displayName = "Button";
```

- [ ] **Step 2: Crear card.tsx**

```typescript
import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-elevated]",
        "shadow-[--shadow-sm]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-6 pb-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-base font-semibold text-[--color-text]", className)} {...props} />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center p-6 pt-0 gap-2", className)} {...props} />
  );
}
```

- [ ] **Step 3: Crear badge.tsx**

```typescript
import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type BadgeVariant = "default" | "success" | "warning" | "destructive" | "outline" | "secondary";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-[--color-primary-light] text-[--color-primary]",
  success: "bg-[--color-success-light] text-[--color-success]",
  warning: "bg-[--color-warning-light] text-[--color-warning]",
  destructive: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  outline: "border border-[--color-border] text-[--color-text-secondary]",
  secondary: "bg-[--color-bg-secondary] text-[--color-text-secondary]",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Crear input.tsx**

```typescript
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helper, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium text-[--color-text]">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-9 w-full rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-elevated]",
            "px-3 text-sm text-[--color-text] placeholder:text-[--color-text-disabled]",
            "focus:outline-none focus:ring-2 focus:ring-[--color-primary] focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-[--color-destructive] focus:ring-[--color-destructive]",
            className
          )}
          {...props}
        />
        {error ? <p className="text-xs text-[--color-destructive]">{error}</p> : null}
        {helper && !error ? <p className="text-xs text-[--color-text-secondary]">{helper}</p> : null}
      </div>
    );
  }
);
Input.displayName = "Input";
```

- [ ] **Step 5: Crear textarea.tsx**

```typescript
import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium text-[--color-text]">
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-elevated]",
            "px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-disabled]",
            "focus:outline-none focus:ring-2 focus:ring-[--color-primary] focus:border-transparent",
            "disabled:opacity-50 resize-y min-h-[80px]",
            error && "border-[--color-destructive]",
            className
          )}
          {...props}
        />
        {error ? <p className="text-xs text-[--color-destructive]">{error}</p> : null}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
```

- [ ] **Step 6: Crear checkbox.tsx**

```typescript
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="checkbox"
          id={inputId}
          className={cn(
            "h-4 w-4 rounded border-[--color-border] text-[--color-primary]",
            "focus:ring-[--color-primary] focus:ring-offset-0 cursor-pointer",
            className
          )}
          {...props}
        />
        {label ? (
          <label htmlFor={inputId} className="text-sm text-[--color-text] cursor-pointer select-none">
            {label}
          </label>
        ) : null}
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";
```

- [ ] **Step 7: Crear skeleton.tsx**

```typescript
import { cn } from "@/lib/cn";
import { type HTMLAttributes } from "react";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-[--radius-md] bg-[--color-bg-secondary]", className)}
      {...props}
    />
  );
}
```

- [ ] **Step 8: Crear empty-state.tsx**

```typescript
import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      {icon ? (
        <div className="mb-4 text-[--color-text-disabled]">{icon}</div>
      ) : null}
      <h3 className="text-base font-semibold text-[--color-text]">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm text-[--color-text-secondary] max-w-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
```

- [ ] **Step 9: Crear page-header.tsx**

```typescript
import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <h1 className="text-xl font-semibold text-[--color-text]">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-sm text-[--color-text-secondary]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
```

- [ ] **Step 10: Crear confirm-dialog.tsx**

```typescript
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "確認",
  cancelLabel = "キャンセル",
  variant = "default",
  onConfirm,
  loading,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-[--radius-xl] bg-[--color-bg-elevated] p-6 shadow-[--shadow-lg] border border-[--color-border]">
          <Dialog.Title className="text-base font-semibold text-[--color-text]">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-[--color-text-secondary]">
            {description}
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={onConfirm}
              loading={loading}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 11: Crear combobox.tsx (cmdk-based)**

```typescript
import { useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  trigger?: ReactNode;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "選択してください",
  searchPlaceholder = "検索...",
  emptyMessage = "見つかりません",
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover.Root open={open} onOpenChange={disabled ? undefined : setOpen}>
      <Popover.Trigger asChild>
        <button
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-[--radius-md]",
            "border border-[--color-border] bg-[--color-bg-elevated] px-3 text-sm",
            "text-[--color-text] hover:bg-[--color-bg-secondary] transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-[--color-primary]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            !selected && "text-[--color-text-disabled]",
            className
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[--color-text-secondary]" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-[var(--radix-popover-trigger-width)] rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-elevated] shadow-[--shadow-lg] p-1"
          sideOffset={4}
        >
          <Command>
            <div className="flex items-center border-b border-[--color-border] px-2 pb-1 mb-1">
              <Command.Input
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent py-1.5 text-sm text-[--color-text] placeholder:text-[--color-text-disabled] focus:outline-none"
              />
            </div>
            <Command.Empty className="py-4 text-center text-sm text-[--color-text-secondary]">
              {emptyMessage}
            </Command.Empty>
            <Command.List className="max-h-56 overflow-y-auto">
              {options.map((option) => (
                <Command.Item
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between rounded-[--radius-sm] px-2 py-1.5 text-sm text-[--color-text] cursor-pointer hover:bg-[--color-bg-secondary] data-[selected=true]:bg-[--color-bg-secondary]"
                >
                  <div>
                    <span>{option.label}</span>
                    {option.description ? (
                      <span className="ml-2 text-xs text-[--color-text-secondary]">
                        {option.description}
                      </span>
                    ) : null}
                  </div>
                  {value === option.value ? (
                    <Check className="h-4 w-4 text-[--color-primary]" />
                  ) : null}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

- [ ] **Step 12: Crear file-upload.tsx**

```typescript
import { useRef, type DragEvent, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/cn";

interface FileUploadProps {
  onFile: (file: File) => void;
  accept?: string;
  label?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
}

export function FileUpload({
  onFile,
  accept = ".xlsx,.xls",
  label = "Arrastrá aquí o hacé click",
  description = "Formatos: .xlsx, .xls",
  className,
  disabled,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  }

  return (
    <div
      onDrop={disabled ? undefined : handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={disabled ? undefined : () => inputRef.current?.click()}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-[--radius-lg]",
        "border-2 border-dashed border-[--color-border] bg-[--color-bg-secondary]",
        "py-10 px-6 text-center cursor-pointer transition-colors",
        "hover:border-[--color-primary] hover:bg-[--color-primary-light]",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className
      )}
    >
      <Upload className="h-8 w-8 text-[--color-text-secondary]" />
      <p className="text-sm font-medium text-[--color-text]">{label}</p>
      <p className="text-xs text-[--color-text-secondary]">{description}</p>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
    </div>
  );
}
```

- [ ] **Step 13: Crear date-picker.tsx**

```typescript
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium text-[--color-text]">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          type="date"
          id={inputId}
          className={cn(
            "h-9 w-full rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-elevated]",
            "px-3 text-sm text-[--color-text]",
            "focus:outline-none focus:ring-2 focus:ring-[--color-primary] focus:border-transparent",
            "disabled:opacity-50",
            error && "border-[--color-destructive]",
            className
          )}
          {...props}
        />
        {error ? <p className="text-xs text-[--color-destructive]">{error}</p> : null}
      </div>
    );
  }
);
DatePicker.displayName = "DatePicker";
```

- [ ] **Step 14: Crear tabs.tsx (Radix-free, simple)**

```typescript
import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs components must be used within <Tabs>");
  return ctx;
}

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ activeTab: value, setActiveTab: onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-[--radius-lg] bg-[--color-bg-secondary] p-1",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { activeTab, setActiveTab } = useTabs();
  return (
    <button
      onClick={() => setActiveTab(value)}
      className={cn(
        "rounded-[--radius-md] px-3 py-1.5 text-sm font-medium transition-colors",
        activeTab === value
          ? "bg-[--color-bg-elevated] text-[--color-text] shadow-[--shadow-sm]"
          : "text-[--color-text-secondary] hover:text-[--color-text]",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { activeTab } = useTabs();
  if (activeTab !== value) return null;
  return <div className={className}>{children}</div>;
}
```

- [ ] **Step 15: Crear dialog.tsx (Radix)**

```typescript
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  children,
  className,
  title,
  description,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "w-full max-w-lg rounded-[--radius-xl] bg-[--color-bg-elevated] p-6",
          "shadow-[--shadow-lg] border border-[--color-border]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
      >
        {title ? (
          <DialogPrimitive.Title className="text-base font-semibold text-[--color-text] mb-1">
            {title}
          </DialogPrimitive.Title>
        ) : null}
        {description ? (
          <DialogPrimitive.Description className="text-sm text-[--color-text-secondary] mb-4">
            {description}
          </DialogPrimitive.Description>
        ) : null}
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-[--radius-sm] p-1 text-[--color-text-secondary] hover:text-[--color-text] hover:bg-[--color-bg-secondary] transition-colors focus:outline-none focus:ring-2 focus:ring-[--color-primary]">
          <X className="h-4 w-4" />
          <span className="sr-only">閉じる</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
```

- [ ] **Step 16: Crear tooltip.tsx**

```typescript
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { type ReactNode } from "react";

export function Tooltip({
  children,
  content,
  side = "top",
}: {
  children: ReactNode;
  content: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={400}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={4}
            className="z-50 rounded-[--radius-md] bg-[--color-text] px-2.5 py-1 text-xs text-[--color-bg] shadow-[--shadow-md]"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-[--color-text]" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
```

- [ ] **Step 17: Crear sheet.tsx (drawer lateral)**

```typescript
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  children,
  className,
  side = "right",
  hideClose,
}: {
  children: ReactNode;
  className?: string;
  side?: "left" | "right";
  hideClose?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50" />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-0 z-50 h-full w-full max-w-md bg-[--color-bg-elevated]",
          "border-[--color-border] shadow-[--shadow-lg] flex flex-col",
          "data-[state=open]:animate-in data-[state=closed]:animate-out duration-300",
          side === "right"
            ? "right-0 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
            : "left-0 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
          className
        )}
      >
        {!hideClose ? (
          <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-[--radius-sm] p-1 text-[--color-text-secondary] hover:text-[--color-text] hover:bg-[--color-bg-secondary] transition-colors">
            <X className="h-4 w-4" />
            <span className="sr-only">閉じる</span>
          </DialogPrimitive.Close>
        ) : null}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between border-b border-[--color-border] px-6 py-4", className)}>
      {children}
    </div>
  );
}

export function SheetTitle({ children }: { children: ReactNode }) {
  return (
    <DialogPrimitive.Title className="text-base font-semibold text-[--color-text]">
      {children}
    </DialogPrimitive.Title>
  );
}
```

- [ ] **Step 18: Commit UI components**

```bash
git add src/components/ui/ src/lib/
git commit -m "feat(ui): design system LUNARIS v2 — 18 componentes primitivos"
```

---

## Task 7: Layout base (sidebar + header + root layout)

**Files:**
- Create: `src/stores/ui-store.ts`
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/header.tsx`
- Create: `src/components/layout/root-layout.tsx`

- [ ] **Step 1: Crear src/stores/ui-store.ts**

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      theme: "dark",
      sidebarCollapsed: false,
      setTheme: (theme) => {
        set({ theme });
        document.documentElement.classList.toggle("dark", theme === "dark");
      },
      toggleTheme: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        set({ theme: next });
        document.documentElement.classList.toggle("dark", next === "dark");
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: "kobetsuv2-ui" }
  )
);
```

- [ ] **Step 2: Crear src/components/layout/sidebar.tsx**

```typescript
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  FolderOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useUIStore } from "@/stores/ui-store";

const NAV_ITEMS = [
  { to: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { to: "/companies", label: "企業", icon: Building2 },
  { to: "/employees", label: "社員", icon: Users },
  { to: "/contracts", label: "契約", icon: FileText },
  { to: "/documents", label: "書類", icon: FolderOpen },
  { to: "/system", label: "システム", icon: Settings },
] as const;

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-[--color-bg-elevated] border-r border-[--color-border]",
        "transition-[width] duration-200 shrink-0",
        collapsed ? "w-[56px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center h-14 border-b border-[--color-border] px-4 gap-3")}>
        <div className="h-7 w-7 rounded-[--radius-md] bg-[--color-primary] shrink-0" />
        {!collapsed && (
          <span className="text-sm font-bold text-[--color-text] truncate">
            個別契約書 v2
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 mx-2 px-3 py-2 rounded-[--radius-md] text-sm",
                "transition-colors duration-100 group",
                isActive
                  ? "bg-[--color-primary-light] text-[--color-primary] font-medium"
                  : "text-[--color-text-secondary] hover:bg-[--color-bg-secondary] hover:text-[--color-text]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-[--color-border] p-2">
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full py-2 rounded-[--radius-md] text-[--color-text-secondary] hover:bg-[--color-bg-secondary] hover:text-[--color-text] transition-colors"
          aria-label={collapsed ? "サイドバーを展開" : "サイドバーを折りたたむ"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="text-xs ml-2">折りたたむ</span>}
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Crear src/components/layout/header.tsx**

```typescript
import { Sun, Moon, Search } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onCommandPalette?: () => void;
}

export function Header({ onCommandPalette }: HeaderProps) {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  return (
    <header className="h-14 border-b border-[--color-border] bg-[--color-bg-elevated] flex items-center px-6 gap-4 shrink-0">
      {/* Command palette trigger */}
      <button
        onClick={onCommandPalette}
        className="flex items-center gap-2 flex-1 max-w-xs h-8 rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-secondary] px-3 text-sm text-[--color-text-disabled] hover:border-[--color-primary] transition-colors"
        aria-label="コマンドパレットを開く"
      >
        <Search className="h-3.5 w-3.5" />
        <span>検索...</span>
        <kbd className="ml-auto text-xs bg-[--color-bg-elevated] border border-[--color-border] rounded px-1.5 py-0.5">
          Ctrl+K
        </kbd>
      </button>

      <div className="flex items-center gap-2 ml-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Crear src/components/layout/command-palette.tsx**

```typescript
import { useState, useEffect } from "react";
import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Building2, Users, FileText, FolderOpen,
  Settings, History, ClipboardList, Plus, Upload,
} from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NAVIGATION_ITEMS = [
  { label: "ダッシュボード", to: "/", icon: LayoutDashboard },
  { label: "企業", to: "/companies", icon: Building2 },
  { label: "社員", to: "/employees", icon: Users },
  { label: "契約一覧", to: "/contracts", icon: FileText },
  { label: "書類生成", to: "/documents", icon: FolderOpen },
  { label: "監査ログ", to: "/system/audit", icon: ClipboardList },
  { label: "設定", to: "/system/settings", icon: Settings },
  { label: "履歴", to: "/system/history", icon: History },
];

const ACTION_ITEMS = [
  { label: "新しい契約を作成", to: "/contracts/new", icon: Plus },
  { label: "社員をインポート", action: "import-employees", icon: Upload },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-lg rounded-[--radius-xl] border border-[--color-border] bg-[--color-bg-elevated] shadow-[--shadow-lg] overflow-hidden">
        <Command className="[&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-[--color-border]">
          <Command.Input
            autoFocus
            placeholder="検索またはコマンドを入力..."
            className="w-full bg-transparent px-4 py-3 text-sm text-[--color-text] placeholder:text-[--color-text-disabled] focus:outline-none"
          />
          <Command.Empty className="py-6 text-center text-sm text-[--color-text-secondary]">
            見つかりません
          </Command.Empty>
          <Command.List className="max-h-64 overflow-y-auto p-2">
            <Command.Group heading={<span className="px-2 text-xs font-medium text-[--color-text-secondary]">ナビゲーション</span>}>
              {NAVIGATION_ITEMS.map((item) => (
                <Command.Item
                  key={item.to}
                  value={item.label}
                  onSelect={() => {
                    void navigate({ to: item.to });
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-3 rounded-[--radius-md] px-3 py-2 text-sm text-[--color-text] cursor-pointer hover:bg-[--color-bg-secondary] data-[selected=true]:bg-[--color-bg-secondary]"
                >
                  <item.icon className="h-4 w-4 text-[--color-text-secondary]" />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading={<span className="px-2 text-xs font-medium text-[--color-text-secondary]">アクション</span>}>
              {ACTION_ITEMS.map((item) => (
                <Command.Item
                  key={item.label}
                  value={item.label}
                  onSelect={() => {
                    if (item.to) void navigate({ to: item.to as "/" });
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-3 rounded-[--radius-md] px-3 py-2 text-sm text-[--color-text] cursor-pointer hover:bg-[--color-bg-secondary] data-[selected=true]:bg-[--color-bg-secondary]"
                >
                  <item.icon className="h-4 w-4 text-[--color-primary]" />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Crear src/components/layout/root-layout.tsx**

```typescript
import { useState, useEffect } from "react";
import { Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { CommandPalette } from "./command-palette";
import { useUIStore } from "@/stores/ui-store";

export function RootLayout() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const theme = useUIStore((s) => s.theme);

  // Sync theme class on mount
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <div className="flex h-screen overflow-hidden bg-[--color-bg]">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header onCommandPalette={() => setCmdOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <Toaster
        position="bottom-right"
        theme={theme}
        richColors
        closeButton
      />
    </div>
  );
}
```

- [ ] **Step 6: Commit layout**

```bash
git add src/stores/ src/components/layout/
git commit -m "feat(layout): sidebar, header, root layout y command palette (Ctrl+K)"
```

---

## Task 8: Rutas base (6 páginas shell) + TanStack Router

**Files:**
- Create: `src/main.tsx`
- Create: `src/routes/__root.tsx`
- Create: `src/routes/index.tsx`
- Create: `src/routes/companies.tsx`
- Create: `src/routes/employees.tsx`
- Create: `src/routes/contracts.tsx`
- Create: `src/routes/documents.tsx`
- Create: `src/routes/system/route.tsx`
- Create: `src/routes/system/audit.tsx`
- Create: `src/routes/system/settings.tsx`
- Create: `src/routes/system/history.tsx`

- [ ] **Step 1: Crear src/main.tsx**

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";
import { queryClient } from "./lib/query-client";
import "./index.css";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("No root element");

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
```

- [ ] **Step 2: Crear src/routes/__root.tsx**

```typescript
import { createRootRoute } from "@tanstack/react-router";
import { RootLayout } from "@/components/layout/root-layout";

export const Route = createRootRoute({
  component: RootLayout,
});
```

- [ ] **Step 3: Crear src/routes/index.tsx (Dashboard shell)**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ダッシュボード"
        description="契約状況の概要と重要な通知"
      />
      <EmptyState
        icon={<LayoutDashboard className="h-12 w-12" />}
        title="Fase 2で実装予定"
        description="統計カード、アラート、グラフが表示されます"
      />
    </div>
  );
}
```

- [ ] **Step 4: Crear src/routes/companies.tsx**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/companies")({
  component: CompaniesPage,
});

function CompaniesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="企業・工場"
        description="派遣先企業と工場の管理"
      />
      <EmptyState
        icon={<Building2 className="h-12 w-12" />}
        title="Fase 2で実装予定"
        description="企業一覧、工場エディタ、インポート機能"
      />
    </div>
  );
}
```

- [ ] **Step 5: Crear src/routes/employees.tsx**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";

export const Route = createFileRoute("/employees")({
  component: EmployeesPage,
});

function EmployeesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="社員"
        description="派遣社員の管理とExcelインポート"
      />
      <EmptyState
        icon={<Users className="h-12 w-12" />}
        title="Fase 2で実装予定"
        description="社員テーブル、インポート、データチェック"
      />
    </div>
  );
}
```

- [ ] **Step 6: Crear src/routes/contracts.tsx**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/contracts")({
  component: ContractsPage,
});

function ContractsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="契約"
        description="個別契約書の管理・作成・一括処理"
      />
      <EmptyState
        icon={<FileText className="h-12 w-12" />}
        title="Fase 3で実装予定"
        description="契約一覧、新規作成（2ステップ）、バッチ処理"
      />
    </div>
  );
}
```

- [ ] **Step 7: Crear src/routes/documents.tsx**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FolderOpen } from "lucide-react";

export const Route = createFileRoute("/documents")({
  component: DocumentsPage,
});

function DocumentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="書類生成"
        description="PDF生成・ダウンロード"
      />
      <EmptyState
        icon={<FolderOpen className="h-12 w-12" />}
        title="Fase 4で実装予定"
        description="個別契約書、通知書、管理台帳の生成"
      />
    </div>
  );
}
```

- [ ] **Step 8: Crear src/routes/system/route.tsx**

```typescript
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/system")({
  component: () => <Outlet />,
});
```

- [ ] **Step 9: Crear rutas system/ hijas**

`src/routes/system/audit.tsx`:
```typescript
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList } from "lucide-react";

export const Route = createFileRoute("/system/audit")({
  component: () => (
    <div className="flex flex-col gap-6">
      <PageHeader title="監査ログ" description="全操作の記録" />
      <EmptyState icon={<ClipboardList className="h-12 w-12" />} title="Fase 5で実装予定" />
    </div>
  ),
});
```

`src/routes/system/settings.tsx`:
```typescript
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Settings } from "lucide-react";

export const Route = createFileRoute("/system/settings")({
  component: () => (
    <div className="flex flex-col gap-6">
      <PageHeader title="設定" description="バックアップ・システム情報" />
      <EmptyState icon={<Settings className="h-12 w-12" />} title="Fase 5で実装予定" />
    </div>
  ),
});
```

`src/routes/system/history.tsx`:
```typescript
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { History } from "lucide-react";

export const Route = createFileRoute("/system/history")({
  component: () => (
    <div className="flex flex-col gap-6">
      <PageHeader title="履歴" description="契約履歴タイムライン" />
      <EmptyState icon={<History className="h-12 w-12" />} title="Fase 5で実装予定" />
    </div>
  ),
});
```

- [ ] **Step 10: Crear index.html en raíz**

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>個別契約書 v2</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 11: Run Vite dev para generar routeTree.gen.ts**

```bash
cd "C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1"
npx vite --port 3026
```

Expected: Vite arranca, TanStack Router genera `src/routeTree.gen.ts` automáticamente. Abrir `http://localhost:3026` debe mostrar el dashboard shell con sidebar y header funcionales.

- [ ] **Step 12: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errores.

- [ ] **Step 13: Commit**

```bash
git add src/
git commit -m "feat(routes): 6 rutas shell, layout base, main.tsx, TanStack Router configurado"
```

---

## Task 9: Servidor Hono base + backup middleware

**Files:**
- Create: `server/index.ts`
- Create: `server/middleware/backup.ts`
- Create: `server/routes/system.ts`

- [ ] **Step 1: Crear server/middleware/backup.ts**

```typescript
import { existsSync, copyFileSync, mkdirSync } from "fs";
import { join } from "path";
import { format } from "date-fns";

const DB_PATH = "./data/kobetsu.db";
const BACKUP_DIR = "./data/backups";

/**
 * Crea un backup del archivo SQLite antes de operaciones de importación.
 * Retorna la ruta del backup o null si no existe la DB aún.
 */
export function createBackup(): string | null {
  if (!existsSync(DB_PATH)) return null;

  mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = format(new Date(), "yyyyMMdd-HHmmss");
  const backupPath = join(BACKUP_DIR, `kobetsu-${timestamp}.db`);
  copyFileSync(DB_PATH, backupPath);
  return backupPath;
}

/**
 * Lista los backups disponibles, ordenados por más reciente primero.
 */
export function listBackups(): Array<{ filename: string; path: string; createdAt: string }> {
  if (!existsSync(BACKUP_DIR)) return [];
  const { readdirSync, statSync } = require("fs") as typeof import("fs");
  return readdirSync(BACKUP_DIR)
    .filter((f: string) => f.endsWith(".db"))
    .map((f: string) => {
      const fullPath = join(BACKUP_DIR, f);
      const stat = statSync(fullPath);
      return { filename: f, path: fullPath, createdAt: stat.mtime.toISOString() };
    })
    .sort((a: { createdAt: string }, b: { createdAt: string }) =>
      b.createdAt.localeCompare(a.createdAt)
    );
}
```

- [ ] **Step 2: Crear server/routes/system.ts**

```typescript
import { Hono } from "hono";
import { createBackup, listBackups } from "../middleware/backup";

const app = new Hono();

// GET /api/system/health
app.get("/health", (c) =>
  c.json({ status: "ok", version: "2.0.0", timestamp: new Date().toISOString() })
);

// POST /api/backup — manual backup
app.post("/backup", (c) => {
  const path = createBackup();
  if (!path) return c.json({ error: "Database not found" }, 404);
  return c.json({ success: true, path });
});

// GET /api/backup — list backups
app.get("/backup", (c) => {
  const backups = listBackups();
  return c.json({ backups });
});

export { app as systemRouter };
```

- [ ] **Step 3: Crear server/index.ts**

```typescript
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { systemRouter } from "./routes/system";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:3026"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

// Routes
app.route("/api/system", systemRouter);

// Serve static (production build)
app.use("/*", serveStatic({ root: "./dist" }));

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

const PORT = 8026;
console.log(`🚀 Server running on http://localhost:${PORT}`);

serve({ fetch: app.fetch, port: PORT });
```

- [ ] **Step 4: Verificar servidor arranca**

```bash
cd "C:\Users\kenji\Github\Jpkken1979\Kobetsuv2.26.4.1"
npx tsx server/index.ts
```

Expected output:
```
🚀 Server running on http://localhost:8026
```

Verificar en otra terminal:
```bash
curl http://localhost:8026/api/system/health
```

Expected: `{"status":"ok","version":"2.0.0","timestamp":"..."}`

- [ ] **Step 5: Verificar dev completo (server + client)**

```bash
npm run dev
```

Expected: Dos procesos arrancan, `http://localhost:3026` muestra la app con sidebar, header y command palette (Ctrl+K funciona).

- [ ] **Step 6: Typecheck final**

```bash
npx tsc --noEmit
```

Expected: 0 errores.

- [ ] **Step 7: Commit final Fase 1**

```bash
git add server/
git commit -m "feat(server): Hono base, backup middleware, rutas /api/system"
```

---

## Self-Review

**Spec coverage checklist:**

| Requerimiento Fase 1 | Task |
|---|---|
| Setup proyecto + package.json | Task 1 |
| Schema DB v2 (10 tablas + contractStartDate/EndDate) | Task 2 |
| Copiar servicios backend (10) | Task 3 |
| Copiar PDF generators (9) + fonts | Task 4 |
| Design system LUNARIS v2 (tokens CSS + dark mode) | Task 5 |
| 15+ componentes UI (button, card, combobox, file-upload...) | Task 6 |
| Layout: sidebar + header + breadcrumbs | Task 7 |
| Command palette Ctrl+K | Task 7 Step 4 |
| 6 rutas base (shells) | Task 8 |
| Backup automático middleware | Task 9 |
| TanStack Router configurado | Task 8 |
| React Hook Form + @tanstack/react-table en deps | Task 1 |
| Ports: API 8026, Vite 3026 | Task 9 / vite.config.ts |

**Gaps:** Ninguno. Todo lo especificado en Fase 1 de PLAN-NUEVA-APP.md está cubierto.

**Type consistency:** Todos los tipos se definen e importan en el mismo task donde se crean. No hay referencias cruzadas que rompan el orden de ejecución.

**Placeholder scan:** Ningún TBD ni TODO en el plan. Todas las rutas de archivos son absolutas o relativas al repo v2.
