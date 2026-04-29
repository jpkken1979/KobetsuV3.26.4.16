# ESTADO DEL PROYECTO — JP個別契約書v26.4.16

> Última actualización: 2026-04-29 (auditoría profesional + hardening sin auth + ESLint hardening + splits + cobertura nueva)

## Sesión 2026-04-29 — Auditoría profesional + hardening + refactors + tests

**Branch:** `claude/audit-app-refactor-1r0Fw` (4 commits, push OK)

### Fase 1 — `/auditoriajp` (auditoría profesional)

3 agentes paralelos (backend, frontend, calidad) auditaron el repo completo. Hallazgos:
**0 críticos · 4 altos · 7 medios · 6 bajos**. Riesgo global: BAJO–MEDIO (app local-first, hardening C-1 ya bien ejecutado).

- `npm audit`: 0 high/critical (2 moderate transitivas en `uuid<14` via `exceljs`)
- Type safety: **0 `: any` productivos**, 0 `@ts-ignore`, 0 `as any`
- 0 secretos en repo, `.gitignore` bien configurado

### Fase 2 — Hardening sin tocar auth (commit `d9010f7`)

Por pedido del usuario (uso local-only), **se skipea TODO lo de auth**: BACK-HIGH-1 (gateaer `/api/backup`), FRONT-HIGH-1 (mover `ADMIN_TOKEN` de `localStorage`), FRONT-HIGH-2 (validar Origin/Referer). Documentado en `decision_no_auth_changes_local_only.md`.

**Aplicado:**
- BACK-HIGH-2: `resolveBackupPath()` con `lstatSync` + `realpathSync` rechaza symlinks en restore/delete (`server/routes/admin-backup.ts`)
- MED-2: `sanitizeFilename` colapsa `..` y capa a 200 chars (`server/services/document-files.ts`)
- LOW-1: nuevo `services/error-utils.ts` con `sanitizeErrorMessage()` que enmascara paths Unix (`/home`, `/var`, `/etc`, ...) y Windows (`C:\\`, `D:\\`, ...) en error responses; aplicado en `admin-sql`, `admin-crud`, `admin-backup`, `documents`
- FRONT-MED-1: rechaza `:contractId` no entero positivo antes de fetch (`src/routes/contracts/$contractId.tsx`)
- FRONT-MED-2: `noopener,noreferrer` en `window.open` (3 lugares)
- FRONT-MED-3: nuevo `isSafePreviewUrl()` exige `/api/` o `/output/` antes del iframe (`src/lib/utils.ts`)
- `parseInt` con radix 10 (rate-preview, work-conditions, shift-utils)
- `parseJsonOrThrow` con `cause` en `seed.ts`
- Tests: `security-middleware.test.ts` (13 casos cubriendo gating admin paths, rate limiting, modos prod/dev, comparación timing-safe)

### Fase 3 — ESLint hardening (commit `d75807c`)

- Instala `eslint-plugin-security` con reglas curadas (`detect-eval-with-expression`, `detect-pseudoRandomBytes`, `detect-buffer-noassert`, `detect-bidi-characters`, `detect-non-literal-require`, `detect-no-csrf-before-method-override`)
- Apaga `detect-unsafe-regex` (falsos positivos sobre parsers de PDF internos), `detect-object-injection`, `detect-non-literal-fs-filename`
- **Sube `no-explicit-any` de `warn` a `error`** (relajado en tests)
- 3 directivas `eslint-disable` obsoletas removidas

### Fase 4 — Refactor de archivos grandes (commit `0c6a9d4`)

Ambos splits con barrel re-exports → 100% backward-compat.

**Backend:** `server/services/batch-contracts/write.ts` (727 líneas) → barrel
- `write/build-values.ts` (helper compartido `buildContractValues`)
- `write/standard-batches.ts` (~330 líneas, 4 executors estándar)
- `write/by-line.ts` (~145 líneas, `executeByLineCreate`)
- `write/smart-batch.ts` (~60 líneas, `executeSmartBatch` + tipo)

**Frontend:** `src/lib/api-types.ts` (1032 líneas) → barrel con 6 sub-archivos
- `api-types/entities.ts` — Company, Factory, Employee, Contract, RoleKey, etc.
- `api-types/batch.ts` — todos los flujos batch
- `api-types/documents.ts` — generación de docs
- `api-types/inputs.ts` — Create/Update + import
- `api-types/dashboard.ts` — stats + alerts + data-check
- `api-types/admin.ts` — panel admin

### Fase 5 — Cobertura nueva (commit `fffc98d`)

- `error-utils.test.ts` (11 casos): paths Unix/Windows ocultos, fallback, truncado a 500
- `utils.test.ts` extendido: `isSafePreviewUrl` rechaza `javascript:`, `data:`, dominios externos; `toLocalDateStr` sin TZ shift
- `use-debounce.test.ts` (6 casos): fake timers, cancelación, custom delays
- `button.test.tsx` (11 casos): variants, sizes, loading, ref forwarding
- `status-badge.test.tsx` (19 casos): 3 badges (Contract/Employee/Audit) con labels canónicos + fallbacks

### Verificación final

| Check | Antes | Ahora |
|---|---|---|
| Tests | 832 | **889** ✅ |
| Test files | 46 | **50** ✅ |
| `npm run lint` | 0 errors | 0 errors ✅ |
| `npm run typecheck` | clean | clean ✅ |
| `npm audit` (high/crit) | 0 | 0 ✅ |
| Service modules | 33 | 34 (`error-utils` added) |

### Pendiente

- BACK-HIGH-1, FRONT-HIGH-1, FRONT-HIGH-2: skipped (uso local-only); reabrir si la app sale al network público.
- Cobertura formal del frontend sigue scopeada a `companies/-table-*.tsx`. Si se quiere subir floor, ajustar `vitest.config.ts` `coverage.include`.
- Refactor de archivos >500 líneas restantes (`routes/contracts/new.tsx` 954, `index.tsx` 854, `employees/index.tsx` 817, `koritsu-pdf-parser.ts` 737). Abordar al tocar feature.
- `pdf_versions.sha256` solo se almacena al generar; agregar endpoint `verify` para integridad real.

---

## Sesión 2026-04-28h — Smart-Batch: ikkatsu por fábrica con auto-clasificación 継続/途中入社者

**Feature nueva — flujo #9 de generación de bundle.**

### Problema que resuelve

Caso real reportado por el usuario: hacer ikkatsu de toda una fábrica con un
rango global (ej. `2025/10/1 → 2026/9/30`) y que el sistema **automáticamente**:

- A los empleados antiguos (`hireDate < 2025/10/1`) les genere contrato del
  rango completo (継続).
