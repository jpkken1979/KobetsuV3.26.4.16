# AGENTS.md — JP-v26.3.25 個別契約書管理システム

Japanese labor dispatch contract management system for ** UNIVERSAL企画，合同会社 (UNS)**. Manages dispatch contracts, employee records, factory configurations, and generates legally-compliant PDF documents per 派遣法第26条.

**Language:** Full-stack TypeScript (ESM modules), **Database:** SQLite at `data/kobetsu.db`

---

## Build / Lint / Test Commands

```bash
# Development
npm run dev           # API (port 8026) + Vite frontend (port 3026) concurrently
npm run dev:server    # API only (tsx watch)
npm run dev:client   # Vite only

# Production
npm run build         # Vite production build
npm run preview       # Preview production build

# Quality checks
npm run lint          # ESLint on src/ and server/
npm run typecheck     # TypeScript (tsc --noEmit)

# Testing
npm run test          # Vitest watch mode
npm run test:run      # Single pass
npm run test:coverage # With coverage thresholds

# Run a single test file or by name pattern:
npx vitest run server/__tests__/batch-helpers.test.ts
npx vitest run -t "groupEmployeesByRate"
npx vitest run src/routes/companies/-table-grid.test.tsx

# PDF smoke tests (write to output/):
npx tsx test-pdf.ts
npx tsx test-keiyakusho-shugyojoken.ts

# Database
npm run db:push       # Push schema to SQLite (dev shortcut)
npm run db:studio    # Drizzle Studio GUI
npm run db:generate   # Generate Drizzle migrations
npm run db:migrate   # Run migrations

# DANGEROUS — never on production:
npm run db:seed:force # Drops/recreates all tables + reloads seed JSON
```

---

## Code Style Guidelines

### TypeScript

- **Strict mode enabled** — no implicit any, no unused variables/parameters
- **Path aliases:** `@/*` → `src/*`, `@server/*` → `server/*`
- Use `??` (nullish coalescing) for rate lookups — NEVER `||` (treats 0 as falsy)

  ```typescript
  // CORRECT — 0 is a valid billing rate
  const rate = employee.billingRate ?? employee.hourlyRate ?? factory.hourlyRate;

  // WRONG — 0 would be treated as falsy
  const rate = employee.billingRate || employee.hourlyRate;
  ```

- **Avoid `any`** — use `unknown` and narrow with type guards
- **Custom errors** extend `Error`, not built-in types

### Imports

- ESM with `.js` extensions in imports (required for ESM modules):

  ```typescript
  import { db } from "../db/index.js";    // ✅ with .js
  import { db } from "../db/index";         // ❌ without
  ```

- **Named exports only** for utilities — avoid default exports for routes/services
- Group imports: external → internal → relative

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| DB columns | `snake_case` | `employee_id`, `factory_id` |
| TypeScript | `camelCase` (vars/functions) | `getEmployeeById` |
| Components | `PascalCase` | `EmployeeSelector` |
| Types/Interfaces | `PascalCase` | `ContractEmployee` |
| Constants | `SCREAMING_SNAKE_CASE` | `VALID_CONTRACT_STATUSES` |
| Contract numbers | `KOB-YYYYMM-XXXX` | `KOB-202603-0001` |

### Error Handling

- All Hono routes wrapped in `try/catch` with JSON error response:

  ```typescript
  try {
    // route logic
  } catch (err) {
    if (err instanceof CustomError) {
      return c.json({ error: err.message }, 400);
    }
    console.error("Unexpected error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
  ```

- Custom error classes (e.g., `ContractValidationError`) for domain-specific errors
- Use `parseIdParam` utility for safe ID parsing from request params

### Hono Router Conventions

- **Literal routes BEFORE parameterized routes** — parameterized routes silently shadow literals

  ```typescript
  router.get("/bulk-roles", handler);  // ✅ literal first
  router.get("/:id", handler);        // parameterized after
  ```

### Database / Drizzle

- Schema defined once in `server/db/schema.ts` — single source of truth
- For new nullable columns, prefer direct `ALTER TABLE` via better-sqlite3 (drizzle-kit push has index issues with SQLite)
- Always use parameterized queries — never string concatenation for user input

