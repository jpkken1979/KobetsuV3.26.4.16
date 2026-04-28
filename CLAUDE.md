# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Japanese labor dispatch contract management system (人材派遣個別契約書管理) for **ユニバーサル企画株式会社 (Universal Kikaku KK)**. Manages dispatch worker contracts, employee records, factory configurations, and generates legally compliant PDF documents per 派遣法第26条.

- **Version:** 26.4.16 (canonical version lives in `ESTADO_PROYECTO.md` — this is the source of truth for changelog and current project status)
- **Language:** Full-stack TypeScript (ESM modules)
- **Database:** SQLite (WAL mode) at `data/kobetsu.db`
- **Usage:** Internal/local-first admin application — public-web hardening is not the main focus, but mutating API routes do use rate limiting via `server/middleware/security.ts`

## Gotchas críticos

Antes de tocar código, leer estas secciones (todas marcadas `— CRITICAL` más abajo):

1. **Work Hours / Shift Data Flow** — `factory.workHours` es la fuente de verdad; `workHoursDay/Night` son auxiliares.
2. **Import Safety** — factory import NUNCA sobrescribe con null/vacío; headers export/import idénticos.
3. **Rate Priority Chain** — `billingRate ?? hourlyRate ?? factory.hourlyRate` con `??`, NUNCA `||` (0 es válido).
4. **UI Accessibility** — todo `motion` debe respetar `useReducedMotion()`; variants fuera del componente.

## Primary Project Docs

Read these first when you need repo-specific context:

1. `README.md` — onboarding and operational overview
2. `AGENTS.md` — technical map, workflows, schema, and conventions
3. `docs/architecture.md` — functional architecture and workflow map
4. `ESTADO_PROYECTO.md` — project history and recent changes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Hono 4.12 (port 8026) |
| ORM | Drizzle ORM 0.45 + better-sqlite3 12 |
| Frontend | React 19.2 + TanStack Router 1.16 (file-based) + TanStack React Query 5 |
| Local state | Zustand 5 |
| Styling | Tailwind CSS 4.2 + PostCSS (native CSS `@theme` — no `tailwind.config.js`) |
| PDF | PDFKit 0.18 with NotoSansJP, BIZ UD Mincho, MS Gothic, MS Mincho, Century Schoolbook fonts. Inkan seal embedded as PNG via `doc.image()`. |
| PDF parsing | pdfjs-dist (Koritsu annual PDF) |
| Build | Vite 8 (port 3026, proxies `/api` → 8026) + TypeScript 6 |
| Test | Vitest 4 (uses `vite.config.ts`); ESLint 10 |
| Validation | Zod 4 |
| Excel | ExcelJS (reads/writes .xlsx) |
| Dates | date-fns 4 |
| UI extras | Recharts, Lucide React, `motion` (NOT `framer-motion`), Sonner, CVA, TanStack Virtual, TanStack React Table 8 |
| ZIP | yazl (batch PDF download bundles) |

## Quick Start & Key Commands

```bash
npm install
npm run dev                      # Starts API (port 8026) + web (port 3026) via concurrently
                                 # - API: tsx watch --env-file .env server/index.ts
                                 # - Web: Vite dev server with /api proxy
                                 # Note: --env-file .env is REQUIRED — without it, ADMIN_TOKEN and env vars won't load
                                 # Fallback for Windows if concurrently fails: run dev:server + dev:client in separate terminals

npm run dev:server               # API server only (tsx watch --env-file .env server/index.ts)
                                 # Use when dev:client in separate terminal or to avoid concurrently issues on Windows

npm run dev:client               # Vite dev server only (port 3026)
                                 # Run in a second terminal alongside dev:server if using split setup

npm run build                    # Production build: Vite compiles src/ → dist/ (static files)

npm run test                     # Watch mode: runs test:prepare, then Vitest in watch mode
                                 # test:prepare is DESTRUCTIVE: drops/recreates data/kobetsu.test.db
                                 # Production DB (data/kobetsu.db) is NEVER touched

npm run test:prepare             # Drops and recreates test DB with seed data
                                 # Safe to run standalone; production DB is completely isolated
                                 # Uses DATABASE_PATH=data/kobetsu.test.db via cross-env

npm run test:run                 # Single-pass test execution: test:prepare + Vitest run (serial)
                                 # Use in CI or for one-off test runs

npm run test:coverage            # Coverage report: test:prepare + Vitest with --coverage
                                 # Thresholds: globals 50/50/50/50; per-file: contract-dates 95%, batch-helpers 85%, koritsu-pdf-parser 80%

npm run test:pdf-snapshots:update # Regenerates PDF golden snapshots
                                 # Use UPDATE_PDF_SNAPSHOTS=1 env var when you intentionally change PDF generators
                                 # Re-run after modifying any server/pdf/*.ts file

npm run lint                     # ESLint: checks src/ and server/ for style violations

npm run typecheck                # TypeScript: tsc --noEmit (no emit, just type checking)
                                 # Run before commits to catch type errors

npm run db:push                  # Drizzle: pushes schema.ts changes → data/kobetsu.db
                                 # Dev shortcut; CI/prod uses migrations instead

npm run db:studio                # Drizzle Studio: GUI explorer for SQLite at http://localhost:3000
                                 # Useful for inspecting DB state during development
```

