/**
 * Shift/break time calculation and parsing utilities.
 * Extracted from companies/index.tsx to eliminate 200+ lines.
 */

// ─── Types ──────────────────────────────────────────────────────────

interface BreakEntry {
  id: string;
  startTime: string;
  endTime: string;
}

export interface ShiftEntry {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breaks: BreakEntry[];
}

type ShiftPreset = Omit<ShiftEntry, "id" | "breaks">[];

// ─── Constants ──────────────────────────────────────────────────────

export const SHIFT_PRESETS: Record<string, ShiftPreset> = {
  normal: [{ name: "日勤", startTime: "08:00", endTime: "17:00" }],
  "2shift": [
    { name: "昼勤", startTime: "08:00", endTime: "17:00" },
    { name: "夜勤", startTime: "20:00", endTime: "05:00" },
  ],
  "3shift": [
    { name: "1直", startTime: "06:00", endTime: "14:00" },
    { name: "2直", startTime: "14:00", endTime: "22:00" },
    { name: "3直", startTime: "22:00", endTime: "06:00" },
  ],
  "4on2off": [
    { name: "昼勤", startTime: "07:00", endTime: "15:30" },
    { name: "夜勤", startTime: "19:00", endTime: "03:30" },
  ],
  irregular: [{ name: "シフト1", startTime: "", endTime: "" }],
};

export const SHIFT_PATTERN_OPTIONS = [
  { value: "normal", label: "通常（日勤のみ）" },
  { value: "2shift", label: "昼夜2交代" },
  { value: "3shift", label: "3交代" },
  { value: "4on2off", label: "4勤2休" },
  { value: "irregular", label: "変則シフト" },
];

export const CONTRACT_PERIOD_OPTIONS = [
  { value: "teishokubi", label: "抵触日まで" },
  { value: "1month", label: "毎月" },
  { value: "3months", label: "3ヶ月毎" },
  { value: "6months", label: "6ヶ月毎" },
  { value: "1year", label: "1年" },
];

// ─── UID Generator ──────────────────────────────────────────────────

let _idCounter = 0;
export function uid(): string {
  return `_${++_idCounter}`;
}

// ─── Canonical Shift Sort ───────────────────────────────────────────
// Orden: 日勤→昼勤→夕勤→夜勤→深夜 (kanji fijo) → kanji numerados
// (1直, シフト1…) → letras latinas (A-Z) → otros kanji → resto.
// Dentro de cada grupo se ordena por sufijo ①②③ / número trailing.

const CIRCLED_DIGITS: Record<string, number> = {
  "①": 1, "②": 2, "③": 3, "④": 4, "⑤": 5,
  "⑥": 6, "⑦": 7, "⑧": 8, "⑨": 9, "⑩": 10,
};

const KANJI_TIME_RANK: Record<string, number> = {
  "日勤": 0,
  "通常勤務": 0,
  "昼勤": 1,
  "早番": 1,
  "夕勤": 2,
  "準夜": 2,
  "遅番": 2,
  "夜勤": 3,
  "交替勤務": 3,
  "深夜": 4,
};

function stripSuffix(name: string): string {
  return name.replace(/[①②③④⑤⑥⑦⑧⑨⑩0-9０-９]+$/u, "").trim();
}

function toAsciiDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30));
}

function suffixNumber(name: string): number {
  for (const [c, v] of Object.entries(CIRCLED_DIGITS)) {
    if (name.includes(c)) return v;
  }
  const m = name.match(/([0-9０-９]+)\s*$/);
  if (m) return parseInt(toAsciiDigits(m[1]), 10) || 0;
  return 0;
}

function shiftGroup(rawName: string): number {
  const name = rawName.trim();
  const base = stripSuffix(name);
  if (base in KANJI_TIME_RANK) return 0;
  if (/^[0-9０-９]+\s*[直勤]/.test(name)) return 1;
  if (/^シフト/.test(name)) return 1;
  if (/^[A-Za-z]/.test(name)) return 2;
  if (/^[一-鿿]/.test(name)) return 3;
  return 4;
}

/**
 * Ordena turnos segun el orden canonico del sistema.
 * No muta el array original.
 */