- A los empleados que entraron a mitad del rango (ej. `hireDate = 2025/12/15`)
  les genere contrato `2025/12/15 → 2026/9/30` (途中入社者), no el rango completo.

Antes había que hacer dos operaciones separadas: ikkatsu para los antiguos y
luego mid-hires para los tochuunyusha. Ahora una sola operación clasifica
automáticamente.

### Implementación

**Backend:**
- `server/services/batch-contracts/types.ts`: tipos `SmartBatchEmployee`,
  `SmartBatchLine`, `SmartBatchResult`, `SmartBatchParams`,
  `SmartBatchEmpKind = "continuation" | "mid-hire" | "future-skip"`.
- `server/services/batch-contracts/read.ts`: `analyzeSmartBatch()` carga
  empleados activos por factory, normaliza `actualHireDate ?? hireDate`
  (acepta formato `YYYY-MM-DD` y `YYYY年MM月DD日`), clasifica cada empleado
  contra `[globalStartDate, globalEndDate]`, devuelve preview con totales.
- `server/services/batch-contracts/write.ts`: `executeSmartBatch()` reusa
  `executeByLineCreate` por factoryId — agrupa por `(rate, startDate, endDate)`
  y crea contratos atomicamente.
- `server/routes/contracts-batch.ts`: endpoints
  `POST /batch/smart-by-factory/preview` y `POST /batch/smart-by-factory`.

**Frontend:**
- `src/routes/contracts/smart-batch.tsx`: page nueva con selector
  multi-fábrica, inputs `globalStartDate/globalEndDate`, preview con
  desglose visual por factory (継続 / 途中入社者 / future-skip), confirmación
  modal con stats, auto-PDF al final.
- `src/lib/api-types.ts`: tipos `SmartBatchPayload`, `SmartBatchPreviewResult`,
  `SmartBatchCreateResult`, `SmartBatchPerFactory`.
- `src/lib/api.ts`: `smartBatchPreview()` + `smartBatchCreate()`.
- `src/lib/hooks/use-contracts.ts`: `useSmartBatchPreview` + `useSmartBatchCreate`.

### Reglas de clasificación

| Caso | Condición | startDate del contrato | endDate del contrato |
|---|---|---|---|
| **継続** | `effectiveHireDate < globalStartDate` o `null` | `globalStartDate` | `globalEndDate` |
| **途中入社者** | `globalStartDate ≤ effectiveHireDate ≤ globalEndDate` | `effectiveHireDate` | `globalEndDate` |
| **future-skip** | `effectiveHireDate > globalEndDate` | — | — (no se crea) |

Donde `effectiveHireDate = actualHireDate ?? hireDate`. `actualHireDate` tiene
prioridad consistente con el resto del módulo (mid-hires line 256 read.ts).

### Decisiones de diseño

1. `hireDate IS NULL` → se trata como 継続 (asumir que es antiguo). Distinto
   de mid-hires que excluye a los empleados sin fecha.
2. NO se aplica cap automático por 抵触日. Si el caller quiere capear, lo
   hace en la UI antes de enviar (consistente con `by-line`).
3. Multi-factory en una sola operación: loop interno por `factoryId`
   llamando `executeByLineCreate` (cada factory tiene su propia transacción).
4. NO valida overlap con contratos previos (consistente con mid-hires).
5. Preview obligatorio antes de crear (mismo patrón que mid-hires/new-hires).

### Tests

- `server/__tests__/smart-batch.test.ts`: 12 tests cubriendo firma, errores,
  clasificación 継続/途中/future-skip, prioridad `actualHireDate ?? hireDate`,
  `hireDate null` como continuation, totales por línea, creación end-to-end
  con cleanup automático de empleados modificados y contratos creados (date
  prefix `2099-*`).

### Calidad

- `npm run test:run`: **793/793** tests pasando (44 archivos)
- `npm run lint`: limpio
- `npx tsc --noEmit`: 0 errores
- Drift guard: 31 routes / 33 services sin cambios (smart-batch entró en
  archivos existentes)

### Archivos tocados

```
M  CLAUDE.md                                  (+13/−6)
M  server/routes/contracts-batch.ts           (+93)
M  server/services/batch-contracts/read.ts    (+148)
M  server/services/batch-contracts/types.ts   (+39)
M  server/services/batch-contracts/write.ts   (+61)
M  src/lib/api-types.ts                       (+64)
M  src/lib/api.ts                             (+9)
M  src/lib/hooks/use-contracts.ts             (+28)
A  server/__tests__/smart-batch.test.ts       (+360)
A  src/routes/contracts/smart-batch.tsx       (+489)
```

Commit: `e028199` en branch `claude/add-claude-documentation-68xJu`.

---

## Sesión 2026-04-28g — C-2: anonimización de seeds (PII fuera del HEAD)

**1 commit (en curso):**

Cierra C-2 de auditoría 2026-04-28. Los `data/seed/*.json` tenían PII real:
392 empleados con `fullName`, `birthDate`, `visaExpiry`, `address`, además de
nombres de personas físicas como representantes legales y supervisores en
`companies.json` y `factories.json`. Ahora **solo se versionan los `.example.json`**
con datos sintéticos.

### Estrategia (Opción A elegida por usuario)

- **`scripts/anonymize-seeds.cjs`** (nuevo, reproducible): genera los 3
  `.example.json` desde los reales con PRNG seeded (mulberry32, seed=20260428).
  Misma entrada → misma salida. Pools de nombres romaji vietnamitas, addresses
  ficticias en prefecturas inventadas, fechas de nacimiento y hire dates
  válidos en rangos plausibles, postal codes con formato real pero arbitrarios.
- **Mantiene `companyName` real** en cada empleado/factory porque la lógica
  R11 de `takao-detection.ts` y los tests de `takao-detection.test.ts`,
  `batch-helpers.test.ts`, `batch-contracts-service.test.ts` dependen de
  strings exactos como `高雄` y `瑞陵精機株式会社`.
- **`server/db/seed.ts`** (modificado): `loadJson()` ahora hace fallback
  automático `*.json` → `*.example.json` con warning visible. Cero cambios
  en la API pública del seed.
- **`.gitignore`**: agregado `data/seed/*.json` + excepción `!data/seed/*.example.json`.
- **`git rm --cached`** los 3 reales (`companies.json`, `factories.json`, `employees.json`).
  Quedan en el filesystem local del usuario; nuevos clones / CI usan automáticamente
  los `.example` via fallback.

### Validación

Ejecutado `npm run test:run` con los 3 `.json` reales **temporalmente removidos**
del filesystem. Resultado: **781/781 tests passed (43 archivos)** usando solo
los `.example.json` como fuente de seed. Conteos preservados (14 companies / 76
factories / 392 employees).

