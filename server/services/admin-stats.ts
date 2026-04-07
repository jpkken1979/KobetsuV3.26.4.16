/**
 * Admin Statistics Service
 *
 * Computes aggregate statistics from the database for the admin stats dashboard.
 * Used by GET /api/admin/stats.
 */

import { db } from "../db/index.js";
import {
  clientCompanies,
  factories,
  employees,
  contracts,
  contractEmployees,
  factoryCalendars,
  shiftTemplates,
  auditLog,
} from "../db/schema.js";
import { count, sql, isNull, isNotNull, and, gte } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdminStats {
  counts: Record<string, number>;
  contractStatusDistribution: Record<string, number>;
  employeeStatusDistribution: Record<string, number>;
  nationalityDistribution: { nationality: string; count: number }[];
  monthlyContracts: { month: string; count: number }[];
  topFactories: { factoryId: number; factoryName: string; companyName: string; employeeCount: number }[];
  nullCounts: { table: string; column: string; nullCount: number }[];
  expiringContracts: {
    contractId: number;
    contractNumber: string;
    endDate: string;
    companyName: string;
    factoryName: string;
  }[];
}

const TABLE_NAMES = [
  "client_companies",
  "factories",
  "employees",
  "contracts",
  "contract_employees",
  "factory_calendars",
  "shift_templates",
  "audit_log",
] as const;

// ─── Main export ─────────────────────────────────────────────────────────────

export function computeAdminStats(): AdminStats {
  const counts = computeCounts();
  const contractStatusDistribution = computeContractStatusDistribution();
  const employeeStatusDistribution = computeEmployeeStatusDistribution();
  const nationalityDistribution = computeNationalityDistribution();
  const monthlyContracts = computeMonthlyContracts();
  const topFactories = computeTopFactories();
  const nullCounts = computeNullCounts();
  const expiringContracts = computeExpiringContracts();

  return {
    counts,
    contractStatusDistribution,
    employeeStatusDistribution,
    nationalityDistribution,
    monthlyContracts,
    topFactories,
    nullCounts,
    expiringContracts,
  };
}

// ─── Count all tables ────────────────────────────────────────────────────────

function computeCounts(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const name of TABLE_NAMES) {
    const table = getTable(name);
    if (!table) continue;
    const row = db.select({ count: count() }).from(table).get();
    result[name] = row?.count ?? 0;
  }
  return result;
}

function getTable(name: string) {
  switch (name) {
    case "client_companies": return clientCompanies;
    case "factories": return factories;
    case "employees": return employees;
    case "contracts": return contracts;
    case "contract_employees": return contractEmployees;
    case "factory_calendars": return factoryCalendars;
    case "shift_templates": return shiftTemplates;
    case "audit_log": return auditLog;
    default: return null;
  }
}

// ─── Contract status distribution ─────────────────────────────────────────────

function computeContractStatusDistribution(): Record<string, number> {
  const rows = db
    .select({ status: contracts.status, count: count() })
    .from(contracts)
    .groupBy(contracts.status)
    .all();

  return Object.fromEntries(rows.map((r) => [r.status, r.count]));
}

// ─── Employee status distribution ────────────────────────────────────────────

function computeEmployeeStatusDistribution(): Record<string, number> {
  const rows = db
    .select({ status: employees.status, count: count() })
    .from(employees)
    .groupBy(employees.status)
    .all();

  return Object.fromEntries(rows.map((r) => [r.status, r.count]));
}

// ─── Nationality distribution (top 10) ───────────────────────────────────────

