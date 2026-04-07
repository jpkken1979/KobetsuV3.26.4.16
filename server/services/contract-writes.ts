export interface ContractEmployeeAssignmentInput {
  employeeId: number;
  hourlyRate?: number | null;
  individualStartDate?: string | null;
  individualEndDate?: string | null;
  isIndefinite?: boolean;
}

export interface ContractEmployeeRow {
  contractId: number;
  employeeId: number;
  hourlyRate: number | null;
  individualStartDate: string | null;
  individualEndDate: string | null;
  isIndefinite: boolean;
}

interface BuildRowsInput {
  contractId: number;
  employeeAssignments?: ContractEmployeeAssignmentInput[];
  employeeIds?: number[];
}

export function buildContractEmployeeRows({
  contractId,
  employeeAssignments,
  employeeIds,
}: BuildRowsInput): ContractEmployeeRow[] {
  if (employeeAssignments && employeeAssignments.length > 0) {
    return employeeAssignments.map((assignment) => ({
      contractId,
      employeeId: assignment.employeeId,
      hourlyRate: assignment.hourlyRate ?? null,
      individualStartDate: assignment.individualStartDate ?? null,
      individualEndDate: assignment.individualEndDate ?? null,
      isIndefinite: assignment.isIndefinite ?? false,
    }));
  }

  if (!employeeIds || employeeIds.length === 0) {
    return [];
  }

  return employeeIds.map((employeeId) => ({
    contractId,
    employeeId,
    hourlyRate: null,
    individualStartDate: null,
    individualEndDate: null,
    isIndefinite: false,
  }));
}
