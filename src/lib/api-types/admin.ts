/**
 * Admin panel: tipos para el explorador de tablas, runner SQL y stats.
 */

export interface AdminColumnMeta {
  name: string;
  type: "text" | "integer" | "real" | "boolean";
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: { table: string; column: string };
}

export interface AdminTableMeta {
  name: string;
  displayName: string;
  count: number;
  columns: AdminColumnMeta[];
  foreignKeys: { column: string; refs: { table: string; column: string } }[];
}

export interface AdminQueryParams {
  table: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  filters?: Record<string, string>;
}

export interface AdminRowResult {
  rows: Record<string, unknown>[];
  total: number;
  columns: AdminColumnMeta[];
  page: number;
  pageSize: number;
}

export interface AdminSqlResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  time: number;
}

export interface AdminStats {
  counts: Record<string, number>;
  contractStatusDistribution: Record<string, number>;
  employeeStatusDistribution: Record<string, number>;
  nationalityDistribution: { nationality: string; count: number }[];
  monthlyContracts: { month: string; count: number }[];
  topFactories: {
    factoryId: number;
    factoryName: string;
    companyName: string;
    employeeCount: number;
  }[];
  nullCounts: { table: string; column: string; nullCount: number }[];
  expiringContracts: {
    contractId: number;
    contractNumber: string;
    endDate: string;
    companyName: string;
    factoryName: string;
  }[];
}
