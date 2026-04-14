# ESTADO DEL PROYECTO — JP個別契約書v26.3.25

> Última actualización: 2026-04-14

---

## Resumen Ejecutivo

| Componente | Estado | Versión | Nota |
|---|---|---|---|
| Core | ✅ Estable | 26.3.31 | 643 tests, WCAG completo, audit trail completo |
| Admin Panel | ✅ Activo | — | 6 routers admin-* con token-gate vía `ADMIN_TOKEN` |
| Tests aislados | ✅ Nuevo | — | `data/kobetsu.test.db` separada — `npm test` ya no destruye la DB real |
| Versionado PDFs | ✅ Nuevo | — | Tabla `pdf_versions` con SHA256 + audit; integrado en `documents-generate-single.ts` |
| Snapshot tests PDFs | ✅ Nuevo | — | 9 hashes golden con mock determinista |
| Drift guard | ✅ Nuevo | — | `claude-md-drift.test.ts` previene descalce CLAUDE.md ↔ código |

## Estado Canónico Actual

- El estado vigente del repo es el de la **sesión 2026-04-07b** (pendientes resueltos) y sus verificaciones asociadas.
- El sistema está estable y verificado en `typecheck` y `test:run` (35 archivos, 643 tests).
- **Audit confirmó paridad byte-exacta entre v1 y v3** en los 7 dominios críticos. v3 NO tiene regresiones funcionales vs v1; ver `.claude/memory/discovery_v1_v3_parity.md`.
- Pendientes vigentes no bloqueantes:
	- ~~refactorizar logica de import routes a services~~ → resuelto: `import-employees.ts` e `import-factories-service.ts` creados (28 servicios total)
	- ~~evaluar migracion Vite 8~~ → ya en Vite 8 (CLAUDE.md decía 6 por drift)
	- ~~verificar y eliminar pdf-lib si no se usa~~ → eliminado de package.json y CLAUDE.md
	- ~~7 rutas sin EmptyState para listas vacías~~ → resuelto en 6 rutas (companies, data-check, documents, batch, new-hires, mid-hires)
	- ~~estrategia explícita de deprecación para payload legacy (`employeeIds`)~~ → resuelto: headers RFC 7234 (`Deprecation: true` + `Warning: 299`) en POST/PUT /api/contracts
	- ~~replicar `recordPdfVersion()` en las 4 rutas restantes~~ → resuelto (bundle, set, factory, ids)
	- decidir estrategia de backup remoto (Litestream o `cp` con rotación) — **requiere decisión del usuario**
- Los bloques históricos más abajo se conservan como bitácora de sesión; si contradicen este resumen, prevalece esta sección y la sesión más reciente.

## Sesión 2026-04-14 — Audit-pro security + Excel import + light mode

**Audit-pro:** 11 fases, 1 CRITICAL (SQL injection admin-sql), 4 HIGH, 10 MEDIUM, 6 LOW. Todos resueltos.

**Seguridad:** admin-sql regex -> stmt.reader; admin guard requiere token siempre; CORS x-admin-token; path confinement backup; timingSafeEqual; readFileSync -> async en 5 rutas docs.

**Tests:** admin-sql.test.ts (18 tests) + dashboard-stats.test.ts (34 tests). Coverage: admin-sql 0%->100%, dashboard-stats 25%->100%.

**Bug Excel parser:** Row 1 del Excel tenía headers mergeados (基本情報, 派遣先責任者...). Parser ahora detecta "会社名" como ancla. El Excel de 中山 ya estaba importado en DB.

**Bug light mode:** Tabla CompanyTableGrid usaba background transparente. Fix: bg-background en area scrolleable.

**Pendiente no bloqueante:** CLAUDE.md dice 8 tablas, hay 9 (falta pdfVersions). npm audit CVEs en esbuild/drizzle-kit (dev-only).

**Tests:** 755/755 ✅ | Typecheck ✅ | Lint 19 warnings (preexistentes) ✅

## Sesión 2026-04-14 (tarde) — UI/UX Modernización LUNARIS v2

**Alcance:** Cirugía + polish completo — 13 tasks con subagent-driven development (spec+quality review por task).

**Fase 1 — Bugs dark/light mode (8 bugs):**
- `index.css`: 3 keyframes `rgba(5,150,105,...)` → `color-mix(in srgb, var(--color-primary) N%, transparent)`
- `sidebar.tsx`: `hover:bg-white/10` → `bg-muted/50`, footer `bg-white/[0.03]` → `bg-muted/30`, status dot `bg-emerald-500` → `bg-primary`
- `button.tsx`: variante `success` → tokens `bg-success text-success-foreground`
- `badge.tsx` + `confirm-dialog.tsx`: paleta `red-*` → `bg-destructive/10 text-destructive`
- `input.tsx`: `aria-invalid={error ? true : undefined}` en ambos branches

**Fase 2 — Dashboard:**
- Skeleton loaders: `StatCardSkeleton`, `DashboardSkeleton`, `ChartSkeleton` reemplazan spinners
- `NumberTicker`: faltaba `useReducedMotion()` — corregido
- Hover states en StatCard: `whileHover={{ scale: 1.02, y: -2 }}` + `whileTap`
- Stagger animation en 3 listas de alertas (expiring, teishokubi, visa)

**Fase 3 — Contratos + Empleados:**
- Stagger en tabla de contratos (`motion.tbody` + `motion.tr`, `staggerChildren: 0.05`)
- `aria-live="polite"` en bulk action bar de contratos
- Stagger compatible con `useVirtualizer` en empleados (motion.tr individual, sin staggerChildren)
- Auditoría page transitions: 8 rutas ya tenían `<AnimatedPage>` — sin cambios

**Fix post-review:** `<Fragment key={group.key}>` en groupedContracts.map; hardcodes residuales `red-*`/`emerald-*` en dashboard-alerts → tokens; `ChartSkeleton` shadow → `shadow-[var(--shadow-card)]`

**Tests:** 755/755 ✅ | Typecheck ✅ (cero errores nuevos) | Push: `704ae0e..8602acc`

---

## Sesión 2026-04-09b — Audit-pro fixes: chart colors + typing

**Refactor:** Centralización de paleta Recharts en `src/lib/chart-colors.ts` (`CHART_COLORS`). Removidos arrays locales `COLORS` y `PIE_COLORS` de `-dashboard-charts.tsx` y `-stats-dashboard.tsx`. Tipado `_raw: Contract` correctamente importado en `-contract-table.tsx`. CLAUDE.md actualizado con 3 archivos de servidor grandes.

**Commit:** `57884dc` (charts refactor)