### Running Individual Tests

```bash
npx vitest run server/__tests__/fixes.test.ts           # Single test file
npx vitest run -t "calculates OT rates"                 # By test name pattern (any test matching string)
npx vitest run server/__tests__/batch-helpers.test.ts -t "groupEmployeesByRate"  # File + name filter

# Drift guard test (validates CLAUDE.md counts)
npx vitest run server/__tests__/claude-md-drift.test.ts # Checks route and service file counts vs CLAUDE.md
                                                        # Fails if counts drift; forces doc update alongside code changes

# All tests with coverage (one-shot)
npm run test:run                                        # Serial execution avoiding SQLite race conditions
```

### PDF Test Scripts

```bash
npx tsx test-pdf.ts                        # 個別契約書, 通知書, 管理台帳 → output/
npx tsx test-keiyakusho-shugyojoken.ts     # 契約書 + 就業条件明示書
npx tsx test-koritsu-pdf.ts                # コーリツ PDFs (個別契約書, 台帳, 通知書)
npx tsx test-multishift-pdf.ts             # Multi-shift variant smoke test
node scripts/excel-to-grid-spec.cjs <file> <sheet> [start] [end]  # Parse Excel → JSON grid spec
```

## Architecture

> **Dónde está qué:** Routes HTTP → `server/routes/*.ts` · Business logic → `server/services/*.ts` · PDFs → `server/pdf/*.ts` · React pages → `src/routes/*.tsx` · React Query hooks → `src/lib/hooks/*.ts` · Tipos API → `src/lib/api-types.ts` · Tokens UI → `src/index.css` (`@theme`)

### How the Dev Server Works

`npm run dev` runs two processes via `concurrently`:
1. **API server** (port 8026): `tsx watch --env-file .env server/index.ts` — Hono app with all `/api` routes. The `--env-file .env` flag is **required** — without it, `ADMIN_TOKEN` and other env vars are not loaded (see `session_2026-04-15b` memory: this caused admin middleware to reject localhost requests).
2. **Vite dev server** (port 3026): Serves React frontend, proxies `/api/*` → `localhost:8026`.

The proxy is configured in `vite.config.ts`. In production, `npm run build` outputs static files to `dist/`.

### Server (`server/`)

```
server/
├── index.ts               # Hono entry, health check, backup (port 8026)
├── db/
│   ├── schema.ts           # 11 tables + relations + indexes
│   └── index.ts            # Drizzle + SQLite init (WAL, FK, pragmas)
├── routes/                 # 31 route files (CRUD, docs, batch, imports, admin)
├── services/               # Business logic (33 modules)
└── pdf/                    # PDFKit generators (9 generators + helpers + types)
    └── fonts/              # NotoSansJP + BIZ UD Mincho
```

> **Convención de carpetas:** `server/routes/factories.ts` es el entry point de Hono; `server/routes/factories/` contiene helpers de ese dominio. Mismo patrón en `services/batch-contracts.ts` + `services/batch-contracts/` y `services/import-factories-service.ts` + `services/import-factories/`. El drift guard cuenta solo archivos `.ts` del primer nivel.

**Route files (31 files, grouped by purpose):**
- **Domain CRUD (13):** `companies.ts`, `factories.ts`, `employees.ts`, `contracts.ts`, `contracts-batch.ts`, `documents.ts`, `shift-templates.ts`, `calendars.ts`, `data-check.ts`, `dashboard.ts`, `pdf-versions.ts`, `factory-yearly-config.ts`, `company-yearly-config.ts`
- **Document generation (8):** `documents-generate.ts`, `documents-generate-individual.ts`, `documents-generate-single.ts`, `documents-generate-batch-bundle.ts`, `documents-generate-batch-factory.ts`, `documents-generate-batch-ids.ts`, `documents-generate-batch-set.ts`, `documents-generate-batch-utils.ts`
- **Imports (3):** `import.ts`, `import-factories.ts`, `import-koritsu.ts`
- **Admin panel (7)** (token-gated via `ADMIN_TOKEN` env, see `server/middleware/security.ts`): `admin-tables.ts`, `admin-rows.ts`, `admin-sql.ts` (SELECT-only via `stmt.reader` flag de better-sqlite3 — sin parsing de SQL ni regex), `admin-crud.ts` (DELETE blocked on `client_companies`/`factories`/`audit_log`), `admin-stats.ts`, `admin-backup.ts`, `admin-reset.ts` (POST /reset-all — deletes all operational data atomically). Token obligatorio para TODA mutación (incluso desde localhost) tras hardening C-1 (audit 2026-04-28).

