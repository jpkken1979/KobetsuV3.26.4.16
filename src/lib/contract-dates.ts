function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// Mirror exacto de server/services/contract-dates.ts#isFactoryClosureDay.
// 年末年始: Dec 29-31 + Jan 1-3 / GW: Apr 29 + May 3-6 / お盆: Aug 13-16.
export function isFactoryClosureDay(date: Date): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month === 12 && day >= 29) return true;
  if (month === 1 && day <= 3) return true;
  if (month === 4 && day === 29) return true;
  if (month === 5 && day >= 3 && day <= 6) return true;
  if (month === 8 && day >= 13 && day <= 16) return true;
  return false;
}

function isBusinessDay(date: Date) {
  return !isWeekend(date) && !isFactoryClosureDay(date);
}

function shiftBusinessDays(date: Date, businessDays: number) {
  const next = new Date(date);
  const direction = businessDays >= 0 ? 1 : -1;
  let remaining = Math.abs(businessDays);

  while (remaining > 0) {
    next.setDate(next.getDate() + direction);
    if (isBusinessDay(next)) {
      remaining -= 1;
    }
  }

  return next;
}

export function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calculateContractDates(startDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const contractDate = shiftBusinessDays(start, -2);
  const notificationDate = shiftBusinessDays(start, -3);
  return {
    contractDate: formatLocalDate(contractDate),
    notificationDate: formatLocalDate(notificationDate),
  };
}

export function calculateDefaultEndDate(startDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  start.setMonth(start.getMonth() + 3);
  start.setDate(start.getDate() - 1);
  return formatLocalDate(start);
}
