# Architecture Guidelines (Short)

## Backend
- Keep `routes` focused on HTTP concerns: parse/validate input, call services, shape response.
- Move domain logic and reusable transformations to `server/services/*`.
- Prefer pure helpers for mapping and calculations; keep DB mutations explicit in route transactions.
- Maintain consistent JSON error shape: `{ error: string }`.

## Frontend
- Route files should orchestrate data and UI composition, not host all reusable primitives.
- Move reusable UI pieces and pure derivation logic to co-located `-*.tsx` / `-*.ts` modules.
- Keep mutation logic in hooks (`src/lib/hooks`) and avoid ad-hoc fetch logic in route pages.

## Domain safety (critical)
- `DBGenzaiX` assignment remains source of truth.
- Do not infer ambiguous `factoryId`.
- Treat `派遣先ID = 0` as empty (`null`).
- Contract creation must validate selected workers belong to chosen factory/line.

## File-size guidance
- Prefer splitting files above ~900 LOC or when component and domain logic are mixed.
- Extract in this order:
  1. Pure data transforms
  2. Reusable UI primitives
  3. Endpoint-specific write helpers

## Quality gates
- Required before merge:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:run`
