/**
 * Integration tests for import-employees.ts — importEmployees & buildEmployeeData.
 *
 * Strategy: call the real service functions against kobetsu.test.db
 * (VITEST=true → db/index.ts picks the test file automatically).
 *
 * Cleanup: employees created here use employeeNumber prefix "TEST-" so we can
 * safely DELETE them in afterEach without touching production seeds.
 *
 * Critical domain rule under test:
 *   - 派遣先ID = "0"  → clientEmployeeId = null
 *   - 配属先 / 配属ライン empty or "0" → factoryId = null (never infer)
 */
import { describe, it, expect, afterEach } from "vitest";
import { db } from "../db/index.js";
import { employees, auditLog } from "../db/schema.js";
import { like, inArray } from "drizzle-orm";
import { importEmployees, buildEmployeeData } from "../services/import-employees.js";
import { buildFactoryLookup } from "../services/import-assignment.js";

// ─── Test DB constants (verified in kobetsu.test.db) ─────────────────────────
// company_id=3 → 瑞陵精機株式会社
// factory_id=1 → 恵那工場, department=製造部, line=等速ジョイント, company_id=3
const TEST_COMPANY_ID = 3;
const TEST_COMPANY_NAME = "瑞陵精機株式会社";
const TEST_FACTORY_ID = 1;
const TEST_DEPT = "製造部";
const TEST_LINE = "等速ジョイント";

// Employee numbers prefixed with TEST- to isolate cleanup
const EMP_NUM_BASIC = "TEST-001";
const EMP_NUM_FACTORY_ZERO = "TEST-002";
const EMP_NUM_FACTORY_EMPTY = "TEST-003";
const EMP_NUM_UPDATE = "TEST-004";
const EMP_NUM_RATES = "TEST-005";
const EMP_NUM_SKIP = "TEST-006";

// ─── Cleanup ──────────────────────────────────────────────────────────────────