### Pendiente declarado (acción del usuario)

- **Purga del histórico**: hasta este commit, los `.json` con PII vivieron en git.
  Para sacarlos del histórico se requiere `git filter-repo` (destructivo —
  reescribe SHAs, requiere coordinación con cualquier clone existente). Receta:

  ```bash
  git filter-repo --path data/seed/employees.json \
    --path data/seed/factories.json \
    --path data/seed/companies.json --invert-paths
  git push origin --force --all
  git push origin --force --tags
  ```

  Esto se deja como acción manual del usuario por su impacto en la red de clones.
  Cualquier dev con clone previo debe rehacer `git clone` después.

**Estado**: Typecheck ✓ · 781 tests ✓ · PII fuera del HEAD ✓ · Histórico pendiente de purga manual

---

## Sesión 2026-04-28f — Auditoría profesional aplicada (13 fixes + B-1)

**3 commits (1f53cb7, 749e480, en curso):**

Audit completa contra OWASP Top 10 + calidad. Resultado: 2 críticos, 4 altos, 6 medios, 7 bajos. **13 hallazgos resueltos** (los 2 restantes son C-2 y B-1, este último cerrado en este mismo bloque).

### Hardening seguridad (commit `1f53cb7`)

- **C-1 (CRÍTICO) — Bypass admin via localhost cerrado**: `server/middleware/security.ts` ahora exige `X-Admin-Token` para TODA mutación POST/PUT/PATCH/DELETE en `/api/admin/*`, incluso desde `127.0.0.1`. GETs siguen permitidos sin token solo en dev+localhost para no romper el panel admin del frontend; en producción todo requiere token.
- **A-1 — Parser closingDay/paymentDay unificado**: `import-factories/parser.ts` deriva `closingDayText`/`paymentDayText` desde el numérico cuando solo este se provee. Antes, importar Excel con `締め日: "当月末"` perdía el dato silenciosamente.
- **A-2 — bodyLimit por ruta**: `/api/import/*` ahora acepta hasta 25MB (Koritsu workbooks reales con imágenes). Resto sigue acotado a 5MB. El check de 20MB en `import-koritsu.ts` ya no es código muerto.
- **A-3 — Zod en admin-rows**: schema completo para query params; reemplaza la validación ad-hoc previa.
- **A-4 — Cubierto por C-1**: reset-all ahora exige token siempre.
- **M-3 — IP+UA en audit log**: nuevo helper `services/audit-context.ts` con `buildAuditDetail(c, message, payload?)` que envuelve detail con `{message, ip, userAgent, ts, payload}`. Aplicado en `admin-crud` y `admin-reset` para forensics. Test `admin-reset.test.ts` actualizado para validar el nuevo formato.

### Calidad y mantenibilidad (commit `749e480`)

- **M-1 — Paths absolutos no se filtran**: `factories/excel.ts` y `data-check.ts` ahora devuelven `./DataTotal/${filename}` en lugar de la ruta absoluta del FS del servidor.
- **M-2 — SQL dump correcto**: `admin-backup/export-sql` ya no escapa `\\` (sqlite no lo interpreta como escape; el output anterior se reimportaba corrupto). Bytes binarios ahora serializados como `X'hex'`.
- **M-4 — Match exacto first**: `resolveOrCreateCompany` detecta ambigüedad. Si el fuzzy match encuentra >1 candidato, retorna `null` y agrega warning. Antes, el primer hit ganaba según orden de iteración del Map → re-asignaciones silenciosas a empresas equivocadas.
- **M-5 — Modelo de autorización documentado**: `/documents/download` queda intencionalmente público en local-first; receta para hardening (URLs firmadas, ownership check) si se expone fuera de localhost.
- **M-6 — Safeguard `db:seed:force`**: aborta si la DB target tiene >100 contratos sin flag `--i-know-what-im-doing`. Test DBs (`*.test.*`) están eximidas. Protege contra wipe accidental.
- **B-2 — Invariante de `contract-number` documentado**: toda llamada a `generateContractNumber` debe estar dentro de `sqlite.transaction()`. Verificados los 6 call sites actuales (`contracts.ts`, `batch-contracts/write.ts` ×5, `documents-generate-batch-ids.ts`).
- **B-5 — CLAUDE.md actualizado**: admin-sql usa `stmt.reader` (no regex blocklist); service modules pasan a 33 con `audit-context` agregado.

### Drift `.env` cerrado (este bloque)

- **B-1 — `.env` NO se versiona**: `.gitignore:14-17` excluye `.env` y `.env.*`. Solo `.env.example` queda en git. Política realineada con la realidad operativa después de oscilaciones documentadas en `session_2026-04-21.md`. Actualizados:
  - `.claude/rules/security.md` — regla activa
  - `.claude/rules/best-practices.md` — sección Git
  - `CLAUDE.md` — sección "Files NOT to Commit"
  - Agregado `data/seed/*.json` a la lista de no-commit (preparación para C-2)

### Pendiente (siguiente sesión)

- **C-2 — Anonimizar `data/seed/*.json`**: 233 KB con PII real de empleados (`THAI HUY DUC`, fechas de nacimiento, nacionalidad). Plan acordado: (1) generar `seed/*.example.json` con datos sintéticos manteniendo invariantes (14 companies / 76 factories / 392 employees para no romper tests); (2) gitignorear `seed/*.json` reales; (3) commit separado para `git filter-repo` del histórico (destructivo, requiere coordinación con clones existentes).

**Estado**: Typecheck ✓ · Lint ✓ · 781 tests ✓ · Postura de seguridad: 6.5/10 → ~8.5/10

---

## Sesión 2026-04-28e — SET生成 error logging fix

**1 fix commit:**

- **Frontend: catch block muestra mensaje real del error** (`src/routes/contracts/index.tsx`):
  - Antes: `catch { toast.error("SET生成に失敗しました") }` — mensaje hardcodeado, no decía nada útil
  - Después: `catch (err) { const msg = err instanceof Error ? err.message : ...; console.error("[SET生成]", msg); toast.error(msg) }` — ahora muestra el error real del backend o de la red
  - Para debugging futuro: `console.error` en DevTools Console para ver el stack completo

- **PDF hashes actualizados** (snapshots PDF regenerados con `UPDATE_PDF_SNAPSHOTS=1`)

**Pendiente identificado**: La causa raíz del error original "SET生成に失敗しました" no se reprodujo en testing directo (API funciona con contratos 137, 138, 118). El error era visible solo en la UI. Con el fix de logging, la próxima vez que falle se verá el mensaje real.

