/**
 * Centralized API client with typed request/response interfaces.
 * Type definitions are in api-types.ts — re-exported here for backward compatibility.
 */

export * from "./api-types";

import type {
  Company,
  Factory,
  Employee,
  Contract,
  CascadeData,
  BatchCreateResult,
  BatchPreviewResult,
  BatchDocumentResult,
  GenerateGroupedResult,
  LaborHistoryFile,
  NewHiresPreviewResult,
  NewHiresCreateResult,
  MidHiresPreviewResult,
  MidHiresCreateResult,
  ByLineBatchPayload,
  ByLineBatchResult,
  SmartBatchPayload,
  SmartBatchPreviewResult,
  SmartBatchCreateResult,
  GenerateFactoryResult,
  PreviewByIdsResult,
  GenerateByIdsResult,
  ImportResult,
  EmployeeDiffResult,
  DiffResult,
  DashboardStats,
  NationalityStat,
  CompanyStat,
  ExpiringContract,
  TeishokubiAlert,
  VisaExpiryAlert,
  AuditLogEntry,
  RoleKey,
  RoleValue,
  FactoryGroupRoles,
  ShiftTemplate,
  DataCheckResponse,
  AdminTableMeta,
  AdminRowResult,
  AdminSqlResult,
  AdminStats,
  ResetAllResponse,
} from "./api-types";

const API_BASE = "/api";

function getAdminTokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem("adminApiToken");
  return value?.trim() ? value.trim() : null;
}