afterEach(() => {
  const testEmps = db
    .select({ id: employees.id })
    .from(employees)
    .where(like(employees.employeeNumber, "TEST-%"))
    .all();

  if (testEmps.length > 0) {
    const ids = testEmps.map((e) => e.id);
    db.delete(employees).where(inArray(employees.id, ids)).run();
    db.delete(auditLog).where(like(auditLog.detail, "%Excel import%")).run();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// importEmployees — importación básica
// ═══════════════════════════════════════════════════════════════════════════════

describe("importEmployees — importación básica", () => {
  it("inserta un empleado nuevo con los campos esperados", async () => {
    const rows = [
      {
        "社員番号": EMP_NUM_BASIC,
        "氏名": "NGUYEN VAN TEST",
        "フリガナ": "グエン バン テスト",
        "性別": "男",
        "国籍": "ベトナム",
        "時給": 1500,
        "請求単価": 2000,
      },
    ];

    const { result } = await importEmployees(rows, "upsert");

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(0);

    const inserted = db
      .select()
      .from(employees)
      .where(like(employees.employeeNumber, "TEST-001"))
      .all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].fullName).toBe("NGUYEN VAN TEST");
    expect(inserted[0].katakanaName).toBe("グエン バン テスト");
    expect(inserted[0].gender).toBe("male");
    expect(inserted[0].nationality).toBe("ベトナム");
  });

  it("omite filas sin número de empleado", async () => {
    const rows = [{ "氏名": "SIN NUMERO" }];
    const { result } = await importEmployees(rows, "upsert");
    expect(result.skipped).toBe(1);
    expect(result.inserted).toBe(0);
  });

  it("omite filas sin nombre completo", async () => {
    const rows = [{ "社員番号": EMP_NUM_BASIC }];
    const { result } = await importEmployees(rows, "upsert");
    expect(result.skipped).toBe(1);
    expect(result.inserted).toBe(0);
  });

  it("escribe una entrada en audit_log tras la importación", async () => {
    const rows = [
      {
        "社員番号": EMP_NUM_BASIC,
        "氏名": "AUDIT LOG TEST",
        "時給": 1400,
      },
    ];

    const before = db
      .select()
      .from(auditLog)
      .where(like(auditLog.detail, "%Excel import%"))
      .all().length;

    await importEmployees(rows, "upsert");

    const after = db
      .select()
      .from(auditLog)
      .where(like(auditLog.detail, "%Excel import%"))
      .all().length;

    expect(after).toBeGreaterThan(before);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGLA CRÍTICA: 派遣先ID = "0" → clientEmployeeId = null
// ═══════════════════════════════════════════════════════════════════════════════

describe("importEmployees — regla crítica: 派遣先ID=0 → null", () => {
  it('派遣先ID "0" se guarda como clientEmployeeId = null', async () => {
    const rows = [
      {
        "社員番号": EMP_NUM_FACTORY_ZERO,
        "氏名": "TEST FACTORY ZERO",
        "派遣先ID": "0",
      },
    ];

    await importEmployees(rows, "upsert");

    const inserted = db
      .select()
      .from(employees)
      .where(like(employees.employeeNumber, EMP_NUM_FACTORY_ZERO))
      .all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].clientEmployeeId).toBeNull();
  });

  it('派遣先ID numérico 0 se guarda como clientEmployeeId = null', async () => {
    const rows = [
      {
        "社員番号": EMP_NUM_FACTORY_ZERO,
        "氏名": "TEST NUMERIC ZERO",
        "派遣先ID": 0,
      },
    ];

    await importEmployees(rows, "upsert");

    const inserted = db
      .select()
      .from(employees)
      .where(like(employees.employeeNumber, EMP_NUM_FACTORY_ZERO))
      .all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].clientEmployeeId).toBeNull();
  });

  it('派遣先ID vacío se guarda como clientEmployeeId = null', async () => {
    const rows = [
      {
        "社員番号": EMP_NUM_FACTORY_ZERO,
        "氏名": "TEST EMPTY ID",
        "派遣先ID": "",
      },
    ];

    await importEmployees(rows, "upsert");

    const inserted = db
      .select()
      .from(employees)
      .where(like(employees.employeeNumber, EMP_NUM_FACTORY_ZERO))
      .all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].clientEmployeeId).toBeNull();
  });

  it('派遣先ID con valor real se guarda correctamente', async () => {
    const rows = [
      {
        "社員番号": EMP_NUM_FACTORY_ZERO,
        "氏名": "TEST REAL ID",
        "派遣先ID": "A-1234",
      },
    ];

    await importEmployees(rows, "upsert");

    const inserted = db
      .select()
      .from(employees)
      .where(like(employees.employeeNumber, EMP_NUM_FACTORY_ZERO))
      .all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].clientEmployeeId).toBe("A-1234");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGLA CRÍTICA: 配属先 / 配属ライン vacíos → factoryId = null (nunca inferir)
// ═══════════════════════════════════════════════════════════════════════════════

describe("importEmployees — regla crítica: 配属先 vacío → factoryId = null", () => {
  it("配属先 y 配属ライン vacíos → factoryId = null", async () => {
    const rows = [
      {
        "社員番号": EMP_NUM_FACTORY_EMPTY,
        "氏名": "TEST NO FACTORY",
        "配属先": "",
        "配属ライン": "",
        "派遣先": TEST_COMPANY_NAME,
      },
    ];

    await importEmployees(rows, "upsert");

    const inserted = db
      .select()
      .from(employees)
      .where(like(employees.employeeNumber, EMP_NUM_FACTORY_EMPTY))
      .all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].factoryId).toBeNull();
  });

  it('配属先 = "0" → factoryId = null', async () => {
    const rows = [
      {
        "社員番号": EMP_NUM_FACTORY_EMPTY,
        "氏名": "TEST ZERO DEPT",
        "配属先": "0",
        "配属ライン": "0",
        "派遣先": TEST_COMPANY_NAME,
      },
    ];

    await importEmployees(rows, "upsert");

    const inserted = db
      .select()
      .from(employees)
      .where(like(employees.employeeNumber, EMP_NUM_FACTORY_EMPTY))
      .all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].factoryId).toBeNull();
  });

  it("sin campo 配属先 en la fila → factoryId = null", async () => {
    // No 配属先 key at all — must NOT infer from company name
    const rows = [
      {
        "社員番号": EMP_NUM_FACTORY_EMPTY,
        "氏名": "TEST MISSING DEPT",
        "派遣先": TEST_COMPANY_NAME,
      },
    ];

    await importEmployees(rows, "upsert");

    const inserted = db
      .select()
      .from(employees)
      .where(like(employees.employeeNumber, EMP_NUM_FACTORY_EMPTY))
      .all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].factoryId).toBeNull();
  });

  it("配属先 + 配属ライン presentes → factoryId resuelto (no null)", async () => {
    // Factory id=1: company_id=3, dept=製造部, line=等速ジョイント
    const rows = [
      {
        "社員番号": EMP_NUM_FACTORY_EMPTY,
        "氏名": "TEST WITH FACTORY",
        "派遣先": TEST_COMPANY_NAME,
        "配属先": TEST_DEPT,
        "配属ライン": TEST_LINE,
      },
    ];

    await importEmployees(rows, "upsert");

    const inserted = db
      .select()
      .from(employees)
      .where(like(employees.employeeNumber, EMP_NUM_FACTORY_EMPTY))
      .all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].factoryId).toBe(TEST_FACTORY_ID);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Actualización (upsert vs skip)
