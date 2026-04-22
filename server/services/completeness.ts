/**
 * Lista de campos obligatorios para un registro de empleado completo.
 */
export const REQUIRED_EMPLOYEE_FIELDS = [
  "fullName", "katakanaName", "nationality", "gender", "birthDate",
  "hireDate",
] as const;

/**
 * Lista de campos obligatorios para un registro de fabrica completo.
 */
export const REQUIRED_FACTORY_FIELDS = [
  "address", "phone", "jobDescription",
  "supervisorName", "supervisorDept", "supervisorPhone",
  "hakensakiManagerName", "hakensakiManagerDept", "hakensakiManagerPhone",
  "managerUnsName", "managerUnsDept", "managerUnsPhone",
  "complaintClientName", "complaintClientDept", "complaintClientPhone",
  "complaintUnsName", "complaintUnsDept", "complaintUnsPhone",
  "workHours", "breakTimeDay", "conflictDate",
  "closingDayText", "paymentDayText", "calendar",
] as const;

type Completeness = "green" | "yellow" | "red" | "gray";

/**
 * Calcula el nivel de completitud de un empleado y su fabrica asociada.
 * @returns "green" si ambos completos, "yellow" si uno, "red" si ninguno, "gray" si no hay datos
 */
export function calcCompleteness(
  emp: Record<string, unknown>,
  factory: Record<string, unknown> | null,
): Completeness {
  if (!emp.factoryId || !factory) return "gray";
  const empOk = checkEmployeeFields(emp);
  const facOk = checkFactoryFields(factory);
  if (empOk && facOk) return "green";
  if (empOk || facOk) return "yellow";
  return "red";
}

function checkEmployeeFields(emp: Record<string, unknown>): boolean {
  for (const field of REQUIRED_EMPLOYEE_FIELDS) {
    if (!emp[field] && emp[field] !== 0) return false;
  }
  if (!emp.billingRate && emp.billingRate !== 0 && !emp.hourlyRate && emp.hourlyRate !== 0) return false;
  return true;
}

function checkFactoryFields(factory: Record<string, unknown>): boolean {
  for (const field of REQUIRED_FACTORY_FIELDS) {
    if (!factory[field] && factory[field] !== 0) return false;
  }
  return true;
}

/**
 * Lista los campos faltantes para un empleado y su fabrica.
 */
export function getMissingFields(
  emp: Record<string, unknown>,
  factory: Record<string, unknown> | null,
): { missingEmployee: string[]; missingFactory: string[] } {
  const missingEmployee: string[] = [];
  for (const field of REQUIRED_EMPLOYEE_FIELDS) {
    if (!emp[field] && emp[field] !== 0) missingEmployee.push(field);
  }
  if (!emp.billingRate && emp.billingRate !== 0 && !emp.hourlyRate && emp.hourlyRate !== 0) {
    missingEmployee.push("billingRate|hourlyRate");
  }
  const missingFactory: string[] = [];
  if (factory) {
    for (const field of REQUIRED_FACTORY_FIELDS) {
      if (!factory[field] && factory[field] !== 0) missingFactory.push(field);
    }
  }
  return { missingEmployee, missingFactory };
}