**PDF generators (9 generators + utilities):**
| Module | Document |
|--------|----------|
| `kobetsu-pdf.ts` | 個別契約書 (dispatch contract) |
| `tsuchisho-pdf.ts` | 通知書 (worker notification) |
| `keiyakusho-pdf.ts` | 労働契約書 (labor contract) |
| `shugyojoken-pdf.ts` | 就業条件明示書 (employment terms) |
| `hakensakikanridaicho-pdf.ts` | 派遣先管理台帳 (client-side ledger) |
| `hakenmotokanridaicho-pdf.ts` | 派遣元管理台帳 (dispatch-side ledger) |
| `koritsu-kobetsu-pdf.ts` | コーリツ個別契約書 |
| `koritsu-tsuchisho-pdf.ts` | コーリツ通知書 |
| `koritsu-hakensakidaicho-pdf.ts` | コーリツ派遣先管理台帳 |
| `helpers.ts` | Grid functions, font registration, `getTakaoJigyosho()` |
| `types.ts` | Shared type definitions for PDF data |

**Service modules (33):** `admin-sql`, `admin-stats`, `audit-context`, `backup`, `batch-contracts`, `batch-helpers`, `completeness`, `contract-assignment`, `contract-dates`, `contract-number`, `contract-writes`, `dashboard-stats`, `db-utils`, `dispatch-mapping`, `document-files`, `document-generation`, `document-index`, `employee-mapper`, `factory-roles`, `factory-yearly-config`, `haizokusaki-parser`, `import-assignment`, `import-employees`, `import-factories-service`, `import-utils`, `koritsu-excel-parser`, `koritsu-pdf-parser`, `koritsu-types`, `pdf-data-builders`, `pdf-versioning`, `shift-sort`, `takao-detection`, `validation` (verified: 33 modules — `audit-context` agregado en C-1/M-3 audit 2026-04-28).

**Conventions:**
- Routes use `try/catch (err: unknown)` with JSON error responses `{ error: string }`
- Batch operations wrapped in `sqlite.transaction()` for atomicity
- Audit log written on significant mutations (create/update/delete/export/import)
- In Hono, literal routes (`/bulk-roles`) MUST come BEFORE parameterized routes (`/:id`) to avoid silent 404s
- `calendars.ts` route ordering is correct — `post("/")` comes before `get("/:factoryId")` (fixed).

### Frontend (`src/`)

```
src/
├── lib/
│   ├── api-types.ts        # All TypeScript interfaces
│   ├── api.ts              # Typed fetch wrapper
│   ├── app-settings.ts     # App-level settings (tema, densidad, etc.)
│   ├── chart-colors.ts     # Paleta compartida para Recharts (light/dark)
│   ├── constants.ts        # Constantes globales (rate multipliers, formatos)
│   ├── contract-dates.ts   # Helpers cliente (espejo parcial de server/services/contract-dates)
│   ├── excel/              # Parsers/builders ExcelJS compartidos
│   ├── mutation-helpers.ts # Shared toast helpers for mutations
│   ├── query-keys.ts       # Centralized React Query key factory
│   ├── shift-utils.ts      # Shift/break time calculations
│   ├── utils.ts            # `cn()` y helpers misc
│   └── hooks/              # React Query CRUD hooks (see table below)
├── stores/
│   ├── contract-form.ts    # Zustand: 5-step contract wizard state
│   └── ui-prefs.ts         # Zustand: UI preferences (densidad, filtros persistidos, etc.)
├── components/
│   ├── layout/             # root-layout, sidebar, header, command-palette
│   ├── ui/                 # 23 reusable primitives (alert, animated, animated-number, badge, batch-page-shell, bento-stats-grid, button, card, confirm-dialog, dialog, empty-state, error-boundary, input, page-header, particle-burst, select, skeleton, status-badge, switch, table, tabs, textarea, tooltip)
│   └── contract/           # 8 wizard step components (batch-shared, cascading-select, contract-form, contract-preview, date-calculator, employee-selector, rate-preview, work-conditions)
└── routes/                 # TanStack file-based routes (see table below)
```

**React Query + utility hooks (`src/lib/hooks/`, 23 archivos):**

> El drift guard automatizado solo cubre `server/routes/` y `server/services/`. Esta tabla de hooks se mantiene a mano — actualizarla al agregar/quitar archivos en `src/lib/hooks/`.

*Dominio CRUD:*
| Hook | Purpose |
|------|---------|
| `use-companies.ts` | Companies CRUD + list |
| `use-factories.ts` | Factories CRUD + bulk roles/calendars |
| `use-employees.ts` | Employees CRUD + filter by factory |
| `use-contracts.ts` | Contracts CRUD + batch operations |
| `use-data-check.ts` | Completeness matrix queries |
| `use-shift-templates.ts` | Shift pattern CRUD |
| `use-company-yearly-config.ts` | Per-company annual config CRUD |
| `use-factory-yearly-config.ts` | Per-line annual config CRUD |
| `use-contract-wizard.ts` | Wiring del wizard 5-step + split por tarifa |
| `use-koritsu-import.ts` | Flujo de import específico コーリツ (Excel + PDF parse) |
| `use-pdf-versions.ts` | Historial de PDFs generados (tabla `pdf_versions`) |

