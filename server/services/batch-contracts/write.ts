/**
 * Write functions for batch contracts (transactional creation).
 *
 * Re-exports los executors desde `write/` para que importadores externos
 * (`server/services/batch-contracts.ts` barrel + tests) sigan funcionando
 * sin cambios. Cada execute* vive en su propio archivo:
 *
 *   write/standard-batches.ts → executeBatchCreate, executeNewHiresCreate,
 *                              executeMidHiresCreate, executeIndividualBatchCreate
 *   write/by-line.ts          → executeByLineCreate
 *   write/smart-batch.ts      → executeSmartBatch + SmartBatchCreateResult
 */
export type { IndividualBatchParams } from "./types.js";

export {
  executeBatchCreate,
  executeNewHiresCreate,
  executeMidHiresCreate,
  executeIndividualBatchCreate,
} from "./write/standard-batches.js";

export { executeByLineCreate } from "./write/by-line.js";

export {
  executeSmartBatch,
  type SmartBatchCreateResult,
} from "./write/smart-batch.js";
