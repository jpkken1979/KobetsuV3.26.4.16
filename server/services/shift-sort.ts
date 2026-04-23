// Server-side normalizer for workHours / breakTime strings.
// Mirrors the canonical order defined in src/lib/shift-utils.ts:
//   Group 0 (kanji fijo): 日勤 → 昼勤 → 夕勤 → 夜勤 → 深夜
//   Group 1: kanji numerados (1直, シフト1, …)
//   Group 2: letras latinas (A-Z)
//   Group 3: otros kanji
//   Group 4: resto
// Se usa en el script de migración y (opcionalmente) antes de escribir
// workHours/breakTime al PDF como red de seguridad.

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

function compareShiftNames(a: string, b: string): number {
  const ga = shiftGroup(a);
  const gb = shiftGroup(b);
  if (ga !== gb) return ga - gb;

  if (ga === 0) {
    const ra = KANJI_TIME_RANK[stripSuffix(a.trim())] ?? 99;
    const rb = KANJI_TIME_RANK[stripSuffix(b.trim())] ?? 99;
    if (ra !== rb) return ra - rb;
    return suffixNumber(a) - suffixNumber(b);
  }

  if (ga === 2) {
    const cmp = a.localeCompare(b);
    if (cmp !== 0) return cmp;
    return suffixNumber(a) - suffixNumber(b);
  }

  const sn = suffixNumber(a) - suffixNumber(b);
  if (sn !== 0) return sn;
  return a.localeCompare(b);
}

// Shift name pattern — acepta sufijos ①-⑩ y dígitos (full/half width)
// Ej: 昼勤①, 昼勤②, A勤務, 交替勤務③, シフト1
const SHIFT_NAME_PAT = /[A-Za-z一-鿿\d]+[勤直務夜番][①-⑩0-9０-９]*|シフト\d?/;

/**
 * Normalize a workHours string into canonical shift order.
 * Conservative: returns the original untouched when
 *   - fewer than 2 shift segments match,
 *   - the shifts are already in canonical order, or
 *   - there is non-trivial text outside the segments (e.g. 実働, annotations).
 * This prevents data loss for factories that carry extra notes in the string.
 */
export function normalizeWorkHoursString(text: string | null | undefined): string {
  if (!text) return text ?? "";
  const original = text;

  const segmentRe = new RegExp(
    `(${SHIFT_NAME_PAT.source})：\\s*\\d{1,2}[時:]\\d{2}分?\\s*[～~ー-]\\s*\\d{1,2}[時:]\\d{2}分?`,
    "g",
  );
  const segments: Array<{ name: string; text: string }> = [];
  let match;
  while ((match = segmentRe.exec(original)) !== null) {
    segments.push({ name: match[1], text: match[0] });
  }
  if (segments.length < 2) return original;

  // Skip if already in canonical order
  const names = segments.map((s) => s.name);
  const sortedNames = [...names].sort(compareShiftNames);
  if (names.every((n, i) => n === sortedNames[i])) return original;

  // Skip if there is meaningful extra text around the segments
  let outside = original;
  for (const s of segments) outside = outside.replace(s.text, "");
  const outsideMeaningful = outside.replace(/[\s　・、,]/g, "");
  if (outsideMeaningful.length > 3) return original;

  segments.sort((a, b) => compareShiftNames(a.name, b.name));
  return segments.map((s) => s.text).join("　");
}

/**
 * Normalize a breakTime string into canonical shift order.
 * Conservative: returns the original untouched when
 *   - fewer than 2 lines match the "<name>：..." shape,
 *   - any line lacks a shift prefix (formats like free-form notes), or
 *   - the lines are already in canonical order.
 */
export function normalizeBreakTimeString(text: string | null | undefined): string {
  if (!text) return text ?? "";
  const original = text;

  const lines = original.split(/\n/).filter((l) => l.trim());
  if (lines.length < 2) return original;

  const nameRe = new RegExp(`^(${SHIFT_NAME_PAT.source})：`);
  const parsed: Array<{ name: string; line: string }> = [];
  for (const line of lines) {
    const m = line.match(nameRe);
    if (!m) return original;
    parsed.push({ name: m[1], line });
  }

  const names = parsed.map((p) => p.name);
  const sortedNames = [...names].sort(compareShiftNames);
  if (names.every((n, i) => n === sortedNames[i])) return original;

  parsed.sort((a, b) => compareShiftNames(a.name, b.name));
  return parsed.map((p) => p.line).join("\n");
}