*Admin panel (token-gated):*
| Hook | Purpose |
|------|---------|
| `use-admin-tables.ts` | Lista de tablas disponibles en el admin explorer |
| `use-admin-columns.ts` | Metadata de columnas para grilla admin |
| `use-admin-rows.ts` | Paginación de filas de cualquier tabla |
| `use-admin-crud.ts` | Create / update / delete controlado por el servidor |
| `use-admin-sql.ts` | SELECT-only runner con blocklist |
| `use-admin-stats.ts` | Métricas agregadas (totales, drift, últimas mutaciones) |
| `use-admin-backup.ts` | Backup manual + listado de snapshots |

*Utility / UX:*
| Hook | Purpose |
|------|---------|
| `use-theme.ts` | Light/dark theme state |
| `use-debounce.ts` | Debounced value utility |
| `use-unsaved-warning.ts` | Unsaved changes guard (beforeunload + TanStack Router) |
| `use-reduced-motion.ts` | Respeta `prefers-reduced-motion` para todos los `motion` |
| `use-dashboard-stats.ts` | Stats agregadas para hero spotlight + bento grid de páginas batch |

**Frontend routes (`src/routes/`):**
| Path | Purpose |
|------|---------|
| `/` | Dashboard — stats, charts, alerts |
| `/companies` | Company/factory registry |
| `/companies/table` | Tabla editable de factories con import modal |
| `/companies/koritsu` | コーリツ-specific import |
| `/employees` | Employee list with search/filter |
| `/contracts` | Contract list with filters + cancelled toggle |
| `/contracts/new` | 5-step contract wizard |
| `/contracts/:contractId` | Contract detail + employee assignment editor (con `-edit-contract-dialog.tsx` para edición inline) |
| `/contracts/batch` | Batch contract generation |
| `/contracts/new-hires` | Batch creation for new hires (preview → confirm) |
| `/contracts/mid-hires` | Batch creation for mid-hires (preview → confirm) |
| `/shouheisha` | Recruitment bulk for 外国人材 — creates employees + contract + PDFs in one flow |
| `/documents` | PDF generation/download (tabs: 契約別/工場一括/ID指定) |
| `/import` | Excel employee import |
| `/data-check` | Completeness matrix |
| `/audit` | Audit log explorer |
| `/history` | Contract history |
| `/settings` | Backup, system info |
| `/admin` | Panel de administración — token-gated (`ADMIN_TOKEN`) |

**Conventions:**
- Path aliases: `@/*` → `src/*`, `@server/*` → `server/*`
- React Query: staleTime 60s, no refetch on window focus
- Query keys centralized in `query-keys.ts` — factory pattern. NEVER use raw string arrays like `["contracts"]`
- Mutation toasts via `mutation-helpers.ts`
- Factory mutations MUST invalidate BOTH `queryKeys.factories` AND `queryKeys.companies` (companies embeds factories via `with: { factories }`)
- Destructive actions use `ConfirmDialog` (not `window.confirm()`)
- `src/routeTree.gen.ts` is **auto-generated** by TanStack Router — never edit manually

### Drift Guard Test

A **drift guard test** (`server/__tests__/claude-md-drift.test.ts`) automatically validates that CLAUDE.md counts match the actual number of files:

**What it checks:**
- `Route files (N` count in CLAUDE.md vs actual `.ts` files in `server/routes/` (first level only)
- `Service modules (N` count in CLAUDE.md vs actual `.ts` files in `server/services/` (first level only)

**Why it exists:**
Historical issue: v1↔v3 audit found CLAUDE.md was **lying** (17 vs 30 routes, 21 vs 25 services). Future Claude sessions got misled.

**When it fails:**
If you add/remove a route or service file without updating CLAUDE.md, `npm run test:run` will fail:
```
Drift: server/routes/ has 32 .ts files but CLAUDE.md says 31. Update the doc.
```

**How to fix:**
Update the count in CLAUDE.md: `Route files (32` and re-run tests. This forces documentation to stay honest.

**Important notes:**
- Only counts first-level files (e.g., `server/routes/factories.ts`), NOT subdirs (e.g., `server/routes/factories/`)
- Helper subdirectories with `factories.ts` + `factories/` are expected; the drift guard counts only top-level `.ts` files
- Update CLAUDE.md **at the same time** you add/remove routes or services

### Large Files Warning

- Several route/component files exceed 500 lines. Consider splitting when adding features (line counts are approximate — verify before quoting):
  - Largest route files: `shouheisha.tsx` (foreign recruitment), `employees/index.tsx`, `contracts/index.tsx`, `companies/koritsu.tsx`, `settings/index.tsx`, `import/-import-page.tsx`, `contracts/batch.tsx`
  - Large admin: `admin/-contract-manager.tsx`, `admin/-employee-table.tsx`, `admin/-stats-dashboard.tsx`, `admin/-audit-explorer.tsx`
  - Large contracts: `contracts/mid-hires.tsx`, `contracts/new-hires.tsx`, `contracts/$contractId.tsx`, `contracts/new.tsx`, `history/index.tsx`
  - Large shared: `src/lib/api-types.ts` — interfaces grouped by domain; split if navigation becomes cumbersome
  - Large server: `routes/factories.ts`, `services/batch-contracts.ts`, `services/koritsu-pdf-parser.ts`, `services/import-factories-service.ts`
