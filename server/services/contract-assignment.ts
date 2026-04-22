export type EmployeeIdAssignment = {
  employeeId: number;
};

export type FactoryAssignedEmployee = {
  id: number;
  factoryId: number | null;
  fullName: string | null;
  employeeNumber: string | null;
};

/**
 * Extrae la lista de employeeIds desde el payload del contrato.
 * Acepta tanto employeeAssignments (nuevo formato) como employeeIds (legacy).
 */
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

/**
 * Detecta IDs de empleados duplicados en una lista.
 * Retorna los duplicados ordenados de menor a mayor.
 */
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

/**
 * Retorna los IDs esperados que no se encuentran en la lista de encontrados.
 */
export function getMissingEmployeeIds(expectedIds: number[], foundIds: number[]): number[] {
  const found = new Set(foundIds);
  return [...new Set(expectedIds)].filter((employeeId) => !found.has(employeeId));
}

/**
 * Filtra empleados que no pertenecen a una fabrica especifica.
 */
export function getEmployeesOutsideFactory(
  employees: FactoryAssignedEmployee[],
  factoryId: number,
): FactoryAssignedEmployee[] {
  return employees.filter((employee) => employee.factoryId !== factoryId);
}

/**
 * Formatea un empleado como etiqueta legible: "Nombre (NUM-123)".
 */
export function formatEmployeeLabel(employee: Pick<FactoryAssignedEmployee, "fullName" | "employeeNumber">): string {
  if (employee.fullName && employee.employeeNumber) {
    return `${employee.fullName} (${employee.employeeNumber})`;
  }
  return employee.fullName || employee.employeeNumber || "Unknown employee";
}
