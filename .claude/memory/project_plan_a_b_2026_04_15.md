---
name: Plan A + Plan B — Settings/Admin fixes + Database Reset 2026-04-15
description: 5 bug fixes en Settings/Admin + endpoint reset DB + UI Danger Zone
type: project
auto_saved: true
trigger: session
date: 2026-04-15
---

## Que se implemento

### Plan A — 5 bug fixes
- B1: `purgeEmployees()` en api.ts ahora pasa body `{ confirm: "DELETE" }`
- B2: `/admin` route lee `adminMode` de appSettings — muestra pantalla bloqueada si false
- B3: 6 holiday date states en Settings persisten en appSettings (localStorage)
- B4: `handleBulkCalendar()` valida campos vacíos antes de enviar al endpoint
- B5: `AdminCrudTab` en `src/routes/admin/-crud-tab.tsx` — insert/delete con ConfirmDialog, 4 tablas permitidas

### Plan B — Database Reset
- `server/routes/admin-reset.ts`: POST con Zod(`z.literal("RESET")`), transacción atómica, audit_log entry
- `src/lib/api-types.ts`: ResetAllResponse + ResetAllDeletedCounts
- `src/lib/api.ts`: método resetAllData()
- `src/routes/settings/index.tsx`: Danger Zone al final — ConfirmDialog con input RESET, counts del DB, redirect post-reset

## Decisiones tecnicas criticas

- auditLog no tiene enum "RESET_ALL" → usar `action: "delete"` + `entityType: "ALL_TABLES"`
- Counts dentro de la transacción SQLite para evitar race condition (fix post code-review)
- setTimeout de redirect usa useEffect + clearTimeout para cleanup si componente se desmonta
- Tests de admin-reset usan mini Hono app que bypassa adminGuard (guard se testea en su propio test file)
- drift guard test: CLAUDE.md debe reflejar numero correcto de route files (ahora 30)

## Commits clave

- e478785: fin Plan A — fix tipo adminDelete + centralizar tipos en crud-tab
- 6ca5e43: endpoint reset-all + tests (7 tests, 762 total)
- d2d37d1: fix race condition counts dentro de transaction
- 600c2ab: Danger Zone UI en Settings
- fe0ed21: fix cleanup setTimeout con useEffect