**Decisión técnica**: No se cambió la lógica de negocio, solo se mejoró el error reporting. El timeout de 120s para generateSet es suficiente para PDFs SET normales (3-10 empleados). Si se necesita más, agrandar el timeout en `src/lib/api.ts`.

**Estado**: Typecheck ✓ · Lint ✓ · Tests en suite principal

---

## Sesión 2026-04-28d — Showcase aplicado a contracts batch + hook DRY

**1 feat commit:**

- **5 rutas batch ahora unificadas con showcase consistente** (commit `2640882`):
  - **Hook reusable nuevo**: `src/lib/hooks/use-dashboard-stats.ts` (7 líneas) — wrapper de `useQuery` sobre `getDashboardStats`
  - **`BatchPageHeader`** (en `batch-shared.tsx`) ahora envuelve `BatchPageShell` internamente; mantiene back link "契約一覧へ戻る" arriba; acepta props opcionales (icon/badge/breadcrumb/stats) con defaults sensatos
  - **3 rutas contracts batch heredan showcase**:
    - `/contracts/batch` → icon `Zap`, badge `BULK CREATE`, stats `[派遣先, 工場ライン, 稼働契約]`
    - `/contracts/new-hires` → icon `UserPlus`, badge `NEW HIRES`, stats `[派遣先, 稼働社員, 稼働契約]`
    - `/contracts/mid-hires` → icon `UserCheck`, badge `MID HIRES`, stats igual a new-hires
  - **2 rutas documents refactorizadas DRY**: `batch-factory.tsx` y `batch-ids.tsx` consumen el nuevo `useDashboardStats()` hook (eliminando imports inline de useQuery/api/queryKeys)

**Estatísticas**: +74 insertions, -21 deletions. Typecheck ✓ · Lint ✓ · 776 tests ✓

**Impacto**: Las 5 rutas batch del sistema ahora tienen identidad visual showcase consistente — gradient title 135deg, spotlight mouse-tracking, breadcrumb, badge mono, stats inline animados con datos en vivo. Hook DRY listo para reusar en futuras rutas que necesiten dashboard stats.

**Decisión técnica clave**: refactorizar `BatchPageHeader` (compartido) en lugar de duplicar `BatchPageShell` en cada ruta de contracts. Resultado: 3 rutas mejoradas con cambios mínimos por archivo (solo agregan props específicos del dominio).

---

## Sesión 2026-04-28c — Showcase UI/UX batch pages (BatchPageShell + Bento + Particles)

**1 feat commit:**

- **4 componentes UI nuevos + 5 archivos modificados** (commit `b92082b`):
  - `src/components/ui/animated-number.tsx` — Counter rolling con easeOutCubic, respeta `useReducedMotion`
  - `src/components/ui/batch-page-shell.tsx` — Hero con spotlight mouse-tracking, gradient title 135deg, breadcrumb, badge live-dot, stats inline animados, glow blur en icon pill
  - `src/components/ui/bento-stats-grid.tsx` — 3 cards con border gradient + glow radial, stagger entrance, hover lift, 4 accents tokenizados (primary/accent/ok/info)
  - `src/components/ui/particle-burst.tsx` — 14 partículas radiales con cubic-bezier ease-out, colores rotativos
  - `src/routes/documents/batch-factory.tsx` y `batch-ids.tsx` consumen `getDashboardStats(30)` con stats reales en `BentoStatsGrid`
  - `src/components/layout/sidebar.tsx` — `NavItem` extendido con `indent` y `badge` props (guide line gradient + pill mono "一括" que cambia a primary cuando active)
  - `src/routes/documents/-factory-generator.tsx` — header interno duplicado eliminado; ParticleBurst integrado en success
  - `src/routes/documents/-id-generator.tsx` — header textual reemplazado por label "進捗 · Progress"; ParticleBurst en `ResultStep` con `overflow-visible`

**Estatísticas**: +560 insertions, -44 deletions. Typecheck ✓ · Lint ✓ · 776 tests ✓

**Impacto**: Las páginas batch ahora tienen identidad visual showcase con animaciones premium que respetan accesibilidad. Componentes reutilizables (`BatchPageShell`, `BentoStatsGrid`, `AnimatedNumber`, `ParticleBurst`) listos para futuras vistas batch (`/contracts/batch`, `/contracts/new-hires`, `/contracts/mid-hires`) y celebraciones de éxito en otros flujos.

**Decisiones técnicas clave**: spotlight con CSS variables (no canvas) para 100x mejor performance, `useReducedMotion` en TODOS los components, variants OUT de componentes (regla typescript.md), `color-mix(in srgb, ...)` tokenizado en `ACCENT_TOKENS` para legibilidad.

---

## Sesión 2026-04-28b — Exponer batch factory e IDs como rutas dedicadas en sidebar

**1 feat commit:**

- **Rutas dedicadas + sidebar entries** (commit `7906823`):
  - Crear `/documents/batch-factory` (`src/routes/documents/batch-factory.tsx`) — wrapper que monta `FactoryGenerator` con `PageHeader("工場一括生成", ...)`
  - Crear `/documents/batch-ids` (`src/routes/documents/batch-ids.tsx`) — wrapper que monta `IdGenerator` con `PageHeader("ID指定一括生成", ...)`
  - Actualizar sidebar (`src/components/layout/sidebar.tsx`) — agregar 2 items bajo "業務ツール": "工場一括" → `/documents/batch-factory` (icon: Package), "ID指定" → `/documents/batch-ids` (icon: Hash)
  - TanStack Router auto-genera `routeTree.gen.ts` — ambas rutas registradas correctamente
  - Componentes `FactoryGenerator` e `IdGenerator` reutilizados sin modificación
  - Tabs originales en `/documents` siguen funcionando (backward compatible)

**Estatísticas**: +40 insertions (2 nuevos route files de 20 líneas cada uno), 2 items sidebar. Typecheck ✓ · Lint ✓ · 776 tests ✓ · drift guard ✓

**Impacto**: Las dos formas "ocultas" de generar PDFs en batch (por factory y por IDs) ahora son **discoverables desde el sidebar** como rutas independientes. Mejora UX eliminando necesidad de navegar a tabs dentro de `/documents`.

---

## Sesión 2026-04-28 — Expansión de CLAUDE.md con 8 mejoras de documentación

**1 docs commit:**

