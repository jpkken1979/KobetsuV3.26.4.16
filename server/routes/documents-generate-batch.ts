// Handlers for batch/set/factory/ID-based document generation
// POST /api/documents/generate-batch — per-contract bundles
// POST /api/documents/generate-set — combined PDF set for shared factory/line
// POST /api/documents/generate-factory — all documents for a factory
// POST /api/documents/generate-by-ids — ID-based employee grouping + generation
//
// Split into focused modules:
//   documents-generate-batch-bundle.ts  — handleGenerateBatch
//   documents-generate-batch-set.ts     — handleGenerateSet
//   documents-generate-batch-factory.ts — handleGenerateFactory
//   documents-generate-batch-ids.ts     — handleGenerateByIds
//   documents-generate-batch-utils.ts   — shared utilities (mergePdfs, SET_OUTPUT_DIR)

export { handleGenerateBatch } from "./documents-generate-batch-bundle.js";
export { handleGenerateSet } from "./documents-generate-batch-set.js";
export { handleGenerateFactory } from "./documents-generate-batch-factory.js";
export { handleGenerateByIds } from "./documents-generate-batch-ids.js";
