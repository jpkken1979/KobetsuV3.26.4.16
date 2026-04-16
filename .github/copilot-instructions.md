# Copilot Instructions

## Read this project first

When you need repository context, read these in order:

1. `README.md` for the short operational overview.
2. `AGENTS.md` for the detailed technical map, commands, and domain rules.
3. `docs/architecture.md` for the end-to-end workflows.
4. `ESTADO_PROYECTO.md` for recent project history.
5. `RULES.md` and `WORKFLOW_RULES.md` before inventing new automation or multi-step workflows; this repo already ships Antigravity rules, skills, and MCP config.

Existing AI-assistant configs in this repo consistently assume **Spanish for assistant prose** and **English for code**.

## Build, test, and lint commands

The CI workflow (`.github/workflows/ci.yml`) runs on **Node 22** and executes `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:run`.

### Core commands

| Area | Command |
|---|---|
| Install | `npm install` |
| Dev (full stack) | `npm run dev` |
| Dev (API only) | `npm run dev:server` |
| Dev (frontend only) | `npm run dev:client` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Build | `npm run build` |
| Tests (watch-style) | `npm run test` |
| Tests (single pass) | `npm run test:run` |
| Coverage | `npm run test:coverage` |

### Single-test workflow

Use the repo's test DB setup first, then run Vitest directly:

```bash
npm run test:prepare
npx cross-env DATABASE_PATH=data/kobetsu.test.db vitest run --no-file-parallelism server/__tests__/batch-helpers.test.ts
npx cross-env DATABASE_PATH=data/kobetsu.test.db vitest run --no-file-parallelism -t "groupEmployeesByRate"
```

### PDF smoke tests

```bash
npx tsx test-pdf.ts
npx tsx test-keiyakusho-shugyojoken.ts
npx tsx test-koritsu-pdf.ts
npx tsx test-multishift-pdf.ts
```

### Database commands

```bash
npm run db:push
npm run db:generate
npm run db:migrate
npm run db:studio
npm run db:seed -- --force
npm run db:seed:force
```

## High-level architecture

- This is an internal labor-dispatch contract system for UNS. The business chain is:
  **company -> factory -> department -> line -> employees -> contracts -> PDFs/audit**.
  The most important operational unit is the **line**, because legal contacts, schedules, rates, and PDF output all depend on line-level factory configuration.
- `npm run dev` runs two processes:
  - Hono API in `server/index.ts` on `http://localhost:8026`
  - Vite frontend on `http://localhost:3026`, proxying `/api` to the API
- Backend responsibilities are intentionally split:
  - `server/db/schema.ts` is the single source of truth for SQLite/Drizzle schema.
  - `server/routes/*` own HTTP parsing, validation, DB queries, and transactions.
  - `server/services/*` hold reusable business logic, calculations, import helpers, assignment resolution, and PDF payload building.
  - `server/pdf/*` contains PDFKit generators. Standard document generation and the special `コーリツ` customer variant branch here.
- Frontend responsibilities are also split:
  - TanStack Router file-based routes in `src/routes/`
  - React Query for server state and invalidation
  - Zustand only for the contract wizard draft/persisted local workflow (`src/stores/contract-form.ts`)
- Document generation is not a single endpoint. `server/routes/documents-generate*.ts` orchestrates several flows:
  per-contract bundles, per-employee labor docs, grouped/factory batch generation, and ZIP output.
- There is a client-specific branch for `コーリツ`. When the company matches that variant, the app uses separate PDF generators and separate output paths instead of the standard templates.

## Key conventions

- Server-side TypeScript uses **ESM imports with `.js` extensions** for relative imports.
- Use the centralized React Query key factory in `src/lib/query-keys.ts`. Do **not** invent raw string keys. Factory mutations must invalidate both `queryKeys.factories` and `queryKeys.companies`.
- Keep the architecture boundary intact:
  - routes handle HTTP + DB access
  - services handle business logic
- In Hono routers, declare **literal routes before parameterized routes** (`/bulk-roles` before `/:id`) or literals can be shadowed.
- `workHours` is the source of truth for shifts. `workHoursDay` and `workHoursNight` are auxiliary legacy fields and should not be treated as the primary schedule model.
- Rates are domain-sensitive:
  - `employees.hourlyRate` = worker pay rate
  - `employees.billingRate` = client billing rate
  - On contracts and 個別契約書, the effective rate is the **billing rate**
  - Always resolve rates with `employee.billingRate ?? employee.hourlyRate ?? factory.hourlyRate`
  - Use `??`, never `||`, because `0` is a valid value
- The contract wizard and batch creation flows split employees into separate contracts by effective rate. Do not collapse mixed-rate groups into one contract.
- `contracts.hourlyRate` is legacy naming; in practice it stores the contract billing rate used for the generated document set.
- Import code must preserve data integrity:
  - trim Japanese Excel headers and string cells
  - never infer `factoryId` from ambiguous employee import data
  - treat source values of `0`/empty for assignment IDs as `null`
  - factory imports must not overwrite existing data with empty spreadsheet values
- UI conventions that matter in this repo:
  - destructive actions use `ConfirmDialog`, not `window.confirm()`
  - do not use `useRef` as a close guard in Radix dialogs
  - do not manually manage `document.body.style.overflow`
  - use `motion`, not `framer-motion`
  - Tailwind is v4 and theme tokens live in `src/index.css`; there is no `tailwind.config.js`
  - `src/routeTree.gen.ts` is generated; never edit it manually
- PDF conventions are easy to break:
  - `"JP"` and `"JP-Mincho"` fonts are distinct; restore the default font after Mincho-based output
  - `managerUns*`, `complaintUns*`, and `hakensakiManager*` are different legal roles and must not be mixed
- Admin/security behavior:
  - mutating API routes are rate-limited in `server/middleware/security.ts`
  - `/api/admin/*` allows localhost automatically, but remote access requires `ADMIN_TOKEN`
- Do not auto-modify `client_companies` or `factories` records without explicit user intent. These are master-data records that drive downstream contract and PDF behavior.
