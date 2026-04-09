/**
 * Seed script — populates SQLite with real production data
 * Run: npm run db:seed (or: tsx server/db/seed.ts)
 *
 * Reads JSON files from data/seed/ and inserts into the database.
 * Safe to run multiple times (truncates tables first).
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { clientCompanies, factories, employees } from "./schema.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Honor DATABASE_PATH so test runs and any deploy can target a separate file.
const requestedDbPath = process.env.DATABASE_PATH || "data/kobetsu.db";
const dbPath = path.isAbsolute(requestedDbPath)
  ? requestedDbPath
  : path.resolve(__dirname, "../..", requestedDbPath);
const seedDir = path.resolve(__dirname, "../../data/seed");

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });

function loadJson<T>(filename: string): T {
  const filepath = path.join(seedDir, filename);
  const raw = fs.readFileSync(filepath, "utf-8");
  return JSON.parse(raw) as T;
}

function normalizeCompanyName(name: string): string {
  const trimmed = name.trim();
  const aliases: Record<string, string> = {
    "フェニテックセミコンダクター(株)": "フェニテックセミコンダクター株式会社",
    "ﾃｨｰｹｰｴﾝｼﾞﾆｱﾘﾝｸﾞ株式会社": "TKE株式会社",
    "ティーケーエンジニアリング株式会社": "TKE株式会社",
  };
  return aliases[trimmed] ?? trimmed;
}

function hasForceFlag(): boolean {
  return process.argv.includes("--force") || process.env.FORCE_SEED === "true";
}

async function seed() {
  console.log("[seed] Starting database seed...");
  console.log(`[seed] DB path: ${dbPath}`);

  if (!hasForceFlag()) {
    console.error(
      "[seed] Blocked: this command resets the database. Use `npm run db:seed:force` (or pass --force) to continue."
    );
    sqlite.close();
    process.exit(1);
  }

  // Recreate tables from scratch so seed always matches current schema.
  // Also drop __drizzle_migrations so migrate() re-applies all migrations on next startup.
  sqlite.exec(`
    DROP TABLE IF EXISTS pdf_versions;
    DROP TABLE IF EXISTS factory_calendars;
    DROP TABLE IF EXISTS contract_employees;
    DROP TABLE IF EXISTS contracts;
    DROP TABLE IF EXISTS employees;
    DROP TABLE IF EXISTS factories;
    DROP TABLE IF EXISTS client_companies;
    DROP TABLE IF EXISTS audit_log;
    DROP TABLE IF EXISTS shift_templates;
    DROP TABLE IF EXISTS __drizzle_migrations;
  `);

  // Create tables using SQL aligned with server/db/schema.ts
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS client_companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_kana TEXT,
      short_name TEXT,
      address TEXT,
      phone TEXT,
      representative TEXT,
      conflict_date TEXT,
      contract_period INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS factories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES client_companies(id),
      factory_name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      department TEXT,
      line_name TEXT,
      supervisor_dept TEXT,
      supervisor_name TEXT,
      supervisor_phone TEXT,
      complaint_client_name TEXT,
      complaint_client_phone TEXT,
      complaint_client_dept TEXT,
      complaint_uns_name TEXT,
      complaint_uns_phone TEXT,
      complaint_uns_dept TEXT,
      manager_uns_name TEXT,
      manager_uns_phone TEXT,
      manager_uns_dept TEXT,
      hakensaki_manager_name TEXT,
      hakensaki_manager_phone TEXT,
      hakensaki_manager_dept TEXT,
      hakensaki_manager_role TEXT,
      hourly_rate REAL,
      job_description TEXT,
      shift_pattern TEXT,
      work_hours TEXT,
      work_hours_day TEXT,
      work_hours_night TEXT,
      break_time INTEGER,
      break_time_day TEXT,
      break_time_night TEXT,
      overtime_hours TEXT,
      overtime_outside_days TEXT,
      work_days TEXT,
      job_description_2 TEXT,
      conflict_date TEXT,
      contract_period TEXT,
      calendar TEXT,
      closing_day INTEGER,
      closing_day_text TEXT,
      payment_day INTEGER,
      payment_day_text TEXT,
      bank_account TEXT,
      time_unit TEXT,
      worker_closing_day TEXT,
      worker_payment_day TEXT,
      worker_calendar TEXT,
      agreement_period_end TEXT,
      explainer_name TEXT,
      has_robot_training INTEGER DEFAULT 0,
      complaint_uns_address TEXT,
      manager_uns_address TEXT,
      supervisor_role TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS factory_unique_key
      ON factories(company_id, factory_name, department, line_name);

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      full_name TEXT NOT NULL,
      katakana_name TEXT,
      nationality TEXT,
      gender TEXT,
      birth_date TEXT,
      hire_date TEXT,
      actual_hire_date TEXT,
      hourly_rate REAL,
      billing_rate REAL,
      client_employee_id TEXT,
      visa_expiry TEXT,
      visa_type TEXT,
      address TEXT,
      postal_code TEXT,
      company_id INTEGER REFERENCES client_companies(id),
      factory_id INTEGER REFERENCES factories(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS employee_number_unique
      ON employees(employee_number);

    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      company_id INTEGER NOT NULL REFERENCES client_companies(id),
      factory_id INTEGER NOT NULL REFERENCES factories(id),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      contract_date TEXT NOT NULL,
      notification_date TEXT NOT NULL,
      work_days TEXT,
      work_start_time TEXT,
      work_end_time TEXT,
      break_minutes INTEGER,
      supervisor_name TEXT,
      supervisor_dept TEXT,
      supervisor_phone TEXT,
      complaint_handler_client TEXT,
      complaint_handler_uns TEXT,
      hakenmoto_manager TEXT,
      safety_measures TEXT,
      termination_measures TEXT,
      job_description TEXT,
      responsibility_level TEXT,
      overtime_max TEXT,
      welfare TEXT,
      is_kyotei_taisho INTEGER DEFAULT 0,
      hourly_rate REAL,
      overtime_rate REAL,
      night_shift_rate REAL,
      holiday_rate REAL,
      previous_contract_id INTEGER REFERENCES contracts(id),
      conflict_date_override TEXT,
      pdf_path TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS contract_number_unique
      ON contracts(contract_number);

    CREATE TABLE IF NOT EXISTS contract_employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      hourly_rate REAL,
      individual_start_date TEXT,
      individual_end_date TEXT,
      is_indefinite INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      detail TEXT,
      user_name TEXT DEFAULT 'system',
      operation_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_audit_timestamp
      ON audit_log(timestamp);

    CREATE INDEX IF NOT EXISTS idx_audit_operation_id
      ON audit_log(operation_id);

    CREATE TABLE IF NOT EXISTS factory_calendars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      holidays TEXT NOT NULL,
      description TEXT,
      total_work_days INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS factory_calendar_unique
      ON factory_calendars(factory_id, year);

    CREATE TABLE IF NOT EXISTS shift_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      work_hours TEXT NOT NULL,
      break_time TEXT NOT NULL,
      shift_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pdf_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pdf_type TEXT NOT NULL,
      contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
      factory_id INTEGER REFERENCES factories(id) ON DELETE SET NULL,
      sha256 TEXT NOT NULL,
      byte_length INTEGER NOT NULL,
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      generated_by TEXT DEFAULT 'system',
      regenerated_from INTEGER REFERENCES pdf_versions(id) ON DELETE SET NULL,
      metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_pdf_versions_type_contract
      ON pdf_versions(pdf_type, contract_id);

    CREATE INDEX IF NOT EXISTS idx_pdf_versions_generated_at
      ON pdf_versions(generated_at);
  `);

  console.log("[seed] Tables created/verified");
  console.log("[seed] Existing schema reset");

  // 1. Seed companies
  interface CompanySeed {
    name: string;
    address?: string;
    phone?: string;
    representative?: string;
    shortName?: string;
  }

  const companiesData = loadJson<CompanySeed[]>("companies.json");
  const companyIdMap = new Map<string, number>();

  for (const c of companiesData) {
    const result = db
      .insert(clientCompanies)
      .values({
        name: c.name,
        address: c.address || null,
        phone: c.phone || null,
        representative: c.representative || null,
        shortName: c.shortName || null,
        isActive: true,
      })
      .returning()
      .get();
    companyIdMap.set(c.name, result.id);
  }
  console.log(`[seed] Inserted ${companiesData.length} companies`);

  // 2. Seed factories
  interface FactorySeed {
    companyName: string;
    factoryName: string;
    address?: string;
    phone?: string;
    department?: string;
    lineName?: string;
    hourlyRate?: number;
    jobDescription?: string;
    workHours?: string;
    breakTime?: number;
    overtimeHours?: string;
    workDays?: string;
    conflictDate?: string;
    calendar?: string;
    closingDay?: number;
    paymentDay?: number;
    bankAccount?: string;
    timeUnit?: number;
    supervisorName?: string;
    supervisorDept?: string;
    supervisorPhone?: string;
    complaintClientName?: string;
    complaintClientPhone?: string;
    complaintUnsName?: string;
    complaintUnsPhone?: string;
    managerUnsName?: string;
    managerUnsPhone?: string;
  }

  const factoriesData = loadJson<FactorySeed[]>("factories.json");
  const factoryIdMap = new Map<string, number>();

  for (const f of factoriesData) {
    const canonicalCompanyName = normalizeCompanyName(f.companyName);
    const companyId = companyIdMap.get(canonicalCompanyName);
    if (!companyId) {
      console.warn(`[seed] Company not found for factory: ${f.companyName}`);
      continue;
    }

    const result = db
      .insert(factories)
      .values({
        companyId,
        factoryName: f.factoryName || f.companyName || "本社",
        address: f.address || null,
        phone: f.phone || null,
        department: f.department || null,
        lineName: f.lineName || null,
        hourlyRate: f.hourlyRate ?? null,
        jobDescription: f.jobDescription || null,
        workHours: f.workHours || null,
        breakTime: f.breakTime ?? null,
        overtimeHours: f.overtimeHours ?? null,
        calendar: f.calendar || null,
        closingDay: f.closingDay ?? null,
        paymentDay: f.paymentDay ?? null,
        bankAccount: f.bankAccount || null,
        timeUnit: f.timeUnit ? String(f.timeUnit) : null,
        supervisorName: f.supervisorName || null,
        supervisorDept: f.supervisorDept || null,
        supervisorPhone: f.supervisorPhone || null,
        complaintClientName: f.complaintClientName || null,
        complaintClientPhone: f.complaintClientPhone || null,
        complaintUnsName: f.complaintUnsName || null,
        complaintUnsPhone: f.complaintUnsPhone || null,
        managerUnsName: f.managerUnsName || null,
        managerUnsPhone: f.managerUnsPhone || null,
        isActive: true,
      })
      .returning()
      .get();

    const key = `${canonicalCompanyName}|${f.factoryName}|${f.department}|${f.lineName}`;
    factoryIdMap.set(key, result.id);
  }
  console.log(`[seed] Inserted ${factoriesData.length} factories/lines`);

  // 3. Seed employees
  interface EmployeeSeed {
    employeeNumber: string;
    fullName: string;
    katakanaName?: string;
    nationality?: string;
    gender?: string;
    birthDate?: string;
    hireDate?: string;
    actualHireDate?: string;
    hourlyRate?: number;
    billingRate?: number;
    visaExpiry?: string;
    visaType?: string;
    postalCode?: string;
    address?: string;
    companyName?: string;
    status?: string;
  }

  const employeesData = loadJson<EmployeeSeed[]>("employees.json");
  let empCount = 0;

  for (const e of employeesData) {
    // Try to find company ID by name
    let companyId: number | null = null;
    if (e.companyName) {
      // Try exact match first, then search
      for (const [name, id] of companyIdMap) {
        if (name.includes(e.companyName) || e.companyName.includes(name)) {
          companyId = id;
          break;
        }
      }
    }

    db.insert(employees)
      .values({
        employeeNumber: e.employeeNumber,
        fullName: e.fullName,
        katakanaName: e.katakanaName || null,
        nationality: e.nationality || null,
        gender: e.gender as "male" | "female" | "other" | undefined,
        birthDate: e.birthDate || null,
        hireDate: e.hireDate || null,
        actualHireDate: e.actualHireDate || null,
        hourlyRate: e.hourlyRate ?? null,
        billingRate: e.billingRate ?? null,
        visaExpiry: e.visaExpiry || null,
        visaType: e.visaType || null,
        postalCode: e.postalCode || null,
        address: e.address || null,
        companyId,
        status: "active",
      })
      .run();
    empCount++;
  }
  console.log(`[seed] Inserted ${empCount} employees`);

  // Log the seed event
  db.insert(schema.auditLog)
    .values({
      action: "import",
      entityType: "system",
      detail: `Seed completed: ${companiesData.length} companies, ${factoriesData.length} factories, ${empCount} employees`,
      userName: "seed-script",
    })
    .run();

  console.log("[seed] Database seeded successfully!");
  console.log(`[seed] Summary:`);
  console.log(`  - Companies: ${companiesData.length}`);
  console.log(`  - Factories: ${factoriesData.length}`);
  console.log(`  - Employees: ${empCount}`);

  sqlite.close();
}

seed().catch((err) => {
  console.error("[seed] Error:", err);
  process.exit(1);
});
