/**
 * Document generation: factory-level y by-IDs (派遣先/派遣元 IDs).
 */

export interface GenerateFactoryResult {
  success: boolean;
  factoryId: number;
  factoryIds?: number[];
  factoryName: string;
  department: string | null;
  lineName: string | null;
  lineCount?: number;
  contractCount: number;
  employeeCount: number;
  fileCount: number;
  kobetsuCopies: 1 | 2;
  zipFilename: string;
  zipPath: string;
}

export interface ByIdsEmployee {
  id: number;
  employeeNumber: string;
  clientEmployeeId: string | null;
  fullName: string;
  katakanaName: string | null;
  hireDate: string | null;
  billingRate: number | null;
  hourlyRate: number | null;
}

export interface ByIdsGroup {
  groupIndex: number;
  groupKey: string;
  factoryId: number;
  factoryName: string | null;
  department: string | null;
  lineName: string | null;
  companyId: number;
  companyName: string;
  billingRate: number;
  startDate: string;
  endDate: string;
  employees: ByIdsEmployee[];
}

export interface PreviewByIdsResult {
  groups: ByIdsGroup[];
  notFoundIds: string[];
  totalEmployees: number;
}

export interface GenerateByIdsResult {
  success: boolean;
  contractCount: number;
  employeeCount: number;
  fileCount: number;
  kobetsuCopies: 1 | 2;
  notFoundIds: string[];
  zipFilename: string | null;
  zipPath: string | null;
  contracts: {
    id: number;
    contractNumber: string;
    factoryName: string | null;
    startDate: string;
    endDate: string;
    employeeCount: number;
  }[];
}
