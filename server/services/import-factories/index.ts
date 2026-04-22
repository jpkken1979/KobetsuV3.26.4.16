/**
 * Import-factories sub-module index.
 * Re-exports all public APIs for backward compatibility.
 */
export {
  importFactories,
  diffFactories,
  resolveOrCreateCompany,
  type FactoryImportResult,
  type FactoryDiffResult,
  type FactoryDiffInsert,
  type FactoryDiffUpdate,
  type FactoryDiffMissing,
} from "./writer.js";

export {
  validateFactory,
  DIFF_FIELDS,
  type ValidationWarning,
  type DeletionCheck,
  type DiffFieldSpec,
} from "./validator.js";

export {
  deriveShiftTime,
  buildFactoryData,
  buildCompanyInfo,
  factoryKey,
  relaxedKey,
  normalizeDateValue,
  normalizeCompanyName,
} from "./parser.js";