export function sortShiftEntries<T extends { name: string }>(shifts: T[]): T[] {
  return [...shifts].sort((a, b) => {
    const ga = shiftGroup(a.name);
    const gb = shiftGroup(b.name);
    if (ga !== gb) return ga - gb;

    if (ga === 0) {
      const ra = KANJI_TIME_RANK[stripSuffix(a.name.trim())] ?? 99;
      const rb = KANJI_TIME_RANK[stripSuffix(b.name.trim())] ?? 99;
      if (ra !== rb) return ra - rb;
      return suffixNumber(a.name) - suffixNumber(b.name);
    }

    if (ga === 2) {
      const cmp = a.name.localeCompare(b.name);
      if (cmp !== 0) return cmp;
      return suffixNumber(a.name) - suffixNumber(b.name);
    }

    // Group 1, 3, 4: compare by suffix number then by string
    const sn = suffixNumber(a.name) - suffixNumber(b.name);
    if (sn !== 0) return sn;
    return a.name.localeCompare(b.name);
  });
}

// ─── Time Calculations ──────────────────────────────────────────────

export function calcMinsBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = sh * 60 + sm;
  let e = eh * 60 + em;
  if (e <= s) e += 1440;
  return e - s;
}

function fmtTimeJP(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  return `${parseInt(h, 10)}時${m}分`;
}

export function composeWorkHoursText(shifts: ShiftEntry[]): string {
  const valid = shifts.filter((s) => s.startTime && s.endTime);
  return sortShiftEntries(valid)
    .map((s) => `${s.name}：${fmtTimeJP(s.startTime)}～${fmtTimeJP(s.endTime)}`)
    .join("　");
}

export function composeBreakForShift(shift: ShiftEntry): string {
  const valid = shift.breaks.filter((b) => b.startTime && b.endTime);
  if (!valid.length) return "";
  const parts = valid.map((b) => {
    const m = calcMinsBetween(b.startTime, b.endTime);
    return `${fmtTimeJP(b.startTime)}～${fmtTimeJP(b.endTime)}（${m}分）`;
  });
  const total = valid.reduce((s, b) => s + calcMinsBetween(b.startTime, b.endTime), 0);
  return `${shift.name}：${parts.join("・")}　合計${total}分`;
}

export function composeFullBreakText(shifts: ShiftEntry[]): string {
  const withBreaks = shifts.filter((s) => s.breaks.some((b) => b.startTime && b.endTime));
  return sortShiftEntries(withBreaks)
    .map(composeBreakForShift)
    .join("\n");
}

export function primaryBreakMins(shifts: ShiftEntry[]): number {
  if (!shifts.length) return 0;
  return shifts[0].breaks
    .filter((b) => b.startTime && b.endTime)
    .reduce((s, b) => s + calcMinsBetween(b.startTime, b.endTime), 0);
}

// ─── Parsing ────────────────────────────────────────────────────────

function parseTimeJP(s: string): string {
  const m = s.match(/(\d{1,2})[時:](\d{2})/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return s.trim();
}

function parseShiftFromStr(hours: string, name: string): ShiftEntry | null {
  if (!hours) return null;
  const m = hours.match(/(\d{1,2}[時:]\d{2}分?)\s*[～~ー-]\s*(\d{1,2}[時:]\d{2})/);
  if (!m) return null;
  return {
    id: uid(),
    name,
    startTime: parseTimeJP(m[1]),
    endTime: parseTimeJP(m[2]),
    breaks: [],
  };
}

function parseBreaksFromText(text: string): BreakEntry[] {
  if (!text) return [];
  const entries: BreakEntry[] = [];
  const re = /(\d{1,2}[時:]\d{2}分?)\s*[～~ー-]\s*(\d{1,2}[時:]\d{2})/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    entries.push({ id: uid(), startTime: parseTimeJP(match[1]), endTime: parseTimeJP(match[2]) });
  }
  return entries;
}

interface ShiftSource {
  workHoursDay?: string | null;
  workHoursNight?: string | null;
  workHours?: string | null;
  breakTimeDay?: string | null;
  breakTimeNight?: string | null;
}