function computeNationalityDistribution(): { nationality: string; count: number }[] {
  const namedRows = db
    .select({
      nationality: employees.nationality,
      count: count(),
    })
    .from(employees)
    .where(isNotNull(employees.nationality))
    .groupBy(employees.nationality)
    .all();

  const nullRows = db
    .select({
      nationality: sql<string>`'(未設定)'`.as("nationality"),
      count: count(),
    })
    .from(employees)
    .where(isNull(employees.nationality))
    .get();

  const all: { nationality: string; count: number }[] = [
    ...namedRows.map((r) => ({ nationality: r.nationality as string, count: r.count })),
  ];
  if (nullRows && nullRows.count > 0) {
    all.push({ nationality: "(未設定)", count: nullRows.count });
  }

  return all
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// ─── Monthly contracts (last 12 months) ──────────────────────────────────────

function computeMonthlyContracts(): { month: string; count: number }[] {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const cutoff = twelveMonthsAgo.toISOString().slice(0, 7); // YYYY-MM

  const rows = db
    .select({
      month: sql<string>`strftime('%Y-%m', ${contracts.startDate})`.as("month"),
      count: count(),
    })
    .from(contracts)
    .where(gte(contracts.startDate, cutoff))
    .groupBy(sql`strftime('%Y-%m', ${contracts.startDate})`)
    .orderBy(sql`strftime('%Y-%m', ${contracts.startDate})`)
    .all();

  return rows;
}

// ─── Top 10 factories by employee count ─────────────────────────────────────

function computeTopFactories(): {
  factoryId: number;
  factoryName: string;
  companyName: string;
  employeeCount: number;
}[] {
  const rows = db
    .select({
      factoryId: employees.factoryId,
      factoryName: factories.factoryName,
      companyName: clientCompanies.name,
      employeeCount: count(),
    })
    .from(employees)
    .innerJoin(factories, sql`${employees.factoryId} = ${factories.id}`)
    .innerJoin(clientCompanies, sql`${factories.companyId} = ${clientCompanies.id}`)
    .where(isNotNull(employees.factoryId))
    .groupBy(employees.factoryId)
    .orderBy(count())
    .limit(10)
    .all();

  return rows.map((r) => ({
    factoryId: r.factoryId as number,
    factoryName: r.factoryName as string,
    companyName: r.companyName as string,
    employeeCount: Number(r.employeeCount),
  }));
}

// ─── Null counts (employees + factories columns) ─────────────────────────────

function computeNullCounts(): { table: string; column: string; nullCount: number }[] {
  const result: { table: string; column: string; nullCount: number }[] = [];

  // employees — only nullable / meaningful columns
  const empCols = [
    "nationality", "gender", "birthDate", "hireDate", "actualHireDate",
    "hourlyRate", "billingRate", "clientEmployeeId", "visaExpiry", "visaType",
    "address", "postalCode", "companyId", "factoryId",
  ] as const;

  for (const col of empCols) {
    const row = db
      .select({ nullCount: count() })
      .from(employees)
      .where(isNull(employees[col]))
      .get();
    const nullCount = row?.nullCount ?? 0;
    if (nullCount > 0) {
      result.push({ table: "employees", column: col, nullCount });
    }
  }

  // factories — key nullable columns
  const factCols = [
    "address", "phone", "department", "lineName",
    "supervisorDept", "supervisorName", "supervisorPhone",
    "complaintClientName", "complaintClientPhone", "complaintClientDept",
    "complaintUnsName", "complaintUnsPhone", "complaintUnsDept",
    "complaintUnsAddress", "managerUnsName", "managerUnsPhone",
    "managerUnsDept", "managerUnsAddress",
    "hakensakiManagerName", "hakensakiManagerPhone",
    "hakensakiManagerDept", "hakensakiManagerRole",
    "supervisorRole", "hourlyRate", "jobDescription",
    "workHours", "workHoursDay", "workHoursNight",
    "breakTime", "breakTimeDay", "breakTimeNight",
    "overtimeHours", "overtimeOutsideDays", "workDays",
    "jobDescription2", "conflictDate", "contractPeriod",
    "calendar", "closingDay", "closingDayText",
    "paymentDay", "paymentDayText", "bankAccount",
    "timeUnit", "workerClosingDay", "workerPaymentDay",
    "workerCalendar", "agreementPeriodEnd", "explainerName",
  ] as const;

  for (const col of factCols) {
    const row = db
      .select({ nullCount: count() })
      .from(factories)
      .where(isNull(factories[col]))
      .get();
    const nullCount = row?.nullCount ?? 0;
    if (nullCount > 0) {
      result.push({ table: "factories", column: col, nullCount });
    }
  }

  return result.sort((a, b) => b.nullCount - a.nullCount);
}

// ─── Expiring contracts (next 90 days) ───────────────────────────────────────

function computeExpiringContracts(): {
  contractId: number;
  contractNumber: string;
  endDate: string;
  companyName: string;
  factoryName: string;
}[] {
  const today = new Date();
  const ninetyDaysLater = new Date(today);
  ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);
  const todayStr = today.toISOString().split("T")[0];
  const laterStr = ninetyDaysLater.toISOString().split("T")[0];

  const rows = db
    .select({
      contractId: contracts.id,
      contractNumber: contracts.contractNumber,
      endDate: contracts.endDate,
      companyName: clientCompanies.name,
      factoryName: factories.factoryName,
    })
    .from(contracts)
    .innerJoin(clientCompanies, sql`${contracts.companyId} = ${clientCompanies.id}`)
    .innerJoin(factories, sql`${contracts.factoryId} = ${factories.id}`)
    .where(
      and(
        sql`${contracts.endDate} >= ${todayStr}`,
        sql`${contracts.endDate} <= ${laterStr}`,
      )
    )
    .orderBy(contracts.endDate)
    .all();

  return rows.map((r) => ({
    contractId: r.contractId as number,
    contractNumber: r.contractNumber as string,
    endDate: r.endDate as string,
    companyName: r.companyName as string,
    factoryName: r.factoryName as string,
  }));
}
