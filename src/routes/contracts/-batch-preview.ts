import type { Employee, Factory as ApiFactory } from "@/lib/api";

export interface LocalPreviewLine {
  factoryId: number;
  factoryName: string;
  department: string | null;
  lineName: string | null;
  contracts: number;
  capped?: boolean | string | null;
  employees?: number;
  conflictDate?: string | null;
  contractPeriod?: string | null;
  effectiveEndDate?: string;
  rates?: { rate: number; count: number }[];
  rateGroups?: number;
}

interface BuildLocalBatchPreviewInput {
  companyId: number | null;
  effectiveFactoryIds: number[];
  startDate: string;
  endDate: string;
  flatFactories: ApiFactory[];
  employeesByFactory: Map<number, Employee[]>;
}

const CONTRACT_PERIOD_MONTHS: Record<string, number> = {
  "1month": 1,
  "3months": 3,
  "6months": 6,
  "1year": 12,
};

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildLocalBatchPreview({
  companyId,
  effectiveFactoryIds,
  startDate,
  endDate,
  flatFactories,
  employeesByFactory,
}: BuildLocalBatchPreviewInput): { lines: LocalPreviewLine[]; totalContracts: number; totalEmployees: number } | null {
  if (!companyId || effectiveFactoryIds.length === 0 || !startDate) {
    return null;
  }

  let totalContracts = 0;
  let totalEmployees = 0;
  const lines: LocalPreviewLine[] = [];

  for (const factoryId of effectiveFactoryIds) {
    const factory = flatFactories.find((item) => item.id === factoryId);
    if (!factory) {
      continue;
    }

    const employees = employeesByFactory.get(factoryId) || [];
    if (employees.length === 0) {
      lines.push({
        factoryId,
        factoryName: factory.factoryName,
        department: factory.department,
        lineName: factory.lineName,
        employees: 0,
        rateGroups: 0,
        contracts: 0,
        capped: false,
      });
      continue;
    }

    const rates = new Map<number, number>();
    for (const employee of employees) {
      const rate = employee.billingRate ?? employee.hourlyRate ?? factory.hourlyRate ?? 0;
      if (rate === 0) {
        continue;
      }
      rates.set(rate, (rates.get(rate) || 0) + 1);
    }

    let lineEndDate = endDate;
    if (factory.contractPeriod === "teishokubi" && factory.conflictDate) {
      lineEndDate = factory.conflictDate;
    } else if (factory.contractPeriod && factory.contractPeriod !== "teishokubi") {
      const monthsToAdd = CONTRACT_PERIOD_MONTHS[factory.contractPeriod];
      if (monthsToAdd && startDate) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + monthsToAdd);
        date.setDate(date.getDate() - 1);
        lineEndDate = formatDateStr(date);
      }
    }

    if (factory.conflictDate && lineEndDate && lineEndDate > factory.conflictDate) {
      lineEndDate = factory.conflictDate;
    }

    const capped = factory.conflictDate && endDate && factory.conflictDate < endDate;
    const contractCount = rates.size;
    totalContracts += contractCount;
    totalEmployees += employees.length;

    lines.push({
      factoryId,
      factoryName: factory.factoryName,
      department: factory.department,
      lineName: factory.lineName,
      employees: employees.length,
      rateGroups: rates.size,
      contracts: contractCount,
      capped,
      conflictDate: factory.conflictDate,
      contractPeriod: factory.contractPeriod,
      effectiveEndDate: lineEndDate,
      rates: Array.from(rates.entries()).map(([rate, count]) => ({ rate, count })),
    });
  }

  return { lines, totalContracts, totalEmployees };
}
