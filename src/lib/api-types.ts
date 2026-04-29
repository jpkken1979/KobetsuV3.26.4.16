/**
 * Shared TypeScript interfaces and types for the API layer.
 *
 * Re-exporta desde `api-types/*` (split por dominio):
 *   entities  → Company, Factory, Employee, Contract, etc.
 *   batch     → Batch*, NewHires*, MidHires*, ByLine*, SmartBatch*
 *   documents → GenerateFactory/ByIds*
 *   inputs    → CompanyCreate/Update, FactoryCreate/Update, ImportResult, etc.
 *   dashboard → DashboardStats, alerts, DataCheck*, TakaoReEntry
 *   admin     → Admin* (panel)
 *
 * Importadores externos usan `from "@/lib/api-types"` o pasan por `api.ts`
 * (que hace `export * from "./api-types"`). Backward-compatible.
 */
export * from "./api-types/entities";
export * from "./api-types/batch";
export * from "./api-types/documents";
export * from "./api-types/inputs";
export * from "./api-types/dashboard";
export * from "./api-types/admin";
