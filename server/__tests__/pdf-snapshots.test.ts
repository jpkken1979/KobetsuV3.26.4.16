/**
 * Snapshot tests para los 9 generadores de PDF de KobetsuV3.
 *
 * Estrategia:
 *   - Se define un dataset fijo (fixtures deterministas, fechas hardcodeadas).
 *   - Cada test genera el PDF, calcula SHA-256 del Buffer y lo compara contra un
 *     "golden" almacenado en __snapshots__/pdf-hashes.json.
 *   - Primera corrida (o UPDATE_PDF_SNAPSHOTS=1): escribe los goldens y pasa.
 *   - Corridas posteriores: compara y falla si hay diff.
 *
 * Para regenerar los goldens cuando un cambio es INTENCIONAL:
 *   npm run test:pdf-snapshots:update
 *
 * Fuentes de no-determinismo controladas:
 *   1. Math.random() — mockeado con vi.spyOn → siempre devuelve 0.5
 *      Afecta: kobetsu-pdf.ts (印鑑 rotation/offset/opacity)
 *   2. new Date() sin args — mockeado con vi.useFakeTimers → 2026-01-01T00:00:00Z
 *      Afecta: hakenmotokanridaicho-pdf.ts (career lines "today" comparison)
 *              helpers.ts (calculateAge sin referenceDate, parseDate fallback)
 *   3. PDFKit CreationDate en metadata — no es configurable via doc.info antes
 *      de construir; PDFKit escribe la fecha del sistema en el stream.
 *      Solución: los hashes se calculan DESPUÉS de strip de la sección /Info del PDF.
 *      Ver stripPdfInfo() abajo.
 *
 * OBSTÁCULOS ENCONTRADOS:
 *   - PDFKit inyecta CreationDate y ModDate en el objeto /Info interno del PDF.
 *     No hay API pública para suprimirlo. Se usa stripPdfInfo() que reemplaza el
 *     bloque de fechas con bytes nulos (mismo tamaño) para no alterar los offsets
 *     del xref, permitiendo un hash estable entre corridas.
 *   - 印鑑 (kobetsu-pdf.ts): usa Math.random() 4 veces. Mockeado con vi.spyOn.
 *     Si en el futuro se agrega aleatoriedad en otros generators, agregar el spy aquí.
 *   - hakenmotokanridaicho-pdf.ts usa new Date() para decidir qué filas de career
 *     consulting mostrar (solo fechas pasadas). Con fake timers fijados en 2026-01-01,
 *     el output es consistente.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import PDFDocument from "pdfkit";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

// ─── Generators ─────────────────────────────────────────────────────

import { generateKobetsuPDF, type KobetsuData } from "../pdf/kobetsu-pdf";
import { generateTsuchishoPDF, type TsuchishoData } from "../pdf/tsuchisho-pdf";
import { generateKeiyakushoPDF, type KeiyakushoData } from "../pdf/keiyakusho-pdf";
import { generateShugyoJokenMeijishoPDF, type ShugyoJokenData } from "../pdf/shugyojoken-pdf";
import { generateHakensakiKanriDaichoPDF, type DaichoData } from "../pdf/hakensakikanridaicho-pdf";
import { generateHakenmotoKanriDaichoPDF, type HakenmotoDaichoData } from "../pdf/hakenmotokanridaicho-pdf";
import { generateKoritsuKobetsuPDF, type KoritsuKobetsuData } from "../pdf/koritsu-kobetsu-pdf";
import { generateKoritsuDaichoPDF, type KoritsuDaichoData } from "../pdf/koritsu-hakensakidaicho-pdf";
import { generateKoritsuTsuchishoPDF, type KoritsuTsuchishoData } from "../pdf/koritsu-tsuchisho-pdf";

// ─── Paths ───────────────────────────────────────────────────────────

const FONT_DIR = path.resolve("server/pdf/fonts");
const JP_FONT = path.join(FONT_DIR, "NotoSansJP-Regular.ttf");
const MINCHO_FONT = path.join(FONT_DIR, "BIZUDMincho-0.ttf");
const GOTHIC_FONT = path.join(FONT_DIR, "MSGothic.ttf");
const CENTURY_FONT = path.join(FONT_DIR, "CenturySchoolbook.ttf");
const PMINCHO_FONT = path.join(FONT_DIR, "MSPMincho.ttf");

const SNAPSHOTS_PATH = path.resolve(
  "server/__tests__/__snapshots__/pdf-hashes.json"
);

// ─── PDF helpers ─────────────────────────────────────────────────────

function createDoc(opts?: { layout?: "portrait" | "landscape" }) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    layout: opts?.layout ?? "portrait",
  });
  if (fs.existsSync(JP_FONT)) {
    doc.registerFont("JP", JP_FONT);
    doc.font("JP");
  }
  if (fs.existsSync(MINCHO_FONT)) doc.registerFont("JP-Mincho", MINCHO_FONT);
  if (fs.existsSync(GOTHIC_FONT)) doc.registerFont("Gothic", GOTHIC_FONT);
  if (fs.existsSync(CENTURY_FONT)) doc.registerFont("Century", CENTURY_FONT);
  if (fs.existsSync(PMINCHO_FONT)) doc.registerFont("PMincho", PMINCHO_FONT);
  return doc;
}

function collectPDF(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

/**
 * Elimina las fechas dinámicas que PDFKit inyecta en el objeto /Info del PDF.
 *
 * PDFKit escribe CreationDate y ModDate como strings D:YYYYMMDDHHmmss dentro
 * del diccionario /Info. Estos valores cambian en cada corrida aunque el
 * contenido visual sea idéntico, lo que haría el hash inestable.
 *
 * La estrategia es reemplazar TODOS los tokens "D:YYYYMMDDHHMMSS" encontrados
 * en el buffer con "D:20260101000000" (longitud idéntica → no afecta offsets
 * del xref ni cross-reference tables).
 */
