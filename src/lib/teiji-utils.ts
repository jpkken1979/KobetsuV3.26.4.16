/** 定時 calculation: append net work hours to each shift line.
 *  Normal: "A勤務：7:00～15:30 (7.75)"
 *  Overtime: "F勤務：7:00～18:45 (7.75h)+残業(3h)" */

function extractShiftName(line: string): string | null {
  const m = line.match(/^([A-Za-zＡ-Ｚ\u4e00-\u9fff]+勤?務?勤?)[\s：:]/);
  return m ? m[1] : null;
}

function parseBreakMinutes(breakText: string): Map<string, number> {
  const map = new Map<string, number>();
  if (!breakText) return map;
  for (const line of breakText.split("\n")) {
    const nameMatch = line.match(/^([A-Za-zＡ-Ｚ\u4e00-\u9fff]+勤?務?勤?)[\s：:]/);
    if (!nameMatch) continue;
    const totalMatch = line.match(/合計(\d+)分/);
    if (totalMatch) { map.set(nameMatch[1], Number(totalMatch[1])); continue; }
    let sum = 0;
    for (const m of line.matchAll(/[（(](\d+)分[）)]/g)) sum += Number(m[1]);
    if (sum > 0) map.set(nameMatch[1], sum);
  }
  return map;
}

function calcNetMinutes(line: string, breakMins: number): number {
  const m = line.match(/(\d{1,2})[時:](\d{2})分?～(\d{1,2})[時:](\d{2})/);
  if (!m) return 0;
  const startMins = Number(m[1]) * 60 + Number(m[2]);
  const endMins = Number(m[3]) * 60 + Number(m[4]);
  let duration = endMins - startMins;
  if (duration <= 0) duration += 24 * 60;
  return Math.max(duration - breakMins, 0);
}

function findMode(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = arr[0], bestCount = 0;
  for (const [v, c] of counts) { if (c > bestCount) { best = v; bestCount = c; } }
  return best;
}

function fmtHours(mins: number): string {
  const h = mins / 60;
  return h % 1 === 0 ? h.toFixed(0) : parseFloat(h.toFixed(2)).toString();
}

export function appendTeiji(workHours: string, breakTimeDay: string | null | undefined): string {
  if (!workHours) return workHours;
  const breakMap = parseBreakMinutes(breakTimeDay || "");
  const lines = workHours.split("\n").filter(Boolean);

  if (breakMap.size === 0 && breakTimeDay) {
    const singleMatch = breakTimeDay.match(/[（(](\d+)分[）)]/);
    if (singleMatch) {
      const mins = Number(singleMatch[1]);
      for (const line of lines) {
        const name = extractShiftName(line);
        if (name) breakMap.set(name, mins);
      }
    }
  }

  const shiftData: { line: string; netMins: number }[] = [];
  for (const line of lines) {
    const name = extractShiftName(line);
    const breakMins = name ? (breakMap.get(name) ?? 0) : 0;
    shiftData.push({ line, netMins: calcNetMinutes(line, breakMins) });
  }

  const validMins = shiftData.filter(s => s.netMins > 0).map(s => s.netMins);
  const baseMins = findMode(validMins) ?? 0;

  return shiftData.map(({ line, netMins }) => {
    if (netMins <= 0) return line;
    if (baseMins > 0 && netMins > baseMins) {
      const overtimeMins = netMins - baseMins;
      return `${line} (${fmtHours(baseMins)}h)+残業(${fmtHours(overtimeMins)}h)`;
    }
    return `${line} (${fmtHours(netMins)})`;
  }).join("\n");
}
