/**
 * Tests para server/services/koritsu-excel-parser.ts.
 *
 * Estrategia: construir un workbook fake (RowLike + WorksheetLike) en vez de
 * usar un .xlsx real. El parser solo depende de la interfaz (`getRow`,
 * `getCell`, `rowCount`), no de exceljs en sí.
 *
 * Cubre:
 *   - Selección de fecha más reciente cuando no se pasa targetDate
 *   - Override por targetDate explícito (si existe en availableDates)
 *   - Filtrado de departamentos administrativos (財務部 etc.)
 *   - Resolución 本社工場 + 古浜町 → 乙川工場 (resolveRealFactory)
 *   - Resolución 州の崎工場 + 亀崎 → 亀崎工場
 *   - Dedup por (factory|dept|line)
 *   - Lectura de UNS sheet (派遣元)
 *   - Fallback de UNS desde row si sheet 派遣元 falta
 *   - parseDate: Date object, string YYYY-MM-DD, string con slash, Excel serial
 *   - cellStr: richText, formula result, null/empty
 *   - workbook sin mainSheet → result vacío
 *   - workConditions parser
 */
import { describe, it, expect } from "vitest";
import { parseKoritsuExcelWorkbook } from "../services/koritsu-excel-parser.js";

// ─── Builders para workbook fake ─────────────────────────────────────────────

type CellValue = unknown;

function makeRow(cells: Record<number, CellValue>) {
  return {
    getCell(col: number) {
      return { value: cells[col] ?? null };
    },
  };
}

interface FakeSheet {
  name: string;
  rowCount: number;
  getRow(n: number): { getCell(col: number): { value: unknown } };
}

function makeSheet(name: string, rows: Array<Record<number, CellValue>>): FakeSheet {
  return {
    name,
    rowCount: rows.length, // rows[0] is row 1
    getRow(n: number) {
      return makeRow(rows[n - 1] ?? {});
    },
  };
}

function makeWorkbook(sheets: FakeSheet[]) {
  return {
    worksheets: sheets,
    getWorksheet(name: string) {
      return sheets.find((s) => s.name === name);
    },
  };
}

// ─── Datos de muestra ────────────────────────────────────────────────────────

const DATE_OLD = "2025-10-01";
const DATE_NEW = "2026-04-01";

// Layout: row 1 = header (vacía aquí), row 2+ = datos
function buildMainSheetRows(): Array<Record<number, CellValue>> {
  return [
    // Row 1: header (parser empieza desde r=2)
    {},
    // Row 2: 本社工場 + 古浜町 → debería resolverse a 乙川工場
    {
      1: DATE_NEW,
      2: "本社工場",
      3: "製造1課",
      4: "田中 太郎",
      5: "課長",
      6: "1工区",
      7: "山田 花子",
      8: "班長",
      9: "0533-11-2222",
      10: "自動車部品の組立",
      15: "愛知県半田市古浜町1-1",
      35: "2028-04-01",
    },
    // Row 3: 州の崎工場 + 亀崎 → 亀崎工場
    {
      1: DATE_NEW,
      2: "州の崎工場",
      3: "製造2課",
      4: "佐藤 次郎",
      5: "課長",
      6: "2工区",
      7: "鈴木 三郎",
      8: "工長",
      9: "0533-22-3333",
      10: "ボルト製造",
      15: "愛知県半田市亀崎町2-2",
      35: "2028-04-01",
    },
    // Row 4: factory administrativo (財務部) → debería filtrarse
    {
      1: DATE_NEW,
      2: "財務部",
      3: "経理",
      4: "経理 太郎",
    },
    // Row 5: duplicado exacto del Row 2 → debería dedupearse
    {
      1: DATE_NEW,
      2: "本社工場",
      3: "製造1課",
      4: "田中 太郎",
      5: "課長",
      6: "1工区",
      7: "山田 花子",
      8: "班長",
      9: "0533-11-2222",
      10: "自動車部品の組立",
      15: "愛知県半田市古浜町1-1",
      35: "2028-04-01",
    },
    // Row 6: fecha vieja (DATE_OLD) → no debería procesarse
    {
      1: DATE_OLD,
      2: "本社工場",
      3: "古い課",
      4: "Old Manager",
      6: "Old Line",
    },
    // Row 7: 本社工場 sin 古浜町 → permanece como 本社工場
    {
      1: DATE_NEW,
      2: "本社工場",
      3: "製造3課",
      4: "本社 課長",
      6: "3工区",
      7: "本社 工長",
      15: "愛知県半田市別住所3-3",
    },
  ];
}

