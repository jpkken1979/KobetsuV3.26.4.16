// PDF document generation endpoints — main router
// Handlers split into:
//   documents-generate-single.ts    — POST /generate/:contractId
//   documents-generate-individual.ts — POST /keiyakusho/:employeeNumber, /shugyojoken/:employeeNumber
//   documents-generate-batch-bundle.ts  — handleGenerateBatch
//   documents-generate-batch-set.ts     — handleGenerateSet
//   documents-generate-batch-factory.ts — handleGenerateFactory
//   documents-generate-batch-ids.ts     — handleGenerateByIds
import { Hono } from "hono";
import { handleGenerateSingle } from "./documents-generate-single.js";
import { handleKeiyakusho, handleShugyojoken } from "./documents-generate-individual.js";
import { handleGenerateBatch } from "./documents-generate-batch-bundle.js";
import { handleGenerateSet } from "./documents-generate-batch-set.js";
import { handleGenerateFactory } from "./documents-generate-batch-factory.js";
import { handleGenerateByIds } from "./documents-generate-batch-ids.js";

// Re-export for backward compatibility (documents.ts imports from this file)
export { readContractDocIndex, KOBETSU_OUTPUT_DIR, ROUDOU_OUTPUT_DIR, KORITSU_OUTPUT_DIR } from "../services/document-generation.js";

export const documentsGenerateRouter = new Hono();

// ─── POST /api/documents/generate/:contractId ───────────────────────
// Generate contract bundle PDFs (個別契約書 + 台帳 + optional 就業条件明示書)
documentsGenerateRouter.post("/generate/:contractId", handleGenerateSingle);

// ─── POST /api/documents/keiyakusho/:employeeNumber ─────────────────
// Generate 契約書 (labor contract) by employee number
documentsGenerateRouter.post("/keiyakusho/:employeeNumber", handleKeiyakusho);

// ─── POST /api/documents/shugyojoken/:employeeNumber ────────────────
// Generate 就業条件明示書 by employee number
documentsGenerateRouter.post("/shugyojoken/:employeeNumber", handleShugyojoken);

// ─── POST /api/documents/generate-batch ─────────────────────────────
// Generate per-contract bundles (1 ZIP per contract)
documentsGenerateRouter.post("/generate-batch", handleGenerateBatch);

// ─── POST /api/documents/generate-set ───────────────────────────────
// Generate combined PDF set for contracts sharing the same factory/line
documentsGenerateRouter.post("/generate-set", handleGenerateSet);

// ─── POST /api/documents/generate-factory ───────────────────────────
// Generate ALL documents for all active contracts in a factory
documentsGenerateRouter.post("/generate-factory", handleGenerateFactory);

// ─── POST /api/documents/generate-by-ids ────────────────────────────
// Group employees by ID, create contracts, generate PDFs, bundle into ZIP
documentsGenerateRouter.post("/generate-by-ids", handleGenerateByIds);