export function parseExistingShifts(factory: ShiftSource): ShiftEntry[] {
  const workHoursText = factory.workHours || "";
  const shiftNamePat = /[A-Za-z\u4e00-\u9fff\d]+[勤直務夜番][①-⑩\d０-９]*|シフト\d?/g;
  const shiftRe = new RegExp(`(${shiftNamePat.source})：\\s*(\\d{1,2}[時:]\\d{2}分?\\s*[～~ー-]\\s*\\d{1,2}[時:]\\d{2})`, "g");

  // Always try to parse from workHours text first — it preserves custom names
  if (workHoursText) {
    const shifts: ShiftEntry[] = [];
    let match;
    while ((match = shiftRe.exec(workHoursText)) !== null) {
      const s = parseShiftFromStr(match[2], match[1]);
      if (s) shifts.push(s);
    }
    if (shifts.length) {
      // Distribute breaks to matching shifts by name
      const allBreakText = [factory.breakTimeDay, factory.breakTimeNight].filter(Boolean).join("\n");
      if (allBreakText) {
        // Split by shift name boundaries and assign to matching shift
        const breakSections = allBreakText.split(/\n/).filter(Boolean);
        const shiftNameRe = new RegExp(`^(${shiftNamePat.source})：`);
        for (const section of breakSections) {
          const nameMatch = section.match(shiftNameRe);
          if (nameMatch) {
            const target = shifts.find((s) => s.name === nameMatch[1]) || shifts[0];
            target.breaks.push(...parseBreaksFromText(section));
          } else {
            // No name prefix — assign to first shift without breaks
            const target = shifts.find((s) => s.breaks.length === 0) || shifts[0];
            target.breaks.push(...parseBreaksFromText(section));
          }
        }
      }
      return sortShiftEntries(shifts);
    }
  }

  // Fallback: parse from individual day/night fields (no custom names available)
  const shifts: ShiftEntry[] = [];
  if (factory.workHoursDay) {
    const s = parseShiftFromStr(factory.workHoursDay, "昼勤");
    if (s) {
      s.breaks = parseBreaksFromText(factory.breakTimeDay || "");
      shifts.push(s);
    }
  }
  if (factory.workHoursNight) {
    const s = parseShiftFromStr(factory.workHoursNight, "夜勤");
    if (s) {
      s.breaks = parseBreaksFromText(factory.breakTimeNight || "");
      shifts.push(s);
    }
  }
  if (!shifts.length) {
    shifts.push({ id: uid(), name: "日勤", startTime: "", endTime: "", breaks: [] });
  }
  return shifts;
}

// ─── Calendar Utilities ──────────────────────────────────────────────

/** Holiday periods (Toyota-style) used to generate default calendar text. */
const HOLIDAY_DB: Record<string, [[string, string], [string, string], [string, string]]> = {
  "2019": [["04-27", "05-06"], ["08-09", "08-17"], ["12-26", "01-05"]],
  "2020": [["04-29", "05-06"], ["08-08", "08-16"], ["12-26", "01-05"]],
  "2021": [["04-29", "05-05"], ["08-07", "08-15"], ["12-26", "01-05"]],
  "2022": [["04-29", "05-05"], ["08-08", "08-16"], ["12-26", "01-05"]],
  "2023": [["04-29", "05-05"], ["08-08", "08-16"], ["12-26", "01-05"]],
  "2024": [["04-27", "05-06"], ["08-10", "08-18"], ["12-26", "01-05"]],
  "2025": [["04-29", "05-06"], ["08-08", "08-17"], ["12-27", "01-05"]],
  "2026": [["04-29", "05-05"], ["08-08", "08-16"], ["12-26", "01-05"]],
};

/** Generate default calendar text based on current year's holiday schedule. */
export function generateCalendarText(): string {
  const year = new Date().getFullYear();
  const db = HOLIDAY_DB[String(year)];
  const toJP = (mmdd: string) => { const [m, d] = mmdd.split("-").map(Number); return `${m}月${d}日`; };
  const parts = ["土曜日・日曜日"];
  if (db) {
    parts.push(`年末年始（${toJP(db[2][0])}～${toJP(db[2][1])}）`);
    parts.push(`GW（${toJP(db[0][0])}～${toJP(db[0][1])}）`);
    parts.push(`夏季休暇（${toJP(db[1][0])}～${toJP(db[1][1])}）`);
  }
  return parts.join("・");
}