### React / Frontend

- **File-based routing** via TanStack Router — pages in `src/routes/`
- **React Query keys** from `src/lib/query-keys.ts` — never raw string arrays:

  ```typescript
  // ✅
  queryClient.invalidateQueries({ queryKey: queryKeys.factories.invalidateAll });
  // ❌
  queryClient.invalidateQueries({ queryKey: ["factories"] });
  ```

- Factory mutations invalidate BOTH `queryKeys.factories` AND `queryKeys.companies` (companies embed factories via `with: { factories }`)
- **Never use `useRef` as a close guard in Radix dialogs** — causes zombie state
- **Never manipulate `document.body.style.overflow`** — Radix handles scroll locking
- **Use `ConfirmDialog`** for destructive actions — never `window.confirm()`
- **Animation library:** `motion` (npm package) — NOT `framer-motion`
- **Tailwind CSS v4:** no `tailwind.config.js` — uses native CSS `@theme {}` in `src/index.css`

### Excel / Import

- Japanese Excel headers often have extra spaces — **always trim**:

  ```typescript
  for (const [key, value] of Object.entries(rawRow)) {
    row[key.trim()] = typeof value === "string" ? value.trim() : value;
  }
  ```

### Rate Priority (CRITICAL — two different rates)

| Concept | DB Column | Meaning | Flow |
|---------|-----------|---------|------|
| 時給 (hourlyRate) | `employees.hourlyRate` | Pay TO worker | UNS → 社員 |
| 単価 (billingRate) | `employees.billingRate` | Charge FROM factory | 派遣先 → UNS |

**On 個別契約書, the 単価 (billingRate) appears — NOT 時給.**

### PDF Generation

- **Fonts:** NotoSansJP registered as `"JP"`, BIZ UD明朝 as `"JP-Mincho"` — do NOT mix
- After Mincho generators, restore `doc.font("JP")` to avoid contaminating multi-page bundles
- Three distinct roles — never mix:

  | DB fields | Japanese role |
  |----------|--------------|
  | `managerUns*` | 派遣元責任者 |
  | `complaintUns*` | 苦情処理担当者 |
  | `hakensakiManager*` | 派遣先責任者 |

### Commit Format

```
<type>(<scope>): <description in Spanish>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Scope in English. Max 72 chars.

---

## Key Architecture Rules

- **Services** (`server/services/`) — pure business logic, NO direct DB access
- **Routes** (`server/routes/`) — handle HTTP, call services, access DB via `db`
- **Zustand stores** (`src/stores/`) — complex form state only; prefer React Query for server state
- **Destructive seed blocked** — `npm run db:seed` requires `--force` flag; `db:seed:force` drops all tables
- **Never auto-modify** factory/company data without explicit user instruction

---

## Files NOT to Commit

`node_modules/`, `dist/`, `data/kobetsu.db*`, `output/*.pdf`, `.env`, `.env.*`, `*.local`, `src/routeTree.gen.ts`

---

<!-- ANTIGRAVITY-AGENTS-START -->

## Integracion Antigravity

- Runtime local: `.agent/` contiene agentes, skills, workflows, core y servidores MCP.
- Claude Code: usa `.claude/settings.json` en modo ligero y resuelve capacidades por MCP.
- Codex: usa `AGENTS.md` del repo y, si el inyector detecta Codex, sincroniza skills curadas, skills propias de Antigravity y comandos portables como `finalize` en `~/.codex/skills`.
- MiniMax: si detectamos Claude Code o Codex, el inyector puede integrar también las skills oficiales de `MiniMax-AI/skills`.
- MCP universal: revisa `.mcp.json`, `.cursor/mcp.json`, `.windsurf/mcp.json`, `.vscode/mcp.json` y `.zed/settings.json`.
- Memoria: `antigravity-memory` (mem0) y la memoria del proyecto en `ESTADO_PROYECTO.md`.
- Reglas compartidas: `RULES.md`, `WORKFLOW_RULES.md`, `.antigravity/rules.md`.

<!-- ANTIGRAVITY-AGENTS-END -->
