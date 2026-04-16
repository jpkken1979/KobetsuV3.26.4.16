// Service: factory_yearly_config + company_yearly_config — configuración por año fiscal (Oct～Sep)
import { db } from "../db/index.js";
import {
  factoryYearlyConfig,
  companyYearlyConfig,
  type FactoryYearlyConfig,
  type NewFactoryYearlyConfig,
  type CompanyYearlyConfig,
} from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";

/**
 * Determina el año fiscal a partir de la fecha de inicio del contrato.
 * Regla: mes >= 10 → fiscalYear = año; mes < 10 → fiscalYear = año - 1
 * Ej: 2024/10/01 → 2024 | 2025/03/01 → 2024 | 2022/10/01 → 2022
 */
export function getFiscalYear(startDate: string): number {
  const d = new Date(startDate.replace(/\//g, "-"));
  const month = d.getMonth() + 1; // 1-12
  const year = d.getFullYear();
  return month >= 10 ? year : year - 1;
}

/** Obtiene la config anual para una fábrica según la fecha de inicio del contrato. Retorna null si no existe. */
export async function getConfigForYear(
  factoryId: number,
  startDate: string
): Promise<FactoryYearlyConfig | null> {
  const fiscalYear = getFiscalYear(startDate);
  const config = await db.query.factoryYearlyConfig.findFirst({
    where: and(
      eq(factoryYearlyConfig.factoryId, factoryId),
      eq(factoryYearlyConfig.fiscalYear, fiscalYear)
    ),
  });
  return config ?? null;
}

/** Lista todas las configs de una fábrica ordenadas por año desc */
export async function getAllConfigsForFactory(factoryId: number): Promise<FactoryYearlyConfig[]> {
  const rows = await db
    .select()
    .from(factoryYearlyConfig)
    .where(eq(factoryYearlyConfig.factoryId, factoryId));
  return rows.sort((a, b) => b.fiscalYear - a.fiscalYear);
}

/** Crea una config anual para una fábrica */
export async function createYearlyConfig(
  data: Omit<NewFactoryYearlyConfig, "id" | "createdAt" | "updatedAt">
): Promise<FactoryYearlyConfig> {
  const rows = await db.insert(factoryYearlyConfig).values(data).returning();
  return rows[0];
}

/** Actualiza una config anual existente */
export async function updateYearlyConfig(
  id: number,
  data: Partial<Omit<NewFactoryYearlyConfig, "id" | "factoryId" | "createdAt" | "updatedAt">>
): Promise<FactoryYearlyConfig | null> {
  const rows = await db
    .update(factoryYearlyConfig)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(factoryYearlyConfig.id, id))
    .returning();
  return rows[0] ?? null;
}

/** Elimina una config anual */
export async function deleteYearlyConfig(id: number): Promise<void> {
  await db.delete(factoryYearlyConfig).where(eq(factoryYearlyConfig.id, id));
}

/** Retorna los factoryIds distintos que tienen al menos una config anual */
export async function getFactoryYearlyConfigSummary(): Promise<number[]> {
  const rows = await db
    .selectDistinct({ factoryId: factoryYearlyConfig.factoryId })
    .from(factoryYearlyConfig);
  return rows.map((r) => r.factoryId);
}

/** Copia la config de un año fiscal desde una fábrica origen a múltiples destinos (skips si ya existe) */
export function copyYearlyConfig(
  sourceFactoryId: number,
  fiscalYear: number,
  targetFactoryIds: number[]
): { copied: number; skipped: number } {
  const source = db
    .select()
    .from(factoryYearlyConfig)
    .where(
      and(
        eq(factoryYearlyConfig.factoryId, sourceFactoryId),
        eq(factoryYearlyConfig.fiscalYear, fiscalYear)
      )
    )
    .limit(1)
    .all()[0];

  if (!source) return { copied: 0, skipped: 0 };

  const now = new Date().toISOString();
  let copied = 0;
  let skipped = 0;

  db.transaction((tx) => {
    for (const targetId of targetFactoryIds) {
      const existing = tx
        .select({ id: factoryYearlyConfig.id })
        .from(factoryYearlyConfig)
        .where(
          and(
            eq(factoryYearlyConfig.factoryId, targetId),
            eq(factoryYearlyConfig.fiscalYear, fiscalYear)
          )
        )
        .limit(1)
        .all()[0];

      if (existing) {
        skipped++;
        continue;
      }

      tx.insert(factoryYearlyConfig)
        .values({
          factoryId: targetId,
          fiscalYear: source.fiscalYear,
          sagyobiText: source.sagyobiText,
          kyujitsuText: source.kyujitsuText,
          kyuukashori: source.kyuukashori,
          supervisorName: source.supervisorName,
          supervisorDept: source.supervisorDept,
          supervisorRole: source.supervisorRole,
          supervisorPhone: source.supervisorPhone,
          hakensakiManagerName: source.hakensakiManagerName,
          hakensakiManagerDept: source.hakensakiManagerDept,
          hakensakiManagerRole: source.hakensakiManagerRole,
          hakensakiManagerPhone: source.hakensakiManagerPhone,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      copied++;
    }
  });

  return { copied, skipped };
}

// ─── company_yearly_config ───────────────────────────────────────────

/** Obtiene la config anual de empresa para un año fiscal. Retorna null si no existe. */
export async function getCompanyConfigForYear(
  companyId: number,
  fiscalYear: number
): Promise<CompanyYearlyConfig | null> {
  const config = await db.query.companyYearlyConfig.findFirst({
    where: and(
      eq(companyYearlyConfig.companyId, companyId),
      eq(companyYearlyConfig.fiscalYear, fiscalYear)
    ),
  });
  return config ?? null;
}

/** Lista todas las configs de una empresa ordenadas por año desc */
export async function getAllConfigsForCompany(companyId: number): Promise<CompanyYearlyConfig[]> {
  return db
    .select()
    .from(companyYearlyConfig)
    .where(eq(companyYearlyConfig.companyId, companyId))
    .orderBy(desc(companyYearlyConfig.fiscalYear));
}

/** Crea una config anual para una empresa */
export async function createCompanyYearlyConfig(
  data: Pick<CompanyYearlyConfig, "companyId" | "fiscalYear"> & Partial<Pick<CompanyYearlyConfig, "kyujitsuText" | "kyuukashori" | "hakensakiManagerName" | "hakensakiManagerDept" | "hakensakiManagerRole" | "hakensakiManagerPhone">>
): Promise<CompanyYearlyConfig> {
  const rows = await db.insert(companyYearlyConfig).values(data).returning();
  return rows[0];
}

/** Actualiza una config anual de empresa existente */
export async function updateCompanyYearlyConfig(
  id: number,
  data: Partial<Omit<CompanyYearlyConfig, "id" | "companyId" | "createdAt" | "updatedAt">>
): Promise<CompanyYearlyConfig | null> {
  const rows = await db
    .update(companyYearlyConfig)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(companyYearlyConfig.id, id))
    .returning();
  return rows[0] ?? null;
}

/** Elimina una config anual de empresa */
export async function deleteCompanyYearlyConfig(id: number): Promise<void> {
  await db.delete(companyYearlyConfig).where(eq(companyYearlyConfig.id, id));
}
