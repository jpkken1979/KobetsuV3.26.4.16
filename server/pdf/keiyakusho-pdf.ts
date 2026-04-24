/**
 * 契約書 (Labor Contract / 労働契約書兼就業条件明示書)
 *
 * Refactor 2026-04-23 — match al formato de referencia
 * "個別契約書TEXPERT2026.1Perfect.pdf" (plantilla oficial UNS).
 *
 * Landscape A4 visible (842.0 × 595.22pt). Dos mitades:
 *   Izquierda (cols A-H) = No.1 — 労働契約書
 *   Derecha   (cols J-P) = No.2 — 就業条件明示書
 *   Col I separador.
 *
 * Cambios vs. versión anterior:
 *   - Eliminado spacer vertical C/M (era columna gris de 21px)
 *   - Grid pasó de 18 a 16 columnas útiles
 *   - Fondo gris LBG sacado — labels se distinguen por borde + posición
 *   - Font base 7pt uniforme (antes 4.5-6pt) con auto-shrink 3.5pt mínimo
 *   - Grid impreso con el tamaño exacto de la plantilla: 748.92,529.56pt
 *   - 就業時間: renderizado adaptativo según cantidad de turnos (1, 2, 3-5, 6+)
 *
 * Font: JP-Mincho (BIZ UD明朝).
 */
import {
  type Doc,
  UNS,
  isIndefiniteEmployment,
  genderText,
  getHireReference,
  getTakaoJigyosho,
  formatDateJP,
} from "./helpers.js";
import type { BaseEmployeeWithRate, CellOpts } from "./types.js";

// ─── DATA INTERFACES ──────────────────────────────────────────────────

export interface KeiyakushoEmployee extends BaseEmployeeWithRate {
  employeeNumber: string;
  romajiName?: string | null;
  nationality: string | null;
  address: string | null;
  postalCode: string | null;
  billingRate: number | null;
  visaExpiry: string | null;
  visaType: string | null;
}

export interface KeiyakushoData {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  factoryName: string;
  factoryAddress: string;
  factoryPhone: string;
  department: string;
  lineName: string;
  conflictDate: string;
  startDate: string;
  endDate: string;
  contractDate: string;
  jobDescription: string;
  workHours: string;
  workHoursDay: string;
  workHoursNight: string;
  breakTime: string;
  breakTimeDay: string;
  breakTimeNight: string;
  overtimeHours: string;
  calendar: string;
  closingDay: string;
  paymentDay: string;
  hourlyRate: number;
  shiftPattern: string;

  // 指揮命令者
  supervisorDept: string;
  supervisorName: string;
  supervisorPhone: string;

  // 派遣先責任者
  hakensakiManagerDept: string;
  hakensakiManagerName: string;
  hakensakiManagerPhone: string;

  // 派遣元責任者 (UNS manager per factory)
  managerUnsDept?: string;
  managerUnsName?: string;
  managerUnsPhone?: string;

  // 苦情処理 (UNS side)
  complaintUnsDept: string;
  complaintUnsName: string;
  complaintUnsPhone: string;

  // 苦情処理 (Client side)
  complaintClientDept: string;
  complaintClientName: string;
  complaintClientPhone: string;

  employee: KeiyakushoEmployee;
}

const fmtDate = formatDateJP;

// ─── GRID SYSTEM ──────────────────────────────────────────────────────
// Landscape A4 visible. The reference PDF is stored as portrait A4 with
// /Rotate 90, but renders to the same 842.0 × 595.22pt landscape viewport.
// 16 columnas: A-B labels izq | C-H valores izq | I separador | J-K labels der | L-P valores der

const PAGE_WIDTH = 842.0;
const PAGE_HEIGHT = 595.22;
const TABLE_WIDTH = 748.92;
const TABLE_HEIGHT = 529.56;
const TABLE_LEFT = (PAGE_WIDTH - TABLE_WIDTH) / 2;
const TABLE_TOP = (PAGE_HEIGHT - TABLE_HEIGHT) / 2;

