/**
 * Integration tests for import-factories-service.ts — importFactories & buildFactoryData.
 *
 * Strategy: call the real service functions against kobetsu.test.db
 * (VITEST=true → db/index.ts picks the test file automatically).
 *
 * Cleanup: factories created here use factoryName prefix "TEST-" so we can
 * safely DELETE them in afterEach without touching production seeds.
 *
 * Critical domain rule under test:
 *   - Empty/null field in Excel → NEVER overwrites existing DB field
 *   - Only non-empty values update the DB
 *   - Contact fields (supervisor, manager, etc.) follow the same rule
 */
import { describe, it, expect, afterEach } from "vitest";
import { db, sqlite } from "../db/index.js";
import { factories, clientCompanies, auditLog } from "../db/schema.js";
import { like, inArray, eq } from "drizzle-orm";
import { importFactories, buildFactoryData } from "../services/import-factories-service.js";

// ─── Test DB constants ──────────────────────────────────────────────────────
// company_id=3 → 瑞陵精機株式会社
const TEST_COMPANY_ID = 3;
const TEST_COMPANY_NAME = "瑞陵精機株式会社";

// Factory names prefixed with TEST- for isolation
const FACT_NAME_BASIC = "TEST-Factory-Basic";
const FACT_NAME_CONTACT = "TEST-Factory-Contact";
const FACT_NAME_UPDATE = "TEST-Factory-Update";
const FACT_NAME_NULLSAFE = "TEST-Factory-NullSafe";
const FACT_NAME_RATE = "TEST-Factory-Rate";

// ─── Cleanup ────────────────────────────────────────────────────────────────

afterEach(() => {
  const testFactories = db
    .select({ id: factories.id })
    .from(factories)
    .where(like(factories.factoryName, "TEST-%"))
    .all();

  if (testFactories.length > 0) {
    const ids = testFactories.map((f) => f.id);
    db.delete(factories).where(inArray(factories.id, ids)).run();
    db.delete(auditLog).where(like(auditLog.detail, "%Excel import%")).run();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// importFactories — basic creation
// ═══════════════════════════════════════════════════════════════════════════════

describe("importFactories — creación básica", () => {
  it("inserta una fábrica nueva con los campos esperados", async () => {
    const rows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": FACT_NAME_BASIC,
        "部署": "製造部",
        "ライン名": "ライン1",
        "住所": "愛知県恵那市",
        "TEL": "0123-45-6789",
        "単価": 2500,
      },
    ];

    const result = await importFactories(rows, "upsert", [], []);

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    const inserted = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, FACT_NAME_BASIC))
      .all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].department).toBe("製造部");
    expect(inserted[0].lineName).toBe("ライン1");
    expect(inserted[0].address).toBe("愛知県恵那市");
    expect(inserted[0].phone).toBe("0123-45-6789");
    expect(inserted[0].hourlyRate).toBe(2500);
  });

  it("omite filas sin nombre de empresa", async () => {
    const rows = [
      {
        "工場名": FACT_NAME_BASIC,
        "部署": "製造部",
      },
    ];

    const result = await importFactories(rows, "upsert", [], []);

    expect(result.skipped).toBe(1);
    expect(result.inserted).toBe(0);
  });

  it("omite filas sin nombre de fábrica", async () => {
    const rows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "部署": "製造部",
      },
    ];

    const result = await importFactories(rows, "upsert", [], []);

    expect(result.skipped).toBe(1);
    expect(result.inserted).toBe(0);
  });

  it("escribe una entrada en audit_log tras la importación", async () => {
    const rows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": FACT_NAME_BASIC,
      },
    ];

    const before = db
      .select()
      .from(auditLog)
      .where(like(auditLog.detail, "%Excel import%"))
      .all().length;

    await importFactories(rows, "upsert", [], []);

    const after = db
      .select()
      .from(auditLog)
      .where(like(auditLog.detail, "%Excel import%"))
      .all().length;

    expect(after).toBeGreaterThan(before);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGLA CRÍTICA: Campo vacío en Excel → NO sobrescribe campo existente en DB
// ═══════════════════════════════════════════════════════════════════════════════

