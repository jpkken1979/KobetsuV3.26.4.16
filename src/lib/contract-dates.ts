function isBusinessDay(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
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