- Extract sub-components to separate `-*.tsx` files to keep route files manageable
- Sheet drawers with custom header buttons: use `hideClose` prop on `SheetContent` + `<SheetClose asChild>` for the custom X button (built-in Radix Close overlaps header buttons)
- `closingDayText` and `paymentDayText` are free text (`"当月末"`, `"翌月20日"`), NOT numbers — use the `*Text` schema fields in all UI and API
- **Never auto-modify** `client_companies` or `factories` records programmatically — analyze and present, but wait for explicit user instruction

### Adding New Routes

TanStack Router uses file-based routing in `src/routes/`. The routing is **automatic** based on file paths:

**File-to-Route Mapping:**
- `src/routes/index.tsx` → `/`
- `src/routes/employees.tsx` → `/employees`
- `src/routes/contracts/$contractId.tsx` → `/contracts/:contractId` (`:contractId` is a param)
- `src/routes/contracts/-edit-dialog.tsx` → NOT a route (prefix `-` marks it as non-route component)

**Workflow:**
1. Create new file in `src/routes/` (e.g., `src/routes/my-page.tsx`)
2. Export a React component as default
3. Dev server automatically regenerates `src/routeTree.gen.ts` (auto-generated — **never edit manually**)
4. Route becomes live immediately

**Sub-components and Helpers:**
- Use `-` prefix for non-route files: `-my-component.tsx`, `-form-section.tsx`
- These files are importable by routes but do NOT create their own routes
- Keep route files organized by domain: `contracts/`, `employees/`, `documents/`, etc.

**Important:**
- `src/routeTree.gen.ts` is **auto-generated** — any manual edits will be overwritten on next dev server restart
- Each top-level route file should export a single default component

### Adding New PDF Generators

1. Create generator in `server/pdf/` following the grid-system pattern (see `kobetsu-pdf.ts` or `keiyakusho-pdf.ts`)
2. Use `scripts/excel-to-grid-spec.cjs` to parse Excel template → JSON grid spec
3. Register font as `"JP"` (NotoSansJP) — use `"Mincho"` only for 管理台帳
4. Connect in `server/routes/documents-generate.ts`
5. For details on PDF rules: see `.claude/rules/pdf-rules.md` (auto-injected)

### Adding New Features (Complex Tasks)

For tasks that touch 3+ files, new features, or architectural changes, use the **SDD workflow** (Spec-Driven Development):

| Command | Phase | Purpose |
|---------|-------|---------|
| `/sdd` | Full 9-phase orchestration | Complete workflow: explore → propose → spec → plan → implement → test → review → document → finalize |
| `/sdd-explore` | Phase 1 only | Investigation: understand requirements, constraints, edge cases |
| `/sdd-propose` | Phase 2 only | Propose solution: architecture, file structure, API contract |

**When to use:**
- Feature request spanning 3+ files
- Architectural decision (new table, new service layer, new workflow)
- Refactors with behavioral impact
- Complex domain logic changes

**When NOT needed:**
- Bug fixes in a single file
- Simple additions (new route, new util function)
- Documentation-only changes
- Dependency updates

SDD is defined in `WORKFLOW_RULES.md` and follows 9 phases. See that file for detailed workflow and expectations.

## Database (11 Tables)

| Table | Purpose | Key relationships |
|-------|---------|-------------------|
| `client_companies` | Client companies | Parent of factories |
| `factories` | Factory/line configs | FK → companies. Unique (companyId, factoryName, department, lineName) |
| `employees` | Workers | FK → companies, factories. Has `hourlyRate` AND `billingRate` |
| `contracts` | Dispatch contracts | FK → companies, factories. KOB-YYYYMM-XXXX format |
| `contract_employees` | N:M junction | FK → contracts, employees. Has individual `hourlyRate` per contract |
| `factory_calendars` | Work calendars | FK → factories. Unique (factoryId, year) |
| `factory_yearly_config` | Per-line annual config (就業日/休日/指揮命令者/派遣先責任者) | FK → factories. Unique (factoryId, fiscalYear). Cascades to PDF |
| `company_yearly_config` | Per-company annual config for shared fields (休日/休暇処理/派遣先責任者) | FK → client_companies. Unique (companyId, fiscalYear). Fallback in cascade |
| `shift_templates` | Reusable shift/break patterns | Standalone |
| `audit_log` | Audit trail | Records all mutations |
| `pdf_versions` | PDF generation log | SHA256 + metadata per generated document |

Schema defined in `server/db/schema.ts`. Drizzle config in `drizzle.config.ts`.

### Work Hours / Shift Data Flow — CRITICAL

`workHours` (text) is the **source of truth** for all shifts. `workHoursDay`/`workHoursNight` are auxiliary fields (max 2 shifts).

**Rules:**
- New output points MUST read from `factory.workHours`, not `workHoursDay`/`Night`
- For breaks, combine `breakTimeDay` + `breakTimeNight` — for 3+ shifts, all breaks are in `breakTimeDay`
- `parseExistingShifts()` in `shift-utils.ts` always parses `workHours` first to preserve custom shift names
- Excel import derives `workHoursDay`/`Night` automatically from `workHours` text