describe("importFactories — regla crítica: no sobrescribir con null/vacío", () => {
  it("campo vacío en Excel no sobrescribe campo existente en DB", async () => {
    // Insertar con datos iniciales
    const insertRows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": FACT_NAME_NULLSAFE,
        "部署": "製造部",
        "ライン名": "ライン1",
        "住所": "愛知県恵那市",
        "TEL": "0123-45-6789",
        "仕事内容": "部品製造",
      },
    ];

    await importFactories(insertRows, "upsert", [], []);

    const inserted = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, FACT_NAME_NULLSAFE))
      .all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].address).toBe("愛知県恵那市");
    expect(inserted[0].phone).toBe("0123-45-6789");
    expect(inserted[0].jobDescription).toBe("部品製造");

    // Actualizar con campo vacío — NO debe sobrescribir
    const updateRows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": FACT_NAME_NULLSAFE,
        "部署": "製造部",
        "ライン名": "ライン1",
        "住所": "", // ← vacío, no debe sobrescribir
        "TEL": "", // ← vacío, no debe sobrescribir
        "仕事内容": "", // ← vacío, no debe sobrescribir
      },
    ];

    await importFactories(updateRows, "upsert", [], []);

    const updated = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, FACT_NAME_NULLSAFE))
      .all();

    expect(updated).toHaveLength(1);
    // Los campos deben mantener sus valores originales
    expect(updated[0].address).toBe("愛知県恵那市");
    expect(updated[0].phone).toBe("0123-45-6789");
    expect(updated[0].jobDescription).toBe("部品製造");
  });

  it("valor real en Excel sí sobrescribe campo existente", async () => {
    // Insertar con dirección inicial
    const insertRows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": FACT_NAME_NULLSAFE,
        "部署": "製造部",
        "住所": "愛知県恵那市",
      },
    ];

    await importFactories(insertRows, "upsert", [], []);

    // Actualizar con nueva dirección
    const updateRows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": FACT_NAME_NULLSAFE,
        "部署": "製造部",
        "住所": "岐阜県美濃加茂市",
      },
    ];

    await importFactories(updateRows, "upsert", [], []);

    const updated = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, FACT_NAME_NULLSAFE))
      .all();

    expect(updated).toHaveLength(1);
    expect(updated[0].address).toBe("岐阜県美濃加茂市");
  });

  it("campo de contacto vacío no sobrescribe valor existente (派遣先責任者)", async () => {
    // Insertar con datos de contacto
    const insertRows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": FACT_NAME_CONTACT,
        "派遣先責任者氏名": "鈴木太郎",
        "派遣先責任者TEL": "090-1234-5678",
        "派遣先責任者部署": "人事部",
        "派遣先責任者役職": "部長",
      },
    ];

    await importFactories(insertRows, "upsert", [], []);

    const inserted = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, FACT_NAME_CONTACT))
      .all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].hakensakiManagerName).toBe("鈴木太郎");
    expect(inserted[0].hakensakiManagerPhone).toBe("090-1234-5678");

    // Actualizar con algunos campos vacíos
    const updateRows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": FACT_NAME_CONTACT,
        "派遣先責任者氏名": "", // ← vacío, no debe sobrescribir
        "派遣先責任者TEL": "090-9999-9999", // ← nuevo valor
        "派遣先責任者部署": "", // ← vacío, no debe sobrescribir
      },
    ];

    await importFactories(updateRows, "upsert", [], []);

    const updated = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, FACT_NAME_CONTACT))
      .all();

    expect(updated).toHaveLength(1);
    // Nombre debe mantener valor original
    expect(updated[0].hakensakiManagerName).toBe("鈴木太郎");
    // Teléfono debe actualizarse
    expect(updated[0].hakensakiManagerPhone).toBe("090-9999-9999");
    // Departamento debe mantener valor original
    expect(updated[0].hakensakiManagerDept).toBe("人事部");
  });

  it("campos numéricos null/vacío no sobrescribe números existentes", async () => {
    // Insertar con tarifa horaria
    const insertRows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": FACT_NAME_RATE,
        "単価": 2500,
      },
    ];

    await importFactories(insertRows, "upsert", [], []);

    const inserted = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, FACT_NAME_RATE))
      .all();

    expect(inserted[0].hourlyRate).toBe(2500);

    // Actualizar con campo vacío
    const updateRows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": FACT_NAME_RATE,
        "単価": "", // ← vacío, no debe sobrescribir
      },
    ];

    await importFactories(updateRows, "upsert", [], []);

    const updated = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, FACT_NAME_RATE))
      .all();

    expect(updated[0].hourlyRate).toBe(2500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Actualización (upsert vs skip) y matching
// ═══════════════════════════════════════════════════════════════════════════════

describe("importFactories — actualización y matching", () => {
  it("mode=upsert actualiza fábrica existente sin duplicar", async () => {
    // Insertar primero
    await importFactories(
      [
        {
          "会社名": TEST_COMPANY_NAME,
          "工場名": FACT_NAME_UPDATE,
          "部署": "製造部",
          "ライン名": "ライン1",
          "仕事内容": "ORIGINAL",
        },
      ],
      "upsert",
      [],
      [],
    );

    // Actualizar con contenido diferente
    const { updated } = await importFactories(
      [
        {
          "会社名": TEST_COMPANY_NAME,
          "工場名": FACT_NAME_UPDATE,
          "部署": "製造部",
          "ライン名": "ライン1",
          "仕事内容": "UPDATED",
        },
      ],
      "upsert",
      [],
      [],
    );

    expect(updated).toBe(1);

    const all = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, FACT_NAME_UPDATE))
      .all();

    // No debe haber duplicado
    expect(all).toHaveLength(1);
    expect(all[0].jobDescription).toBe("UPDATED");
  });

  it("mode=skip omite fábrica existente sin modificarla", async () => {
    // Insertar primero
    await importFactories(
      [
        {
          "会社名": TEST_COMPANY_NAME,
          "工場名": FACT_NAME_UPDATE,
          "部署": "製造部",
          "仕事内容": "SHOULD NOT CHANGE",
        },
      ],
      "upsert",
      [],
      [],
    );

    // Intentar actualizar con mode=skip
    const { skipped, updated } = await importFactories(
      [
        {
          "会社名": TEST_COMPANY_NAME,
          "工場名": FACT_NAME_UPDATE,
          "部署": "製造部",
          "仕事内容": "NEW CONTENT SKIP",
        },
      ],
      "skip",
      [],
      [],
    );

    expect(skipped).toBe(1);
    expect(updated).toBe(0);

    const all = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, FACT_NAME_UPDATE))
      .all();

    expect(all).toHaveLength(1);
    // El contenido original no debe haberse cambiado
    expect(all[0].jobDescription).toBe("SHOULD NOT CHANGE");
  });

  it("matching relajado: misma factory/line pero distinto dept → usa relaxed match", async () => {
    // Insertar con dept=製造部, line=ライン1
    const { inserted: inserted1 } = await importFactories(
      [
        {
          "会社名": TEST_COMPANY_NAME,
          "工場名": FACT_NAME_UPDATE,
          "部署": "製造部",
          "ライン名": "ライン1",
          "住所": "ORIGINAL",
        },
      ],
      "upsert",
      [],
      [],
    );
    expect(inserted1).toBe(1);

    // Actualizar mismo nombre + line pero distinto dept
    // Lógica: relaxedKey ignora dept, así que con una sola candidate hace match
    const { inserted: inserted2, updated: updated2 } = await importFactories(
      [
        {
          "会社名": TEST_COMPANY_NAME,
          "工場名": FACT_NAME_UPDATE,
          "部署": "営業部", // ← diferente dept
          "ライン名": "ライン1",
          "住所": "NEW",
        },
      ],
      "upsert",
      [],
      [],
    );

    // Con relaxed matching y una sola candidate, hace UPDATE
    expect(inserted2).toBe(0);
    expect(updated2).toBe(1);

    const all = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, FACT_NAME_UPDATE))
      .all();

    // Solo 1 fábrica (actualizada, el dept cambió)
    expect(all).toHaveLength(1);
    expect(all[0].department).toBe("営業部");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Campos de contacto específicos (派遣元責任者, 苦情処理, etc.)