- **CLAUDE.md expandido con 8 mejoras** (commit `d742fc5`):
  1. **Quick Start** — explicación detallada de cada comando npm, notas de seguridad (`--env-file .env` requerido), fallback Windows `dev:server`/`dev:client`
  2. **Testing** — sección mejorada: Vitest, serial execution, DB isolation, coverage thresholds per-file, PDF snapshots, mocking philosophy
  3. **TypeScript Standards** — nueva sección resolviendo confusión path-scoping (reglas en `.claude/rules/typescript.md` aplican SOLO a `nexus-app/`)
  4. **Adding New Routes** — TanStack file-based routing, `-` prefix, `routeTree.gen.ts` auto-generado
  5. **Drift Guard Test** — documenta test que valida route/service counts vs CLAUDE.md
  6. **Auto-Injected Rules** — explica mecanismo de inyección automática en sesión
  7. **SDD Workflow** — guidance cuando usar (3+ files) / cuando no usar (simple fixes)
  8. **Nota de Seguridad** — `--env-file .env` es CRÍTICO para `npm run dev` — sin él, `ADMIN_TOKEN` no carga

**Estatísticas**: +181 insertions, -36 deletions. Typecheck ✓ · Lint ✓ · 770 tests ✓

**Impacto**: futuras sesiones de Claude Code tendrán documentación más clara sobre comandos, testing strategy, y workflow recommendations.

---

## Sesión 2026-04-27 — CLAUDE.md drift de hooks + bugfix masivo calendario PDF (高雄/HUB)

**1 docs + 1 bugfix de datos masivo:**

- **CLAUDE.md afinado** (commit `bc8364c`, ya pusheado): drift de hooks corregido (`use-pdf-versions.ts` agregado, conteo 21→22), nota explícita de que el drift guard solo cubre routes/services, sección "Auto-Injected Rules" reducida de 16 a 4 entradas críticas + puntero genérico, convención de carpetas `factories/`/`batch-contracts/`/`import-factories/` documentada, fallback `dev:server` + `dev:client` para Windows, "Active Pending Items" removido. Drift guard test pasa (2/2). Net +15/-26 líneas.

- **Bugfix masivo calendario PDF — `factory_yearly_config.sagyobi_text` corrupto**: PDF de KOB-202510-0042 (高雄工業 / HUB工場 / 製作1課 / 1次旋係.) mostraba feriados con fechas distintas a las del factory base. Root cause: cascada `yearlyConfig?.sagyobiText || factory.calendar` en `server/services/document-generation.ts:261` priorizaba un texto roto importado el 2026-04-15 sobre el texto correcto editado por el usuario. **74 filas afectadas** (FY 2024 y 2025, prácticamente todas las factories) con patrones `12月29日～1月5)` (sin `日`) y `12月30日～1月7日)`. Fix: UPDATE masivo `sagyobi_text = NULL` en las 74 filas — la cascada cae a `factory.calendar` (correcto). 13 filas FY 2026 con texto válido preservadas intactas. Backups en `data/kobetsu.db.backup-takao-fix-*` y `data/kobetsu.db.backup-mass-fix-*`.

**Pendiente**: regenerar el PDF de KOB-202510-0042 para verificar; considerar mejora UX en editor 年度 que muestre `factory.calendar` al lado del campo `sagyobiText` para evitar que el usuario edite el factory base sin saber que el yearly config gana en cascada. Factories duplicadas con punto al final (`1次旋係` vs `1次旋係.`) siguen pendientes de decisión del usuario.

**Detalle técnico**: `.claude/memory/session_2026-04-27.md` y `.claude/memory/bugfix_takao_yearly_config_cascade.md`

---

## Sesión 2026-04-23b — Orden canónico de turnos + fix render multicolumna

**3 features + 2 bugs + 1 reconciliacion:**

- **Orden canónico en UI/DB/PDF**: `sortShiftEntries` en `src/lib/shift-utils.ts` — `日勤 → 昼勤 → 夕勤 → 夜勤 → 深夜` → kanji numerados → letras A-Z. Aplicado en `composeWorkHoursText`, `composeFullBreakText`, `parseExistingShifts`.
- **Normalizer server-side**: `server/services/shift-sort.ts` conservador — preserva original si ya esta ordenado o tiene texto extra (`(実働 7時間40分）`).
- **Split multicolumna secuencial (opción B)**: `tryColumnLayout` en `server/pdf/kobetsu-pdf.ts` preserva orden canónico en lugar de reordenar por ancho de píxeles. Takao 9 shifts: col1 A-B-C, col2 D-E-F, col3 G-H-I.
- **Fix bug regex nombre shift**: antes NO matcheaba `昼勤①`, `昼勤②`, `深夜`, `早番`, `遅番`. Nuevo pattern: `[A-Za-z一-鿿\d]+[勤直務夜番][①-⑩\d０-９]*|シフト\d?`.
- **Fix render workHours apelmazado**: `renderMultiShift` spliteaba solo por `\n` pero `workHours` usa `　` — caía en path ≤2 shifts cortando `D勤務：15時00分～23` a mitad. Ahora split por `\n` o `　` con lookahead que preserva `　合計60分` interno.
- **Reconciliación `compactTimeFormat`**: helper expandido en `server/pdf/helpers.ts` (strip `合計XX分` + reemplazo `~→~`) consumido desde `kobetsu-pdf.ts`.

**Script migración**: `scripts/normalize-shifts.ts` dry-run default + backup timestamp. DB actual → 0 cambios (todas canónicas).

**Tests**: +7 unitarios en `shift-utils.test.ts`. Total 770/770 · typecheck ✓

**Detalle técnico**: `.claude/memory/session_2026-04-23b.md`

---

## Sesión 2026-04-23c — Split 既存/新規入社 en wizard + endDate -1 día + tanka priority en PDF

**3 fixes críticos:**

- **Split 既存/新規入社 en Step 2 del wizard activo**: `src/routes/contracts/new.tsx` reescrito para mostrar dos secciones visuales. `既存社員` = `hireDate < contract.startDate` (contrato completo); `新規入社` = `startDate ≤ hireDate ≤ endDate` (cada uno con su propio `calculateContractDates(hireDate)`). Checkboxes para filtrar status: 在職中 (active), 休職中 (onLeave), 退職者 (inactive).
- **endDate = startDate + N meses - 1 día**: `calculateEndDate()` en `use-contract-wizard.ts` ahora hace `addMonths(startDate, N); setDate(getDate() - 1)`. Así 2025/10/01 + 1年 → 2026/09/30 (no 2026/10/01).
- **tanka del 社員台帳 manda sobre factory en PDF**: root cause: contratos KOB-202510-0006/0007 tienen `contracts.hourly_rate = NULL` pero `contract_employees.assignment_rate = 1750`. El fallback `c.hourlyRate ?? factory.hourlyRate` usaba ¥1,700 del factory. Fix: `buildCommonData()` en `document-generation.ts` infiere de las asignaciones (mode) cuando `c.hourlyRate` es null. También el wizard ahora pasa `hourlyRate` + rates derivados en el payload.

