/**
 * Contract date calculation service
 * Ported from KobetsuV1.0/services/contract_date_service.py
 *
 * Business rules:
 * - contract_date = start_date - 2 business days (excluding Sat/Sun + factory closure periods)
 * - notification_date = start_date - 3 business days
 *
 * Factory closure periods (派遣先の実際の休業日):
 * - 年末年始: Dec 29 – Jan 3
 * - GW: Apr 29, May 3–6 (昭和の日 + 憲法記念日/みどりの日/こどもの日 + 振替休日)
 * - お盆: Aug 13–16
 *
 * Note: Individual national holidays (海の日, 敬老の日, etc.) are NOT skipped
 * because factories continue operating on those days.
 */

/**
 * Format a Date as YYYY-MM-DD using local timezone (not UTC).
 * Avoids the common toISOString() bug where JST dates shift by 1 day.
 */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Check if a date falls in a factory closure period (工場休業日).
 * These are the only non-weekend days that factories actually close:
 * - 年末年始: Dec 29 – Jan 3
 * - GW: Apr 29, May 3–6
 * - お盆: Aug 13–16
 */
export function isFactoryClosureDay(date: Date): boolean {
  const month = date.getMonth() + 1; // 1-indexed
  const day = date.getDate();

  // 年末年始: Dec 29–31, Jan 1–3
  if (month === 12 && day >= 29) return true;
  if (month === 1 && day <= 3) return true;

  // GW: Apr 29 (昭和の日), May 3–6 (憲法記念日~振替休日)
  if (month === 4 && day === 29) return true;
  if (month === 5 && day >= 3 && day <= 6) return true;

  // お盆: Aug 13–16
  if (month === 8 && day >= 13 && day <= 16) return true;

  return false;
}

/**
 * Get factory closure days for a given year as a Set of "YYYY-MM-DD" strings.
 * Useful for calendar displays and validation.
 */
export function getFactoryClosureDays(year: number): Set<string> {
  const closures = new Set<string>();

  // 年末年始: Dec 29–31 of previous year + Jan 1–3
  for (let d = 1; d <= 3; d++) {
    closures.add(toLocalDateStr(new Date(year, 0, d)));
  }
  for (let d = 29; d <= 31; d++) {
    closures.add(toLocalDateStr(new Date(year, 11, d)));
  }

  // GW: Apr 29, May 3–6
  closures.add(toLocalDateStr(new Date(year, 3, 29)));
  for (let d = 3; d <= 6; d++) {
    closures.add(toLocalDateStr(new Date(year, 4, d)));
  }

  // お盆: Aug 13–16
  for (let d = 13; d <= 16; d++) {
    closures.add(toLocalDateStr(new Date(year, 7, d)));
  }

  return closures;
}

/**
 * Check if a date is a non-business day (weekend or factory closure period).
 */
function isNonBusinessDay(date: Date): boolean {
  return isWeekend(date) || isFactoryClosureDay(date);
}

/**
 * Subtract N business days from a date (WORKDAY equivalent in Excel).
 * Skips Saturdays, Sundays, and factory closure periods (年末年始, GW, お盆).
 */
export function subtractBusinessDays(fromDate: Date, days: number): Date {
  const result = new Date(fromDate);
  let remaining = days;

  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    if (!isNonBusinessDay(result)) {
      remaining--;
    }
  }

  return result;
}

/**
 * Calculate contract_date: start_date - 2 business days
 */
export function calculateContractDate(startDate: string): string {
  const start = new Date(startDate);
  const contractDate = subtractBusinessDays(start, 2);
  return toLocalDateStr(contractDate);
}

/**
 * Calculate notification_date: start_date - 3 business days
 */
export function calculateNotificationDate(startDate: string): string {
  const start = new Date(startDate);
  const notifDate = subtractBusinessDays(start, 3);
  return toLocalDateStr(notifDate);
}

/**
 * Calculate all contract dates from a start date
 */
export function calculateContractDates(startDate: string, endDate: string) {
  return {
    startDate,
    endDate,
    contractDate: calculateContractDate(startDate),
    notificationDate: calculateNotificationDate(startDate),
  };
}