// ═══════════════════════════════════════════════════════════════════════════════

describe("importFactories — campos de contacto complejos", () => {
  it("guarda datos completos de 派遣元責任者 (dispatch-side manager)", async () => {
    const rows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": FACT_NAME_CONTACT,
        "派遣元責任者部署": "営業部",
        "派遣元責任者氏名": "田中花子",
        "派遣元責任者TEL": "03-1234-5678",
        "派遣元責任者所在地": "東京都渋谷区",
      },
    ];

    await importFactories(rows, "upsert", [], []);

    const inserted = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, FACT_NAME_CONTACT))
      .all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].managerUnsDept).toBe("営業部");
    expect(inserted[0].managerUnsName).toBe("田中花子");
    expect(inserted[0].managerUnsPhone).toBe("03-1234-5678");
    expect(inserted[0].managerUnsAddress).toBe("東京都渋谷区");
  });

  it("guarda datos de 苦情処理 (complaint handling) para ambos lados", async () => {
    const rows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": FACT_NAME_CONTACT,
        "苦情処理(派遣先)部署": "品質管理部",
        "苦情処理(派遣先)氏名": "山田太郎",
        "苦情処理(派遣先)TEL": "052-999-8888",
        "苦情処理(派遣元)部署": "カスタマーサービス部",
        "苦情処理(派遣元)氏名": "佐藤花子",
        "苦情処理(派遣元)TEL": "03-777-6666",
        "苦情処理(派遣元)所在地": "東京都千代田区",
      },
    ];

    await importFactories(rows, "upsert", [], []);

    const inserted = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, FACT_NAME_CONTACT))
      .all();

    expect(inserted).toHaveLength(1);
    // Client-side complaint
    expect(inserted[0].complaintClientDept).toBe("品質管理部");
    expect(inserted[0].complaintClientName).toBe("山田太郎");
    expect(inserted[0].complaintClientPhone).toBe("052-999-8888");
    // Dispatch-side complaint
    expect(inserted[0].complaintUnsDept).toBe("カスタマーサービス部");
    expect(inserted[0].complaintUnsName).toBe("佐藤花子");
    expect(inserted[0].complaintUnsPhone).toBe("03-777-6666");
    expect(inserted[0].complaintUnsAddress).toBe("東京都千代田区");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Return value verification
