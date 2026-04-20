# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Japanese labor dispatch contract management system (人材派遣個別契約書管理) for **ユニバーサル企画株式会社 (Universal Kikaku KK)**. Manages dispatch worker contracts, employee records, factory configurations, and generates legally compliant PDF documents per 派遣法第26条.

- **Version:** 26.3.31
- **Language:** Full-stack TypeScript (ESM modules)
- **Database:** SQLite (WAL mode) at `data/kobetsu.db`
- **Usage:** Internal/local-first admin application — public-web hardening is not the main focus, but mutating API routes do use rate limiting via `server/middleware/security.ts`

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
npm run dev                      # API (8026) + web (3026) via concurrently (tsx loads .env via --env-file)
npm run dev:server               # API only (tsx watch --env-file .env server/index.ts)
npm run dev:client               # Vite only
npm run build                    # Production build
npm run test                     # Runs test:prepare first (drops/recreates data/kobetsu.test.db), then Vitest watch
npm run test:prepare             # Force-seed data/kobetsu.test.db (never touches data/kobetsu.db)
npm run test:run                 # Seed + single pass against test DB (serial — --no-file-parallelism)
npm run test:coverage            # Seed + coverage (globals 50/50/50/50; per-file: contract-dates 95, batch-helpers 85, koritsu-pdf-parser 80)
npm run test:pdf-snapshots:update # Regenerate PDF snapshot fixtures (UPDATE_PDF_SNAPSHOTS=1) after changing generators
npm run lint                     # ESLint on src/ and server/
npm run typecheck                # tsc --noEmit
npm run db:push                  # Push schema to SQLite (dev shortcut)
npm run db:studio                # Drizzle Studio GUI
```

### Running Individual Tests

```bash
npx vitest run server/__tests__/fixes.test.ts           # Single test file
npx vitest run -t "calculates OT rates"                 # By test name pattern
npx vitest run server/__tests__/batch-helpers.test.ts -t "groupEmployeesByRate"  # File + name
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
├── routes/                 # 32 route files (CRUD, docs, batch, imports, admin)
├── services/               # Business logic (31 modules)
└── pdf/                    # PDFKit generators (9 generators + helpers + types)
    └── fonts/              # NotoSansJP + BIZ UD Mincho
```

**Route files (32 files, grouped by purpose):**
- **Domain CRUD (13):** `companies.ts`, `factories.ts`, `employees.ts`, `contracts.ts`, `contracts-batch.ts`, `documents.ts`, `shift-templates.ts`, `calendars.ts`, `data-check.ts`, `dashboard.ts`, `pdf-versions.ts`, `factory-yearly-config.ts`, `company-yearly-config.ts`
- **Document generation (9):** `documents-generate.ts`, `documents-generate-individual.ts`, `documents-generate-single.ts`, `documents-generate-batch.ts`, `documents-generate-batch-bundle.ts`, `documents-generate-batch-factory.ts`, `documents-generate-batch-ids.ts`, `documents-generate-batch-set.ts`, `documents-generate-batch-utils.ts`
- **Imports (3):** `import.ts`, `import-factories.ts`, `import-koritsu.ts`
- **Admin panel (7)** (token-gated via `ADMIN_TOKEN` env, see `server/middleware/security.ts`): `admin-tables.ts`, `admin-rows.ts`, `admin-sql.ts` (SELECT-only with regex blocklist), `admin-crud.ts` (DELETE blocked on `client_companies`/`factories`/`audit_log`), `admin-stats.ts`, `admin-backup.ts`, `admin-reset.ts` (POST /reset-all — deletes all operational data atomically)

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

**Service modules (30):** `admin-sql`, `admin-stats`, `backup`, `batch-contracts`, `batch-helpers`, `completeness`, `contract-assignment`, `contract-dates`, `contract-number`, `contract-writes`, `dashboard-stats`, `db-utils`, `dispatch-mapping`, `document-files`, `document-generation`, `document-index`, `employee-mapper`, `factory-roles`, `factory-yearly-config`, `haizokusaki-parser`, `import-assignment`, `import-employees`, `import-factories-service`, `import-utils`, `koritsu-excel-parser`, `koritsu-pdf-parser`, `pdf-data-builders`, `pdf-versioning`, `takao-detection`, `validation` (verified: 30 modules)

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
│   ├── query-keys.ts       # Centralized React Query key factory
│   ├── mutation-helpers.ts # Shared toast helpers for mutations
│   ├── shift-utils.ts      # Shift/break time calculations
│   └── hooks/              # React Query CRUD hooks (see table below)
├── stores/
│   └── contract-form.ts    # Zustand: 5-step contract wizard state
├── components/
│   ├── layout/             # root-layout, sidebar, header, command-palette
│   ├── ui/                 # 15 reusable primitives (button, card, dialog, etc.)
│   └── contract/           # 8 wizard step components
└── routes/                 # TanStack file-based routes (see table below)
```

