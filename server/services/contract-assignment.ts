export type EmployeeIdAssignment = {
  employeeId: number;
};

export type FactoryAssignedEmployee = {
  id: number;
  factoryId: number | null;
  fullName: string | null;
  employeeNumber: string | null;
};

export function getSelectedEmployeeIds(input: {
  employeeAssignments?: EmployeeIdAssignment[];
  employeeIds?: number[];
}): number[] | undefined {
  if (input.employeeAssignments) {
    return input.employeeAssignments.map((assignment) => assignment.employeeId);
  }
  if (input.employeeIds) {
    return [...input.employeeIds];
  }
  return undefined;
}

export function getDuplicateEmployeeIds(employeeIds: number[]): number[] {
  const seen = new Set<number>();
  const duplicates = new Set<number>();

  for (const employeeId of employeeIds) {
    if (seen.has(employeeId)) {
      duplicates.add(employeeId);
      continue;
    }
    seen.add(employeeId);
  }

  return [...duplicates].sort((left, right) => left - right);
}

export function getMissingEmployeeIds(expectedIds: number[], foundIds: number[]): number[] {
  const found = new Set(foundIds);
  return [...new Set(expectedIds)].filter((employeeId) => !found.has(employeeId));
}

export function getEmployeesOutsideFactory(
  employees: FactoryAssignedEmployee[],
  factoryId: number,
): FactoryAssignedEmployee[] {
  return employees.filter((employee) => employee.factoryId !== factoryId);
}

export function formatEmployeeLabel(employee: Pick<FactoryAssignedEmployee, "fullName" | "employeeNumber">): string {
  if (employee.fullName && employee.employeeNumber) {
    return `${employee.fullName} (${employee.employeeNumber})`;
  }
  return employee.fullName || employee.employeeNumber || "Unknown employee";
}