function stripPdfDates(buf: Buffer): Buffer {
  // PDFKit emite algo como: (D:20260407123045)
  // El patrón tiene exactamente 15 dígitos → largo fijo, safe para reemplazar.
  const pdfDatePattern = /D:\d{14}/g;
  const str = buf.toString("binary");
  const fixed = str.replace(pdfDatePattern, "D:20260101000000");
  return Buffer.from(fixed, "binary");
}

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// ─── Snapshot I/O ─────────────────────────────────────────────────────

type SnapshotMap = Record<string, string>;

function loadSnapshots(): SnapshotMap {
  if (!fs.existsSync(SNAPSHOTS_PATH)) return {};
  return JSON.parse(fs.readFileSync(SNAPSHOTS_PATH, "utf-8")) as SnapshotMap;
}

function saveSnapshots(map: SnapshotMap): void {
  const dir = path.dirname(SNAPSHOTS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SNAPSHOTS_PATH, JSON.stringify(map, null, 2) + "\n", "utf-8");
}

// ─── Fixtures ────────────────────────────────────────────────────────
// Dataset fijo y determinista. NO usa DB, NO usa seeds.
// Fechas fijas, nombres fijos, números fijos.

const EMPLOYEE = {
  fullName: "グエン　ヴァン　アン",
  katakanaName: "グエン ヴァン アン",
  gender: "male",
  birthDate: "1995-03-15",
  actualHireDate: "2023-04-01",
  hireDate: "2023-04-01",
};

const SUPERVISORS = {
  supervisorDept: "III本部",
  supervisorName: "伊藤英昭",
  supervisorPhone: "0567-56-6711",
  hakensakiManagerDept: "III本部",
  hakensakiManagerName: "伊藤英昭",
  hakensakiManagerPhone: "0567-56-6711",
  complaintClientDept: "III本部",
  complaintClientName: "伊藤英昭",
  complaintClientPhone: "0567-56-6711",
  complaintUnsDept: "営業部",
  complaintUnsName: "中山　欣英",
  complaintUnsPhone: "052-938-8840",
  managerUnsDept: "営業部",
  managerUnsName: "中山　欣英",
  managerUnsPhone: "052-938-8840",
};

const FACILITY = {
  companyName: "テスト株式会社",
  companyAddress: "愛知県弥富市六條町大崎11番地1",
  companyPhone: "0567-56-6711",
  factoryName: "テスト工場",
  factoryAddress: "愛知県弥富市六條町大崎11番地1",
  factoryPhone: "0567-56-6711",
  department: "製造1課",
  lineName: "1ライン",
};

const DATES = {
  startDate: "2026-04-01",
  endDate: "2026-06-30",
  contractDate: "2026-03-28",
  conflictDate: "2027-03-31",
};

const WORK_CONDITIONS = {
  jobDescription: "コイル製作・加工業務",
  calendar: "月～金（シフトに準ずる）",
  workHours: "8:00～17:00",
  breakTime: "12:00～13:00（60分）",
  overtimeHours: "3時間/日, 42時間/月, 320時間/年とする。",
  hourlyRate: 1600,
};

// ─── Definición de los 9 casos ────────────────────────────────────────

type GeneratorCase = {
  name: string;
  key: string;
  layout?: "portrait" | "landscape";
  run: (doc: InstanceType<typeof PDFDocument>) => void;
};