### Import Safety — CRITICAL

- Factory import NEVER overwrites existing fields with null/empty — only updates fields that have actual values in the Excel
- Export and import headers MUST be identical (no spaces: `派遣先責任者氏名` not `派遣先責任者 氏名`)
- Export saves to `./DataTotal/` with timestamp

### DB Safety Rules

- `npm run db:seed` is **blocked** by default — requires `--force` flag
- `npm run db:seed:force` is **DESTRUCTIVE** (drop/recreate all tables)
- Before any destructive DB operation: `POST /api/backup` or copy `data/kobetsu.db*`

### Seed Data Policy — CRITICAL

`data/seed/*.json` (reales) tienen PII (nombres, fechas de nacimiento, direcciones, visa)
y están **gitignored**. Solo se versionan `data/seed/*.example.json` con datos sintéticos.

- **Tu PC tiene los `.json` reales** localmente (ignorados por git)
- **Otros devs / CI** solo tienen los `.example.json`; el `seed.ts` hace fallback automático
  con un warning `[seed] X.json not found, using X.example.json (synthetic data)`
- **Para regenerar los `.example`** desde tus `.json` reales (ej. después de actualizar
  el shape o agregar empresas): `node scripts/anonymize-seeds.cjs`
- **Los `.example` mantienen** los `companyName` reales (`高雄`, `瑞陵精機株式会社`, etc.)
  porque la lógica de detección R11 en `takao-detection.ts` y varios tests dependen de
  esos strings exactos. Solo se anonimiza PII de personas físicas.
- **Histórico previo**: hasta el commit que introdujo esta política, los `.json` con PII
  estuvieron en git. Para purgarlos del histórico se requiere `git filter-repo`
  (destructivo — coordinar con clones existentes). Ver ESTADO_PROYECTO.md sesión 2026-04-28g.

### Employee Assignment Integrity

- **DBGenzaiX** (Excel) is the source of truth for employee assignment
- If `配属先`/`配属ライン` are empty or `0`, importer must keep `factoryId = null` — never infer
- `派遣先ID` values of `0` must be treated as `null`, not a valid ID

## Critical Domain Knowledge

### Important Terms
- **UNS** = ユニバーサル企画株式会社 (the dispatch company operating this system)
- **派遣先** = Client company receiving workers / **派遣元** = UNS (dispatching company)
- **個別契約書** = Individual dispatch contract / **通知書** = Worker notification
- **契約書** = Labor contract / **就業条件明示書** = Employment terms disclosure
- **管理台帳** = Management ledger (派遣先 = client-side, 派遣元 = dispatch-side)
- **抵触日** = Legal maximum dispatch period date
- Workers are primarily Vietnamese nationals with visa tracking requirements

### Rate Priority Chain — CRITICAL

Two **distinct** rates per employee:

| 概念 | DB column | 意味 | 金の流れ |
|------|-----------|------|---------|
| **時給** (hourlyRate) | `employees.hourlyRate` | Pay TO worker (UNS → 社員) | UNS payroll |
| **単価** (billingRate) | `employees.billingRate` | Charge FROM factory (派遣先 → UNS) | Goes on 個別契約書 |

**単価 is always higher than 時給** — the difference is UNS's margin. On contracts, **単価 (billingRate)** appears, NOT 時給.

**Priority for contract rate:** `employee.billingRate ?? employee.hourlyRate ?? factory.hourlyRate`. ALWAYS use `??` (nullish coalescing), NEVER `||` (treats 0 as falsy).

Rate multipliers per 労働基準法: OT 125%, holiday 135%, 60h+ 150%, night +25%.

### Contract Creation Flow (5-Step Wizard)

1. **Step 1** (`cascading-select.tsx`): Company → Factory → Dept → Line. Auto-fills from factory.
2. **Step 2** (`date-calculator.tsx`): Auto-calculates endDate from contractPeriod. Caps at conflictDate.
3. **Step 3** (`rate-preview.tsx`): Factory base rate as reference only.
4. **Step 4** (`employee-selector.tsx`): Loads employees by factory. Rate = `billingRate ?? hourlyRate ?? factory.hourlyRate`. Auto-groups by rate → different rates = separate contracts.
5. **Step 5**: Creates N contracts (one per rate group) with `employeeAssignments: [{ employeeId, hourlyRate }]`.

### Contract API

POST/PUT `/api/contracts` accepts:
- **Preferred:** `employeeAssignments: [{ employeeId: number, hourlyRate?: number }]`
- **Legacy:** `employeeIds: number[]`

### Business Day Calculations

`contractDate` = startDate - 2 business days, `notificationDate` = startDate - 3 business days. Weekends excluded.

### Dashboard Warning Window

`warningDays` (not `conflictWarningDays`) is the parameter that controls the "contracts expiring soon" alert window in the dashboard. Clamped 1–365, default 30. Stored in `dashboard.ts` route logic.

### Koritsu PDF Variant (コーリツ)