**React Query hooks (`src/lib/hooks/`):**
| Hook | Purpose |
|------|---------|
| `use-companies.ts` | Companies CRUD + list |
| `use-factories.ts` | Factories CRUD + bulk roles/calendars |
| `use-employees.ts` | Employees CRUD + filter by factory |
| `use-contracts.ts` | Contracts CRUD + batch operations |
| `use-data-check.ts` | Completeness matrix queries |
| `use-shift-templates.ts` | Shift pattern CRUD |
| `use-factory-cascade.ts` | Company → Factory → Dept → Line cascade for shouheisha/contracts |
| `use-theme.ts` | Light/dark theme state |
| `use-debounce.ts` | Debounced value utility |
| `use-unsaved-warning.ts` | Unsaved changes guard |

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
| `/contracts/:contractId` | Contract detail + employee assignment editor |
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

### Large Files Warning
- Several route/component files exceed 500 lines. Consider splitting when adding features:
  - `shouheisha.tsx` (1177L) — recruitment bulk for 外国人材, largest route file
  - `companies/-koritsu-components.tsx` (805L), `companies/koritsu.tsx` (768L), `contracts/index.tsx` (786L), `import/-import-page.tsx` (761L), `contracts/batch.tsx` (716L), `admin/-contract-manager.tsx` (708L), `employees/index.tsx` (705L), `settings/index.tsx` (617L), `contracts/mid-hires.tsx` (586L), `contracts/new-hires.tsx` (552L), `history/index.tsx` (538L)
  - Server: `services/koritsu-pdf-parser.ts` (759L), `routes/factories.ts` (644L), `services/import-factories-service.ts` (643L)
- Extract sub-components to separate `-*.tsx` files to keep route files manageable
- Sheet drawers with custom header buttons: use `hideClose` prop on `SheetContent` + `<SheetClose asChild>` for the custom X button (built-in Radix Close overlaps header buttons)
- `closingDayText` and `paymentDayText` are free text (`"当月末"`, `"翌月20日"`), NOT numbers — use the `*Text` schema fields in all UI and API
- **Never auto-modify** `client_companies` or `factories` records programmatically — analyze and present, but wait for explicit user instruction

### Adding New Routes

TanStack Router uses file-based routing in `src/routes/`. Create a new file (e.g., `src/routes/my-page.tsx`) and the route is auto-registered. Use `-` prefix for non-route components (e.g., `-my-component.tsx`). The dev server auto-regenerates `routeTree.gen.ts`.

### Adding New PDF Generators

1. Create generator in `server/pdf/` following the grid-system pattern (see `kobetsu-pdf.ts` or `keiyakusho-pdf.ts`)
2. Use `scripts/excel-to-grid-spec.cjs` to parse Excel template → JSON grid spec
3. Register font as `"JP"` (NotoSansJP) — use `"Mincho"` only for 管理台帳
4. Connect in `server/routes/documents-generate.ts`
5. For details on PDF rules: see `.claude/rules/pdf-rules.md` (auto-injected)

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
- Design reference screenshots in `LUNARIS-exports/dark/` and `LUNARIS-exports/light/` (14 screens each)

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

## Testing