const CASES: GeneratorCase[] = [
  {
    name: "個別契約書 (kobetsu)",
    key: "kobetsu",
    run: (doc) => {
      const data: KobetsuData = {
        ...FACILITY,
        ...SUPERVISORS,
        ...DATES,
        ...WORK_CONDITIONS,
        responsibilityLevel: "担当者業務",
        employeeCount: 3,
        overtimeOutsideDays: "1ヶ月に2日の範囲内で命ずることがある。",
        timeUnit: "15",
        closingDay: "末日",
        paymentDay: "翌月末日",
        bankAccount: "三菱UFJ銀行 名古屋営業部 普通 1234567",
        isKyoteiTaisho: true,
        welfare: "なし",
      };
      generateKobetsuPDF(doc, data);
    },
  },
  {
    name: "通知書 (tsuchisho)",
    key: "tsuchisho",
    run: (doc) => {
      const data: TsuchishoData = {
        companyName: FACILITY.companyName,
        contractDate: DATES.contractDate,
        startDate: DATES.startDate,
        endDate: DATES.endDate,
        employees: [EMPLOYEE],
      };
      generateTsuchishoPDF(doc, data);
    },
  },
  {
    name: "労働契約書 (keiyakusho)",
    key: "keiyakusho",
    layout: "landscape",
    run: (doc) => {
      const data: KeiyakushoData = {
        ...FACILITY,
        ...SUPERVISORS,
        ...DATES,
        ...WORK_CONDITIONS,
        workHoursDay: "8:00～17:00",
        workHoursNight: "",
        breakTimeDay: "12:00～13:00（60分）",
        breakTimeNight: "",
        shiftPattern: "日勤",
        closingDay: "末日",
        paymentDay: "翌月末日",
        employee: {
          ...EMPLOYEE,
          employeeNumber: "E001",
          romajiName: "NGUYEN VAN ANH",
          nationality: "ベトナム",
          address: "愛知県弥富市六條町大崎22番地5",
          postalCode: "498-0011",
          hourlyRate: 1500,
          billingRate: 1600,
          visaExpiry: "2027-03-31",
          visaType: "技能",
        },
      };
      generateKeiyakushoPDF(doc, data);
    },
  },
  {
    name: "就業条件明示書 (shugyojoken)",
    key: "shugyojoken",
    run: (doc) => {
      const data: ShugyoJokenData = {
        ...FACILITY,
        ...SUPERVISORS,
        ...DATES,
        ...WORK_CONDITIONS,
        closingDay: "末日",
        paymentDay: "翌月末日",
        employee: {
          ...EMPLOYEE,
          hourlyRate: 1500,
        },
      };
      generateShugyoJokenMeijishoPDF(doc, data);
    },
  },
  {
    name: "派遣先管理台帳 (hakensakikanridaicho)",
    key: "hakensakikanridaicho",
    run: (doc) => {
      const data: DaichoData = {
        ...FACILITY,
        ...SUPERVISORS,
        ...DATES,
        ...WORK_CONDITIONS,
        commanderDept: SUPERVISORS.supervisorDept,
        commanderName: SUPERVISORS.supervisorName,
        commanderPhone: SUPERVISORS.supervisorPhone,
        employee: {
          ...EMPLOYEE,
          isFirstContract: false,
        },
      };
      generateHakensakiKanriDaichoPDF(doc, data);
    },
  },
  {
    name: "派遣元管理台帳 (hakenmotokanridaicho)",
    key: "hakenmotokanridaicho",
    run: (doc) => {
      const data: HakenmotoDaichoData = {
        ...FACILITY,
        ...SUPERVISORS,
        ...DATES,
        ...WORK_CONDITIONS,
        employee: {
          ...EMPLOYEE,
          hourlyRate: 1500,
          billingRate: 1600,
          nationality: "ベトナム",
        },
      };
      generateHakenmotoKanriDaichoPDF(doc, data);
    },
  },
  {
    name: "コーリツ個別契約書 (koritsu-kobetsu)",
    key: "koritsu-kobetsu",
    run: (doc) => {
      const data: KoritsuKobetsuData = {
        companyName: "株式会社　コーリツ",
        companyAddress: "愛知県刈谷市小垣江町本郷下33番地3",
        companyPhone: "0566-21-5139",
        factoryName: "州の崎工場",
        factoryAddress: "愛知県半田市州の崎町2番171",
        factoryPhone: "0569-20-0332",
        department: "製造2課",
        lineName: "２工区",
        commanderDept: "州の崎工場 製造2課 ２工区",
        commanderName: "鳥居 英司",
        commanderTitle: "工長",
        commanderPhone: "0569-20-0332",
        hakensakiManagerDept: "州の崎工場 製造2課",
        hakensakiManagerTitle: "課長",
        hakensakiManagerName: "坪井 友和",
        hakensakiManagerPhone: "0569-20-0332",
        complaintClientDept: "財務部 リスク管理課",
        complaintClientTitle: "課長",
        complaintClientName: "大場 明宏",
        complaintClientPhone: "0566-21-5139",
        contractNumber: "8210004",
        jobDescription: "オートマチックトランスミッション部品の製造を行う業務",
        ...DATES,
        employeeCount: 1,
        hourlyRate: 2225,
        closingDay: "末日締め",
        paymentDay: "翌月15日",
      };
      generateKoritsuKobetsuPDF(doc, data);
    },
  },
  {
    name: "コーリツ派遣先管理台帳 (koritsu-daicho)",
    key: "koritsu-daicho",
    run: (doc) => {
      const data: KoritsuDaichoData = {
        companyName: "株式会社　コーリツ",
        factoryName: "州の崎工場",
        factoryAddress: "愛知県半田市州の崎町2番171",
        factoryPhone: "0569-20-0332",
        department: "製造2課",
        lineName: "２工区",
        contractNumber: "8210004",
        contractDate: DATES.contractDate,
        startDate: DATES.startDate,
        endDate: DATES.endDate,
        jobDescription: "オートマチックトランスミッション部品の製造を行う業務",
        hakensakiManagerDept: "州の崎工場 製造2課",
        hakensakiManagerTitle: "課長",
        hakensakiManagerName: "坪井 友和",
        hakensakiManagerPhone: "0569-20-0332",
        employees: [{ ...EMPLOYEE, isFirstContract: false }],
      };
      generateKoritsuDaichoPDF(doc, data);
    },
  },
  {
    name: "コーリツ通知書 (koritsu-tsuchisho)",
    key: "koritsu-tsuchisho",
    run: (doc) => {
      const data: KoritsuTsuchishoData = {
        companyName: "株式会社　コーリツ",
        contractNumber: "8210004",
        contractDate: DATES.contractDate,
        startDate: DATES.startDate,
        endDate: DATES.endDate,
        employees: [EMPLOYEE],
      };
      generateKoritsuTsuchishoPDF(doc, data);
    },
  },
];