// ═══════════════════════════════════════════════════════════════════════════════

describe("importFactories — retorno de FactoryImportResult", () => {
  it("retorna counters correctos tras insert/update/skip/error", async () => {
    // Insertar una fábrica existente
    await importFactories(
      [
        {
          "会社名": TEST_COMPANY_NAME,
          "工場名": FACT_NAME_BASIC,
          "部署": "製造部",
        },
      ],
      "upsert",
      [],
      [],
    );

    // Importar múltiples filas en second pass
    const result = await importFactories(
      [
        {
          "会社名": TEST_COMPANY_NAME,
          "工場名": FACT_NAME_BASIC,
          "部署": "製造部",
          "住所": "updated",
        }, // ← update
        {
          "会社名": TEST_COMPANY_NAME,
          "工場名": "TEST-NEW-FACTORY",
          "部署": "製造部",
        }, // ← insert
        {
          // ← skip (no company)
          "工場名": "ORPHAN",
          "部署": "製造部",
        },
      ],
      "upsert",
      [],
      [],
    );

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(result.companiesUpdated).toBeGreaterThanOrEqual(0);
  });

  it("retorna array de errors para filas problemáticas", async () => {
    const result = await importFactories(
      [
        {
          // ← fila sin empresa
          "工場名": FACT_NAME_BASIC,
        },
        {
          // ← fila sin factory name
          "会社名": TEST_COMPANY_NAME,
        },
      ],
      "upsert",
      [],
      [],
    );

    expect(result.skipped).toBe(2);
    expect(result.inserted).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Validación de tipos de datos (parseNum, booleanos, etc.) — via integration tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("importFactories — validación de tipos de datos", () => {
  it("guarda tarifa horaria como número (単価 → hourlyRate)", async () => {
    const rows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": FACT_NAME_RATE,
        "単価": 2500,
      },
    ];

    await importFactories(rows, "upsert", [], []);

    const inserted = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, FACT_NAME_RATE))
      .all();

    expect(inserted[0].hourlyRate).toBe(2500);
  });

  it("rechaza tarifa inválida (string no numérico) → null", async () => {
    const rows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": "TEST-Factory-Invalid-Rate",
        "単価": "invalid_number",
      },
    ];

    await importFactories(rows, "upsert", [], []);

    const inserted = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, "TEST-Factory-Invalid-Rate"))
      .all();

    expect(inserted[0].hourlyRate).toBeNull();
  });

  it("boolean hasRobotTraining: '○' y '1' → true", async () => {
    const rows1 = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": "TEST-Robot-Circle",
        "産業用ロボット特別教育": "○",
      },
    ];

    await importFactories(rows1, "upsert", [], []);

    const inserted1 = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, "TEST-Robot-Circle"))
      .all();

    expect(inserted1[0].hasRobotTraining).toBe(true);

    const rows2 = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": "TEST-Robot-One",
        "産業用ロボット特別教育": "1",
      },
    ];

    await importFactories(rows2, "upsert", [], []);

    const inserted2 = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, "TEST-Robot-One"))
      .all();

    expect(inserted2[0].hasRobotTraining).toBe(true);
  });

  it("empty hasRobotTraining field → null (no boolean coercion)", async () => {
    const rows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": "TEST-Robot-Empty",
        "産業用ロボット特別教育": "",
      },
    ];

    await importFactories(rows, "upsert", [], []);

    const inserted = db
      .select()
      .from(factories)
      .where(like(factories.factoryName, "TEST-Robot-Empty"))
      .all();

    expect(inserted[0].hasRobotTraining).toBeNull();
  });
});
