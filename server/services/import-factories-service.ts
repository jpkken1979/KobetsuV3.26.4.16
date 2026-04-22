/**
 * Import-factories service — backward-compatible facade.
 * All logic moved to sub-modules under import-factories/:
 *   - parser.ts    : Excel → data structures (pure parsing)
 *   - validator.ts : Business validation rules
 *   - writer.ts    : DB writes + transaction logic
 *   - index.ts     : Re-exports everything
 *
 * This file re-exports the full public API for existing callers.
 */
export * from "./import-factories/index.js";