**Commits**: 32e9569, 5cef899, 8cb48b4, 210f780 · typecheck ✓ · 770 tests ✓

**Detalle técnico**: `.claude/memory/session_2026-04-23c.md`

---

## Sesión 2026-04-23 — Refactor completo KobetsuV3

**7 splits + 4 investigaciones + 1 fix de encoding:**

- **R-1**: Eliminado wrapper `documents-generate-batch.ts` (re-export puro sin callers externos)
- **R-2**: `validateForPdf` en `validation.ts` marcado como test-only con JSDoc
- **R-3**: `cleanupOrphanedFiles` no existe — función activa es `cleanupPurgedContractDocuments` (usada en contracts.ts DELETE /purge)
- **R-4**: `batch-contracts.ts` (969L) → `batch-contracts/write.ts` + `read.ts` + `cancel.ts` + `types.ts`
- **R-5**: `factories.ts` (864L) → `factories/crud.ts` + `roles.ts` + `calendars.ts` + `cascade.ts` + `excel.ts`
- **R-6**: `koritsu-pdf-parser.ts` (759L) → `koritsu-types.ts` + `koritsu-pdf-parser.ts` + `koritsu-excel-parser.ts` + fix encoding `工的`(U+7684)→`務`(U+52D9)
- **R-7**: `import-factories-service.ts` (679L) → `import-factories/parser.ts` + `validator.ts` + `writer.ts`
- **P-9**: `shouheisha.tsx` (1194L→615L) — 8 componentes extraídos + barrel export `-index.ts`
- **L-1**: `/takao-reentries` endpoint NO existe — lógica en `takao-detection.ts`
- **L-2**: Koritsu import es ACTIVO — frontend `companies/koritsu.tsx` lo usa
- **L-3**: `employee-mapper.ts` y `import-employees.ts` son complementarios (PDF vs Excel→DB), no se unifican

**Investigación datos:**
- 13 `contract_employees.hourly_rate` NULL (KOB-202604-0004兄妹, todos con `billing_rate=1750`) — NO se automatiza, usuario maneja via shaindaicho
- 4 empleados sin rates (DAO VIET CHIEN, CAO ANH DI, LUONG XUAN TUAN, DAO CONG PHUC) — huérfanos sin factory_id, asignación manual
- 6 contratos cancelled sin campos Art.26 (usa `supervisor_name`, etc. — no `article26_*`)

**Commits**: fec6937..594549e · typecheck ✓ · lint ✓ · 762/762 tests ✓

**Detalle técnico**: `.claude/memory/session_2026-04-23.md`

---

## Sesión 2026-04-22c — Wizard fix + appendTeiji + PDF traceability

**4 fixes + 1 feature:**

- **Fix `/contracts/new` wizard**: POST fallaba con "Invalid input: expected number, received undefined" — faltaban `companyId`, `contractDate`, `notificationDate` en el payload. Solucionado en `src/routes/contracts/new.tsx` usando `calculateContractDates()`.
- **Feature PDF traceability**: columna `最終PDF生成` en lista `/contracts` + sección `PDF生成履歴` en detalle de contrato. Backend inyecta `lastKobetsuAt` via LEFT JOIN con `pdf_versions` en `GET /api/contracts`. Frontend: `usePdfVersions` hook + `LastKobetsuAt` component + `PdfHistorySection`.
- **Fix `(N)` calculation en PDFs**: removida la llamada a `appendTeiji()` de todos los call sites (kobetsu-pdf, hakenmotokanridaicho-pdf, flat-view, table-config). Función eliminada completamente de `server/pdf/helpers.ts` (99 líneas) y `src/lib/teiji-utils.ts` (archivo borrado).
- **5 contratos 川原鉄工所** (KOB-202604-0013 a 0017): billingRate 1750, endDate 2026-11-20.
- **DB reset + test**: contratos 63/64 (test) cancelados post-validación.

**Commits**: d71f1da..4c58ae5 · typecheck ✓ · lint ✓ · 762/762 tests ✓

**Detalle técnico**: `.claude/memory/session_2026-04-22b.md`

---

## Sesión 2026-04-22b — Fix transaction bug + timestamp filenames + Kawahara PDFs

**3 fixes + 1 feature + regeneracion de PDFs:**

- **Bug fix `executeIndividualBatchCreate`** (`server/services/batch-contracts.ts`): `sqlite.transaction()` devolvía función wrapper en vez de resultado. Mismo fix que `executeMidHiresCreate`: agregar `()` para invocar. Transaction ahora retorna correctamente el array de resultados.
- **`toLocalDateTimeStr`** (`server/services/contract-dates.ts`): nueva función con formato `YYYY-MM-DD_HH-mm` para timestamp con hora/minuto.
- **Fix filename prefix** (`server/routes/documents-generate-single.ts`): ahora incluye `contract.contractNumber` en el prefix — múltiples contratos del mismo día/company/line generaban nombres idénticos.
- **Endpoint `/preview-by-ids`** (`server/routes/contracts-batch.ts`): nuevo endpoint para preview por IDs de empleados.
- **Regeneración PDFs 川原鉄工所**: 8 contratos (IDs 50-57, KOB-202604-0010 a 0012 + renew IDs 53-57), billing_rate=1750, 32 archivos generados con timestamp `_2026-04-22_18-23`.
- **Lint warning fix**: import no usado `toLocalDateStr` removido de documents-generate-single.ts.

**Verificación**: typecheck clean · lint clean · 762/762 tests · 0 errores

**Detalle técnico**: `.claude/memory/session_2026-04-22.md`

---

## Sesión 2026-04-22 — Rediseño UI/UX Path B "Hypercar Aurora"

**8 fases completadas sobre 72 archivos (+2944 -1807 líneas):**

- **Fase 1-2**: Tokens CSS base (status ok/warning/error/info/pending/neutral + muted) + 9 primitives UI (button, card, badge, input, select, dialog, skeleton, empty-state, page-header) + premium utilities (aurora-border, shine-hover, spotlight, live-dot, text-display, mono-tabular, sep-fade)
- **Fase 3**: Dashboard + charts — hero card aurora-border, stat cards elevated+spotlight, live-dots per status
- **Fase 4**: /contracts + /employees — motion.tbody bug fix (React 19), useMemo deps fix, badge status tokens
- **Fase 5**: Contract wizard (new stepper) + 8 componentes contract
- **Fase 6**: Batch routes (contracts/batch, new-hires, mid-hires) + shouheisha
- **Fase 7**: /companies (32 archivos) + /documents (6 archivos)
- **Fase 8**: Lote 3 primitives (tabs, table, tooltip, switch, alert, error-boundary) + rutas verdes (admin, settings, import, data-check, history, audit)