- **Framework:** Vitest (uses `vite.config.ts` implicitly — no separate config)
- **Serial execution:** all test scripts pass `--no-file-parallelism` to avoid SQLite race conditions
- **Test DB isolation:** `DATABASE_PATH=data/kobetsu.test.db` via `cross-env`. `test:prepare` drops/recreates it before every run — `data/kobetsu.db` (production) is never touched by tests
- **Coverage thresholds:** globals 50/50/50/50 (lines/functions/statements/branches), per-file raised: `contract-dates.ts` 95, `batch-helpers.ts` 85, `koritsu-pdf-parser.ts` 80. Coverage include list is scoped to `server/services/**` + `src/routes/companies/-table-*.tsx`
- **Server tests:** `server/__tests__/` (unit + integration with real SQLite)
- **Frontend tests:** colocated with components
- **CI Pipeline:** `.github/workflows/ci.yml` — verify locally with `npm run lint && npm run typecheck && npm run build && npm run test:run`
- **PDF smoke tests:** standalone scripts in project root (see PDF Test Scripts above). Regenerate golden snapshots with `npm run test:pdf-snapshots:update` after changing any generator
- Mocks only for external dependencies — prefer real SQLite for integration tests

## Additional Context & Rules

### Auto-Injected Rules (`.claude/rules/`)

These rules are injected into every session automatically. When they conflict with generic guidance, rules win.

| Rule file | Scope |
|-----------|-------|
| `pdf-rules.md` | Pixel-perfect PDF generation, font rules, 派遣元責任者 roles, 高雄 事業所 logic |
| `domain-rules.md` | Never auto-modify data, Excel trim keys, closingDay/paymentDay are text, cancelled contracts hidden |
| `language.md` | Responses in Spanish, code in English, commits in Spanish |
| `commits.md` | `<type>(<scope>): <description>` format |
| `security.md` | No hardcoded secrets, no `shell=True`, no `.env` commits |
| `typescript.md` | Strict mode, no `any`, naming conventions |
| `python.md` | Type hints, Google docstrings, ruff + mypy |
| `best-practices.md` | MCP-first, 4-layer arch, backward-compatible refactors |
| `architecture.md` | 4-layer separation: Directiva → Contexto → Ejecucion → Observabilidad |
| `user-identity.md` | Developer profile, communication preferences, expertise |
| `ecosystem-usage.md` | MCP-first discovery: skills/agents via MCP before local file reads |
| `memory-engine.md` | antigravity-memory (mem0) as primary memory, not legacy claude-mem |
| `memory-sync.md` | Sync memories to `.claude/memory/` in repo for cross-PC persistence |
| `proactive-memory.md` | Call `memory_suggest` before creating new functions/components |
| `skills-discovery.md` | Search skills.sh before implementing from scratch |
| `AI_MEMORY.md` | Project identity, docs hierarchy, operational reminders |

### Reference Files

| File | Purpose |
|------|---------|
| `MedidasKobetsu.md` | A4 grid spec for 個別契約書 PDF |
| `WORKFLOW_RULES.md` | Workflow methodology — consult for tasks with 3+ steps |
| `ESTADO_PROYECTO.md` | Project state document (Spanish) |
| `Koritsu/` | コーリツ Excel template + 指揮命令者 PDF reference |
| `LUNARIS-exports/` | Design reference screenshots (28 screens) |

## Files NOT to Commit

`data/kobetsu.db*`, `output/*.pdf`, `node_modules/`, `dist/`, `*.local`, `src/routeTree.gen.ts`, `.agent/memory/`, `.agent/metrics/`, `__pycache__/`

> **`.env` excepción:** este repo es **privado**, por lo que `.env` SÍ se versiona (ver `.claude/rules/security.md`). En forks o mirrors públicos, sacar inmediatamente con `git rm --cached .env` y rotar todos los tokens.

---

<!-- ANTIGRAVITY-START -->

## Integracion Antigravity

Proyecto integrado con **Antigravity v6.0.0**.
Instalado por Nexus el 2026-04-08.

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
