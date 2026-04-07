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
  return `${parseInt(h)}時${m}分`;
}

export function composeWorkHoursText(shifts: ShiftEntry[]): string {
  return shifts
    .filter((s) => s.startTime && s.endTime)
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
  return shifts
    .filter((s) => s.breaks.some((b) => b.startTime && b.endTime))
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
  const shiftNamePat = /[A-Za-z\u4e00-\u9fff\d]+[勤直務]|シフト\d?/g;
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
      return shifts;
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