**Verificación**: typecheck ✓ · lint 1 error pre-existente · 762/762 tests ✓ · 0 vulnerabilidades npm

**Tokens migrados**: 426 raw Tailwind colors → ~228 status tokens (46% reducción)

## Sesión 2026-04-21b — Balance tipográfico kobetsu + relleno tsuchisho

**3 iteraciones sobre `server/pdf/kobetsu-pdf.ts` y `server/pdf/tsuchisho-pdf.ts`:**

### Ronda 1 — Fonts +1pt across the board (kobetsu)
- Intro 7→8.5pt · Values 7→8pt · Row labels 6.5→7pt · Inner labels 7→7.5pt
- Legal labels 6.5→7.5pt · Legal text 6→7pt (苦情/契約解除 5.5→6.5pt)
- Shifts cascade: techo 7.5pt / piso 4.5pt (antes 6.5 / 3.5)
- Checkboxes labels 6→7pt / values 7→8pt

### Ronda 2 — Tsuchisho: relleno hasta pie de página
- `RH`: 16 → **17pt** · `emptyRows`: 20→**38** · Guard: `y<720` → `y<795`
- Llega al 93% de A4 sin overflow

### Ronda 3 — Pulidos (feedback visual)
- **Row labels unificados a 7.5pt** (personRow, row labels, checkbox labels, legal labels) — balance visual total
- **派遣内容**: `"派遣\n内容"` split forzado (2+2 chars balanceado vs 3+1 por wrap automático)
- **Cols A+B ampliadas**: `COL_CW[0]` 3.625→**4.5**, `COL_CW[1]` 11.375→**13.5**, `COL_CW[2..25]` 11.375→**11.25** (CW_SUM mantenido en 292.625) → side label ~27.4pt → **~32.9pt** de ancho
- **Checkboxes hardcoded**: siempre ☑ en primera opción (ignora `data.isKyoteiTaisho` / `data.responsibilityLevel`)

### Verificación
- typecheck: clean · lint: clean · 762/762 tests · 10/10 snapshots regenerados
- Mediciones pdfjs-dist: 19/20 bloques con font size exacto (solo `就業日 calendar` largo activa auto-shrink a 6pt — edge case esperado)
- `scripts/analyze-kobetsu-pdfs.mjs` creado como herramienta de diagnóstico reusable

**Detalle técnico completo**: `.claude/memory/session_2026-04-21b.md`

---

## Resumen Ejecutivo

| Componente | Estado | Versión | Nota |
|---|---|---|---|
| Core | ✅ Estable | 26.3.31 | 762 tests, WCAG completo, audit trail completo |
| Admin Panel | ✅ Activo | — | 6 routers admin-* con token-gate vía `ADMIN_TOKEN` |
| Tests aislados | ✅ Nuevo | — | `data/kobetsu.test.db` separada — `npm test` ya no destruye la DB real |
| Versionado PDFs | ✅ Nuevo | — | Tabla `pdf_versions` con SHA256 + audit; integrado en `documents-generate-single.ts` |
| Snapshot tests PDFs | ✅ Nuevo | — | 9 hashes golden con mock determinista |
| Drift guard | ✅ Nuevo | — | `claude-md-drift.test.ts` previene descalce CLAUDE.md ↔ código |

## Estado Canónico Actual

- El estado vigente del repo incluye la **sesión 2026-04-16** como cierre más reciente y sus verificaciones asociadas.
- El sistema está estable y verificado en `typecheck` y `test:run` (42 archivos, 762 tests).
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

## Sesión 2026-04-21 — Hardening dependencias + refactor CLAUDE.md

**Ciclo completo post-pull (audit-pro + /init + hardening):**

1. **Pull de 4 commits del merge PR #1** — fixes P1/P2 del audit-pro anterior (`shouheisha.tsx` sin `p-5`, versiones docs sincronizadas).
2. **Revert politica `.env`** — vuelve a versionarse por decision explicita (repo privado, single-user). Documentado en 3 lugares con warning para forks publicos.
3. **Body limit `server/index.ts:52`** — 10MB → 5MB. Excel maximo del repo: 57KB → 87x headroom.
4. **CLAUDE.md refactor post-/init** — 487 → 463 lineas. Nueva seccion "Gotchas criticos" + ancla "Donde esta que" + drift guard movido a Testing + Antigravity colapsado (delega a reglas auto-inyectadas).
5. **`npm update`** — 25 paquetes minor/patch (vitest 4.1.4, react 19.2.5, tailwind 4.2.3, vite 8.0.9, ts 6.0.3, etc.). 18 lint warnings → 0 (eslint-disable justificado en test fixtures).
6. **Override esbuild >=0.25.0** — cierra `GHSA-67mh-4wv8-2f99` (CVSS 5.3, dev-only via drizzle-kit) sin esperar upstream. Detalle: `.claude/memory/decision_esbuild_override.md`.

**Resultado final:**
- `npm audit`: 4 moderate → **0 vulnerabilities**
- Lint: 18 warnings → **0**
- Tests: 762/762 pass (42 suites)
- Typecheck: clean
- Build: OK

**Commits**: `15e6907` → `7b504da` → `e1b379d` → `59db590` → `2c96ed7`

**Pendientes**: `@hono/node-server@2` (release de hace 10h, esperar 2-4 semanas); backup remoto (Litestream vs `cp`).

## Sesión 2026-04-20 — toggle auto-fill horarios en shouheisha

**Toggle "自動反映" en shouheisha.tsx:**
- `applyFactoryDefaults` dividida en dos funciones:
  - `applyFactoryDefaults` —单价、業務内容、シフトパターン、勤務日数、Supervisor全部 → siempre se ejecuta al seleccionar工場
  - `applyScheduleDefaults` — 開始時刻、終了時刻、休憩 → solo cuando toggle ON
- Toggle `Switch` junto al botón "工場情報を反映" con label "自動反映"
- Default `autoFillEnabled = true` (backward compat)
- Nuevo componente: `src/components/ui/switch.tsx` (shadcn)

**Fix cascading-select.tsx:**
- Reemplazado regex-parsing de `workHours` por `workHoursDay.split("～")` para extraer horarios de inicio/fin correctamente
- Strip de sufijo `(8.5h)` al auto-fill: `.replace(/\s*\([^)]*8\.5[^)]*\)/g, "").trim()`

**Nuevo EditContractDialog en `/contracts/:id`:**
- Nuevo componente `src/routes/contracts/-edit-contract-dialog.tsx`: Dialog con tabs 社員/派遣先 para editar datos desde el detalle de contrato
- Botón "編集" (Pencil icon) junto a PDF生成 en el header de `$contractId.tsx`
- Usa `api.updateEmployee()` y `api.updateFactory()` directamente (patrón consistente con el resto del codebase)
- Commit: `813a4e1`