// ═══════════════════════════════════════════════════════════════════════════════

describe("importEmployees — actualización y modo skip", () => {
  it("mode=upsert actualiza empleado existente sin duplicar", async () => {
    // Insertar primero
    await importEmployees(
      [{ "社員番号": EMP_NUM_UPDATE, "氏名": "ORIGINAL NAME", "時給": 1400 }],
      "upsert",
    );

    // Actualizar con nombre diferente
    const { result } = await importEmployees(
      [{ "社員番号": EMP_NUM_UPDATE, "氏名": "UPDATED NAME", "時給": 1600 }],
      "upsert",
    );

    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(1);

    const all = db
      .select()
      .from(employees)
      .where(like(employees.employeeNumber, EMP_NUM_UPDATE))
      .all();

    // No debe haber duplicado
    expect(all).toHaveLength(1);
    expect(all[0].fullName).toBe("UPDATED NAME");
    expect(all[0].hourlyRate).toBe(1600);
  });

  it("mode=skip omite empleado existente sin modificarlo", async () => {
    // Insertar primero
    await importEmployees(
      [{ "社員番号": EMP_NUM_SKIP, "氏名": "SHOULD NOT CHANGE", "時給": 1400 }],
      "upsert",
    );

    // Intentar actualizar con mode=skip
    const { result } = await importEmployees(
      [{ "社員番号": EMP_NUM_SKIP, "氏名": "NEW NAME SKIP", "時給": 9999 }],
      "skip",
    );

    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);

    const all = db
      .select()
      .from(employees)
      .where(like(employees.employeeNumber, EMP_NUM_SKIP))
      .all();

    expect(all).toHaveLength(1);
    // El nombre original no debe haberse cambiado
    expect(all[0].fullName).toBe("SHOULD NOT CHANGE");
    expect(all[0].hourlyRate).toBe(1400);
  });

  it("múltiples filas del mismo número en el mismo import no duplican", async () => {
    const rows = [
      { "社員番号": EMP_NUM_UPDATE, "氏名": "DUP FIRST", "時給": 1400 },
      { "社員番号": EMP_NUM_UPDATE, "氏名": "DUP SECOND", "時給": 1500 },
    ];

    const { result } = await importEmployees(rows, "upsert");

    // Primera fila inserta, segunda actualiza (detecta dentro del mismo import)
    expect(result.errors).toHaveLength(0);

    const all = db
      .select()
      .from(employees)
      .where(like(employees.employeeNumber, EMP_NUM_UPDATE))
      .all();

    expect(all).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// billingRate vs hourlyRate
// ═══════════════════════════════════════════════════════════════════════════════

describe("importEmployees — billingRate vs hourlyRate", () => {
  it("guarda hourlyRate y billingRate (単価) por separado", async () => {
    const rows = [
      {
        "社員番号": EMP_NUM_RATES,
        "氏名": "RATE TEST",
        "時給": 1500,
        "請求単価": 2100,
      },
    ];

    await importEmployees(rows, "upsert");

    const inserted = db
      .select()
      .from(employees)
      .where(like(employees.employeeNumber, EMP_NUM_RATES))
      .all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].hourlyRate).toBe(1500);
    expect(inserted[0].billingRate).toBe(2100);
    // billingRate debe ser mayor que hourlyRate (margen UNS)
    expect(inserted[0].billingRate!).toBeGreaterThan(inserted[0].hourlyRate!);
  });

  it("acepta 単価 como alias de billingRate", async () => {
    const rows = [
      {
        "社員番号": EMP_NUM_RATES,
        "氏名": "ALIAS TANKA TEST",
        "時給": 1400,
        "単価": 1900,
      },
    ];

    await importEmployees(rows, "upsert");

    const inserted = db
      .select()
      .from(employees)
      .where(like(employees.employeeNumber, EMP_NUM_RATES))
      .all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].billingRate).toBe(1900);
  });

  it("hourlyRate null cuando el campo está vacío", async () => {
    const rows = [
      {
        "社員番号": EMP_NUM_RATES,
        "氏名": "NO RATE TEST",
        "時給": "",
      },
    ];

    await importEmployees(rows, "upsert");

    const inserted = db
      .select()
      .from(employees)
      .where(like(employees.employeeNumber, EMP_NUM_RATES))
      .all();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].hourlyRate).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildEmployeeData — unit tests (sin DB, verifica lógica de parseo)
// ═══════════════════════════════════════════════════════════════════════════════

describe("buildEmployeeData — lógica de parseo", () => {
  // Mínimo setup de lookup vacío para tests que no necesitan factory resolution
  const emptyCompanyMap = new Map<string, number>();
  const emptyFactories: Array<{
    id: number;
    companyId: number;
    factoryName: string;
    department: string | null;
    lineName: string | null;
  }> = [];
  const emptyLookup = buildFactoryLookup(emptyFactories);

  it('派遣先ID "0" → clientEmployeeId = null', () => {
    const data = buildEmployeeData(
      { "派遣先ID": "0" },
      emptyCompanyMap,
      emptyFactories,
      emptyLookup,
    );
    expect(data.clientEmployeeId).toBeNull();
  });

  it("派遣先ID numérico 0 → clientEmployeeId = null", () => {
    const data = buildEmployeeData(
      { clientEmployeeId: 0 },
      emptyCompanyMap,
      emptyFactories,
      emptyLookup,
    );
    expect(data.clientEmployeeId).toBeNull();
  });

  it("退社 → status = inactive", () => {
    const data = buildEmployeeData(
      { "現在": "退社" },
      emptyCompanyMap,
      emptyFactories,
      emptyLookup,
    );
    expect(data.status).toBe("inactive");
  });

  it("status vacío → active por defecto", () => {
    const data = buildEmployeeData({}, emptyCompanyMap, emptyFactories, emptyLookup);
    expect(data.status).toBe("active");
  });

  it("性別 男 → gender = male", () => {
    const data = buildEmployeeData(
      { "性別": "男" },
      emptyCompanyMap,
      emptyFactories,
      emptyLookup,
    );
    expect(data.gender).toBe("male");
  });

  it("性別 女 → gender = female", () => {
    const data = buildEmployeeData(
      { "性別": "女" },
      emptyCompanyMap,
      emptyFactories,
      emptyLookup,
    );
    expect(data.gender).toBe("female");
  });

  it("configuración de 配属先 vacía → factoryId = null (sin company)", () => {
    const data = buildEmployeeData(
      { "配属先": "", "配属ライン": "" },
      emptyCompanyMap,
      emptyFactories,
      emptyLookup,
    );
    expect(data.factoryId).toBeNull();
  });

  it("katakana half-width normalizado en nationalidad", () => {
    const data = buildEmployeeData(
      { "国籍": "ﾍﾞﾄﾅﾑ" },
      emptyCompanyMap,
      emptyFactories,
      emptyLookup,
    );
    expect(data.nationality).toBe("ベトナム");
  });

  it("parseRate ignora valores en cero o negativos → null", () => {
    const data = buildEmployeeData(
      { "時給": 0 },
      emptyCompanyMap,
      emptyFactories,
      emptyLookup,
    );
    expect(data.hourlyRate).toBeNull();
  });

  it("parseRate acepta string con símbolo ¥ y coma", () => {
    const data = buildEmployeeData(
      { "時給": "¥1,500" },
      emptyCompanyMap,
      emptyFactories,
      emptyLookup,
    );
    expect(data.hourlyRate).toBe(1500);
  });
});