function buildUnsSheetRows(): Array<Record<number, CellValue>> {
  return [
    // Row 1: header
    {},
    // Row 2: data del UNS
    {
      3: "愛知県名古屋市中区栄1-1-1", // managerAddress
      4: "052-111-2222",            // managerPhone
      5: "製造業務専門",              // managerDept
      6: "UNS マネージャー",           // managerName
      7: "苦情処理部",                // complaintDept
      8: "052-333-4444",             // complaintPhone (nota: NOT 9 — parser lee de col 8 para complaintPhone)
      9: "苦情 担当者",                // complaintName
    },
  ];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("parseKoritsuExcelWorkbook — selección de fecha", () => {
  it("usa la fecha más reciente cuando no se pasa targetDate", () => {
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", buildMainSheetRows()),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    expect(result.selectedDate).toBe(DATE_NEW);
    expect(result.availableDates).toContain(DATE_OLD);
    expect(result.availableDates).toContain(DATE_NEW);
  });

  it("respeta targetDate cuando es válido", () => {
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", buildMainSheetRows()),
    ]);
    const result = parseKoritsuExcelWorkbook(wb, DATE_OLD);
    expect(result.selectedDate).toBe(DATE_OLD);
    // Solo debería procesar la row de DATE_OLD (Row 6), no las de DATE_NEW.
    expect(result.factories.length).toBeGreaterThan(0);
  });

  it("ignora targetDate inválido y usa la más reciente", () => {
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", buildMainSheetRows()),
    ]);
    const result = parseKoritsuExcelWorkbook(wb, "2099-01-01");
    expect(result.selectedDate).toBe(DATE_NEW);
  });

  it("formatea period como '2026年 4月'", () => {
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", buildMainSheetRows()),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    expect(result.period).toBe("2026年 4月");
  });
});

describe("parseKoritsuExcelWorkbook — resolución de factory real", () => {
  it("本社工場 + dirección con 古浜町 → 乙川工場", () => {
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", buildMainSheetRows()),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    const otsugawa = result.factories.find((f) => f.factoryName === "乙川工場");
    expect(otsugawa).toBeDefined();
    expect(otsugawa?.lineName).toBe("1工区");
  });

  it("州の崎工場 + dirección con 亀崎 → 亀崎工場", () => {
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", buildMainSheetRows()),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    const kamezaki = result.factories.find((f) => f.factoryName === "亀崎工場");
    expect(kamezaki).toBeDefined();
    expect(kamezaki?.lineName).toBe("2工区");
  });

  it("本社工場 sin 古浜町 permanece como 本社工場", () => {
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", buildMainSheetRows()),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    const honsha = result.factories.find((f) => f.factoryName === "本社工場");
    expect(honsha).toBeDefined();
  });
});

describe("parseKoritsuExcelWorkbook — dedup y filtrado", () => {
  it("filtra departamentos administrativos (財務部, 経営企画部, 業務部)", () => {
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", buildMainSheetRows()),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    const admin = result.factories.find((f) => f.factoryName === "財務部");
    expect(admin).toBeUndefined();
  });

  it("dedupea filas con misma (factory|dept|line)", () => {
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", buildMainSheetRows()),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    // 乙川工場 / 製造1課 / 1工区 aparece 2 veces en el sheet (row 2 y row 5)
    const otsugawa1 = result.factories.filter(
      (f) => f.factoryName === "乙川工場" && f.department === "製造1課" && f.lineName === "1工区",
    );
    expect(otsugawa1).toHaveLength(1);
  });

  it("guarda dirección por factoryName real (resuelta) en addresses map", () => {
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", buildMainSheetRows()),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    expect(result.addresses["乙川工場"]).toContain("古浜町");
    expect(result.addresses["亀崎工場"]).toContain("亀崎");
  });
});