**Tests:** 686/686 ✅ | Typecheck ✅ | Lint 0 errores ✅

---

## Sesión 2026-04-09 — Enhanced Mid-Hires: auto-period + preview agrupado

**Feature:** Flujo `/contracts/mid-hires` mejorado con cálculo automático de período desde `company.conflictDate`. Jerarquía de 抵触日: `override manual > factory.conflictDate > company.conflictDate`. Preview agrupado por fábrica con 抵触日 editable inline y exclusión por checkbox. Empresa ahora tiene campos `conflictDate`/`contractPeriod` editables en el dialog de empresas.

**Commits clave:** `01ff4fa` (schema) → `aaa9f47` (analyzeMidHires) → `da64af8` (mid-hires Step 1) → `12b77b8` (preview component) → `ce41ef5` (fixes timezone/tests/Zod)

**Tests:** 686/686 ✅ | Typecheck ✅ | Lint ✅

---

## Sesión 2026-04-08 — conflictDateOverride + auditoría imports + 3 fixes

**Feature:** Campo `conflictDateOverride` nullable por contrato para soportar contratos históricos retroactivos con 抵触日 distinta a la de la fábrica. Toggle en Step 2 del wizard, resolver en PDF (`??` nullish), validación server-side actualizada, detalle de contrato muestra `(個別設定)`.

**Fixes de auditoría:**
1. `pdf-lib` instalado + `PDFPage` tipado en `batch-utils.ts`
2. `normalizeJpDateString()` en `import-factories-service.ts` — normaliza Date/YYYY/MM/DD a ISO
3. Validación de headers de sheet en `-import-modal.tsx` — bloquea import silencioso con sheet equivocada
4. `待機中` → `onLeave` en `import-employees.ts`

**Auditoría Excel:** ambos archivos reales auditados (`企業データ一覧`, `社員台帳`), sin errores bloqueantes.

**Tests:** 703/703 ✅ | Build ✅ | Typecheck ✅

---

## Sesión 2026-04-07c — Bugfix edición de fábricas

**Bug:** No se podía editar fábricas en la página /companies.

**Root cause (2 bugs combinados):**
1. `handleEditFactory` en `index.tsx` no seteaba `selectedCompany` → el bloque `{selectedCompany && <FactoryEditor>}` nunca renderizaba
2. `FactoryEditor` no tenía `useQuery` + `useEffect` para cargar datos existentes (campos siempre vacíos)

**Fix:** Reemplazado `FactoryEditor` por `FactoryDrawer` (que ya implementa correctamente el fetch de datos) + `handleEditFactory` ahora busca la empresa dueña iterando `companies`.

**Verificación:** typecheck exit 0 · lint exit 0 · 35 archivos, 643 tests passed

---

## Sesión 2026-04-07b — Pendientes resueltos + backup con rotación

**Acciones realizadas:**
- `recordPdfVersion` replicado en 4 rutas batch (bundle, set, factory, ids)
- `pdf-lib` eliminado de package.json y CLAUDE.md (no se usaba en source)
- EmptyState agregado en 6 rutas (companies, data-check, documents, batch, new-hires, mid-hires)
- Deprecación `employeeIds` via headers RFC 7234 (`Deprecation: true` + `Warning: 299`) en POST/PUT /api/contracts
- Refactor import routes → 2 nuevos servicios: `import-employees.ts` + `import-factories-service.ts` (28 módulos total)
- Backup automático con rotación: `BACKUP_KEEP_COUNT` (default 10), `BACKUP_INTERVAL_HOURS` (default 24h), jitter 0–30min
- 2 lint errors corregidos en `koritsu-preview.test.ts` (prefer-const, no-useless-assignment)

**Verificación:**
- `npm run typecheck` → exit 0
- `npm run lint` → exit 0 (0 errors, 0 warnings)
- `npm run test:run` → 35 archivos, 643 tests passed

---

## Sesión 2026-04-07 — Audit v1↔v3 + Fase 1-3 completas

**Acciones realizadas:**

Audit (7 agentes Explore en paralelo, todos confirmaron paridad):
- contract-dates: byte-idéntico (28 tests)
- batch-helpers + batch-contracts: byte-idéntico (9 tests)
- Koritsu parsers: MD5 idéntico (42 cases)
- 9 generators PDF: 4075 LOC iguales
- Factory wizard + Contract wizard: paridad completa
- Schema DB + admin panel: idéntico, mismo middleware seguridad
- Sellos 印鑑 + sharp: sharp NUNCA existió en ninguna versión (drift documental heredado)

Fase 1 — Sangrado urgente:
- Backup `data/kobetsu.db.bak-pre-audit-20260407-162645`
- `npm test` no destructivo: `cross-env` + `DATABASE_PATH=data/kobetsu.test.db` en `db/index.ts`, `seed.ts` y scripts
- `.env` creado con `ADMIN_TOKEN` random (32 bytes hex)
- `CLAUDE.md` sincronizado: Drizzle 0.45, Vite 8, TS 6, Vitest 4, sin `sharp`, conteos correctos

Fase 2 — Mejoras reales:
- Migration `0002_business_constraints.sql`: triggers BEFORE INSERT/UPDATE para `contracts.end_date >= start_date` y `employees.billing_rate >= hourly_rate` (UNS margin no negativo)
- Snapshot tests PDFs: 9 hashes SHA256 + mock determinista (`Math.random=0.5`, fake timer, normalización de PDFKit dates)
- Coverage thresholds por archivo: 95% `contract-dates.ts`, 85% `batch-helpers.ts`, 80% `koritsu-pdf-parser.ts`
- `validation.ts` extendido: `validateContractForPdf()` (jobDescription/safetyMeasures/terminationMeasures/dates) + check de `conflictDate` ya vencido

Fase 3 — Diferenciación:
- Versionado de PDFs: tabla `pdf_versions` (10 columnas, self-FK), migration `0003`, `services/pdf-versioning.ts` (recordPdfVersion/listPdfVersions/getPdfVersion), router `pdf-versions.ts`, integrado en `documents-generate-single.ts` como patrón
- Preview-diff Koritsu: backend ya tenía dry-run; agregado `use-koritsu-import.ts` (hook React Query) + 11 tests
- Drift guard: `claude-md-drift.test.ts` cuenta routers/services y bloquea reaparición de `sharp`

