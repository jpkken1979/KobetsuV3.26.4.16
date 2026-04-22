import { db } from "../db/index.js";
import { contracts, employees, clientCompanies, factories, auditLog } from "../db/schema.js";
import { count, eq, and, gte, lte, desc, like, isNotNull } from "drizzle-orm";
import { toLocalDateStr } from "./contract-dates.js";
import { escapeLike } from "./db-utils.js";

export interface DashboardStats {
  companies: number;
  factories: number;
  activeEmployees: number;
  totalContracts: number;
  activeContracts: number;
  expiringInDays: number;
}

export interface AuditQueryParams {
  limit: number;
  offset: number;
  action?: string;
  entityType?: string;
  search?: string;
}

export async function getDashboardStats(warningDays: number): Promise<DashboardStats> {
  const today = toLocalDateStr(new Date());
  const expiryWindow = toLocalDateStr(new Date(Date.now() + warningDays * 24 * 60 * 60 * 1000));

  const [
    totalCompanies,
    totalFactories,
    totalActiveEmployees,
    totalContracts,
    activeContracts,
    expiringContracts,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(clientCompanies)
      .where(eq(clientCompanies.isActive, true)),
    db
      .select({ count: count() })
      .from(factories)
      .where(eq(factories.isActive, true)),
    db
      .select({ count: count() })
      .from(employees)
      .where(eq(employees.status, "active")),
    db.select({ count: count() }).from(contracts),
    db
      .select({ count: count() })
      .from(contracts)
      .where(eq(contracts.status, "active")),
    db
      .select({ count: count() })
      .from(contracts)
      .where(
        and(
          eq(contracts.status, "active"),
          gte(contracts.endDate, today),
          lte(contracts.endDate, expiryWindow)
        )
      ),
  ]);

  return {
    companies: totalCompanies[0].count,
    factories: totalFactories[0].count,
    activeEmployees: totalActiveEmployees[0].count,
    totalContracts: totalContracts[0].count,
    activeContracts: activeContracts[0].count,
    expiringInDays: expiringContracts[0].count,
  };
}

/**
 * Obtiene contratos activos que vencen dentro de los proximos warningDays dias.
 */
export async function getExpiringContracts(warningDays: number) {
  const today = toLocalDateStr(new Date());
  const expiryWindow = toLocalDateStr(new Date(Date.now() + warningDays * 24 * 60 * 60 * 1000));

  return db.query.contracts.findMany({
    where: and(
      eq(contracts.status, "active"),
      gte(contracts.endDate, today),
      lte(contracts.endDate, expiryWindow)
    ),
    orderBy: [contracts.endDate],
    with: { company: true, factory: true, employees: true },
  });
}

/**
 * Obtiene fabricas con fecha de抵触日 proxima dentro de warningDays dias.
 */
export async function getTeishokubiAlerts(warningDays: number) {
  const today = toLocalDateStr(new Date());
  const warningDate = toLocalDateStr(new Date(Date.now() + warningDays * 24 * 60 * 60 * 1000));

  return db.query.factories.findMany({
    where: and(
      eq(factories.isActive, true),
      isNotNull(factories.conflictDate),
      gte(factories.conflictDate, today),
      lte(factories.conflictDate, warningDate)
    ),
    with: { company: true },
    orderBy: (t, { asc }) => [asc(t.conflictDate)],
  });
}

/**
 * Obtiene empleados activos con visa proxima a vencer en los proximos 90 dias.
 */
export async function getVisaExpiryAlerts() {
  const today = toLocalDateStr(new Date());
  const ninetyDaysLater = toLocalDateStr(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

  return db.query.employees.findMany({
    where: and(
      eq(employees.status, "active"),
      isNotNull(employees.visaExpiry),
      gte(employees.visaExpiry, today),
      lte(employees.visaExpiry, ninetyDaysLater)
    ),
    with: { company: true },
    orderBy: (t, { asc }) => [asc(t.visaExpiry)],
  });
}

/**
 * Obtiene la distribucion de empleados activos por nacionalidad.
 */
export function getNationalityBreakdown() {
  const results = db
    .select({
      nationality: employees.nationality,
      count: count(),
    })
    .from(employees)
    .where(eq(employees.status, "active"))
    .groupBy(employees.nationality)
    .orderBy(desc(count()))
    .all();

  return results.map((r) => ({
    nationality: r.nationality || "不明",
    count: r.count,
  }));
}

/**
 * Obtiene la distribucion de empleados activos por empresa cliente.
 */
export function getByCompanyBreakdown() {
  const results = db
    .select({
      companyName: clientCompanies.name,
      count: count(),
    })
    .from(employees)
    .leftJoin(clientCompanies, eq(employees.companyId, clientCompanies.id))
    .where(eq(employees.status, "active"))
    .groupBy(clientCompanies.name)
    .orderBy(desc(count()))
    .all();

  return results.map((r) => ({
    companyName: r.companyName || "未配属",
    count: r.count,
  }));
}

/**
 * Obtiene registros del audit log con filtros opcionales y paginacion.
 */
export async function getAuditLogs(params: AuditQueryParams) {
  const { limit, offset, action, entityType, search } = params;

  const conditions = [
    action ? eq(auditLog.action, action as typeof auditLog.action.enumValues[number]) : undefined,
    entityType ? eq(auditLog.entityType, entityType) : undefined,
    search ? like(auditLog.detail, `%${escapeLike(search)}%`) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [results, totalResult] = await Promise.all([
    db.query.auditLog.findMany({
      where: whereClause,
      orderBy: [desc(auditLog.timestamp)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(auditLog).where(whereClause),
  ]);

  return { logs: results, total: totalResult[0].count };
}