function buildHeaders(path: string, input?: HeadersInit, includeJsonContentType = true): Headers {
  const headers = new Headers(input);
  if (includeJsonContentType && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (path.startsWith("/admin")) {
    const token = getAdminTokenFromStorage();
    if (token && !headers.has("x-admin-token")) {
      headers.set("x-admin-token", token);
    }
  }
  return headers;
}

// ─── Request helper ─────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 30000;

async function request<T>(path: string, options?: RequestInit, timeout = DEFAULT_TIMEOUT): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: buildHeaders(path, options?.headers),
      signal: controller.signal,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || `API Error: ${res.status}`);
    }

    return res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("リクエストがタイムアウトしました", { cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── API methods ────────────────────────────────────────────────────

export const api = {
  // ─── Generic low-level methods ──────────────────────────────────────
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },
  post<T>(path: string, data: unknown): Promise<T> {
    return request<T>(path, { method: "POST", body: JSON.stringify(data) });
  },
  put<T>(path: string, data: unknown): Promise<T> {
    return request<T>(path, { method: "PUT", body: JSON.stringify(data) });
  },
  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },

  // Companies
  getCompanies: () => request<Company[]>("/companies"),
  getCompany: (id: number) => request<Company>(`/companies/${id}`),
  createCompany: (data: Partial<Company>) => request<Company>("/companies", { method: "POST", body: JSON.stringify(data) }),
  updateCompany: (id: number, data: Partial<Company>) => request<Company>(`/companies/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Factories
  getFactories: (companyId?: number) =>
    request<Factory[]>(`/factories${companyId ? `?companyId=${companyId}` : ""}`),
  getFactory: (id: number) => request<Factory>(`/factories/${id}`),
  getFactoryCascade: (companyId: number) => request<CascadeData>(`/factories/cascade/${companyId}`),
  createFactory: (data: Partial<Factory>) => request<Factory>("/factories", { method: "POST", body: JSON.stringify(data) }),
  updateFactory: (id: number, data: Partial<Factory>) => request<Factory>(`/factories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteFactory: (id: number) => request<{ success: boolean }>(`/factories/${id}`, { method: "DELETE" }),
  bulkUpdateCalendar: (calendarText: string) =>
    request<{ updated: number; calendarText: string }>("/factories/bulk-calendar", { method: "PUT", body: JSON.stringify({ calendarText }) }),
  getFactoryRoleSummary: (companyId: number) =>
    request<FactoryGroupRoles[]>(`/factories/role-summary/${companyId}`),
  bulkUpdateFactoryRoles: (data: {
    companyId: number; factoryName: string; roleKey: RoleKey;
    value: RoleValue; excludeLineIds?: number[];
  }) => request<{ updated: number; excluded: number }>("/factories/bulk-roles", { method: "PUT", body: JSON.stringify(data) }),
  exportFactoriesExcel: () =>
    request<{
      success: boolean;
      filename: string;
      path: string;
      factoryCount: number;
      companyCount: number;
      factoryYearlyConfigCount: number;
      companyYearlyConfigCount: number;
    }>("/factories/export-excel", { method: "POST" }),

  // Employees
  getEmployees: (params?: { companyId?: number; factoryId?: number; search?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.companyId) query.set("companyId", String(params.companyId));
    if (params?.factoryId) query.set("factoryId", String(params.factoryId));
    if (params?.search) query.set("search", params.search);
    if (params?.status) query.set("status", params.status);
    const qs = query.toString();
    return request<Employee[]>(`/employees${qs ? `?${qs}` : ""}`);
  },
  getEmployee: (id: number) => request<Employee>(`/employees/${id}`),
  updateEmployee: (id: number, data: Partial<Employee>) => request<Employee>(`/employees/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  createEmployee: (data: Omit<Employee, "id" | "createdAt" | "updatedAt">) =>
    request<Employee>("/employees", { method: "POST", body: JSON.stringify(data) }),
  purgeEmployees: () =>
    request<{ success: boolean; deleted: number; backup: string | null }>("/employees/purge", {
      method: "POST",
      body: JSON.stringify({ confirm: "DELETE" }),
    }),

  // Contracts
  getContracts: (params?: { companyId?: number; status?: string; showCancelled?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.companyId) query.set("companyId", String(params.companyId));
    if (params?.status) query.set("status", params.status);
    if (params?.showCancelled) query.set("showCancelled", "true");
    const qs = query.toString();
    return request<Contract[]>(`/contracts${qs ? `?${qs}` : ""}`);
  },
  purgeContracts: (ids: number[]) =>
    request<{ success: boolean; purged: number }>("/contracts/purge", { method: "POST", body: JSON.stringify({ ids }) }),
  getContract: (id: number) => request<Contract>(`/contracts/${id}`),
  createContract: (data: Record<string, unknown>) => request<Contract>("/contracts", { method: "POST", body: JSON.stringify(data) }),
  updateContract: (id: number, data: Record<string, unknown>) => request<Contract>(`/contracts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteContract: (id: number) => request<{ success: boolean }>(`/contracts/${id}`, { method: "DELETE" }),
  updateContractStatus: (id: number, status: "draft" | "active" | "expired" | "cancelled" | "renewed") =>
    request<{ success: boolean; status: string }>(`/contracts/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  batchCreateContracts: (data: { companyId: number; factoryIds?: number[]; startDate: string; endDate?: string; generatePdf?: boolean }) =>
    request<BatchCreateResult>("/contracts/batch", { method: "POST", body: JSON.stringify(data) }),
  batchPreviewContracts: (data: { companyId: number; factoryIds?: number[]; startDate: string; endDate?: string }) =>
    request<BatchPreviewResult>("/contracts/batch/preview", { method: "POST", body: JSON.stringify(data) }),

  // New Hires Batch
  newHiresPreview: (data: { companyId: number; factoryIds?: number[]; hireDateFrom: string; hireDateTo?: string; endDate?: string; groupByLine?: boolean }) =>
    request<NewHiresPreviewResult>("/contracts/batch/new-hires/preview", { method: "POST", body: JSON.stringify(data) }),
  newHiresCreate: (data: { companyId: number; factoryIds?: number[]; hireDateFrom: string; hireDateTo?: string; endDate?: string; generateDocs?: boolean; groupByLine?: boolean }) =>
    request<NewHiresCreateResult>("/contracts/batch/new-hires", { method: "POST", body: JSON.stringify(data) }),

  // Mid-Hires Batch (途中入社)
  midHiresPreview: (data: { companyId: number; factoryIds?: number[]; conflictDateOverrides?: Record<string, string>; startDateOverride?: string; groupByLine?: boolean }) =>
    request<MidHiresPreviewResult>("/contracts/batch/mid-hires/preview", { method: "POST", body: JSON.stringify(data) }),
  midHiresCreate: (data: { companyId: number; factoryIds?: number[]; conflictDateOverrides?: Record<string, string>; startDateOverride?: string; generateDocs?: boolean; groupByLine?: boolean }) =>
    request<MidHiresCreateResult>("/contracts/batch/mid-hires", { method: "POST", body: JSON.stringify(data) }),

  // By-Line Batch (selección granular por línea, fechas individuales)
  byLineBatchCreate: (data: ByLineBatchPayload) =>
    request<ByLineBatchResult>("/contracts/batch/by-line", { method: "POST", body: JSON.stringify(data) }),

  // Smart Batch (ikkatsu por fábrica con auto-clasificación 継続/途中入社者)
  smartBatchPreview: (data: SmartBatchPayload) =>
    request<SmartBatchPreviewResult>("/contracts/batch/smart-by-factory/preview", { method: "POST", body: JSON.stringify(data) }, 60000),
  smartBatchCreate: (data: SmartBatchPayload) =>
    request<SmartBatchCreateResult>("/contracts/batch/smart-by-factory", { method: "POST", body: JSON.stringify(data) }, 120000),

  bulkDeleteContracts: (ids: number[]) =>
    request<{ success: boolean; deleted: number }>("/contracts/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) }),

  // Documents
  generateContractDocuments: (contractId: number, options?: { kobetsuCopies?: 1 | 2; includeShugyojoken?: boolean }) =>
    request<{ files: { filename: string; path: string }[] }>(`/documents/generate/${contractId}`, { method: "POST", body: JSON.stringify(options ?? {}) }),
  generateFactory: (factoryIds: number | number[], kobetsuCopies: 1 | 2 = 1) => {
    const ids = Array.isArray(factoryIds) ? factoryIds : [factoryIds];
    return request<GenerateFactoryResult>(
      "/documents/generate-factory",
      { method: "POST", body: JSON.stringify({ factoryIds: ids, kobetsuCopies }) },
      120000
    );
  },
  previewByIds: (ids: string[], idType: "hakensaki" | "hakenmoto", contractStart: string, contractEnd: string) =>
    request<PreviewByIdsResult>("/contracts/preview-by-ids", { method: "POST", body: JSON.stringify({ ids, idType, contractStart, contractEnd }) }),
  generateByIds: (ids: string[], idType: "hakensaki" | "hakenmoto", contractStart: string, contractEnd: string, kobetsuCopies: 1 | 2 = 1) =>
    request<GenerateByIdsResult>("/documents/generate-by-ids", { method: "POST", body: JSON.stringify({ ids, idType, contractStart, contractEnd, kobetsuCopies }) }, 180000),
  generateBatchDocuments: (contractIds: number[]) =>
    request<BatchDocumentResult>("/documents/generate-batch", { method: "POST", body: JSON.stringify({ contractIds }) }),
  generateSet: (contractIds: number[], kobetsuCopies: number = 2) =>
    request<{ success: boolean; files: { type: string; filename: string; path: string }[] }>(
      "/documents/generate-set",
      { method: "POST", body: JSON.stringify({ contractIds, kobetsuCopies }) },
      120000
    ),
  generateGrouped: (contractIds: number[], groupBy: "kobetsu" | "tsuchisho" | "daicho" | "kobetsu-tsuchisho" | "all" = "all") =>
    request<GenerateGroupedResult>("/documents/generate-grouped", {
      method: "POST",
      body: JSON.stringify({ contractIds, groupBy }),
    }, 120000),
  generateKeiyakusho: (employeeNumber: string, data?: Record<string, unknown>) =>
    request<{ filename: string; path: string }>(`/documents/keiyakusho/${encodeURIComponent(employeeNumber)}`, { method: "POST", body: JSON.stringify(data ?? {}) }),
  generateShugyojoken: (employeeNumber: string, data?: Record<string, unknown>) =>
    request<{ filename: string; path: string }>(`/documents/shugyojoken/${encodeURIComponent(employeeNumber)}`, { method: "POST", body: JSON.stringify(data ?? {}) }),
  listDocuments: (contractId: number) =>
    request<{ files: { filename: string; path: string; size?: number; type?: string; createdAt?: string }[] }>(`/documents/list/${contractId}`),
  listLaborHistory: () =>
    request<{ files: LaborHistoryFile[] }>("/documents/labor-history"),
  openDocumentsFolder: (type: "kobetsu" | "roudou") =>
    request<{ success: boolean; type: "kobetsu" | "roudou"; path: string }>("/documents/open-folder", {
      method: "POST",
      body: JSON.stringify({ type }),
    }),

  // Import
  importEmployees: (data: { data: Record<string, unknown>[]; mode?: "upsert" | "skip" }) =>
    request<ImportResult>("/import/employees", { method: "POST", body: JSON.stringify(data) }),
  importCompanies: (data: { data: Record<string, unknown>[]; mode?: "upsert" | "skip" }) =>
    request<ImportResult>("/import/companies", { method: "POST", body: JSON.stringify(data) }),
  importFactories: (data: {
    data: Record<string, unknown>[];
    mode?: "upsert" | "skip";
    deleteIds?: number[];
    companyData?: Record<string, unknown>[];
    enrichCompanies?: boolean;
  }) =>
    request<ImportResult>("/import/factories", { method: "POST", body: JSON.stringify(data) }),
  diffEmployees: (data: { data: Record<string, unknown>[] }) =>
    request<EmployeeDiffResult>("/import/employees/diff", { method: "POST", body: JSON.stringify(data) }),
  diffFactories: (data: { data: Record<string, unknown>[] }) =>
    request<DiffResult>("/import/factories/diff", { method: "POST", body: JSON.stringify(data) }),

  // Admin
  resetAllData: (body: { confirm: string }) =>
    request<ResetAllResponse>("/admin/reset-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  // Dashboard
  getDashboardStats: (warningDays = 30) => request<DashboardStats>(`/dashboard/stats?warningDays=${warningDays}`),
  getNationalityStats: () => request<NationalityStat[]>("/dashboard/nationality"),
  getByCompanyStats: () => request<CompanyStat[]>("/dashboard/by-company"),
  getExpiringContracts: (warningDays = 30) => request<ExpiringContract[]>(`/dashboard/expiring?warningDays=${warningDays}`),
  getTeishokubiAlerts: (warningDays?: number) => {
    const query = new URLSearchParams();
    if (warningDays) query.set("warningDays", String(warningDays));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<TeishokubiAlert[]>(`/dashboard/teishokubi${suffix}`);
  },
  getVisaExpiryAlerts: () => request<VisaExpiryAlert[]>("/dashboard/visa-expiry"),
  getAuditLogs: (params?: { action?: string; entityType?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.action) query.set("action", params.action);
    if (params?.entityType) query.set("entityType", params.entityType);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    const qs = query.toString();
    return request<{ logs: AuditLogEntry[]; total: number }>(`/dashboard/audit${qs ? `?${qs}` : ""}`);
  },

  // Factory Yearly Config
  getFactoryYearlyConfigs: (factoryId: number) =>
    request<import("@/lib/api-types").FactoryYearlyConfig[]>(`/factory-yearly-config/${factoryId}`),
  createFactoryYearlyConfig: (data: import("@/lib/api-types").FactoryYearlyConfigCreate) =>
    request<import("@/lib/api-types").FactoryYearlyConfig>("/factory-yearly-config", { method: "POST", body: JSON.stringify(data) }),
  updateFactoryYearlyConfig: (id: number, data: import("@/lib/api-types").FactoryYearlyConfigUpdate) =>
    request<import("@/lib/api-types").FactoryYearlyConfig>(`/factory-yearly-config/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteFactoryYearlyConfig: (id: number) =>
    request<{ ok: boolean }>(`/factory-yearly-config/${id}`, { method: "DELETE" }),
  getFactoryYearlyConfigSummary: () =>
    request<number[]>("/factory-yearly-config/summary"),
  copyFactoryYearlyConfig: (data: { sourceFactoryId: number; fiscalYear: number; targetFactoryIds: number[] }) =>
    request<{ copied: number; skipped: number }>("/factory-yearly-config/copy-to", { method: "POST", body: JSON.stringify(data) }),

  // Company Yearly Config
  getCompanyYearlyConfigs: (companyId: number) =>
    request<import("@/lib/api-types").CompanyYearlyConfig[]>(`/company-yearly-config/${companyId}`),
  createCompanyYearlyConfig: (data: import("@/lib/api-types").CompanyYearlyConfigCreate) =>
    request<import("@/lib/api-types").CompanyYearlyConfig>("/company-yearly-config", { method: "POST", body: JSON.stringify(data) }),
  updateCompanyYearlyConfig: (id: number, data: import("@/lib/api-types").CompanyYearlyConfigUpdate) =>
    request<import("@/lib/api-types").CompanyYearlyConfig>(`/company-yearly-config/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCompanyYearlyConfig: (id: number) =>
    request<{ ok: boolean }>(`/company-yearly-config/${id}`, { method: "DELETE" }),

  // Shift Templates
  getShiftTemplates: () => request<ShiftTemplate[]>("/shift-templates"),
  createShiftTemplate: (data: { name: string; workHours: string; breakTime: string }) =>
    request<ShiftTemplate>("/shift-templates", { method: "POST", body: JSON.stringify(data) }),
  deleteShiftTemplate: (id: number) => request<{ ok: boolean }>(`/shift-templates/${id}`, { method: "DELETE" }),

  // Data Check
  getDataCheck: (companyId?: number) => {
    const params = companyId ? `?companyId=${companyId}` : "";
    return request<DataCheckResponse>(`/data-check${params}`);
  },
  exportDataCheck: () =>
    request<{ success: boolean; filename: string; path: string; count: number }>(
      "/data-check/export", { method: "POST" }
    ),
  importDataCheck: (data: { rows: Record<string, unknown>[] }) =>
    request<{ success: boolean; updated: { employees: number; factories: number }; errors: string[] }>(
      "/data-check/import", { method: "POST", body: JSON.stringify(data) }
    ),

  // System
  getHealth: () => request<{ status: string; port: number; uptime: number; dbSize: number; version?: string }>("/health", {}, 5000),
  createBackup: () => request<{ success: boolean; filename: string }>("/backup", { method: "POST" }),

  // Admin
  getAdminTables: () => request<AdminTableMeta[]>("/admin/tables"),
  getAdminRows: (table: string, params?: { page?: number; pageSize?: number; sortBy?: string; sortDir?: "asc" | "desc" }) => {
    const query = new URLSearchParams();
    query.set("table", table);
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    if (params?.sortBy) query.set("sortBy", params.sortBy);
    if (params?.sortDir) query.set("sortDir", params.sortDir);
    const qs = query.toString();
    return request<AdminRowResult>(`/admin/rows${qs ? `?${qs}` : ""}`);
  },
  adminInsert: (table: string, data: Record<string, string>) =>
    request<{ id: number }>(`/admin/crud/${table}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminDelete: (table: string, id: number) =>
    request<{ deleted: boolean; id: number }>(`/admin/crud/${table}/${id}`, {
      method: "DELETE",
    }),
  executeSql: (sql: string) => request<AdminSqlResult>("/admin/sql", {
    method: "POST",
    body: JSON.stringify({ sql }),
  }),
  getAdminStats: () => request<AdminStats>("/admin/stats"),
};

// ─── Standalone PDF download (binary — cannot use request<T>) ──────────────

export async function downloadPdf(downloadPath: string, filename: string): Promise<void> {
  const res = await fetch(downloadPath);
  if (!res.ok) {
    throw new Error(`PDF download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Standalone ZIP download (binary — cannot use request<T>) ────────────────

export async function downloadZip(filenames: string[], zipName: string): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/download-zip`, {
    method: "POST",
    headers: buildHeaders("/documents/download-zip"),
    body: JSON.stringify({ filenames, zipName }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((error as { error?: string }).error ?? `ZIP download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