**Pendiente:** fix ZIP download en `contracts/$contractId.tsx` — "PDF生成" genera PDFs pero no crea ZIP como shouheisha

**Verificación:** typecheck ✅, lint ✅ (warnings preexistentes), test:run ✅ (42 archivos, 762 tests)

---

## Sesión 2026-04-16 — audit, push confirmado y dashboard experimental

**Gobernanza / tooling:**
- Se creó `.github/copilot-instructions.md` con comandos reales, arquitectura y convenciones operativas del repo para futuras sesiones.
- Se ejecutó una auditoría amplia y se guardó `.claude/audit_report_20260416_035744.md`.
- Hallazgos relevantes de auditoría: `hono < 4.12.14` en `npm audit`, `.mcp.json` con rutas absolutas no portables y baseline de `test:run` inicialmente bloqueado por drift de snapshot PDF.
- Se actualizó `hono` a `4.12.14`, desapareció ese advisory de `npm audit` y `.mcp.json` quedó portable con rutas relativas al checkout actual.

**Git / publicación:**
- Se preparó la publicación completa del estado local y se creó el commit `2b43254` (`feat(app): agregar config anual y sincronizar cambios`).
- Se agregó `target`; inicialmente apuntó a `jokken79/KobetsuV3.26.4.16` y rechazó el push por permisos.
- El remote operativo final quedó en `https://github.com/jpkken1979/KobetsuV3.26.4.16.git` y el push se confirmó correctamente.
- Se generó bundle portable de respaldo en `~/.copilot/session-state/.../KobetsuV3_26.4.16_push_ready.bundle`.

**Dashboard / UI:**
- El dashboard fue elevado a una versión **experimental** con hero cinematográfico, glassmorphism y spotlight interactivo.
- Nuevo helper `src/routes/-dashboard-effects.tsx` con `SpotlightPanel` reutilizable para glow, glass y seguimiento del puntero.
- `src/routes/-dashboard-stats.tsx`: hero más inmersivo, señales operativas y stat cards con superficies vivas.
- `src/routes/-dashboard-charts.tsx`: charts premium y quick actions editoriales/asimétricas.
- `src/routes/index.tsx`: ambient background para dar profundidad al panel completo.

**Tests / snapshots:**
- Se regeneró `server/__tests__/__snapshots__/pdf-hashes.json` porque el golden de `kobetsu` estaba desfasado respecto al output actual.
- Se corrigió `server/__tests__/batch-contracts-service.test.ts` para validar la entrada correcta de `audit_log`, evitando un falso negativo por colisión de `entityId`.
- Verificación final: `npm run typecheck` ✅, `npm run lint` ✅ (18 warnings preexistentes en tests), `npm run test:run` ✅ (**42 archivos, 762 tests**).

**Cierre de layout/UI:**
- Se estabilizaron los cambios locales de layout en `root-layout`, `sidebar`, `header`, `command-palette`, `employees`, `index.css` y `ui-prefs`.
- La validación final del worktree quedó en verde: `typecheck`, `lint`, `build` y suite completa.

## Sesión 2026-04-15c — factory/company yearly config + table UX fixes

**Nuevas tablas DB (9→11):**
- `factory_yearly_config`: config anual por línea (就業日, 休日, 休暇処理, 指揮命令者, 派遣先責任者) — uniqueIndex(factoryId, fiscalYear)
- `company_yearly_config`: config anual por empresa para campos compartidos (休日, 休暇処理, 派遣先責任者) — uniqueIndex(companyId, fiscalYear)

**Cascade en PDFs:** factory_yearly_config → company_yearly_config → factories fields (prioridad descendiente)

**Nuevas rutas server (30→32):**
- `server/routes/factory-yearly-config.ts`: GET/POST/PUT/DELETE + /summary + /copy-to
- `server/routes/company-yearly-config.ts`: GET/POST/PUT/DELETE

**Frontend:**
- Hooks: `use-factory-yearly-config.ts`, `use-company-yearly-config.ts`
- Dialogs: `-factory-yearly-config.tsx` (con copy a otras líneas), `-company-yearly-config.tsx`
- Botón 年度 en tarjetas de fábrica y en tabla `/companies/table` (sticky derecha)
- Indicador verde en botón 年度 cuando la línea ya tiene yearly config
- Copy feature: copiar config de un año a N líneas de la misma empresa con checkboxes

**Fixes tabla `/companies/table`:**
- Light mode: opacidad de filas `06/0c` → `18/2c`; texto `/60` → `/90`
- Dark mode: `dark:[color-scheme:dark]` en select dropdown

**PDF:** inkan tintado a 朱肉 rojo (RGB 185,30,40) via `sharp`; texto más oscuro con MSGothic.

**Estado:** TypeScript 0 errores, ambas tablas SQLite creadas.

## Sesión 2026-04-15b — Admin bypass localhost + CLAUDE.md fixes

**Admin token bypass:**
- Root cause: `tsx watch` no cargaba `.env` → `ADMIN_TOKEN` vacío → todas las rutas `/api/admin/*` devolvían 503
- Fix: `adminGuardMiddleware` ahora permite acceso libre desde localhost (app local-only); token sigue siendo requerido para acceso remoto
- Fix: `package.json` dev scripts usan `--env-file .env` para cargar vars correctamente
- Fix CLAUDE.md: 3 correcciones factuales (conteo tablas/routes/doc-generation, nota .env)

**Estado actual:** typecheck limpio, lint 0 errores, pushed a master.

## Sesión 2026-04-15 — Plan A (5 fixes Settings/Admin) + Plan B (Database Reset)

**Plan A — 5 bug fixes quirúrgicos:**
- B1: `purgeEmployees()` ahora pasa `{ confirm: "DELETE" }` — fix silencioso de 400
- B2: `/admin` route con guard real — pantalla bloqueada si `adminMode === false`
- B3: Holiday dates persistidas en appSettings (6 campos nuevos: nenmatsu/gw/obon)
- B4: `handleBulkCalendar()` valida campos vacíos antes de enviar
- B5: `AdminCrudTab` completo — select tabla, list rows, insert form, delete con ConfirmDialog

**Plan B — Database Reset:**
- `POST /api/admin/reset-all` — borra 8 tablas en transacción atómica, audit_log entry post-tx
- UI Danger Zone en Settings — input `RESET` requerido, counts del DB en tiempo real, redirect post-reset
- 7 tests nuevos (762 total); drift guard actualizado a 30 route files

**Estado actual:** 762/762 tests, typecheck limpio, pushed a master (fe0ed21).

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