// Anchos relativos (px Excel). Suma = 1662.
// Spacers C/M viejos (21px c/u) absorbidos en columna C y L nuevas.
const COL_PX = [
  101, 49,                                   // A-B: labels izq (150px)
  85, 88, 88, 88, 112, 195,                  // C-H: valores izq (656px) — C absorbió spacer
  26,                                        // I: separador mitades
  41, 83,                                    // J-K: labels der (124px)
  141, 115, 125, 88, 237,                    // L-P: valores der (706px) — L absorbió spacer
];
const TOTAL_PX = COL_PX.reduce((a, b) => a + b, 0);

const CX: number[] = [];
{ let x = TABLE_LEFT; for (const w of COL_PX) { CX.push(x); x += (w / TOTAL_PX) * TABLE_WIDTH; } CX.push(x); }

// Alturas de fila indexadas por número de fila Excel
const RH_LIST: number[] = [
  0, 0,                                                    // 0,1: placeholders
  16, 14,                                                  // 2-3: título
  18, 18, 18, 18, 18, 18,                                  // 4-9: personal info
  17, 17, 17, 17, 17, 17, 17, 17,                          // 10-17: 就業場所/組織
  16.5, 16.5, 16.5, 16.5, 16.5, 16.5, 16.5,                // 18-24: 就業時間
  15, 15,                                                  // 25-26: 休日
  15, 15,                                                  // 27-28: 休暇
  15, 15, 15, 15, 15, 15,                                  // 29-34: 賃金
  14, 14, 14, 14,                                          // 35-38: 退職
  13.5, 13.5, 13.5, 13.5, 13.5, 13.5,                      // 39-44: その他
  13.5, 13.5, 13.5, 13.5, 13.5, 13.5, 13.5, 13.5, 13.5, 13.5,  // 45-54: 更新
];
const TOTAL_RH = RH_LIST.slice(2).reduce((a, b) => a + b, 0);
const YS = TABLE_HEIGHT / TOTAL_RH;

const RY: number[] = [0, 0];
{ let y = TABLE_TOP; for (let i = 2; i <= 54; i++) { RY.push(y); y += RH_LIST[i] * YS; } RY.push(y); }

// Índices de columna (0-based). _I (col 8) es el separador entre mitades — no se dibuja.
const _A = 0, _B = 1;
const _C = 2, _D = 3, _E = 4, _F = 5, _G = 6, _H = 7;
const _J = 9, _K = 10;
const _L = 11, _M = 12, _N = 13, _O = 14, _P = 15;

const cx = (c: number) => CX[c];
const cw = (s: number, e: number) => CX[e + 1] - CX[s];
const ry = (r: number) => RY[r];
const rh = (s: number, e: number) => RY[e + 1] - RY[s];

// ─── CELL DRAWING ────────────────────────────────────────────────────

function cell(
  doc: Doc,
  r1: number, c1: number, r2: number, c2: number,
  text: string, fs: number = 7, opts: CellOpts = {}
) {
  const x = cx(c1), y = ry(r1), w = cw(c1, c2), h = rh(r1, r2);
  const { align = "left", valign = "center", wrap = true, noBorder = false, bg } = opts;
  const pad = 2;

  if (!noBorder) doc.lineWidth(0.3).rect(x, y, w, h).stroke();

  if (bg) {
    doc.save().fillColor(bg).rect(x + 0.2, y + 0.2, w - 0.4, h - 0.4).fill().restore();
  }

  if (!text) return;

  const tw = w - pad * 2;

  // Auto-shrink hasta que entre
  let size = fs;
  while (size > 3.5) {
    doc.fontSize(size);
    const th = doc.heightOfString(text, { width: tw });
    if (th <= h - pad) break;
    size -= 0.5;
  }

  doc.fontSize(size).fillColor("#000");
  const th = doc.heightOfString(text, { width: tw });
  const ty = valign === "top" ? y + pad : y + Math.max((h - th) / 2, pad);

  doc.save();
  doc.rect(x, y, w, h).clip();
  doc.text(text, x + pad, ty, { width: tw, align, lineBreak: wrap });
  doc.restore();
}

// Helper: label cell (center-aligned, ideal para columnas A-B y J-K)
function lbl(
  doc: Doc,
  r1: number, c1: number, r2: number, c2: number,
  text: string, fs: number = 6.5
) {
  cell(doc, r1, c1, r2, c2, text, fs, { align: "center", valign: "center" });
}