describe("parseKoritsuExcelWorkbook — UNS data", () => {
  it("lee datos del sheet 派遣元 con prioridad", () => {
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", buildMainSheetRows()),
      makeSheet("派遣元", buildUnsSheetRows()),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    expect(result.uns.managerName).toBe("UNS マネージャー");
    expect(result.uns.managerDept).toBe("製造業務専門");
    expect(result.uns.managerAddress).toBe("愛知県名古屋市中区栄1-1-1");
  });

  it("hace fallback de UNS desde row cuando falta sheet 派遣元", () => {
    // Row con campos UNS poblados (cols 17-24)
    const rowsWithUns: Array<Record<number, CellValue>> = [
      {},
      {
        1: DATE_NEW,
        2: "本社工場",
        3: "製造1課",
        4: "田中 太郎",
        6: "1工区",
        7: "山田 花子",
        15: "愛知県半田市古浜町1-1",
        17: "Fallback UNS Name",
        18: "Fallback UNS Address",
        19: "052-999-0000",
        20: "Fallback Role",
        21: "Fallback Mgr",
        22: "Fallback Complaint Dept",
        23: "Fallback Complaint Role",
        24: "Fallback Complaint Name",
      },
    ];
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", rowsWithUns),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    expect(result.uns.managerName).toBe("Fallback Mgr");
    expect(result.uns.managerAddress).toBe("Fallback UNS Address");
  });
});

