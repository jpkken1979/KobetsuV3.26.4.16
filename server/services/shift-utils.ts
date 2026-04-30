// Shift detection utilities for PDF generation.
// These functions detect and parse named shifts (昼勤, 夜勤, ①, etc.) from workHours/breakTime text.

// Pattern for matching named shifts with time ranges.
// Matches: 昼勤 8:30~17:00, 昼勤：7時00分~15時30分, ①8時00分~17時00分, 1 08:00~17:00
// Handles: shift prefixes + time range with various separators (：:~-)
export const NAMED_SHIFT_RE = /(?:[A-Za-z]+[勤務番]*|交替|[一-鿿]+[勤直務]+|①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)[①-⑩0-9]*\s*[：:ー]?\s*\d{1,2}\s*[時:：]*\s*\d{2}分?\s*[～~ー-]\s*\d{1,2}\s*[時:：]*\s*\d{2}分?|[0-9①-⑩]\d?\s*\d{1,2}:?\d{2}\s*[～~ー-]\s*\d{1,2}:?\d{2}/gu;

/**
 * Count named shifts in text.
 * Returns 0 for empty/undefined text.
 */
export function countNamedShifts(text: string | null | undefined): number {
  if (!text) return 0;
  NAMED_SHIFT_RE.lastIndex = 0;
  return (text.match(NAMED_SHIFT_RE) || []).length;
}

/**
 * Normalize separators to \n so renderMultiShift puts one shift per line.
 * Only kicks in when the text already has 2+ named shifts.
 * Leaves single-shift text unchanged.
 */
export function normalizeShiftText(text: string | null | undefined): string {
  if (!text || text.includes("\n")) return text ?? "";
  if (countNamedShifts(text) < 2) return text;
  return text.replace(/、/g, "\n").trim();
}

interface ShiftParseResult {
  workHours: string;
  breakTime: string;
}

/**
 * Infer hourlyRate from contract employees when contract.hourlyRate is null.
 * Uses the most common rate (mode) from contract_employees assignments.
 * Used for legacy contracts created before hourlyRate was set at contract level.
 */
export function inferContractHourlyRate(
  contractHourlyRate: number | null | undefined,
  employees: Array<{ hourlyRate: number | null; employee: { billingRate: number | null; hourlyRate: number | null } }> | undefined,
  factoryHourlyRate: number | null | undefined
): number {
  if (contractHourlyRate !== null && contractHourlyRate !== undefined) {
    return contractHourlyRate;
  }

  if (employees && employees.length > 0) {
    const rates = employees
      .map((ce) => ce.hourlyRate ?? ce.employee.billingRate ?? ce.employee.hourlyRate ?? null)
      .filter((r): r is number => r !== null);

    if (rates.length > 0) {
      const freq = new Map<number, number>();
      for (const r of rates) {
        freq.set(r, (freq.get(r) ?? 0) + 1);
      }
      const mode = Array.from(freq.entries()).sort((a, b) => b[1] - a[1])[0];
      if (mode) return mode[0];
    }
  }

  return factoryHourlyRate ?? 0;
}

/**
 * Parse workHours from factory fields.
 * Priority:
 * 1. If workHours has 2+ named shifts → use normalizeShiftText(workHours)
 * 2. If workHours has content but Day/Night differ → use workHours directly (arubaito)
 * 3. If Day/Night differ → combine with labels (昼勤/夜勤)
 * 4. If Day/Night same → use workHours or Day
 * 5. Fallback to contract times or workHours
 */
export function parseWorkHours(params: {
  workHours: string | null | undefined;
  workHoursDay: string | null | undefined;
  workHoursNight: string | null | undefined;
  contractStartTime?: string | null;
  contractEndTime?: string | null;
}): string {
  const { workHours, workHoursDay, workHoursNight, contractStartTime, contractEndTime } = params;
  const fullWorkHours = workHours || "";
  const namedShiftCount = countNamedShifts(fullWorkHours);

  const hasDayNight = workHoursDay || workHoursNight;
  const dayNightDifferent = workHoursDay && workHoursNight && workHoursDay !== workHoursNight;

  if (namedShiftCount >= 2) {
    return normalizeShiftText(fullWorkHours);
  }

  if (hasDayNight && dayNightDifferent) {
    // Two distinct shift times — use Day/Night with labels ONLY if workHours is empty
    // (arubaito/part-time factories intentionally have different Day/Night but only ONE
    // shift is actually used — prefer the existing workHours text)
    if (fullWorkHours.trim().length > 0) {
      return fullWorkHours;
    }
    const parts: string[] = [];
    if (workHoursDay) parts.push(`【昼勤】${workHoursDay}`);
    if (workHoursNight) parts.push(`【夜勤】${workHoursNight}`);
    return parts.join("\n");
  }

  if (hasDayNight && !dayNightDifferent) {
    return fullWorkHours || workHoursDay || "";
  }

  if (hasDayNight && !fullWorkHours) {
    return `【昼勤】${workHoursDay}`;
  }

  if (contractStartTime && contractEndTime) {
    return `${contractStartTime} ～ ${contractEndTime}`;
  }

  return fullWorkHours;
}

/**
 * Parse breakTime from factory fields.
 * Priority:
 * 1. If breakTimeDay has 2+ named shifts → use normalizeShiftText(breakTimeDay)
 * 2. If breakTimeDay + breakTimeNight have 2+ total → combine with normalizeShiftText
 * 3. If Day or Night have content → combine with labels if 2 shifts
 * 4. Fallback to contract breakMinutes or factory breakTime
 */
export function parseBreakTime(params: {
  breakTimeDay: string | null | undefined;
  breakTimeNight: string | null | undefined;
  breakMinutes?: number | null;
  breakTime?: number | null;
  isTwoShiftFactory?: boolean;
}): string {
  const { breakTimeDay, breakTimeNight, breakMinutes, breakTime, isTwoShiftFactory = false } = params;

  const breakDayCount = countNamedShifts(breakTimeDay || "");
  const breakNightCount = countNamedShifts(breakTimeNight || "");

  if (breakDayCount >= 2) {
    return normalizeShiftText(breakTimeDay);
  }

  if (breakDayCount + breakNightCount >= 2) {
    const combined = [breakTimeDay, breakTimeNight].filter(Boolean).join("\n");
    return normalizeShiftText(combined);
  }

  if (breakTimeDay || breakTimeNight) {
    const parts: string[] = [];
    if (breakTimeDay) parts.push(isTwoShiftFactory ? `【昼勤】${breakTimeDay}` : breakTimeDay);
    if (breakTimeNight) parts.push(isTwoShiftFactory ? `【夜勤】${breakTimeNight}` : breakTimeNight);
    return parts.join("\n");
  }

  if (breakMinutes) {
    return `${breakMinutes}分`;
  }

  if (breakTime) {
    return `${breakTime}分`;
  }

  return "";
}
