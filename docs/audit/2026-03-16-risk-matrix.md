# Risk Matrix — 2026-03-16

## Scope
- Backend: `server/routes/contracts.ts`, `server/routes/import.ts`, `server/routes/documents.ts`
- Frontend: `src/routes/companies/index.tsx`, `src/routes/contracts/batch.tsx`
- Tooling: `npm ci`, `lint`, `typecheck`, `test:run`

## High
| Area | Risk | Evidence | Action |
|---|---|---|---|
| Route complexity | Large handlers mix orchestration, validation and mapping, increasing regression risk | Hotspots were among largest TS files | Extract pure helpers (`contract-writes`, `import-assignment`, `document-files`) and keep handlers thinner |
| Maintainability drift | UI route files accumulate shared primitives and domain rules in one file | `companies/index.tsx` and `contracts/batch.tsx` had embedded reusable logic | Move reusable constants/components/pure preview logic to dedicated modules |

## Medium
| Area | Risk | Evidence | Action |
|---|---|---|---|
| Dependency freshness | Patch/minor drift in TanStack/Hono/Drizzle tooling | `npm outdated` showed safe patch/minor deltas | Apply conservative upgrades only (no major jumps) |
| Repo hygiene | Generated/log artifacts were tracked and can confuse reviews | tracked files under `output/`, `server-*.log`, `typecheck_output.txt` | Remove tracked artifacts, harden `.gitignore`, add CI quality workflow |

## Low
| Area | Risk | Evidence | Action |
|---|---|---|---|
| Validation consistency | Legacy payload shape still accepted for compatibility | Contracts accept `employeeIds` and `employeeAssignments` | Keep compatibility now, document preferred payload and deprecation path |
| Ownership clarity | Architecture conventions were spread across large docs | Multiple project docs with overlapping rules | Add concise architecture/PR checklist docs for day-to-day work |

## Status
- Baseline health is stable after clean install:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm run test:run` ✅
