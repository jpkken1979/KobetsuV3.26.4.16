/**
 * Tests para server/services/factory-yearly-config.ts.
 *
 * Cubre:
 *   - getFiscalYear: regla mes>=10 → year, mes<10 → year-1
 *   - getConfigForYear: lookup por (factoryId, fiscalYear)
 *   - getCompanyConfigForYear: lookup por (companyId, fiscalYear)
 *   - Cascada implícita: factory_yearly_config tiene prioridad sobre
 *     company_yearly_config (los consumidores hacen override field-by-field).
 *   - copyYearlyConfig: copia campos preservando los target con config existente.
 *   - getAllConfigsForFactory ordenado descendente por fiscalYear.
 *
 * Aislamiento: BEGIN/ROLLBACK por test.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db, sqlite } from "../db/index.js";
import { clientCompanies, factories, factoryYearlyConfig, companyYearlyConfig } from "../db/schema.js";
import {
  getFiscalYear,
  getConfigForYear,
  getCompanyConfigForYear,
  getAllConfigsForFactory,
  getAllConfigsForCompany,
  createYearlyConfig,
  updateYearlyConfig,
  deleteYearlyConfig,
  copyYearlyConfig,
  createCompanyYearlyConfig,
  updateCompanyYearlyConfig,
  getFactoryYearlyConfigSummary,
} from "../services/factory-yearly-config.js";

beforeEach(() => {
  sqlite.exec("BEGIN");
});

afterEach(() => {
  sqlite.exec("ROLLBACK");
});

async function setupCompanyAndFactory(
  companyName: string,
  factoryName: string,
): Promise<{ companyId: number; factoryId: number }> {
  const company = db
    .insert(clientCompanies)
    .values({ name: companyName })
    .returning()
    .get();
  const factory = db
    .insert(factories)
    .values({ companyId: company.id, factoryName })
    .returning()
    .get();
  return { companyId: company.id, factoryId: factory.id };
}

// ─── getFiscalYear ──────────────────────────────────────────────────────────

describe("getFiscalYear", () => {
  it("octubre = inicio del fiscal year (mes 10 → year)", () => {
    expect(getFiscalYear("2024-10-01")).toBe(2024);
    expect(getFiscalYear("2024-10-31")).toBe(2024);
  });

  it("noviembre y diciembre siguen en mismo fiscal year", () => {
    expect(getFiscalYear("2024-11-15")).toBe(2024);
    expect(getFiscalYear("2024-12-31")).toBe(2024);
  });

  it("enero a septiembre cae en fiscal year anterior", () => {
    expect(getFiscalYear("2025-01-01")).toBe(2024);
    expect(getFiscalYear("2025-03-15")).toBe(2024);
    expect(getFiscalYear("2025-09-30")).toBe(2024);
  });

  it("acepta fechas con / como separador", () => {
    expect(getFiscalYear("2024/10/01")).toBe(2024);
    expect(getFiscalYear("2025/03/15")).toBe(2024);
  });

  it("primer día del fiscal year cruza a octubre del año siguiente", () => {
    expect(getFiscalYear("2025-09-30")).toBe(2024);
    expect(getFiscalYear("2025-10-01")).toBe(2025);
  });
});

// ─── getConfigForYear ───────────────────────────────────────────────────────

describe("getConfigForYear (factory level)", () => {
  it("retorna null cuando no existe config para ese fiscal year", async () => {
    const { factoryId } = await setupCompanyAndFactory("TEST-FYC-1", "TEST-Factory-1");
    const result = await getConfigForYear(factoryId, "2024-10-01");
    expect(result).toBeNull();
  });

  it("retorna config existente para el fiscal year correcto", async () => {
    const { factoryId } = await setupCompanyAndFactory("TEST-FYC-2", "TEST-Factory-2");
    db.insert(factoryYearlyConfig).values({
      factoryId,
      fiscalYear: 2024,
      supervisorName: "TEST 山田",
      supervisorRole: "工長",
    }).run();

    const result = await getConfigForYear(factoryId, "2024-10-01");
    expect(result).not.toBeNull();
    expect(result?.supervisorName).toBe("TEST 山田");
    expect(result?.fiscalYear).toBe(2024);
  });

  it("getFiscalYear se aplica correctamente: 2025-03-15 → fiscalYear 2024", async () => {
    const { factoryId } = await setupCompanyAndFactory("TEST-FYC-3", "TEST-Factory-3");
    db.insert(factoryYearlyConfig).values({
      factoryId,
      fiscalYear: 2024,
      supervisorName: "TEST 古い",
    }).run();
    db.insert(factoryYearlyConfig).values({
      factoryId,
      fiscalYear: 2025,
      supervisorName: "TEST 新しい",
    }).run();

    // 2025-03-15 → fiscalYear 2024 → "古い"
    const old = await getConfigForYear(factoryId, "2025-03-15");
    expect(old?.supervisorName).toBe("TEST 古い");

    // 2025-10-01 → fiscalYear 2025 → "新しい"
    const newer = await getConfigForYear(factoryId, "2025-10-01");
    expect(newer?.supervisorName).toBe("TEST 新しい");
  });

  it("config de factory A no afecta lookup de factory B", async () => {
    const { factoryId: factoryA } = await setupCompanyAndFactory("TEST-FYC-4a", "TEST-Factory-A");
    const { factoryId: factoryB } = await setupCompanyAndFactory("TEST-FYC-4b", "TEST-Factory-B");

    db.insert(factoryYearlyConfig).values({
      factoryId: factoryA,
      fiscalYear: 2024,
      supervisorName: "TEST A only",
    }).run();

    const a = await getConfigForYear(factoryA, "2024-11-01");
    const b = await getConfigForYear(factoryB, "2024-11-01");
    expect(a?.supervisorName).toBe("TEST A only");
    expect(b).toBeNull();
  });
});

// ─── getCompanyConfigForYear (cascada — capa company) ─────────────────────

describe("getCompanyConfigForYear (company level)", () => {
  it("retorna null cuando no existe config a nivel empresa", async () => {
    const { companyId } = await setupCompanyAndFactory("TEST-FYC-5", "TEST-Factory-5");
    const result = await getCompanyConfigForYear(companyId, 2024);
    expect(result).toBeNull();
  });

  it("retorna config existente a nivel empresa", async () => {
    const { companyId } = await setupCompanyAndFactory("TEST-FYC-6", "TEST-Factory-6");
    db.insert(companyYearlyConfig).values({
      companyId,
      fiscalYear: 2024,
      kyujitsuText: "土日祝",
      hakensakiManagerName: "TEST 全社",
    }).run();

    const result = await getCompanyConfigForYear(companyId, 2024);
    expect(result?.kyujitsuText).toBe("土日祝");
    expect(result?.hakensakiManagerName).toBe("TEST 全社");
  });
});

// ─── Cascada implícita: factory > company > null ────────────────────────────

describe("cascada de configuración por fiscal year", () => {
  it("cuando ambos existen, factory_yearly_config tiene prioridad", async () => {
    const { companyId, factoryId } = await setupCompanyAndFactory("TEST-FYC-Cascade-1", "TEST-Factory-Cascade-1");

    // Empresa: hakensakiManager genérico
    db.insert(companyYearlyConfig).values({
      companyId,
      fiscalYear: 2024,
      hakensakiManagerName: "TEST 会社レベル",
      kyujitsuText: "土日",
    }).run();

    // Factory: override del nombre, sin kyujitsuText
    db.insert(factoryYearlyConfig).values({
      factoryId,
      fiscalYear: 2024,
      hakensakiManagerName: "TEST 工場レベル",
    }).run();

    const factoryCfg = await getConfigForYear(factoryId, "2024-10-01");
    const companyCfg = await getCompanyConfigForYear(companyId, 2024);

    // El consumidor (PDF generator) usa: factoryCfg.hakensakiManagerName ?? companyCfg.hakensakiManagerName
    expect(factoryCfg?.hakensakiManagerName).toBe("TEST 工場レベル");
    expect(companyCfg?.hakensakiManagerName).toBe("TEST 会社レベル");

    // Field-by-field cascade simulation:
    const resolved = factoryCfg?.hakensakiManagerName ?? companyCfg?.hakensakiManagerName ?? null;
    expect(resolved).toBe("TEST 工場レベル");
  });

  it("cuando factory no tiene config, cascade cae a company", async () => {
    const { companyId, factoryId } = await setupCompanyAndFactory("TEST-FYC-Cascade-2", "TEST-Factory-Cascade-2");

    db.insert(companyYearlyConfig).values({
      companyId,
      fiscalYear: 2024,
      hakensakiManagerName: "TEST 会社レベル",
    }).run();

    const factoryCfg = await getConfigForYear(factoryId, "2024-11-15");
    const companyCfg = await getCompanyConfigForYear(companyId, 2024);

    expect(factoryCfg).toBeNull();
    expect(companyCfg?.hakensakiManagerName).toBe("TEST 会社レベル");

    const resolved = factoryCfg?.hakensakiManagerName ?? companyCfg?.hakensakiManagerName ?? null;
    expect(resolved).toBe("TEST 会社レベル");
  });

  it("cuando ninguno tiene config, cascade resuelve a null", async () => {
    const { companyId, factoryId } = await setupCompanyAndFactory("TEST-FYC-Cascade-3", "TEST-Factory-Cascade-3");

    const factoryCfg = await getConfigForYear(factoryId, "2024-10-01");
    const companyCfg = await getCompanyConfigForYear(companyId, 2024);

    expect(factoryCfg).toBeNull();
    expect(companyCfg).toBeNull();

    const resolved = factoryCfg?.hakensakiManagerName ?? companyCfg?.hakensakiManagerName ?? null;
    expect(resolved).toBeNull();
  });

  it("factory tiene un campo, company tiene otro, cada uno gana en su slot", async () => {
    const { companyId, factoryId } = await setupCompanyAndFactory("TEST-FYC-Cascade-4", "TEST-Factory-Cascade-4");

    db.insert(companyYearlyConfig).values({
      companyId,
      fiscalYear: 2024,
      kyujitsuText: "土日祝",
      hakensakiManagerName: "TEST 全社マネージャー",
    }).run();

    db.insert(factoryYearlyConfig).values({
      factoryId,
      fiscalYear: 2024,
      supervisorName: "TEST ライン指揮命令者",
      // hakensakiManagerName NO seteado a nivel factory
    }).run();

    const fc = await getConfigForYear(factoryId, "2024-10-01");
    const cc = await getCompanyConfigForYear(companyId, 2024);

    // Resolver field-by-field como hace pdf-data-builders:
    const resolvedSupervisor = fc?.supervisorName ?? null; // factory only
    const resolvedHakensaki = fc?.hakensakiManagerName ?? cc?.hakensakiManagerName ?? null;
    const resolvedKyujitsu = fc?.kyujitsuText ?? cc?.kyujitsuText ?? null;

    expect(resolvedSupervisor).toBe("TEST ライン指揮命令者");
    expect(resolvedHakensaki).toBe("TEST 全社マネージャー");
    expect(resolvedKyujitsu).toBe("土日祝");
  });
});

// ─── CRUD operations ────────────────────────────────────────────────────────

describe("createYearlyConfig / updateYearlyConfig / deleteYearlyConfig", () => {
  it("createYearlyConfig persiste y se puede leer con getConfigForYear", async () => {
    const { factoryId } = await setupCompanyAndFactory("TEST-FYC-CRUD-1", "TEST-Factory-CRUD-1");

    const created = await createYearlyConfig({
      factoryId,
      fiscalYear: 2024,
      sagyobiText: "稼働",
      kyujitsuText: "土日",
    });

    expect(created.factoryId).toBe(factoryId);
    expect(created.sagyobiText).toBe("稼働");

    const fetched = await getConfigForYear(factoryId, "2024-10-01");
    expect(fetched?.id).toBe(created.id);
  });

  it("updateYearlyConfig modifica solo los campos pasados", async () => {
    const { factoryId } = await setupCompanyAndFactory("TEST-FYC-CRUD-2", "TEST-Factory-CRUD-2");
    const created = await createYearlyConfig({
      factoryId,
      fiscalYear: 2024,
      kyujitsuText: "Old",
      sagyobiText: "Original",
    });

    const updated = await updateYearlyConfig(created.id, { kyujitsuText: "New" });
    expect(updated?.kyujitsuText).toBe("New");
    expect(updated?.sagyobiText).toBe("Original"); // no tocado
  });

  it("updateYearlyConfig retorna null cuando id no existe", async () => {
    const result = await updateYearlyConfig(99999999, { kyujitsuText: "x" });
    expect(result).toBeNull();
  });

  it("deleteYearlyConfig elimina el registro", async () => {
    const { factoryId } = await setupCompanyAndFactory("TEST-FYC-CRUD-3", "TEST-Factory-CRUD-3");
    const created = await createYearlyConfig({
      factoryId,
      fiscalYear: 2024,
      kyujitsuText: "x",
    });

    await deleteYearlyConfig(created.id);

    const after = await getConfigForYear(factoryId, "2024-10-01");
    expect(after).toBeNull();
  });
});

describe("getAllConfigsForFactory / getAllConfigsForCompany", () => {
  it("getAllConfigsForFactory ordena por fiscalYear desc", async () => {
    const { factoryId } = await setupCompanyAndFactory("TEST-FYC-List-1", "TEST-Factory-List-1");
    db.insert(factoryYearlyConfig).values({ factoryId, fiscalYear: 2022 }).run();
    db.insert(factoryYearlyConfig).values({ factoryId, fiscalYear: 2024 }).run();
    db.insert(factoryYearlyConfig).values({ factoryId, fiscalYear: 2023 }).run();

    const list = await getAllConfigsForFactory(factoryId);
    expect(list.map((c) => c.fiscalYear)).toEqual([2024, 2023, 2022]);
  });

  it("getAllConfigsForCompany ordena por fiscalYear desc", async () => {
    const { companyId } = await setupCompanyAndFactory("TEST-FYC-List-2", "TEST-Factory-List-2");
    db.insert(companyYearlyConfig).values({ companyId, fiscalYear: 2023 }).run();
    db.insert(companyYearlyConfig).values({ companyId, fiscalYear: 2024 }).run();
    db.insert(companyYearlyConfig).values({ companyId, fiscalYear: 2022 }).run();

    const list = await getAllConfigsForCompany(companyId);
    expect(list.map((c) => c.fiscalYear)).toEqual([2024, 2023, 2022]);
  });
});

describe("copyYearlyConfig", () => {
  it("copia config desde source a targets sin config existente", async () => {
    const { factoryId: source } = await setupCompanyAndFactory("TEST-FYC-Copy-Src", "TEST-Factory-Source");
    const { factoryId: targetA } = await setupCompanyAndFactory("TEST-FYC-Copy-A", "TEST-Factory-TargetA");
    const { factoryId: targetB } = await setupCompanyAndFactory("TEST-FYC-Copy-B", "TEST-Factory-TargetB");

    db.insert(factoryYearlyConfig).values({
      factoryId: source,
      fiscalYear: 2024,
      supervisorName: "TEST 源",
      kyujitsuText: "土日",
    }).run();

    const result = copyYearlyConfig(source, 2024, [targetA, targetB]);
    expect(result.copied).toBe(2);
    expect(result.skipped).toBe(0);

    const aCfg = await getConfigForYear(targetA, "2024-10-01");
    const bCfg = await getConfigForYear(targetB, "2024-10-01");
    expect(aCfg?.supervisorName).toBe("TEST 源");
    expect(bCfg?.supervisorName).toBe("TEST 源");
  });

  it("skip targets que ya tienen config para ese fiscal year", async () => {
    const { factoryId: source } = await setupCompanyAndFactory("TEST-FYC-Copy-Src2", "TEST-Factory-Source2");
    const { factoryId: existing } = await setupCompanyAndFactory("TEST-FYC-Copy-Existing", "TEST-Factory-HasConfig");

    db.insert(factoryYearlyConfig).values({
      factoryId: source,
      fiscalYear: 2024,
      supervisorName: "TEST 源",
    }).run();
    db.insert(factoryYearlyConfig).values({
      factoryId: existing,
      fiscalYear: 2024,
      supervisorName: "TEST 既存", // ya existe
    }).run();

    const result = copyYearlyConfig(source, 2024, [existing]);
    expect(result.copied).toBe(0);
    expect(result.skipped).toBe(1);

    // Verificar que NO se sobreescribió
    const cfg = await getConfigForYear(existing, "2024-10-01");
    expect(cfg?.supervisorName).toBe("TEST 既存");
  });

  it("retorna copied=0 cuando source no tiene config", async () => {
    const { factoryId: source } = await setupCompanyAndFactory("TEST-FYC-Copy-Empty", "TEST-Factory-EmptySource");
    const { factoryId: target } = await setupCompanyAndFactory("TEST-FYC-Copy-Tgt", "TEST-Factory-Target");

    const result = copyYearlyConfig(source, 2024, [target]);
    expect(result.copied).toBe(0);
    expect(result.skipped).toBe(0);
  });
});

describe("createCompanyYearlyConfig / updateCompanyYearlyConfig", () => {
  it("createCompanyYearlyConfig persiste y se puede leer con getCompanyConfigForYear", async () => {
    const { companyId } = await setupCompanyAndFactory("TEST-FYC-CY-1", "TEST-Factory-CY-1");

    const created = await createCompanyYearlyConfig({
      companyId,
      fiscalYear: 2024,
      kyujitsuText: "土日祝",
    });
    expect(created.companyId).toBe(companyId);

    const fetched = await getCompanyConfigForYear(companyId, 2024);
    expect(fetched?.id).toBe(created.id);
  });

  it("updateCompanyYearlyConfig retorna null cuando id no existe", async () => {
    const result = await updateCompanyYearlyConfig(99999999, { kyujitsuText: "x" });
    expect(result).toBeNull();
  });
});

describe("getFactoryYearlyConfigSummary", () => {
  it("retorna IDs distintos de factories que tienen al menos una config", async () => {
    const { factoryId: f1 } = await setupCompanyAndFactory("TEST-FYC-Sum-1", "TEST-Factory-Sum-1");
    const { factoryId: f2 } = await setupCompanyAndFactory("TEST-FYC-Sum-2", "TEST-Factory-Sum-2");

    db.insert(factoryYearlyConfig).values({ factoryId: f1, fiscalYear: 2023 }).run();
    db.insert(factoryYearlyConfig).values({ factoryId: f1, fiscalYear: 2024 }).run();
    db.insert(factoryYearlyConfig).values({ factoryId: f2, fiscalYear: 2024 }).run();

    const summary = await getFactoryYearlyConfigSummary();
    expect(summary).toContain(f1);
    expect(summary).toContain(f2);
    // No duplicados — f1 aparece solo una vez aunque tenga 2 configs.
    const occurrencesF1 = summary.filter((id) => id === f1).length;
    expect(occurrencesF1).toBe(1);
  });
});
