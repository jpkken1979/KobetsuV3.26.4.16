/**
 * Shared employee data transformations for PDF generation.
 * Eliminates 4x duplicated empList mapping in documents.ts.
 */

export interface PDFEmployeeData {
  fullName: string;
  katakanaName: string;
  gender: string | null;
  birthDate: string | null;
  actualHireDate: string | null;
  hireDate: string | null;
  hourlyRate: number | null;
  billingRate: number | null;
  nationality: string | null;
  individualStartDate: string | null;
  individualEndDate: string | null;
  employeeNumber: string | null;
  clientEmployeeId: string | null;
}

interface ContractEmployeeRelation {
  hourlyRate: number | null;
  individualStartDate: string | null;
  individualEndDate: string | null;
  employee: {
    fullName: string;
    katakanaName: string | null;
    gender: string | null;
    birthDate: string | null;
    actualHireDate: string | null;
    hireDate: string | null;
    hourlyRate: number | null;
    billingRate: number | null;
    nationality: string | null;
    employeeNumber: string | null;
    clientEmployeeId: string | null;
  };
}

/** Map a contract_employee join result to PDF-ready data */
export function mapContractEmployeeToPDF(ce: ContractEmployeeRelation): PDFEmployeeData {
  return {
    fullName: ce.employee.fullName,
    katakanaName: ce.employee.katakanaName || "",
    gender: ce.employee.gender,
    birthDate: ce.employee.birthDate,
    actualHireDate: ce.employee.actualHireDate,
    hireDate: ce.employee.hireDate,
    hourlyRate: ce.employee.hourlyRate,
    billingRate: ce.hourlyRate ?? ce.employee.billingRate ?? ce.employee.hourlyRate,
    nationality: ce.employee.nationality,
    individualStartDate: ce.individualStartDate || null,
    individualEndDate: ce.individualEndDate || null,
    employeeNumber: ce.employee.employeeNumber || null,
    clientEmployeeId: ce.employee.clientEmployeeId || null,
  };
}

/** Map an array of contract employees to PDF-ready data */
export function mapContractEmployeesToPDF(employees: ContractEmployeeRelation[]): PDFEmployeeData[] {
  return employees.map(mapContractEmployeeToPDF);
}
