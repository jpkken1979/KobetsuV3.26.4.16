/**
 * Invariante crítico: factories que solo difieren por punto final en line_name
 * NO son duplicados. (Ver .claude/rules/factories-line-name-punto-final.md)
 *
 * Ejemplos reales en el sistema:
 *   - 高雄工業 / HUB工場 / 製作1課 → "1次旋係" vs "1次旋係."
 *   - 高雄工業 / HUB工場 / 岡山HUB品証課 → "HUB 検査課係" vs "HUB 検査課係."
 *   - 高雄工業 / 海南第一工場 / 製作1課 → "HUB" vs "HUB。" (full-width)
 *
 * Este test es un guardrail contra:
 *  - "limpieza" automática que mergea/borra esas filas
 *  - imports que normalicen line_name (TRIM, RTRIM, lowercase)
 *
 * Usa la DB de test (kobetsu.test.db). Aislamiento por transacción.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db, sqlite } from "../db/index.js";
import { factories, clientCompanies } from "../db/schema.js";
import { and, eq } from "drizzle-orm";
import { importFactories } from "../services/import-factories-service.js";

const TEST_COMPANY_NAME = "高雄工業";

beforeEach(() => {
  sqlite.exec("BEGIN");
});

afterEach(() => {
  sqlite.exec("ROLLBACK");
});

async function ensureTestCompany(): Promise<number> {
  const existing = await db.query.clientCompanies.findFirst({
    where: eq(clientCompanies.name, TEST_COMPANY_NAME),
  });
  if (existing) return existing.id;
  const inserted = db
    .insert(clientCompanies)
    .values({ name: TEST_COMPANY_NAME })
    .returning()
    .get();
  return inserted.id;
}

describe("factories: punto final preservado en line_name", () => {
  it("permite insertar dos filas con line_name idéntico salvo por '.' final", async () => {
    const companyId = await ensureTestCompany();

    db.insert(factories).values({
      companyId,
      factoryName: "TEST-HUB工場",
      department: "製作1課",
      lineName: "1次旋係",
    }).run();

    // El UNIQUE constraint es (company, factory, dept, line) — el punto los hace distintos.
    db.insert(factories).values({
      companyId,
      factoryName: "TEST-HUB工場",
      department: "製作1課",
      lineName: "1次旋係.",
    }).run();

    const both = await db.query.factories.findMany({
      where: and(
        eq(factories.companyId, companyId),
        eq(factories.factoryName, "TEST-HUB工場"),
        eq(factories.department, "製作1課"),
      ),
    });

    expect(both).toHaveLength(2);
    const lineNames = both.map((f) => f.lineName).sort();
    expect(lineNames).toEqual(["1次旋係", "1次旋係."]);
  });

  it("permite full-width '。' (punto japonés) como discriminador", async () => {
    const companyId = await ensureTestCompany();

    db.insert(factories).values({
      companyId,
      factoryName: "TEST-海南第一工場",
      department: "製作1課",
      lineName: "HUB",
    }).run();
    db.insert(factories).values({
      companyId,
      factoryName: "TEST-海南第一工場",
      department: "製作1課",
      lineName: "HUB。",
    }).run();

    const both = await db.query.factories.findMany({
      where: and(
        eq(factories.companyId, companyId),
        eq(factories.factoryName, "TEST-海南第一工場"),
      ),
    });

    expect(both).toHaveLength(2);
    expect(new Set(both.map((f) => f.lineName))).toEqual(new Set(["HUB", "HUB。"]));
  });

  it("importFactories preserva el punto final byte-by-byte (no TRIM, no RTRIM)", async () => {
    const rows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": "TEST-HUB工場-Import",
        "部署": "製作1課",
        "ライン名": "1次旋係",
      },
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": "TEST-HUB工場-Import",
        "部署": "製作1課",
        "ライン名": "1次旋係.",
      },
    ];

    const result = await importFactories(rows, "upsert", [], []);

    // Ambas filas deben insertarse — NO mergearse por trim del punto.
    expect(result.inserted).toBe(2);
    expect(result.errors).toHaveLength(0);

    const both = await db.query.factories.findMany({
      where: and(
        eq(factories.factoryName, "TEST-HUB工場-Import"),
        eq(factories.department, "製作1課"),
      ),
    });

    expect(both).toHaveLength(2);
    const lineNames = both.map((f) => f.lineName).sort();
    expect(lineNames).toEqual(["1次旋係", "1次旋係."]);
  });

  it("importFactories en modo upsert: rerun no mergea las dos filas", async () => {
    const rows = [
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": "TEST-CVJ-Rerun",
        "部署": "製作部",
        "ライン名": "CVJ研磨係",
      },
      {
        "会社名": TEST_COMPANY_NAME,
        "工場名": "TEST-CVJ-Rerun",
        "部署": "製作部",
        "ライン名": "CVJ研磨係.",
      },
    ];

    await importFactories(rows, "upsert", [], []);
    const second = await importFactories(rows, "upsert", [], []);

    // Segunda corrida: 2 updates, 0 inserts, 0 mergidas como duplicado.
    expect(second.inserted).toBe(0);
    expect(second.updated + second.skipped).toBe(2);

    const both = await db.query.factories.findMany({
      where: eq(factories.factoryName, "TEST-CVJ-Rerun"),
    });
    expect(both).toHaveLength(2);
  });

  it("query exacta requiere line_name byte-by-byte (no normalización)", async () => {
    const companyId = await ensureTestCompany();

    db.insert(factories).values({
      companyId,
      factoryName: "TEST-Exact-Query",
      department: "製作1課",
      lineName: "HUB 検査課係.",
    }).run();

    // Buscar sin punto NO debería encontrarla.
    const noDot = await db.query.factories.findFirst({
      where: and(
        eq(factories.factoryName, "TEST-Exact-Query"),
        eq(factories.lineName, "HUB 検査課係"),
      ),
    });
    expect(noDot).toBeUndefined();

    // Buscar con punto exacto SÍ.
    const withDot = await db.query.factories.findFirst({
      where: and(
        eq(factories.factoryName, "TEST-Exact-Query"),
        eq(factories.lineName, "HUB 検査課係."),
      ),
    });
    expect(withDot).toBeDefined();
    expect(withDot?.lineName).toBe("HUB 検査課係.");
  });
});