// ─── SHIFT PARSING ────────────────────────────────────────────────────

interface ParsedShift {
  label: string;
  time: string;
  breakTime: string;
}

/**
 * Parsea workHours y breakTime en lista de turnos estructurados.
 * Soporta formatos:
 *   - "A勤務：7:00～15:30　B勤務：15:30～0:00"  (separado por espacio full-width)
 *   - "A勤務：7:00～15:30\nB勤務：15:30～0:00"  (separado por newline)
 *   - "昼勤：7:00～15:30\n夜勤：19:00～3:30"
 */
function parseShifts(workHours: string, breakTimes: string): ParsedShift[] {
  if (!workHours) return [];

  const shiftRegex = /([A-Za-zＡ-Ｚ０-９一-龯]+勤務?|昼勤|夜勤|早番|遅番)[:：]\s*([0-9０-９:：]+\s*[～~-]\s*[0-9０-９:：]+)/g;
  const matches: ParsedShift[] = [];

  let m: RegExpExecArray | null;
  while ((m = shiftRegex.exec(workHours)) !== null) {
    matches.push({ label: m[1], time: m[2], breakTime: "" });
  }

  // Fallback: split por newline si el regex no matcheó
  if (matches.length === 0) {
    const lines = workHours.split(/[\n]+/).filter(l => l.trim());
    const defaults = ["昼 勤", "夜 勤", "3直", "4直", "5直"];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Solo aceptar label si empieza con letra (no con dígito — evita partir "8:00~17:00")
      const nm = line.match(/^([A-Za-zＡ-Ｚ一-龯ぁ-んァ-ヴ][^：:]*?)[:：]\s*(\d.+)$/);
      if (nm) {
        matches.push({ label: nm[1].trim(), time: nm[2].trim(), breakTime: "" });
      } else {
        // Línea sin label descriptor — usar default según posición
        matches.push({ label: defaults[i] || `${i + 1}直`, time: line, breakTime: "" });
      }
    }
  }

  // Emparejar breaks por índice
  const breakLines = (breakTimes || "")
    .split(/[\n]+/)
    .filter(l => l.trim())
    .flatMap(l => {
      // Un break line puede traer varios turnos separados por espacio full-width
      const parts = l.split(/[　\s]+(?=[A-Za-zＡ-Ｚ０-９一-龯]+勤)/);
      return parts.length > 1 ? parts : [l];
    });

  for (let i = 0; i < matches.length && i < breakLines.length; i++) {
    const b = breakLines[i].trim();
    // Solo extraer "time" si la línea empieza con label textual (letras), no con dígitos.
    // Esto evita que "8:00~13:00" se parta en label="8" + time="00~13:00".
    const bm = b.match(/^([A-Za-zＡ-Ｚ一-龯ぁ-んァ-ヴ][^：:]*?)[:：]\s*(\d.+)$/);
    matches[i].breakTime = bm ? bm[2].trim() : b;
  }

  return matches;
}

// ─── MAIN GENERATOR ─────────────────────────────────────────────────