Different format from all other companies — 3 separate generators in `server/pdf/koritsu-*.ts`:
- Detection: `companyName.includes("コーリツ")` → use Koritsu generators (routed in `documents-generate.ts`)
- Uses per-side borders (`bT`/`bB`/`bL`/`bR`) via `moveTo/lineTo` — NOT `rect().stroke()`
- Output: `output/koritsu/` (separate from `output/kobetsu/`)
- 派遣元管理台帳 reuses standard `hakenmotokanridaicho-pdf.ts`

## UI Theme (LUNARIS v2 Design System)

- Light: `#f9fafb` bg, emerald `#059669` primary. Dark: `#0c0d0f` bg, neon green `#00ff88` primary
- Warm neutrals (Linear-style) — no pure blacks in dark mode
- Fonts: `Space Grotesk`/`Noto Sans JP` (body), `JetBrains Mono` (mono). Self-hosted via `@fontsource` (no CDN).
- All tokens in `@theme {}` in `src/index.css`
- Factory editor: centered `Dialog` modal (not Sheet drawer)
- NEVER use `useRef` as close guard in Radix dialogs — causes zombie state
- NEVER manipulate `body.style.overflow` manually — Radix handles scroll locking
- ⚠️ `p-5` spacing is PROHIBITED — use `p-4` or `p-6` only
- Especificación viva del design system en `design-system/jp-kobetsu/MASTER.md` (reemplaza el viejo `LUNARIS-exports/`)

### UI Accessibility — CRITICAL
- All `motion` animations (`animate=`, `whileHover`, `whileTap`, `transition=`) MUST check `useReducedMotion()` first
- Pattern established in `src/components/ui/animated.tsx` and `src/components/ui/dialog.tsx` — replicate in every component using motion (audit C-001 closed)
- `staggerChildren` on `<motion.tbody>` is **incompatible with `useVirtualizer`** — use individual `motion.tr` with `initial/animate` instead (employees table pattern)
- Motion variants must be defined at **module level** (outside component body) — never inline

## TypeScript & Build

- **Strict mode** (`noUnusedLocals`, `noUnusedParameters`), no `any` — use `unknown` + narrowing
- Target: ES2022, module: ESNext, moduleResolution: bundler
- Single `tsconfig.json` — includes both `src/` and `server/`
- Path aliases: `@/*` → `src/*` (Vite + TS), `@server/*` → `server/*` (TS only — server runs via `tsx`)
- ESLint 10 flat config: `no-explicit-any: warn`, `no-unused-vars: warn` with `_` prefix, `no-irregular-whitespace: off` (Japanese full-width spaces)
- Vite code splitting: separate chunks for recharts, motion, @tanstack, exceljs
- TanStack Router plugin: `autoCodeSplitting: true` — every route is lazy-loaded

### Naming Conventions

- **Database columns:** `snake_case` (Drizzle maps to camelCase in TS)
- **TypeScript:** `camelCase` for variables/functions, `PascalCase` for types/components
- **Contract numbers:** `KOB-YYYYMM-XXXX` format (e.g., `KOB-202604-0001`)

### TypeScript Standards

Detailed TypeScript/React standards are in `.claude/rules/typescript.md` (auto-injected). Key points:

- **Strict mode:** `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` enabled
- **No `any`:** Use `unknown` + type narrowing instead
- **Functional components:** Use hooks (`useCallback`, `useRef`, `useMemo`)
- **Motion variants:** Extract outside component bodies (e.g., `Button-variants.ts`)
- **Tailwind v4:** Utility-first, no inline styles. Tokens in `src/index.css` via `@theme {}`

**Note:** These standards apply to this project (KobetsuV3). If working in `nexus-app/`, see `nexus-app/` for Electron-specific requirements.

## Testing

- **Framework:** Vitest (uses `vite.config.ts` implicitly — no separate config)
- **Serial execution:** all test scripts pass `--no-file-parallelism` to avoid SQLite race conditions on concurrent writes
- **Test DB isolation:** `DATABASE_PATH=data/kobetsu.test.db` via `cross-env`
  - `test:prepare` drops/recreates test DB with seed data before every run
  - **Production DB** (`data/kobetsu.db`) is **NEVER touched** by tests
  - Safe to run tests while the dev server is running

- **Coverage thresholds:** 
  - Globals: 50/50/50/50 (lines/functions/statements/branches)
  - Per-file raised: `contract-dates.ts` 95%, `batch-helpers.ts` 85%, `koritsu-pdf-parser.ts` 80%
  - Coverage include list scoped to: `server/services/**` + `src/routes/companies/-table-*.tsx`
  - Run `npm run test:coverage` to generate report

- **Test organization:**
  - **Server tests:** `server/__tests__/` — unit + integration with real SQLite
  - **Frontend tests:** colocated with components (e.g., `Button.test.tsx` next to `Button.tsx`)
  - **Drift guard:** `server/__tests__/claude-md-drift.test.ts` — see section above

- **Common test commands:**
  ```bash
  npm run test                          # Watch mode
  npm run test:run                      # Single pass (CI-friendly)
  npm run test:coverage                 # Coverage report
  npm run test:pdf-snapshots:update     # Regenerate PDF golden files
  npx vitest run -t "contract dates"    # Single test by name pattern
  ```

