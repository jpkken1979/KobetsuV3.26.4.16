/**
 * Centralized React Query key factory.
 * Single source of truth for all query keys used in hooks and invalidations.
 */

export const queryKeys = {
  companies: {
    all: ["companies"] as const,
    detail: (id: number) => ["companies", id] as const,
  },
  factories: {
    all: (params?: { companyId?: number }) => ["factories", params] as const,
    detail: (id: number) => ["factories", id] as const,
    cascade: (companyId: number) => ["factories", "cascade", companyId] as const,
    badges: (companyId: number) => ["factories", "badges", companyId] as const,
    roleSummary: (companyId: number) => ["factories", "role-summary", companyId] as const,
    invalidateAll: ["factories"] as const,
  },
  employees: {
    all: (params?: { companyId?: number; factoryId?: number; search?: string; status?: string }) =>
      ["employees", params] as const,
    detail: (id: number) => ["employees", id] as const,
    byFactory: (factoryId: number) => ["employees", "byFactory", factoryId] as const,
    completeness: ["employees", "completeness"] as const,
    invalidateAll: ["employees"] as const,
  },
  contracts: {
    all: (params?: { companyId?: number; status?: string; showCancelled?: boolean }) =>
      ["contracts", params] as const,
    detail: (id: number) => ["contracts", id] as const,
    history: (statusFilter?: string) => ["contracts", "history", statusFilter] as const,
    invalidateAll: ["contracts"] as const,
  },
  documents: {
    all: ["documents"] as const,
    forContract: (contractId: number | null) => ["documents", contractId] as const,
  },
  dashboard: {
    stats: (days?: number) => ["dashboard", "stats", days] as const,
    expiring: (days?: number) => ["dashboard", "expiring", days] as const,
    teishokubi: (days?: number) => ["dashboard", "teishokubi", days] as const,
    visaExpiry: ["dashboard", "visa-expiry"] as const,
    nationality: ["dashboard", "nationality"] as const,
    byCompany: ["dashboard", "by-company"] as const,
    audit: (action?: string, entityType?: string) => ["dashboard", "audit", action, entityType] as const,
    invalidateAll: ["dashboard"] as const,
  },
  shiftTemplates: {
    all: ["shift-templates"] as const,
  },
  dataCheck: {
    all: ["dataCheck"] as const,
    byCompany: (companyId?: number) => ["dataCheck", companyId] as const,
    invalidateAll: ["dataCheck"] as const,
  },
  laborHistory: ["labor-history"] as const,
  health: ["health"] as const,
  admin: {
    tables: ["admin", "tables"] as const,
    rows: (table: string) => ["admin", "rows", table] as const,
    sql: ["admin", "sql"] as const,
    stats: ["admin", "stats"] as const,
  },
} as const;
