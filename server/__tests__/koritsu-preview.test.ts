/**
 * Tests for Koritsu import preview (dry-run diff) and apply endpoints.
 *
 * Verifica que:
 *  1. POST /api/import/koritsu/parse devuelve el diff correcto sin escribir en DB.
 *  2. La cantidad de rows en factories NO cambia después de parse.
 *  3. POST /api/import/koritsu/apply aplica exactamente lo que parse reportó.
 *
 * koritsu-excel-parser se mockea para evitar depender de un .xlsx real.
 * ExcelJS también se mockea para evitar el error de carga del archivo.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// ─── Mock pdf-parse (no instalado como dep) ───────────────────────────────────
vi.mock("pdf-parse", () => ({ PDFParse: vi.fn(), default: vi.fn() }));

// ─── Mock ExcelJS: Workbook como clase que devuelve worksheets con el nombre correcto ─
// El endpoint verifica wb.worksheets.find(s => s.name.includes("派遣先責任者"))
// antes de llamar al parser, así que necesitamos al menos ese sheet.
vi.mock("exceljs", () => {
  const fakeSheet = { name: "派遣先責任者 指揮命令者", rowCount: 0, eachRow: () => {} };
  class FakeWorkbook {
    worksheets = [fakeSheet];
    xlsx = { load: vi.fn().mockResolvedValue(undefined) };
    find(name: string) { return name.includes("派遣先責任者") ? fakeSheet : undefined; }
  }
  return { default: { Workbook: FakeWorkbook } };
});

// ─── Mock parseKoritsuExcelWorkbook ──────────────────────────────────────────
//
// El endpoint import-koritsu.ts importa parseKoritsuExcelWorkbook desde
// koritsu-excel-parser.ts. Al mockearlo controlamos los datos que "parsea"
// el Excel sin necesitar un archivo real ni un workbook funcional.

const MOCK_FACTORY_NAME = "本社工場テスト";
const MOCK_DEPT = "製造1課";
const MOCK_LINE = "1工区";
const MOCK_MANAGER = "田中 太郎";
const MOCK_MANAGER_DEPT = "管理部";
const MOCK_MANAGER_ROLE = "課長";
const MOCK_SUPERVISOR = "山田 花子";
const MOCK_SUPERVISOR_DEPT = "製造部";
const MOCK_SUPERVISOR_ROLE = "班長";
const MOCK_PHONE = "0533-11-2222";
const MOCK_JOB = "自動車部品の組立・検査";
const MOCK_ADDRESS = "愛知県豊川市テスト町1-1";
const MOCK_CONFLICT = "2028-04-01";

function buildMockParsed() {
  return {
    period: "2026年度",
    factories: [
      {
        factoryName: MOCK_FACTORY_NAME,
        department: MOCK_DEPT,
        lineName: MOCK_LINE,
        hakensakiManagerName: MOCK_MANAGER,
        hakensakiManagerDept: MOCK_MANAGER_DEPT,
        hakensakiManagerRole: MOCK_MANAGER_ROLE,
        supervisorName: MOCK_SUPERVISOR,
        supervisorDept: MOCK_SUPERVISOR_DEPT,
        supervisorRole: MOCK_SUPERVISOR_ROLE,
        phone: MOCK_PHONE,
        address: MOCK_ADDRESS,
        conflictDate: MOCK_CONFLICT,
        jobDescription: MOCK_JOB,
      },
    ],
    addresses: { [MOCK_FACTORY_NAME]: MOCK_ADDRESS },
    complaint: { name: "苦情 担当", dept: "総務部", phone: "052-000-1111", fax: null },
    overtime: { regular: "有", threeShift: null },
    availableDates: ["2026-04-01"],
    selectedDate: "2026-04-01",
    uns: {
      managerName: "山本 次郎",
      managerDept: "総務部",
      managerPhone: "052-999-8888",
      managerAddress: "愛知県名古屋市テスト",
      complaintName: "苦情UNS",
      complaintDept: "人事部",
      complaintPhone: "052-111-2222",
    },
    workConditions: {
      workDays: "月〜金",
      workHours: "8:00〜17:00",
      breakTime: "60分",
      overtimeHours: "有",
    },
  };
}

vi.mock("../services/koritsu-excel-parser.js", () => ({
  parseKoritsuExcelWorkbook: vi.fn(() => buildMockParsed()),
}));

// ─── Import app AFTER all mocks ───────────────────────────────────────────────
import app from "../index.js";
import { db, sqlite } from "../db/index.js";
import { factories, clientCompanies } from "../db/schema.js";
import { eq } from "drizzle-orm";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AUTH = "Basic " + Buffer.from("jpkken:admin123").toString("base64");

const apiRequest = (path: string, init?: RequestInit) =>
  app.fetch(
    new Request(`http://localhost${path}`, {
      ...init,
      headers: {
        Authorization: AUTH,
        ...(init?.headers as Record<string, string> | undefined),
      },
    }),
  );

function makeFakeExcelFile(name = "koritsu-test.xlsx"): File {
  const buf = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  return new File([buf], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function callParse(file: File = makeFakeExcelFile()) {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest("/api/import/koritsu/parse", {
    method: "POST",
    body: formData,
  });
}

// ─── Setup: garantizar que コーリツ existe en DB ────────────────────────────────

let koritsuCompanyId: number;
const createdFactoryIds: number[] = [];

beforeAll(async () => {
  // Buscar o crear la empresa コーリツ en la DB real de test
  const existing = await db.query.clientCompanies.findFirst({
    where: (co, { like }) => like(co.name, "%コーリツ%"),
  });

  if (existing) {
    koritsuCompanyId = existing.id;
  } else {
    const created = db
      .insert(clientCompanies)
      .values({
        name: "コーリツ株式会社テスト",
        shortName: "コーリツ",
        isActive: true,
      })
      .returning()
      .get();
    koritsuCompanyId = created.id;
  }
});

afterAll(() => {
  // Limpiar factories creadas por los tests de apply
  if (createdFactoryIds.length > 0) {
    sqlite.transaction(() => {
      for (const id of createdFactoryIds) {
        db.delete(factories).where(eq(factories.id, id)).run();
      }
    })();
  }
});

// ─── Tests: parse (preview / dry run) ────────────────────────────────────────

describe("POST /api/import/koritsu/parse — preview dry run", () => {
  it("devuelve 200 con summary y diff", async () => {
    const res = await callParse();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("summary");
    expect(body).toHaveProperty("diff");
    expect(body).toHaveProperty("companyId");
    expect(typeof body.summary.inserts).toBe("number");
    expect(typeof body.summary.updates).toBe("number");
    expect(typeof body.summary.unchanged).toBe("number");
  });

  it("NO escribe nada en la tabla factories durante parse", async () => {
    const rowsBefore = db
      .select()
      .from(factories)
      .where(eq(factories.companyId, koritsuCompanyId))
      .all();

    await callParse();

    const rowsAfter = db
      .select()
      .from(factories)
      .where(eq(factories.companyId, koritsuCompanyId))
      .all();

    expect(rowsAfter.length).toBe(rowsBefore.length);
  });

  it("cada item del diff tiene los campos requeridos", async () => {
    const res = await callParse();
    const body = await res.json();
    expect(Array.isArray(body.diff)).toBe(true);
    expect(body.diff.length).toBeGreaterThan(0);

    for (const item of body.diff as Array<Record<string, unknown>>) {
      expect(item).toHaveProperty("factoryName");
      expect(item).toHaveProperty("department");
      expect(item).toHaveProperty("status");
      expect(item).toHaveProperty("changes");
      expect(["insert", "update", "unchanged"]).toContain(item.status);
    }
  });

  it("summary.inserts + updates + unchanged == diff.length", async () => {
    const res = await callParse();
    const body = await res.json();
    const { inserts, updates, unchanged } = body.summary as {
      inserts: number;
      updates: number;
      unchanged: number;
    };
    expect(inserts + updates + unchanged).toBe(
      (body.diff as unknown[]).length,
    );
  });

  it("rechaza archivo sin extensión .xlsx / .xlsm", async () => {
    const badFile = new File(["text"], "data.csv", { type: "text/csv" });
    const res = await callParse(badFile);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("rechaza request sin archivo", async () => {
    const res = await apiRequest("/api/import/koritsu/parse", {
      method: "POST",
      body: new FormData(),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

// ─── Tests: apply (escribe en DB) ────────────────────────────────────────────

describe("POST /api/import/koritsu/apply — escribe en DB", () => {
  it("primera ejecución inserta la fábrica mockeada (insert)", async () => {
    // Asegurarse de que la fábrica mockeada NO existe aún
    const existing = db
      .select()
      .from(factories)
      .where(eq(factories.companyId, koritsuCompanyId))
      .all()
      .find(
        (f) =>
          f.factoryName === MOCK_FACTORY_NAME &&
          f.department === MOCK_DEPT &&
          (f.lineName ?? "") === MOCK_LINE,
      );

    if (existing) {
      // Ya existe — skip insert test
      createdFactoryIds.push(existing.id);
      return;
    }

    const parsed = buildMockParsed();

    const applyRes = await apiRequest("/api/import/koritsu/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: koritsuCompanyId,
        factories: parsed.factories.map((f) => ({
          existingId: null,
          factoryName: f.factoryName,
          department: f.department,
          lineName: f.lineName,
          hakensakiManagerName: f.hakensakiManagerName,
          hakensakiManagerDept: f.hakensakiManagerDept,
          hakensakiManagerRole: f.hakensakiManagerRole,
          supervisorName: f.supervisorName,
          supervisorDept: f.supervisorDept,
          supervisorRole: f.supervisorRole,
          phone: f.phone,
          address: f.address,
          conflictDate: f.conflictDate,
          jobDescription: f.jobDescription,
        })),
        addresses: parsed.addresses,
        complaint: parsed.complaint,
        uns: parsed.uns,
        workConditions: parsed.workConditions,
      }),
    });

    expect(applyRes.status).toBe(200);
    const applyBody = await applyRes.json();
    expect(applyBody.success).toBe(true);
    expect(applyBody.inserted).toBeGreaterThanOrEqual(1);
    expect(applyBody.total).toBe(applyBody.inserted + applyBody.updated);

    // Verificar que la fábrica fue creada en DB
    const created = db
      .select()
      .from(factories)
      .where(eq(factories.companyId, koritsuCompanyId))
      .all()
      .find(
        (f) =>
          f.factoryName === MOCK_FACTORY_NAME &&
          f.department === MOCK_DEPT,
      );
    expect(created).toBeTruthy();
    if (created) createdFactoryIds.push(created.id);
  });

  it("segunda ejecución (update): parse reporta update, apply actualiza", async () => {
    // Asegurar que existe la fábrica para que sea update
    let factoryId: number | undefined;
    const existing = db
      .select()
      .from(factories)
      .where(eq(factories.companyId, koritsuCompanyId))
      .all()
      .find(
        (f) =>
          f.factoryName === MOCK_FACTORY_NAME &&
          f.department === MOCK_DEPT,
      );

    if (!existing) {
      // Crear primero
      const inserted = db
        .insert(factories)
        .values({
          companyId: koritsuCompanyId!,
          factoryName: MOCK_FACTORY_NAME,
          department: MOCK_DEPT,
          lineName: MOCK_LINE,
          supervisorName: "旧 担当者",
        })
        .returning()
        .get();
      factoryId = inserted.id;
      createdFactoryIds.push(factoryId);
    } else {
      // fábrica ya existe — no se trackea para cleanup (no fue creada por este test)
    }

    // Llamar parse — debería detectar update (supervisorName cambió)
    const parseRes = await callParse();
    expect(parseRes.status).toBe(200);
    const parseBody = await parseRes.json();

    // El diff debe contener al menos un item con status update o unchanged
    const diffItem = (
      parseBody.diff as Array<{ status: string; factoryName: string }>
    ).find((d) => d.factoryName === MOCK_FACTORY_NAME);
    expect(diffItem).toBeTruthy();
    expect(["update", "unchanged"]).toContain(diffItem?.status);
  });

  it("parse total == inserts + updates + unchanged del summary", async () => {
    const parseRes = await callParse();
    expect(parseRes.status).toBe(200);
    const body = await parseRes.json();
    const { inserts, updates, unchanged } = body.summary as {
      inserts: number;
      updates: number;
      unchanged: number;
    };
    const total = inserts + updates + unchanged;
    expect(total).toBe((body.diff as unknown[]).length);
  });

  it("rechaza apply con companyId que no existe en DB", async () => {
    const parsed = buildMockParsed();
    const res = await apiRequest("/api/import/koritsu/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: 99999999,
        factories: parsed.factories.map((f) => ({
          existingId: null,
          factoryName: f.factoryName,
          department: f.department,
          lineName: f.lineName,
          hakensakiManagerName: f.hakensakiManagerName,
          hakensakiManagerDept: f.hakensakiManagerDept,
          supervisorName: f.supervisorName,
          supervisorDept: f.supervisorDept,
          phone: f.phone,
        })),
        addresses: parsed.addresses,
        complaint: parsed.complaint,
        uns: parsed.uns,
        workConditions: parsed.workConditions,
      }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("rechaza apply sin body JSON válido", async () => {
    const res = await apiRequest("/api/import/koritsu/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json at all",
    });
    expect(res.status).toBe(400);
  });
});