**Verificación final:**
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm run test:run` → 35 archivos, 643 tests passed (16s)
- DB de tests aislada en `data/kobetsu.test.db`; `data/kobetsu.db` intacta

**Memoria de la sesión:** `.claude/memory/session_2026-04-07.md`

---

## Sesión 2026-04-02 — Finalize (commit + push)

**Acciones realizadas:**
- Se registran en git los planes de trabajo pendientes en `docs/superpowers/plans/`.
- Se actualiza esta memoria de proyecto para reflejar el estado de cierre de sesión.
- Se empuja la rama actual a `origin/main`.

**Archivos incluidos en commit de cierre:**
- `ESTADO_PROYECTO.md`
- `docs/superpowers/plans/2026-04-01-kobetsuv2-fase4.md`
- `docs/superpowers/plans/2026-04-02-admin-database-panel.md`

---

## Sesión 2026-04-02 — Admin Database Panel Completo

Branch `feature/admin-database-panel` con 3 commits (Phase 1+2+3+4).

**Implementado:**
- Tab 1 Tables: admin-tables.ts + admin-rows.ts + table-explorer.tsx
- Tab 2 SQL: admin-sql.ts + -sql-runner.tsx con presets y validacion
- Tab 3 CRUD: admin-crud.ts + -crud-dialog.tsx generico con campos dinamicos
- Tab 4 Contracts: -contract-manager.tsx con bulk cancel/renew + renew chain
- Tab 5 Employees: -employee-manager.tsx con bulk assign/status + Excel export ExcelJS
- Tab 6 Backup: admin-backup.ts + -backup-manager.tsx con restore + SQL dump export
- Tab 7 Stats: admin-stats.ts + -stats-dashboard.tsx con BarChart/PieChart Recharts
- Tab 8 Audit: -audit-explorer.tsx con filtros avanzados

**Backend routers:** admin-tables, admin-rows, admin-sql, admin-crud, admin-backup, admin-stats
**Hooks:** useAdminTables, useAdminRows, useAdminSql, useAdminCrud, useAdminBackup, useAdminStats, useAdminColumns

**Verificacion:** 609 tests, 0 errores TS. PR listo en GitHub.

## Sesión 2026-04-01 — Audit-Pro Exhaustivo + 27 Fixes + 75 Tests

### Auditoria completa (11 dimensiones)

Resultado: CRITICAL=1 HIGH=14 MEDIUM=20 LOW=10 INFO=4 — 27 corregidos en esta sesión.

### Correcciones aplicadas

| Área | Fix | Archivos |
|---|---|---|
| CRITICAL routing | Reordenado post("/") antes de get("/:factoryId") en calendars | `calendars.ts` |
| WCAG 2.3.3 | useReducedMotion en 10 componentes (0 restantes) | 10 archivos src/ |
| Design system | 49 p-5 eliminados (LUNARIS v2 compliant) | 21+ archivos src/ |
| Seguridad | Zod validation en 3 endpoints sin schema | `employees.ts`, `factories.ts`, `documents.ts` |
| Types | api-types.ts sincronizado con schema DB | `api-types.ts` |
| Bug | || corregido a ?? en rate display (rate=0) | `-document-generator.tsx` |
| Performance | Default limit 500 en GET /employees | `employees.ts` |
| Cleanup | 3 console.error eliminados, lint warning corregido | `import.ts`, `contracts.ts` |
| Docs | AI_MEMORY.md ruta obsoleta corregida | `AI_MEMORY.md` |

### Tests nuevos (75 tests en 5 archivos)

| Archivo | Tests | Cobertura |
|---|---|---|
| `batch-contracts.test.ts` | 10 | Tipos y estructura batch |
| `calendars.test.ts` | 11 | POST/GET validation, upsert |
| `contracts-mutations.test.ts` | 20 | CRUD completo + purge |
| `pdf-data-builders.test.ts` | 17 | 7 builders con datos reales |
| `document-generation.test.ts` | 17 | buildCommonData, shifts, rates |

### Verificación

| Check | Resultado |
|---|---|
| TypeScript | ✓ sin errores |
| ESLint | ✓ sin errores, sin warnings |
| Vitest | ✓ 28 files, 578 passed, 1 skipped |

---

## Sesión 2026-04-02 — Fase 5 Dashboard Polish + audit-pro

### Resultado
- Commit: `135629e` (dashboard polish — 14 archivos violets/indigos/purples → blue/cyan)
- Commit: `3358409` (chore deps + skipped test eliminado)
- Tests: 609 passed, 0 skipped, 0 TS errors

### Correcciones aplicadas
| Área | Fix |
|---|---|
| Design system | Violets/indigos/purples → blue/cyan en 14 archivos (CLAUDE.md rule) |
| Dependencias | @tanstack/react-query, vite@6.4.1, @vitejs/plugin-react actualizados |
| Tests | Skipped auth test eliminado (local-first app, no auth middleware) |
| Dev server | Vite 8→6.4.1 pinned, clean reinstall resuelto |

---

## Sesión 2026-04-02 — Split archivos grandes

### Resultado
- Commit: `6820f73` (refactor(ui): split large route components into helper modules)
- Tests: 609 passed, 0 TS errors

### Correcciones aplicadas
| Área | Fix | Archivos |
|---|---|---|
| Refactor | contracts/index.tsx 874→762L: extraídos -columns, -helpers, -skeleton | 3 archivos nuevos |
| Refactor | import/-import-page.tsx 840→754L: extraídos -import-helpers.ts | 1 archivo nuevo |
| Bug fix | BLOCKED_KEYS huérfano en helpers (faltaba `= new Set(...)`) | `-import-helpers.ts` |
| Bug fix | MAX_IMPORT_FILE_SIZE/ROWS no estaban en import de import-page | `-import-page.tsx` |
| Cleanup | ImportResult, EmployeeDiffResult, Cell, Worksheet eliminados (no usados) | `-import-page.tsx` |

---

## Sesión 2026-03-29 — Audit-Pro + Workflow Audit + Fixes

### Audit-Pro (11 dimensiones)

- 0 CRITICAL, 5 HIGH, 9 MEDIUM, 7 LOW — todos resueltos
- Core app limpio: 0 `any`, 0 `console.log`, 0 TODOs
- Security issues en `.agent/` corregidos (eval→ast.literal_eval, sandbox secrets→env vars, CORS wildcard removido)

### Workflow Audit (12 workflows)

- 32 checks consistentes, 3 bugs encontrados y corregidos, 8 gaps resueltos

### Fixes aplicados

| Área | Fix | Archivos |
|---|---|---|
| BUG data-check | Export headers calificados para round-trip correcto | `data-check.ts` |
| BUG data-check | Audit log movido dentro de transacción | `data-check.ts` |
| BUG wizard | endDate capea conflictDate en useEffect | `date-calculator.tsx` |
| UX useTheme | Migrado de useState a Zustand store (estado compartido) | `use-theme.ts` |
| UX a11y | 3 aria-labels + contraste dark mode mejorado | `factory-roles-header.tsx`, `table-controls.tsx` |
| Query cache | Invalidación companies faltante en data-check import | `-export-import.tsx` |
| Audit trail | 7 audit logs en 6 endpoints que no tenían | `documents-generate.ts`, `shift-templates.ts`, `factories.ts` |
| Docs | Eliminadas referencias falsas a Basic Auth (4 archivos) | `README.md`, `AGENTS.md`, `architecture.md`, `AI_MEMORY.md` |
| Docs | 7 features no documentadas agregadas | `docs/architecture.md` |
| Security .agent/ | eval→ast.literal_eval, shell=False, path traversal validation | 5 archivos Python |
| Cleanup | 69 unused imports removidos via ruff F401 | 56 archivos .agent/ |

### Verificación

| Check | Resultado |
|---|---|
| TypeScript | ✓ sin errores |
| ESLint | ✓ sin errores |
| Vitest | ✓ 17 files, 390 passed, 1 skipped |

---

## Sesión 2026-03-25 — Sync documental + arquitectura real

### Cambios realizados

| Área | Estado | Archivos |
|---|---|---|
| README raíz | **CREADO** — onboarding corto, stack, scripts, workflows y links a docs | `README.md` |
| AGENTS.md | **ACTUALIZADO** — estructura real, 8 tablas, rutas backend/frontend y tooling actual | `AGENTS.md` |
| Estado operativo | **ACTUALIZADO** — reflejado el estado real de la documentación y arquitectura | `ESTADO_PROYECTO.md` |
| Arquitectura | **CREADA** — documento dedicado con módulos, workflows y diagramas | `docs/architecture.md` |
| Changelog documental | **CREADO** — checklist y registro de mantenimiento de docs | `docs/documentation-changelog.md` |
| Docs auxiliares | **ALINEADAS** — `CLAUDE.md`, `GEMINI.md` y `RULES.md` ya respetan las docs reales del repo y eliminan contradicciones operativas | `CLAUDE.md`, `GEMINI.md`, `RULES.md` |
| Reglas secundarias | **LIMPIADAS** — se corrigieron reglas genéricas que asumían Electron, Nexus, Prettier obligatorio o workflows Python ajenos al repo | `WORKFLOW_RULES.md`, `.antigravity/rules.md`, `.claude/rules/commits.md`, `.claude/rules/typescript.md`, `.claude/rules/security.md` |
| Memoria y reglas de contexto | **CORREGIDAS** — `AI_MEMORY.md` ya describe este repo real y no OpenAntigravity; reglas de dominio/ecosistema apuntan a la documentación correcta | `.claude/rules/AI_MEMORY.md`, `.claude/rules/domain-rules.md`, `.claude/rules/ecosystem-usage.md` |

### Hallazgos confirmados

| Tema | Hallazgo |
|---|---|
| README principal | No existía un `README.md` raíz canónico para onboarding |
| Documentación principal | `AGENTS.md` era la fuente más completa, pero estaba parcialmente desactualizada |
| Schema real | El proyecto tiene **8 tablas**, incluyendo `shift_templates` |
| Rutas nuevas | Existen workflows no bien reflejados en docs previas: `contracts-batch`, `documents-generate`, `data-check`, `import-factories`, `import-koritsu`, `new-hires` |
| Tooling | Sí existe `eslint.config.js`; la animación actual usa `motion`, no `framer-motion` |
| Docs genéricas | Había instrucciones ecosistema/genéricas que contradecían reglas reales del repo (`ARCHITECTURE.md`, `Co-Authored-By`, Prettier asumido) |
| Reglas heredadas | Había archivos secundarios apuntando a `nexus-app`, Electron IPC/preload y validaciones Python/pytest como si fueran universales |
| Memoria heredada | `AI_MEMORY.md` estaba describiendo otro proyecto (`OpenAntigravity`) con Tauri, gateway 4747 y métricas ajenas a JP個別契約書 |

### Estado documental actual

| Documento | Rol |
|---|---|
| `README.md` | onboarding rápido para humanos |
| `AGENTS.md` | mapa técnico/operativo profundo |
| `ESTADO_PROYECTO.md` | historial y estado de cambios relevantes |
| `docs/architecture.md` | arquitectura funcional y workflows |
| `docs/documentation-changelog.md` | mantenimiento y criterios de actualización |

### Verificación ejecutada

| Check | Resultado |
|---|---|
| Revisión de `package.json` | **COMPLETADO** |
| Revisión de `server/index.ts` y rutas | **COMPLETADO** |
| Revisión de `server/db/schema.ts` | **COMPLETADO** |
| Revisión de frontend routes y stores | **COMPLETADO** |
| Contraste documentación ↔ código | **COMPLETADO** |

---

## Sesión 2026-03-16 — Cleanup + Refactor (conflictWarningDays + split de archivos grandes)

### Cambios realizados

| Área | Fix | Archivos |
|---|---|---|
| conflictWarningDays → servidor | `/stats` y `/expiring` aceptan `warningDays` param — setting ya afecta al dashboard | `dashboard.ts`, `api.ts`, `routes/index.tsx` |
| Label dinámico en StatCard | "30日以内" → `${conflictWarningDays}日以内` — refleja la configuración real | `src/routes/index.tsx` |
| Refactor contracts.ts | 899 LOC → 372 LOC (CRUD) + 535 LOC (batch en contracts-batch.ts) | `contracts.ts`, nuevo `contracts-batch.ts` |
| Refactor documents.ts | 945 LOC → 185 LOC (catalog) + 794 LOC (generate en documents-generate.ts) | `documents.ts`, nuevo `documents-generate.ts` |

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `npm run typecheck` | **COMPLETADO** — Sin errores |
| `npm run lint` | **COMPLETADO** — Sin errores |
| `npm run test:run` | **COMPLETADO** — 184/184 tests pasando |
| `npm run build` | **COMPLETADO** |

---

## Sesión 2026-03-16 — Auditoría v2 + bugfix críticos (21 fixes, 11 tests nuevos)

### Cambios realizados

| Área | Fix | Archivos |
|---|---|---|
| PDF-1 billingRate `??` | `||` trataba 0 como null — documentos legales mostraban ¥0 erróneo | `keiyakusho-pdf.ts`, `hakenmotokanridaicho-pdf.ts` |
| PDF-2 managerUnsName con título | kobetsu-pdf mostraba solo nombre, otros PDFs mostraban `役職　名前` | `kobetsu-pdf.ts` |
| PDF-3 派遣先責任者 sin fallback | Fallback a 指揮命令者 mezclaba dos roles legales distintos | `hakensakikanridaicho-pdf.ts` |
| FE-3 Deduplicación rate groups | `Set<number>` de IDs vistos evita enviar mismo employeeId dos veces | `employee-selector.tsx` |
| FE-1 Error tracking por contrato | try/catch individual por rate group — feedback de contratos parciales | `employee-selector.tsx` |
| FE-4 endDate stale al cambiar factory | useEffect recalcula endDate cuando cambia contractPeriod/conflictDate | `date-calculator.tsx` |
| API-1 Race condition contract number | generateContractNumber movida DENTRO de sqlite.transaction() | `contracts.ts` |
| COD-2 PATCH contrato cancelado | 409 si se intenta editar contrato con status='cancelled' | `contracts.ts` |
| API-2 limit/offset sin clamp | Clampado a 1–500 en endpoint /audit | `dashboard.ts` |
| API-3 Holidays sin validación | Regex YYYY-MM-DD + isNaN check antes de persistir | `calendars.ts` |
| API-4 bulk-roles sin Zod | Zod schema reemplaza destructuring manual | `factories.ts` |
| DB-3 Índices en factories | `idx_factories_is_active`, `idx_factories_conflict_date` para batch queries | `schema.ts` |
| COD-1 sixtyHourRate 150% | 労基法第37条: tasa 1.5x para horas >60h/semana añadida a RateGroup | `batch-helpers.ts` |

### Tests añadidos (11 nuevos — total 184)

| Archivo | Tests | Qué documenta |
|---|---|---|
| `batch-helpers.test.ts` | +11 | sixtyHourRate (3), checkExemption rules: 請負 dept, 高雄工業, empresa normal (8) |

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `npm run typecheck` | **COMPLETADO** — Sin errores |
| `npm run lint` | **COMPLETADO** — Sin errores |
| `npm run test:run` | **COMPLETADO** — 184/184 tests pasando |
| `npm run build` | **COMPLETADO** — ExcelJS en chunk separado |

---

## Sesión 2026-03-16 — Auditoría integral + bugfix críticos/altos

### Cambios realizados

| Área | Fix | Archivos |
|---|---|---|
| C-1 `key` dinámico en FactoryPanel | React reutilizaba instancia entre empresas (stale state) | `companies/index.tsx` |
| C-2 HTTP status correcto en PDFs | 207/500 en lugar de 200 cuando fallan PDFs legales | `documents.ts` |
| C-3 `sqlite.transaction()` en import | Rollback atómico — antes 199/392 rows podían quedar a medias | `import.ts` |
| C-6 Path confinement en download | Post-resolve check + null byte strip en filename param | `document-files.ts`, `documents.ts` |
| H-1 Null guard en PUT /contracts | 404 si transaction devuelve null en lugar de `c.json(null)` 200 | `contracts.ts` |
| H-3 Toast con errores silenciados | `onSuccess` verifica `summary.errors` — toast.warning si hay errores | `use-contracts.ts`, `api.ts` |
| H-6 N+1 en analyzeBatch | 152 queries → 1 bulk query con `inArray` (76 fábricas) | `batch-helpers.ts`, `contracts.ts` |
| H-7 N+1 en generate-batch | Loop secuencial → `inArray` bulk query | `documents.ts` |
| H-8 ExcelJS en main bundle | ExcelJS (939 KB) movido a chunk separado | `vite.config.ts` |
| H-13 Zod en bulk-delete/purge | `bulkIdsSchema` reemplaza casting manual `as { ids: number[] }` | `contracts.ts` |
| C-5/C-7/H-9 Tests críticos | 42 nuevos tests — cadena rates, assignments, factory lookup | 3 nuevos archivos test |

### Tests añadidos (42 nuevos)

| Archivo | Tests | Qué documenta |
|---|---|---|
| `employee-mapper.test.ts` | 10 | Rate chain: junction > billingRate > hourlyRate, edge case billingRate=0 |
| `contract-writes.test.ts` | 13 | buildContractEmployeeRows: assignments vs ids, array vacío, null rates |
| `import-assignment.test.ts` | 19 | resolveFactoryAssignment: regla dept+line vacíos → null, exact match, fallback |

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `npm run typecheck` | **COMPLETADO** — Sin errores |
| `npm run lint` | **COMPLETADO** — Sin errores |
| `npm run test:run` | **COMPLETADO** — 173/173 tests pasando |
| `npm run build` | **COMPLETADO** — ExcelJS en chunk separado |

---

## Sesión 2026-03-16 — Refactor cleanup: dead code + split companies/index.tsx

### Cambios realizados

| Área | Estado |
|---|---|
| `src/lib/api.ts` — union type | **COMPLETADO** — `employees?: any[]` → `(Employee \| ContractEmployee)[]` |
| `src/routes/history/index.tsx` — narrowing | **COMPLETADO** — `'fullName' in emp` discriminated union guard |
| `server/__tests__/services.test.ts` | **COMPLETADO** — Eliminados 3 describe blocks de código muerto (64 → 36 tests) |
| `server/__tests__/fixes.test.ts` | **COMPLETADO** — Eliminados 2 describe blocks de código muerto (63 → 59 tests) |
| `server/services/contract-logic.ts` | **ELIMINADO** — 122 LOC, solo importado en tests |
| `server/services/rate-calculator.ts` | **ELIMINADO** — 49 LOC, solo importado por contract-logic |
| `server/services/batch-helpers.ts` | **COMPLETADO** — Añadido `buildBatchContext()` como patrón unificado |
| `server/routes/contracts.ts` | **COMPLETADO** — `analyzeBatch` + `analyzeNewHires` usan `buildBatchContext` |
| Split `companies/index.tsx` (2027 LOC → 318 LOC) | **COMPLETADO** — 6 sub-componentes extraídos |

### Sub-componentes creados

| Archivo | LOC | Contenido |
|---|---|---|
| `-factory-card.tsx` | 241 | `FactoryCard` + `QuickEditField` |
| `-shift-manager.tsx` | 193 | `ShiftManager` |
| `-company-card.tsx` | 136 | `CompanyCard` |
| `-bulk-edit-modal.tsx` | 242 | `BulkEditModal` |
| `-factory-drawer.tsx` | 586 | `FactoryDrawer` (4 tabs) |
| `-factory-panel.tsx` | 311 | `FactoryPanel` (panel flotante) |

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `npm run typecheck` | **COMPLETADO** — Sin errores |
| `npm run lint` | **COMPLETADO** — Sin errores |
| `npm run test:run` | **COMPLETADO** — 131/131 tests pasando |

---

## Sesión 2026-03-16 — Editor jerárquico de roles por fábrica

### Cambios realizados

| Área | Estado |
|---|---|
| Service `factory-roles.ts` | **COMPLETADO** — Detección de roles compartidos (majority vote) + bulk update con exception safety |
| API endpoints | **COMPLETADO** — `GET /role-summary/:companyId` + `PUT /bulk-roles` con `excludeLineIds` |
| Componente `FactoryRolesHeader` | **COMPLETADO** — Inline edit de 4 roles + 2 addresses por fábrica con ConfirmDialog |
| Integración en FactoryPanel | **COMPLETADO** — Panel visible entre header de fábrica y cards de líneas |
| Tests | **COMPLETADO** — 6 tests unitarios (shared, override リフト, single line, majority vote, address, null) |
| Fix botón X | **COMPLETADO** — z-10 + stopPropagation + body.overflow cleanup + onClick fallback |
| Fix contraste modo claro | **COMPLETADO** — Fondo indigo-50, textos green-600/red-500, gray-900 bold |

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `npm run typecheck` | **COMPLETADO** — Sin errores |
| `npm run lint` | **COMPLETADO** — Sin errores |
| `npm run test:run` | **COMPLETADO** — 163/163 tests pasando |
| `npm run build` | **COMPLETADO** — Build exitoso |

### Archivos creados (3)
- `server/services/factory-roles.ts` — Service con `detectSharedRoles()` + `bulkUpdateFactoryRoles()`
- `server/__tests__/factory-roles.test.ts` — 6 tests unitarios
- `src/routes/companies/-factory-roles-header.tsx` — Componente UI con inline edit

### Archivos modificados (5)
- `server/routes/factories.ts` — 2 endpoints nuevos
- `src/lib/api.ts` — Tipos + métodos API
- `src/lib/query-keys.ts` — Key `roleSummary`
- `src/lib/hooks/use-factories.ts` — Hooks `useFactoryRoles` + `useBulkUpdateRoles`
- `src/routes/companies/index.tsx` — Integración + fix X + fix body.overflow

### Resultado operativo

- Edición de 派遣先責任者, 苦情処理, 派遣元責任者 a nivel fábrica con propagación automática a todas las líneas
- Excepciones (ej: リフト作業 con 安藤) se preservan automáticamente via `excludeLineIds`
- Sin migración de schema — UI-only approach (Option A)

---

## Sesión 2026-03-15 — Auditoría integral de código y producto

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `npm run typecheck` | **COMPLETADO** — Sin errores |
| `npm run lint` | **COMPLETADO** — Sin errores |
| `npm run test:run` | **COMPLETADO** — 146/146 tests pasando |
| `npm run build` | **COMPLETADO** — Build exitoso, con warnings de bundles grandes y CSS/Tailwind |

### Hallazgos relevantes

| Área | Hallazgo |
|---|---|
| Selección de empleados | **RIESGO ALTO** — El wizard de contratos aún permite seleccionar "同企業の他の社員", rompiendo la regla de asignación estricta por factory/line. |
| Duplicación de asignaciones | **RIESGO ALTO** — `selectedByRate` mezcla `employees` y `companyEmployees` sin deduplicar; puede enviar un mismo empleado dos veces al crear contrato. |
| Importador Excel | **RIESGO ALTO** — Sigue infiriendo `factoryId` por `resolvedFactoryName` aunque `配属先`/`配属ライン` estén vacíos, contradiciendo la regla del proyecto. |
| Settings vs backend | **RIESGO MEDIO** — El ajuste de "作業者カレンダー" actualiza `calendar`, no `workerCalendar`. |
| Dashboard vs settings | **RIESGO MEDIO** — `conflictWarningDays` solo impacta UI local; `/dashboard/teishokubi` permanece hardcodeado. |
| Dashboard expiring | **RIESGO MEDIO** — La tarjeta resumen usa 30 días; la lista usa 60 días. |
| Arquitectura | **DEUDA TÉCNICA** — Existen archivos demasiado grandes (`companies/index`, `companies/table`, `documents`, `import`, `contracts`). |

### Resultado operativo

- El proyecto **funciona y compila**, pero ya no debe describirse como "producción-listo" sin reservas.
- La base está estable; la mayor deuda actual no es de build ni de tests, sino de **integridad de negocio**, **coherencia funcional** y **sobrecarga arquitectónica**.

---

## Estado Operativo — Lo Real vs Lo Pendiente

> Nota: a partir de este punto hay snapshots históricos de sesiones anteriores. Algunas afirmaciones fueron válidas en su fecha pero quedaron superadas por auditorías y verificaciones posteriores.

## Sesión 2026-03-11 — Inicialización del proyecto

### Cambios realizados

| Área | Estado |
|---|---|
| Proyecto base | **NUEVO** — Proyecto inicializado y memoria base estructurada. |
| Integración MCP | **COMPLETADO** — Tool inyectada, scripts activos, `.mcp.json` generado. |

### Resultado operativo

- El entorno se encuentra preparado para interacciones autónomas con Claude Code/Cursor/Windsurf.
- Usa el workflow `/sync` al terminar cada sesión de trabajo para registrar el progreso y commitear automáticamente los cambios.

## Sesión 2026-03-11 — Estabilización de Base de Datos y Schema

### Cambios realizados

| Área | Estado |
|---|---|
| DB Schema | **COMPLETADO** — Reintegradas las columnas `manager_uns_name`, `manager_uns_phone` y `manager_uns_dept` en la tabla `factories` en `server/db/schema.ts`. |
| Sincronización DB | **COMPLETADO** — Ejecución exitosa de `npm run db:push`. El schema de SQLite ahora refleja la estructura correcta de la versión 26.3.10. |
| Data Seed | **COMPLETADO** — Ejecución limpia de `npm run db:seed`. Todos los registros (companies, factories y employees) han sido poblados sin errores de Foreign Key. |
| Code Quality | **COMPLETADO** — Resueltos errores residuales de linter en archivos de tests (`fixes.test.ts`), removiendo imports sin uso de zod. El `typecheck` pasa sin advertencias. |
| Testing | **COMPLETADO** — Ejecutado el pipeline de pruebas `npm run test:run`, con 57/57 tests pasando correctamente, cubriendo las validaciones vitales del negocio. |

### Resultado operativo

- Las APIs, el frontend y el backend quedaron estabilizados para esa etapa inicial y sincronizados con SQLite. Esta afirmación histórica fue luego matizada por auditorías posteriores: el sistema es estable, pero no debe resumirse hoy como *producción-listo* sin reservas adicionales.

## Sesión 2026-03-13 — Accesibilidad WCAG 10/10 en todo el frontend

### Cambios realizados

| Área | Estado |
|---|---|
| Auditoría a11y | **COMPLETADO** — Análisis exhaustivo de los 39 archivos .tsx del proyecto. Se identificaron deficiencias en aria-labels, asociación label/input, semántica de tablas, modales y dark mode. |
| Modales (dialog, command-palette) | **COMPLETADO** — Agregados `role="dialog"`, `aria-modal="true"`, `aria-label` en botones de cierre e inputs de búsqueda. |
| Componentes de contrato | **COMPLETADO** — 6 archivos corregidos: |
| — `work-conditions.tsx` | Asociación `htmlFor`/`id` en los 16 campos legales (prefijo `wc-`), `aria-hidden` en iconos decorativos de legends. |
| — `date-calculator.tsx` | `htmlFor`/`id` en inputs de fecha inicio/fin, reemplazo `dark:bg-slate-800` → `dark:bg-card`. |
| — `employee-selector.tsx` | `aria-label` en búsqueda, `htmlFor`/`id` en notas, `aria-hidden` en icono Search, dark mode fix. |
| — `cascading-select.tsx` | 4 `<label>` decorativas cambiadas a `<div>`, `aria-hidden` en iconos de columna. |
| — `rate-preview.tsx` | `aria-label="基本時給"` en input de tarifa base. |
| Rutas principales | **COMPLETADO** — 7 rutas corregidas: |
| — `contracts/index.tsx` | `scope="col"` en 6 headers, `aria-label` en checkboxes (select-all + individuales), `aria-hidden` en iconos. |
| — `employees/index.tsx` | `scope="col"` en headers, `aria-hidden` en iconos Edit2, `aria-label` en búsqueda. |
| — `audit/index.tsx` | `scope="col"` en 6 headers, `aria-label` en búsqueda y filtros (acción, entidad). |
| — `documents/index.tsx` | `aria-label` en 6+ botones icon-only (preview, download, close), `aria-hidden` en iconos, dark mode fix. |
| — `import/index.tsx` | `htmlFor`/`id` en sheet-name, `scope="col"` en tabla preview, 5x dark mode fix. |
| — `settings/index.tsx` | `aria-label` en 6 inputs de calendario (年末年始, GW, 夏季休暇). |
| Dark mode | **COMPLETADO** — Reemplazados todos los `dark:bg-slate-800` hardcodeados por `dark:bg-card` (variable CSS del tema) en 4 archivos. |
| Verificación | **COMPLETADO** — TypeScript `tsc --noEmit` sin errores. 82/82 tests pasando. |

### Archivos modificados (13 archivos, solo atributos HTML/a11y)

```
src/components/ui/dialog.tsx
src/components/layout/command-palette.tsx
src/components/contract/cascading-select.tsx
src/components/contract/date-calculator.tsx
src/components/contract/employee-selector.tsx
src/components/contract/rate-preview.tsx
src/components/contract/work-conditions.tsx
src/routes/contracts/index.tsx
src/routes/employees/index.tsx
src/routes/audit/index.tsx
src/routes/documents/index.tsx
src/routes/import/index.tsx
src/routes/settings/index.tsx
```

### Archivos verificados sin cambios necesarios (ya tenían buena accesibilidad)

- `root-layout.tsx` — ya tiene landmark `<main>`
- `header.tsx` — ya tiene `aria-label` en menú y tema
- `sidebar.tsx` — ya tiene `aria-label` en botón cerrar
- `companies/index.tsx` — ya tiene 8 aria-labels
- `history/index.tsx` — ya tiene aria-labels en búsqueda y filtros

### Impacto

- **Cero cambios en lógica de negocio** — no se tocaron stores, APIs, cálculos de fechas/tarifas, ni generación de PDFs
- **Solo atributos HTML de accesibilidad** — aria-label, aria-hidden, role, htmlFor/id, scope
- **Dark mode consistente** — todos los componentes usan variables CSS del tema

## Sesión 2026-03-13 — Actualización de documentación y memoria del proyecto

### Cambios realizados

| Área | Estado |
|---|---|
| ESTADO_PROYECTO.md | **COMPLETADO** — Actualizada versión, estado del core a "Estable", fecha de última actualización. |
| SESSION_LOG.md | **COMPLETADO** — Reescrito con historial de sesiones del proyecto JP-v26.3.10 (ya no referencia AntigravitiSkillUSN). |
| LEARNINGS.md | **COMPLETADO** — Agregada lección sobre accesibilidad WCAG y dark mode consistency. |
| CLAUDE.md | **COMPLETADO** — Corregido conteo de reglas (6 → 8), actualizada referencia de archivos de reglas. |

### Resultado operativo

- La documentación reflejaba razonablemente el estado del proyecto al 2026-03-13.
- La memoria del proyecto (LEARNINGS, SESSION_LOG) está sincronizada con las sesiones de trabajo recientes.
- En ese momento el proyecto quedó estable para esa iteración: 82/82 tests, TypeScript limpio, WCAG compliant.

## Sesión 2026-03-13 — Mejoras de rendimiento y UX frontend (7 mejoras)

### Cambios realizados

| Área | Estado |
|---|---|
| Virtual scrolling | **COMPLETADO** — @tanstack/react-virtual en tabla de empleados. Solo ~30 filas en DOM vs 392+. |
| Column sorting | **COMPLETADO** — Headers clickeables asc/desc con flechas, localeCompare("ja") para texto japonés. |
| Componente Tabs | **COMPLETADO** — Nuevo componente reutilizable con ARIA, modo controlado/no-controlado. |
| Debounce búsqueda | **COMPLETADO** — useDebounce hook (300ms) aplicado en búsqueda de empleados. |
| Validación frontend | **COMPLETADO** — useFormValidation hook genérico con reglas por campo y mensajes de error. |
| Skeleton loaders | **COMPLETADO** — Skeleton/SkeletonTable/SkeletonCard reutilizables con animate-pulse. |
| Error boundary | **COMPLETADO** — ErrorBoundary en root layout captura errores de render con UI de recuperación. |
| Verificación | **COMPLETADO** — 146/146 tests pasando, TypeScript limpio, sin nuevos errores de lint. |

### Nuevos componentes reutilizables

- `src/lib/hooks/use-debounce.ts` — Hook genérico de debounce
- `src/lib/hooks/use-form-validation.ts` — Validación de formularios por campo
- `src/components/ui/error-boundary.tsx` — Error boundary con fallback UI
- `src/components/ui/skeleton.tsx` — Skeleton, SkeletonTable, SkeletonCard
- `src/components/ui/tabs.tsx` — Tabs, TabsList, TabsTrigger, TabsContent

## Sesión 2026-03-15 — Corrección integral de integridad de contratos y consistencia operativa

### Cambios realizados

| Área | Estado |
|---|---|
| Selección manual de empleados | **CORREGIDO** — El wizard de contratos ahora solo permite seleccionar empleados explícitamente asignados al factory/line elegido. |
| Duplicados en contratos | **CORREGIDO** — La agrupación por tarifa ya no puede duplicar empleados en `employeeAssignments`; backend también rechaza duplicados. |
| Validación backend de contratos | **CORREGIDO** — `POST/PUT /api/contracts` validan que todos los empleados pertenezcan al `factoryId` del contrato y devuelven `400` si no cumplen. |
| Cambio de fábrica en edición | **CORREGIDO** — Si se cambia `factoryId` sin reemplazar empleados, el backend valida las asignaciones existentes antes de guardar. |
| Importación de empleados | **CORREGIDO** — El importador ya no infiere `factoryId` cuando `配属先` / `配属ライン` están vacíos o ambiguos. |
| Bulk calendar de Settings | **CORREGIDO** — La acción masiva ahora actualiza `workerCalendar`, alineada con el texto "作業者カレンダー". |
| Dashboard: alertas de抵触日 | **CORREGIDO** — El dashboard consume `conflictWarningDays` vía query param y ya no está fijo a 180 días. |
| Dashboard: contratos por vencer | **CORREGIDO** — `/dashboard/stats` y `/dashboard/expiring` usan la misma ventana de 30 días. |
| Verificación | **COMPLETADO** — `typecheck`, `lint`, `test:run` y `build` pasando al 2026-03-15. |

### Nuevas piezas técnicas

- `server/services/contract-assignment.ts` — Helper reutilizable para extraer IDs, detectar duplicados, faltantes y empleados fuera del factory seleccionado.
- `server/__tests__/fixes.test.ts` — Cobertura adicional para helpers de asignación de contratos.

### Riesgos remanentes observados

- El build sigue reportando warnings por chunks grandes (`exceljs`, bundle principal) y por minificación CSS de clases generadas/documentales.
- La ruta masiva de Settings ahora es consistente con `workerCalendar`, pero la app sigue usando `factory.calendar` en algunos PDFs y documentos; conviene decidir luego si ambos calendarios deben converger o mantenerse separados por dominio.

## Sesión 2026-03-15 — Optimización de build y code splitting

### Cambios realizados

| Área | Estado |
|---|---|
| TanStack Router | **MEJORADO** — Activado `autoCodeSplitting` en Vite/TanStack Router para dividir rutas automáticamente. |
| Tailwind source scan | **MEJORADO** — Excluidos `.agent`, `.agents` y `.claude` del escaneo para evitar generar clases basura desde Markdown/instrucciones. |
| Build frontend | **MEJORADO** — El chunk principal pasó de ~620 kB a ~272 kB tras activar code splitting. |
| CSS warning | **CORREGIDO** — Desapareció el warning de minificación CSS asociado a clases tipo `[file:line]`. |
| Verificación | **COMPLETADO** — `typecheck`, `lint`, `test:run` y `build` vuelven a pasar tras la optimización. |

### Riesgo remanente

- `exceljs` sigue generando un chunk on-demand grande (~940 kB). Ya está aislado del bundle principal, pero conviene evaluar más adelante si se reemplaza por una librería más liviana o si se mantiene como costo aceptable de una feature rara y diferida.

## Sesión 2026-03-15 — Cobertura UI para `companies/table`

### Cambios realizados

| Área | Estado |
|---|---|
| Infra de tests UI | **COMPLETADO** — Instalados `@testing-library/react` y `jsdom` para pruebas de componentes con entorno DOM. |
| Toolbar de tabla | **COMPLETADO** — Nuevo test `src/routes/companies/-table-controls.test.tsx` validando callbacks de scroll, filtros, import/export y fullscreen, incluyendo estado `exporting`. |
| Grid de tabla | **COMPLETADO** — Nuevo test `src/routes/companies/-table-grid.test.tsx` cubriendo estados `loading`, `empty`, render de headers/datos y clase de altura para modo fullscreen. |
| Aislamiento de hooks | **COMPLETADO** — Mock de `EditableCell` en test de grid para evitar acoplamiento con React Query y validar sólo render/estructura. |
| Verificación | **COMPLETADO** — `typecheck`, `lint`, `test:run` y `build` pasan; suite total en **157/157** tests. |

### Riesgo remanente

- Permanece el warning de chunk grande para `exceljs` (~940 kB) durante build, ya aislado por code splitting.

## Sesión 2026-03-15 — Refactor estructural de `companies/table`

### Cambios realizados

| Área | Estado |
|---|---|
| Import modal | **REFACORIZADO** — Extraído a `src/routes/companies/-import-modal.tsx`, separando estado, diff e importación del render principal de la tabla. |
| Parser Excel | **REFACORIZADO** — Extraído a `src/routes/companies/-import-utils.ts` con helpers puros para inferencia de sheet y parsing de headers agrupados. |
| Exportación Excel | **REFACORIZADO** — Extraída a `src/routes/companies/-excel-export.ts`, dejando `handleExportExcel` como orquestación mínima desde la tabla. |
| Configuración de tabla | **REFACORIZADO** — `COLUMNS`, `COLUMN_GROUPS`, `COMPANY_PALETTE` y métricas de ancho movidas a `src/routes/companies/-table-config.ts`. |
| Edición inline | **REFACORIZADO** — `EditableCell` movido a `src/routes/companies/-editable-cell.tsx` reutilizando tipos de configuración. |
| Render de grilla | **REFACORIZADO** — `GroupHeaderRow` y el bloque completo de tabla (loading/empty/rows) movidos a `src/routes/companies/-table-grid.tsx`. |
| Toolbar y filtros | **REFACORIZADO** — Header de acciones y filtros de búsqueda movidos a `src/routes/companies/-table-controls.tsx`. |
| Route tree hygiene | **CORREGIDO** — Los helpers nuevos usan prefijo `-` para que TanStack Router no los trate como rutas ni emita warnings de build. |
| Tabla principal | **MEJORADO** — `src/routes/companies/table.tsx` quedó centrado en orquestación de estado y flujo; el archivo bajó de ~1293 a ~199 líneas. |
| Verificación | **COMPLETADO** — `typecheck`, `lint`, `test:run` y `build` pasando tras el refactor; sin warnings extra de route discovery. |

### Riesgo remanente

- El frente `companies/table` ya quedó altamente modular. El siguiente paso natural es agregar pruebas de UI (componentes presentacionales) si se quiere blindar regresiones de layout/interacción.

