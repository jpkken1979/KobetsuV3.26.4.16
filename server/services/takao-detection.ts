// server/services/takao-detection.ts
// R11: Detect re-entries within 1 year for 高雄工業 companies.
// An employee re-enters if: exitDate → re-entry hireDate gap ≤ 365 days.
// actualHireDate = first entry's hireDate (not the re-entry date).

export interface TakaoEntry {
  employeeNumber: string;
  companyName: string;
  fullName: string;
  hireDate: string; // The hireDate of THIS record
  exitDate: string | null;
  factoryName: string | null;
}

export interface TakaoReEntry {
  employeeNumber: string;
  fullName: string;
  companyName: string;
  previousFactory: string | null;
  newFactory: string | null;
  exitDate: string;
  reEntryDate: string;
  actualHireDate: string; // First hireDate in the chain
  gapDays: number;
}

/**
 * Detects 高雄 re-entries: gap between exitDate and re-entry ≤ 365 days.
 * Only processes companies whose name includes "高雄".
 */
export function detectTakaoReEntries(entries: TakaoEntry[]): TakaoReEntry[] {
  const takaoEntries = entries.filter((e) => e.companyName.includes("高雄"));
  if (takaoEntries.length === 0) return [];

  // Group by employeeNumber + companyName
  const groups = new Map<string, TakaoEntry[]>();
  for (const entry of takaoEntries) {
    const key = `${entry.employeeNumber}::${entry.companyName}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  const reEntries: TakaoReEntry[] = [];

  for (const [, group] of groups) {
    // Sort by hireDate ascending
    group.sort((a, b) => a.hireDate.localeCompare(b.hireDate));

    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1];
      const curr = group[i];

      if (!prev.exitDate) continue;

      const exitDateObj = new Date(prev.exitDate);
      const hireDateObj = new Date(curr.hireDate);
      const gapMs = hireDateObj.getTime() - exitDateObj.getTime();
      const gapDays = Math.round(gapMs / (1000 * 60 * 60 * 24));

      if (gapDays <= 365) {
        reEntries.push({
          employeeNumber: curr.employeeNumber,
          fullName: curr.fullName,
          companyName: curr.companyName,
          previousFactory: prev.factoryName,
          newFactory: curr.factoryName,
          exitDate: prev.exitDate,
          reEntryDate: curr.hireDate,
          actualHireDate: group[0].hireDate,
          gapDays,
        });
      }
    }
  }

  return reEntries;
}