// ─── Test suite ───────────────────────────────────────────────────────

describe("PDF Snapshot Tests", () => {
  const UPDATE = process.env["UPDATE_PDF_SNAPSHOTS"] === "1";
  let goldens: SnapshotMap;
  const generated: SnapshotMap = {};

  beforeAll(() => {
    // Verificar fuente principal
    if (!fs.existsSync(JP_FONT)) {
      throw new Error(`Fuente requerida no encontrada: ${JP_FONT}`);
    }

    goldens = loadSnapshots();

    // Mock 1: Math.random → siempre 0.5
    // Hace que los 4 llamados en kobetsu-pdf.ts (印鑑 rotation/offset/opacity) sean deterministas.
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    // Mock 2: Date → fijo en 2026-01-01T00:00:00Z
    // Hace que new Date() en hakenmotokanridaicho-pdf.ts:273 (career "today") sea determinista.
    // También cubre calculateAge() sin referenceDate y parseDate() fallback.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    if (UPDATE || Object.keys(goldens).length === 0) {
      saveSnapshots(generated);
      console.info(
        `\n[pdf-snapshots] ${Object.keys(generated).length} hashes guardados en:\n  ${SNAPSHOTS_PATH}`
      );
    }
  });

  for (const c of CASES) {
    it(c.name, async () => {
      const doc = createDoc({ layout: c.layout });
      c.run(doc);
      const rawBuf = await collectPDF(doc);

      // Normalizar fechas PDFKit antes de hashear
      const normalizedBuf = stripPdfDates(rawBuf);
      const hash = sha256(normalizedBuf);
      generated[c.key] = hash;

      const existingGolden = goldens[c.key];

      if (!existingGolden || UPDATE) {
        // Primera corrida o modo update: acepta el hash actual
        expect(hash).toBeTruthy();
        expect(rawBuf.subarray(0, 4).toString()).toBe("%PDF");
      } else {
        // Comparación normal contra golden
        expect(hash).toBe(existingGolden);
      }
    });
  }

  it("verifica que todos los 9 generators produjeron un hash", () => {
    // Este test corre DESPUÉS de todos los anteriores por diseño de Vitest
    // (los tests de un describe se ejecutan en orden).
    // Solo tiene sentido verificarlo en afterAll, pero vitest no permite
    // assertions en afterAll. Entonces verificamos la cantidad esperada
    // comparando con los casos declarados.
    expect(CASES).toHaveLength(9);
  });
});