describe("parseKoritsuExcelWorkbook — edge cases", () => {
  it("sin mainSheet → result vacío con valores default", () => {
    const wb = makeWorkbook([
      makeSheet("Hoja sin nada", [{}]),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    expect(result.factories).toHaveLength(0);
    expect(result.selectedDate).toBe("");
    expect(result.availableDates).toHaveLength(0);
  });

  it("mainSheet sin filas con fecha → result vacío", () => {
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", [{}]),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    expect(result.factories).toHaveLength(0);
    expect(result.availableDates).toHaveLength(0);
  });

  it("fila sin factoryName se ignora", () => {
    const rows: Array<Record<number, CellValue>> = [
      {},
      { 1: DATE_NEW, 3: "Dept", 6: "Line" }, // sin col 2 (factory)
    ];
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", rows),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    expect(result.factories).toHaveLength(0);
  });

  it("parsea Excel serial date como número", () => {
    // Excel serial 45748 = 2025-04-01
    // Excel epoch: 1899-12-30, +45748 días
    const rows: Array<Record<number, CellValue>> = [
      {},
      {
        1: 46113, // ≈ 2026-04-01
        2: "TestFactory",
        3: "Dept",
        15: "Test address",
      },
    ];
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", rows),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    expect(result.availableDates).toHaveLength(1);
    expect(result.availableDates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parsea fecha string con slash (YYYY/M/D)", () => {
    const rows: Array<Record<number, CellValue>> = [
      {},
      {
        1: "2026/4/1",
        2: "TestFactory",
        3: "Dept",
        15: "Test address",
      },
    ];
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", rows),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    expect(result.availableDates[0]).toBe("2026-4-1");
  });

  it("parsea Date object como cell value", () => {
    const rows: Array<Record<number, CellValue>> = [
      {},
      {
        1: new Date(2026, 3, 1), // April 1, 2026
        2: "TestFactory",
        3: "Dept",
        15: "Test address",
      },
    ];
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", rows),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    expect(result.availableDates[0]).toBe("2026-04-01");
  });

  it("normaliza dept removiendo espacios internos", () => {
    const rows: Array<Record<number, CellValue>> = [
      {},
      {
        1: DATE_NEW,
        2: "TestFactory",
        3: "製造  1  課", // con espacios
        6: "Line1",
        15: "Test address",
      },
    ];
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", rows),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    expect(result.factories[0]?.department).toBe("製造1課");
  });

  it("cellStr maneja richText extrayendo el texto plano", () => {
    const rows: Array<Record<number, CellValue>> = [
      {},
      {
        1: DATE_NEW,
        2: "TestFactory",
        3: { richText: [{ text: "製造" }, { text: "1課" }] },
        6: "Line1",
        15: "Address",
      },
    ];
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", rows),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    expect(result.factories[0]?.department).toBe("製造1課");
  });

  it("cellStr maneja formula result", () => {
    const rows: Array<Record<number, CellValue>> = [
      {},
      {
        1: DATE_NEW,
        2: { result: "TestFactory" },
        3: "製造部",
        6: "Line1",
        15: "Address",
      },
    ];
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", rows),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    expect(result.factories[0]?.factoryName).toBe("TestFactory");
  });
});

describe("parseKoritsuExcelWorkbook — workConditions parser", () => {
  it("parsea workConditions desde 労働者派遣個別契約書 sheet", () => {
    // El parser lee rows 24-32 de col 13.
    const contractRows: Array<Record<number, CellValue>> = [];
    for (let i = 0; i < 32; i++) contractRows.push({});
    contractRows[23] = { 13: "月～金（祝日除く）" }; // row 24 — workDays
    contractRows[24] = { 13: "【1直】（就業時間）8:00～17:00・（休憩時間）60分" }; // row 25
    contractRows[25] = { 13: "【2直】（就業時間）20:00～5:00・（休憩時間）60分" }; // row 26
    contractRows[26] = { 13: "（〃）一直" }; // row 27 (ignored — no match)
    contractRows[27] = { 13: "1日10時間以内" }; // row 28
    contractRows[28] = { 13: "1ヶ月45時間以内" }; // row 29
    contractRows[29] = { 13: "1年360時間以内" }; // row 30

    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", buildMainSheetRows()),
      makeSheet("労働者派遣個別契約書", contractRows),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    expect(result.workConditions.workDays).toBe("月～金（祝日除く）");
    expect(result.workConditions.workHours).toContain("8:00");
    expect(result.workConditions.breakTime).toContain("60分");
  });

  it("workConditions devuelve null en cada campo si falta sheet contrato", () => {
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", buildMainSheetRows()),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    expect(result.workConditions.workDays).toBeNull();
    expect(result.workConditions.workHours).toBeNull();
    expect(result.workConditions.breakTime).toBeNull();
    expect(result.workConditions.overtimeHours).toBeNull();
  });
});

describe("parseKoritsuExcelWorkbook — complaint handler (派遣先 side)", () => {
  it("toma el primer complaint encontrado", () => {
    const rows: Array<Record<number, CellValue>> = [
      {},
      {
        1: DATE_NEW,
        2: "TestFactory",
        3: "Dept1",
        6: "Line1",
        15: "Address",
        28: "苦情部",
        30: "苦情 一郎",
        31: "0533-99-0000",
      },
      {
        1: DATE_NEW,
        2: "TestFactory2",
        3: "Dept2",
        6: "Line2",
        15: "Address2",
        28: "別の部",
        30: "別 二郎",
        31: "0533-99-9999",
      },
    ];
    const wb = makeWorkbook([
      makeSheet("派遣先責任者 指揮命令者", rows),
    ]);
    const result = parseKoritsuExcelWorkbook(wb);
    // Toma el primero — 苦情 一郎
    expect(result.complaint.name).toBe("苦情 一郎");
    expect(result.complaint.dept).toBe("苦情部");
    expect(result.complaint.phone).toBe("0533-99-0000");
  });
});