export function generateKeiyakushoPDF(doc: Doc, data: KeiyakushoData): void {
  const emp = data.employee;
  if (!emp) return;

  doc.font("JP-Mincho");

  const hireRef = getHireReference(emp.actualHireDate, emp.hireDate);
  const isInfinite = hireRef ? isIndefiniteEmployment(hireRef, data.endDate) : false;
  const gender = genderText(emp.gender);
  const empRate = emp.hourlyRate ?? data.hourlyRate ?? 0;
  const billingRate = emp.billingRate ?? emp.hourlyRate ?? data.hourlyRate ?? 0;

  // 派遣元責任者 (UNS manager)
  const unsMgr = UNS.defaultManager;
  const mDept = data.managerUnsDept || unsMgr.dept;
  const mName = data.managerUnsName || `${unsMgr.role}　${unsMgr.name}`;
  const mPhone = data.managerUnsPhone || unsMgr.phone;

  // 苦情処理 UNS
  const uDept = data.complaintUnsDept || unsMgr.dept;
  const uName = data.complaintUnsName || `${unsMgr.role}　${unsMgr.name}`;
  const uPhone = data.complaintUnsPhone || unsMgr.phone;

  // 派遣先責任者 (never fallback to 指揮命令者)
  const hmDept = data.hakensakiManagerDept || "";
  const hmName = data.hakensakiManagerName || "";
  const hmPhone = data.hakensakiManagerPhone || data.companyPhone;

  // Jigyosho + composición 就業場所
  const jigyosho = getTakaoJigyosho(data.companyName, data.factoryAddress || data.companyAddress);
  const shugyoName = jigyosho
    ? [data.companyName, jigyosho].filter(Boolean).join("　")
    : [data.companyName, data.factoryName, data.department].filter(Boolean).join("　");
  const soshikiText = jigyosho
    ? [jigyosho, data.factoryName, data.department].filter(Boolean).join("　")
    : data.department || "";

  // Shift parsing (fuente de verdad: workHours; si vacío, fallback a day/night)
  const allBreaks = data.breakTime
    || [data.breakTimeDay, data.breakTimeNight].filter(Boolean).join("\n");
  const allWork = data.workHours
    || [
      data.workHoursDay ? `昼勤：${data.workHoursDay}` : "",
      data.workHoursNight ? `夜勤：${data.workHoursNight}` : "",
    ].filter(Boolean).join("\n");

  const shifts = parseShifts(allWork, allBreaks);

  // ═══════════════════════════════════════════════════════════════════
  //  LEFT HALF (No.1) — 労働契約書
  // ═══════════════════════════════════════════════════════════════════

  // Título R2:R3 A:H
  cell(doc, 2, _A, 3, _H,
    "労　働　契　約　書　兼　就　業　条　件　明　示　書     No.1", 9,
    { align: "center" });

  // R4 フリガナ
  lbl(doc, 4, _A, 4, _B, "フ リ ガ ナ", 7);
  cell(doc, 4, _C, 4, _H, emp.katakanaName || "", 7.5);

  // R5 氏名 (romaji preferido)
  lbl(doc, 5, _A, 5, _B, "氏　　　名", 7);
  cell(doc, 5, _C, 5, _H, emp.romajiName || emp.fullName, 7.5);

  // R6 現住所
  lbl(doc, 6, _A, 6, _B, "現 　住 　所", 7);
  cell(doc, 6, _C, 6, _H, emp.address || "", 7);

  // R7 生年月日
  lbl(doc, 7, _A, 7, _B, "生 年 月 日", 7);
  cell(doc, 7, _C, 7, _H, fmtDate(emp.birthDate), 7);

  // R8 性別
  lbl(doc, 8, _A, 8, _B, "性  　　　別", 7);
  cell(doc, 8, _C, 8, _H, gender, 7);

  // R9 intro
  cell(doc, 9, _A, 9, _H, "次の条件で労働派遣行います。", 7, { align: "right" });

  // R10:R11 雇用期間
  lbl(doc, 10, _A, 11, _B, "雇用期間", 7);
  if (isInfinite) {
    cell(doc, 10, _C, 11, _H, "無期", 14, { align: "center" });
  } else {
    cell(doc, 10, _C, 11, _E, fmtDate(data.startDate), 8, { align: "center" });
    cell(doc, 10, _F, 11, _F, "～", 8, { align: "center" });
    cell(doc, 10, _G, 11, _H, fmtDate(data.endDate), 8, { align: "center" });
  }

  // R12:R14 就業場所
  lbl(doc, 12, _A, 14, _B, "就業場所", 7);
  // R12 事業所
  cell(doc, 12, _C, 12, _D, "事  業  所：", 6.5);
  cell(doc, 12, _E, 12, _H, shugyoName, 7);
  // R13 所在地
  cell(doc, 13, _C, 13, _D, "所  在  地：", 6.5);
  cell(doc, 13, _E, 13, _H, data.factoryAddress || data.companyAddress, 7);
  // R14 電話番号
  cell(doc, 14, _C, 14, _D, "電  話  番  号：", 6.5);
  cell(doc, 14, _E, 14, _H, data.factoryPhone || data.companyPhone, 7);

  // R15:R17 組織単位 / 責任 / 業務
  lbl(doc, 15, _A, 15, _B, "組織単位", 7);
  cell(doc, 15, _C, 15, _H, soshikiText, 7);
  lbl(doc, 16, _A, 16, _B, "業務に伴う責任の程度", 5.5);
  cell(doc, 16, _C, 16, _H, "役職なし（付与される権限なし）", 7);
  lbl(doc, 17, _A, 17, _B, "従事すべき業務内容", 6);
  cell(doc, 17, _C, 17, _H, data.jobDescription, 7, { valign: "center" });

  // R18:R24 就業時間/休憩時間
  lbl(doc, 18, _A, 24, _B, "就業時間\n休憩時間", 7);

  if (shifts.length === 0) {
    // Sin datos
    for (let r = 18; r <= 22; r++) {
      cell(doc, r, _C, r, _C, "", 6.5);
      cell(doc, r, _D, r, _H, "", 7);
    }
  } else if (shifts.length <= 2) {
    // 1-2 shifts: layout clásico 昼勤/休憩/夜勤/休憩 (4 filas usadas + 1 blank)
    const s0 = shifts[0];
    const s1 = shifts[1];

    lbl(doc, 18, _C, 18, _C, s0?.label || "昼 勤", 6.5);
    cell(doc, 18, _D, 18, _H, s0 ? `${s0.label}：${s0.time}` : "", 7);

    lbl(doc, 19, _C, 19, _C, "休  憩", 6.5);
    cell(doc, 19, _D, 19, _H, s0?.breakTime ? `${s0.label}：${s0.breakTime}` : "", 7);

    lbl(doc, 20, _C, 20, _C, s1?.label || "", 6.5);
    cell(doc, 20, _D, 20, _H, s1 ? `${s1.label}：${s1.time}` : "", 7);

    lbl(doc, 21, _C, 21, _C, s1 ? "休  憩" : "", 6.5);
    cell(doc, 21, _D, 21, _H, s1?.breakTime ? `${s1.label}：${s1.breakTime}` : "", 7);

    cell(doc, 22, _C, 22, _C, "", 6.5);
    cell(doc, 22, _D, 22, _H, "", 7);
  } else if (shifts.length <= 5) {
    // 3-5 shifts: 1 por fila, rows 18-22
    for (let i = 0; i < 5; i++) {
      const s = shifts[i];
      const r = 18 + i;
      if (s) {
        lbl(doc, r, _C, r, _C, s.label, 6.5);
        const txt = s.breakTime ? `${s.time}　休憩：${s.breakTime}` : s.time;
        cell(doc, r, _D, r, _H, txt, 7);
      } else {
        cell(doc, r, _C, r, _C, "");
        cell(doc, r, _D, r, _H, "");
      }
    }
  } else {
    // 6+ shifts: 2 por fila, hasta 10 turnos en 5 filas
    for (let row = 0; row < 5; row++) {
      const r = 18 + row;
      const sA = shifts[row * 2];
      const sB = shifts[row * 2 + 1];
      const parts = [sA, sB].filter(Boolean).map(s =>
        s!.breakTime
          ? `${s!.label}：${s!.time}（休${s!.breakTime}）`
          : `${s!.label}：${s!.time}`
      );
      cell(doc, r, _C, r, _C, "", 6);
      cell(doc, r, _D, r, _H, parts.join("　／　"), 6.5);
    }
  }

  // R23-R24 notas de flexibilidad
  cell(doc, 23, _C, 23, _H, "業務の都合により、就業時間の変更並びに短縮をすることがある。", 6.5);
  cell(doc, 24, _C, 24, _H, "業務の都合により、休日を他の日に振り替えることがある。", 6.5);

  // R25:R26 休日
  lbl(doc, 25, _A, 26, _B, "休日", 7);
  cell(doc, 25, _C, 26, _H,
    data.calendar || "土曜日・日曜日・年末年始・GW・夏季休暇", 7);

  // R27:R28 休暇
  lbl(doc, 27, _A, 28, _B, "休暇", 7);
  cell(doc, 27, _C, 28, _H, "年次有給休暇　労働基準法通り", 7);

  // R29:R34 賃金
  lbl(doc, 29, _A, 34, _B, "賃金", 7);
  cell(doc, 29, _C, 29, _H,
    `１．基本給　　時給　　¥${empRate.toLocaleString("ja-JP")}　／Ｈ`, 7);
  cell(doc, 30, _C, 30, _H,
    "２．時間外手当及び休日出勤 ・・・・労働基準法の規定による手当", 6.5);
  cell(doc, 31, _C, 31, _H,
    "３．深夜手当 ・・・・労働基準法の規定による手当（22：00～5：00の実働に対し25％増し）", 6);
  cell(doc, 32, _C, 32, _H,
    `４．賃金締切及び支払日・・・・${data.closingDay || "当月１５日"}締切　${data.paymentDay || "翌月１５日"}支払日`,
    6.5);
  cell(doc, 33, _C, 33, _H,
    "５．賃金支払時の控除 ・・・・法定控除及び労使協定の締結による控除費目", 6.5);
  cell(doc, 34, _C, 34, _H,
    "６．月６０時間以内（ ２５）％　月６０時間超 （ ５０）％", 7);

  // R35:R38 退職
  lbl(doc, 35, _A, 38, _B, "退職に関する事項", 6);
  cell(doc, 35, _C, 35, _H, "・解雇の事由及び手続　就業規則第32条、第34条に記載", 6.5);
  cell(doc, 36, _C, 36, _H, "・会社の名誉と信用を失墜するような行為をしたとき。", 6.5);
  cell(doc, 37, _C, 37, _H, "・身勝手な行為や素行不良等により職場の秩序、風紀を乱したとき。", 6.5);
  cell(doc, 38, _C, 38, _H, "・退職を希望する時は、必ず30日前に申し出ること。", 6.5);

  // R39:R44 その他
  lbl(doc, 39, _A, 44, _B, "その他", 7);
  cell(doc, 39, _C, 39, _H, "・社会保険の加入（　☑有　・　□無　）", 6.5);
  cell(doc, 40, _C, 40, _H, "・雇用保険の加入（　☑有　・　□無　）", 6.5);
  cell(doc, 41, _C, 43, _H,
    "・その他（守秘義務　派遣業務遂行中に、知り得た技術上または営業上の機密を派遣中はもちろん派遣終了後も開示、漏洩もしくは使用してはならない。違反した場合は、損害賠償請求をすることがある。）",
    6, { valign: "top" });
  cell(doc, 44, _C, 44, _H, "・本書記載事項以外の労働条件は、当社就業規則による。", 6.5);

  // R45:R54 更新の有無
  lbl(doc, 45, _A, 54, _B, "更新の有無", 7);
  cell(doc, 45, _C, 45, _H, "１．更新の有無", 7);
  cell(doc, 46, _C, 46, _H,
    `　　「${isInfinite ? "□" : "☑"}更新する場合があり得る　・　${isInfinite ? "☑" : "□"}契約の更新はしない」`,
    6.5);
  cell(doc, 47, _C, 47, _H, "２．契約の更新は、次のいずれかにより判断する。", 7);
  cell(doc, 48, _C, 48, _H, "　・契約期間満了時の業務量", 6.5);
  cell(doc, 49, _C, 49, _H, "　・勤務成績、態度", 6.5);
  cell(doc, 50, _C, 50, _H, "　・会社の経営状況", 6.5);
  cell(doc, 51, _C, 51, _H, "　・能力", 6.5);
  cell(doc, 52, _C, 52, _H, "　・従事している業務の進捗状況", 6.5);
  cell(doc, 53, _C, 53, _H,
    "　・その他（　　　　　　　　　　　　　　　　　　　　　　　　　　　）", 6.5);
  cell(doc, 54, _C, 54, _H,
    `３．${isInfinite ? "□" : "☑"}期間の定めあり、${isInfinite ? "☑" : "□"}期間の定めなし`,
    7);

  // ═══════════════════════════════════════════════════════════════════
  //  RIGHT HALF (No.2) — 就業条件明示書
  // ═══════════════════════════════════════════════════════════════════

  // Título R2:R3 J:P
  cell(doc, 2, _J, 3, _P,
    "労　働　契　約　書　兼　就　業　条　件　明　示　書     No.2", 9,
    { align: "center" });

  // R5 nombre + 殿
  cell(doc, 5, _J, 5, _M, emp.katakanaName || emp.fullName, 8, { align: "center" });
  cell(doc, 5, _N, 5, _N, "殿", 8, { align: "center" });
  cell(doc, 5, _O, 5, _P, "", 7);

  // R7:R8 協定対象
  lbl(doc, 7, _J, 8, _K, "派遣労働者を協定\n対象労働者に限定\nするか否かの別", 6);
  cell(doc, 7, _L, 7, _P, "□協定対象派遣労働者ではない", 6.5);
  cell(doc, 8, _L, 8, _N, "☑協定対象派遣労働者である　当該協定の有期期間の終了日", 6);
  cell(doc, 8, _O, 8, _P, fmtDate(data.endDate), 7, { align: "center" });

  // R9 派遣期間
  lbl(doc, 9, _J, 9, _K, "派遣期間", 7);
  cell(doc, 9, _L, 9, _M, fmtDate(data.startDate), 7.5, { align: "center" });
  cell(doc, 9, _N, 9, _N, "～", 7.5, { align: "center" });
  cell(doc, 9, _O, 9, _P, fmtDate(data.endDate), 7.5, { align: "center" });

  // R10:R11 派遣先の抵触日
  lbl(doc, 10, _J, 11, _K, "派遣先の抵触日", 7);
  cell(doc, 10, _L, 11, _P, fmtDate(data.conflictDate), 8, { align: "center" });

  // R12:R13 組織（個人）抵触日
  lbl(doc, 12, _J, 13, _K, "組織（個人）\n抵触日", 6.5);
  cell(doc, 12, _L, 13, _M,
    isInfinite ? "無期雇用" : fmtDate(data.conflictDate), 7.5, { align: "center" });
  cell(doc, 12, _N, 13, _P,
    "なお、派遣先の事業所における派遣可能期間の延長について、当該手続を適正に行っていない場合や派遣労働者個人単位の期間制限の抵触日を超えて労働者派遣の役務の提供を受けた場合は、派遣先は労働契約の申込みをしたものとみなされます。",
    5, { valign: "top" });

  // R14:R15 派遣元責任者
  lbl(doc, 14, _J, 15, _K, "派遣元責任者", 7);
  cell(doc, 14, _L, 15, _N, `${mDept}　${mName}`, 7);
  cell(doc, 14, _O, 15, _P, `電話番号：${mPhone}`, 6.5);

  // R16:R17 派遣先責任者
  lbl(doc, 16, _J, 17, _K, "派遣先責任者", 7);
  cell(doc, 16, _L, 17, _N, `${hmDept}　${hmName}`, 7);
  cell(doc, 16, _O, 17, _P, `電話番号：${hmPhone}`, 6.5);

  // R18:R28 苦情の処理
  lbl(doc, 18, _J, 28, _K,
    "苦情の処理及び\n申出先、苦情処理\n方法、連携体制等", 5.5);
  // R18:R19 派遣元
  lbl(doc, 18, _L, 19, _L, "派遣元", 7);
  cell(doc, 18, _M, 19, _N, `${uDept}　${uName}`, 6.5);
  cell(doc, 18, _O, 19, _P, `電話番号：${uPhone}`, 6.5);
  // R20:R21 派遣先
  lbl(doc, 20, _L, 21, _L, "派遣先", 7);
  cell(doc, 20, _M, 21, _N,
    `${data.complaintClientDept || ""}　${data.complaintClientName || ""}`, 6.5);
  cell(doc, 20, _O, 21, _P,
    `電話番号：${data.complaintClientPhone || ""}`, 6.5);
  // R22:R28 procedimiento
  cell(doc, 22, _L, 28, _P,
    `①派遣元における上記の者が苦情の申し出を受けたときは、ただちに派遣元責任者の${mName}へ連絡することとし、当該派遣元責任者が中心となって、誠意をもって、遅滞なく、当該苦情の適切、迅速な処理を図ることとする。\n②苦情処理を行うに際しては派遣元と派遣先との密接な連携のもとに誠意をもって対応し解決を図る。`,
    5.5, { valign: "top" });

  // R29 指揮命令者
  lbl(doc, 29, _J, 29, _K, "指揮命令者", 7);
  cell(doc, 29, _L, 29, _P,
    `${data.supervisorDept}　${data.supervisorName}`, 7);

  // R30:R33 時間外労働及び休日労働
  lbl(doc, 30, _J, 33, _K, "時間外労働\n及び\n休日労働", 6);
  cell(doc, 30, _L, 30, _P,
    `時間外労働〔①□無　・　②☑有（　${data.overtimeHours || "１日5時間，1ヶ月42時間，1年320時間"}　）〕`,
    6);
  cell(doc, 31, _L, 31, _P,
    "※但し、特別条項により1ヶ月80時間迄、1年720時間迄延長できる。申請は年6回迄とする。", 6);
  cell(doc, 32, _L, 33, _P,
    "休日労働〔①□無　・　②☑有 ※但し1か月2回の範囲で命ずることができることとする〕", 6.5);

  // R34:R40 派遣契約解除の場合の措置
  lbl(doc, 34, _J, 40, _K, "派遣契約解除の\n場合の措置", 6);
  cell(doc, 34, _L, 40, _P,
    "労働者の責に帰すべき事由によらない労働者派遣契約の解除が行われた場合には、派遣先と連携して他の派遣先をあっせんする等により新たな就業機会の確保を図ることとする。また、当該派遣元事業主は、当該労働者を解雇しようとするときは、労働基準法等に基づく責任を果たすこととする。",
    5.5, { valign: "top" });

  // R41:R42 安全・衛生
  lbl(doc, 41, _J, 42, _K, "安全・衛生", 7);
  cell(doc, 41, _L, 42, _P,
    "派遣先は労働者派遣法第４４条から第４７条までの規定により自己に課せられた責任を負う。\n（但し業務上の事由による災害の場合は派遣元にて手続きを行う。）",
    6, { valign: "top" });

  // R43:R44 福利厚生
  lbl(doc, 43, _J, 44, _K, "福利厚生施設等", 6.5);
  cell(doc, 43, _L, 44, _P,
    "☑食堂、☑駐車場、☑更衣室、□シャワー室、制服（□有償・☑無償）〔その他　　　　　　〕",
    6.5);

  // R45:R47 紛争防止
  lbl(doc, 45, _J, 47, _K,
    "派遣先が派遣労働\n者を雇用する場合\nの紛争防止措置", 5.5);
  cell(doc, 45, _L, 47, _P,
    "労働者派遣の役務の提供終了後、当該派遣労働者を派遣先が雇用する場合には、手数料として派遣先は、派遣元事業主に支払うものとする。金額については甲乙協議の上決定することとする。",
    5.5, { valign: "top" });

  // R48 備考
  lbl(doc, 48, _J, 48, _K, "備考", 7);
  cell(doc, 48, _L, 48, _P,
    `当該労働者に係る労働者派遣に関する料金の額：${billingRate.toLocaleString("ja-JP")}円/時　（事業所平均）`,
    6.5);

  // R49:R54 Área de firma
  // R49 fecha del contrato (full right side)
  cell(doc, 49, _J, 49, _P,
    fmtDate(data.contractDate || data.startDate), 7.5, { align: "left" });

  // R50 使用者 / 労働者 headers
  cell(doc, 50, _J, 50, _M, "使用者", 7);
  cell(doc, 50, _N, 50, _P, "労働者", 7);

  // R51 address / サイン
  cell(doc, 51, _J, 51, _M, UNS.address.replace("〒", ""), 6.5);
  cell(doc, 51, _N, 51, _P, "サイン（受領）", 6.5);

  // R52 UNS name
  cell(doc, 52, _J, 52, _M, UNS.name, 7);
  cell(doc, 52, _N, 52, _P, "", 7);

  // R53 representante + phone
  cell(doc, 53, _J, 53, _M,
    `代表取締役　　${UNS.representative.replace("代表取締役　", "")}`, 7);
  cell(doc, 53, _N, 53, _P, `電話番号：${unsMgr.phone}`, 6.5);

  // R54 就業者名
  cell(doc, 54, _J, 54, _M, "", 7);
  cell(doc, 54, _N, 54, _P,
    `就業者名：${emp.katakanaName || emp.fullName}`, 6.5);

  // Restaurar font default para siguiente página
  doc.font("JP");
}