- **PDF smoke tests:** 
  - Standalone scripts in project root: `test-pdf.ts`, `test-keiyakusho-shugyojoken.ts`, etc.
  - Regenerate golden snapshots with `npm run test:pdf-snapshots:update` after modifying any `server/pdf/*.ts` generator
  - Output: `output/` directory with generated PDFs

- **Mocking philosophy:**
  - Mocks only for external dependencies (APIs, file system if unavoidable)
  - Prefer real SQLite for integration tests — ensures prod-like behavior
  - Database schema and queries are best tested against real DB, not mocks

- **CI Pipeline:** `.github/workflows/ci.yml` — locally verify with:
  ```bash
  npm run lint && npm run typecheck && npm run build && npm run test:run
  ```

## Additional Context & Rules

### Auto-Injected Rules (`.claude/rules/`)

Every Claude Code session **automatically injects** rules from `.claude/rules/*.md`. When they conflict with generic guidance, **rules always win**.

**How it works:**
1. `.claude/rules/` files are read at session start
2. Rules override Claude Code default behavior
3. User-provided rules take priority over global system rules

**Project-specific rules (critical for this project):**

| Rule file | Scope |
|-----------|-------|
| `pdf-rules.md` | Pixel-perfect PDF generation, font rules, 派遣元責任者 roles, 高雄 事業所 logic |
| `domain-rules.md` | Never auto-modify data, Excel trim keys, closingDay/paymentDay are text, cancelled contracts hidden |
| `commits.md` | `<type>(<scope>): <description>` format en español |
| `language.md` | Respuestas en español, código en inglés, commits en español |

**Global rules** (also auto-injected from `~/.claude/rules/`):
Additional rules for security, TypeScript standards, Python standards, architecture, memory engines, and more are automatically loaded. See `.claude/rules/` directory for complete list — these are not repeated here to avoid duplication.

**Note:** If you need to check what rules are in effect, see the `.claude/rules/` directory or look at CLAUDE.md's "Additional Context & Rules" section above.

### Reference Files

| File | Purpose |
|------|---------|
| `MedidasKobetsu.md` | A4 grid spec for 個別契約書 PDF |
| `WORKFLOW_RULES.md` | Workflow methodology — consult for tasks with 3+ steps |
| `ESTADO_PROYECTO.md` | Project state document (Spanish) |
| `Koritsu/` | コーリツ Excel template + 指揮命令者 PDF reference |
| `design-system/jp-kobetsu/MASTER.md` | Design system spec (colores, spacing, componentes) |

## Files NOT to Commit

`data/kobetsu.db*`, `data/seed/*.json` (PII real — usar `*.example.json` ficticio), `output/*.pdf`, `node_modules/`, `dist/`, `.env`, `.env.*`, `*.local`, `src/routeTree.gen.ts`, `.agent/memory/`, `.agent/metrics/`, `__pycache__/`

> **Política `.env`:** NO se versiona (`.gitignore:14-17`). Solo `.env.example`
> con placeholders queda en git. Cada developer mantiene su `.env` local con
> `ADMIN_TOKEN`, etc. Si encontrás un `.env` rastreado: `git rm --cached .env`
> + **rotar todos los tokens** expuestos. Ver `.claude/rules/security.md`.

---

<!-- ANTIGRAVITY-START -->

## Integracion Antigravity

Proyecto integrado con **Antigravity v6.1.4**.
Instalado por Nexus el 2026-04-23.

### Persona activa: gentleman

El estilo de comunicacion de la IA se adapta segun el modo de persona.
Modos disponibles: `gentleman` (detallado, pedagogico), `neutral` (factual),
`conciso` (minimalista). Configurar via `ANTIGRAVITY_PERSONA` env var o
`.antigravity/config.json`. Ver `.claude/rules/persona.md` para detalles.

### Runtime MCP-first

```
.agent/
  agents/ skills/ skills-custom/ workflows/
  scripts/ core/ mcp/ plugins/
.claude/
  settings.json hooks/ rules/
.antigravity/
  config.json sdk/ ai_manifest.json rules.md
```

### Clientes compatibles

- Claude Code: `.claude/settings.json` + `.mcp.json`
- Cursor: `.cursor/mcp.json` + `.cursorrules`
- Windsurf: `.windsurf/mcp.json` + `.windsurfrules`
- VS Code / Roo / Cline: `.vscode/mcp.json` y `.vscode/cline_mcp_settings.json`
- Zed: `.zed/settings.json`
- Cualquier IA/IDE con MCP: `.mcp.json` y `.antigravity/ai_manifest.json`

### SDK JS/TS

```js
import { runAgent } from "./.antigravity/sdk/antigravity.js";
const result = await runAgent("explorer", "analiza el repo");
```

### Memoria

- Memoria MCP: `antigravity-memory` (mem0)
- Memoria de proyecto: `ESTADO_PROYECTO.md`
- Reglas compartidas: `.claude/rules/` y `.antigravity/rules.md`

<!-- ANTIGRAVITY-END -->
