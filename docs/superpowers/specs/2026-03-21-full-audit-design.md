# Auditoría 360° — JP Kobetsu v26.3.10

**Fecha:** 2026-03-21
**Tipo:** Reporte de auditoría + Plan de acción priorizado
**Alcance:** Todas las capas de la aplicación, sin sesgo previo

---

## Métricas Generales

| Métrica | Valor |
|---------|-------|
| Archivos TypeScript (server) | 55 |
| Archivos TypeScript/TSX (frontend) | 86 |
| Líneas de código (server) | ~15,358 |
| Líneas de código (frontend) | ~16,304 |
| Tests | 230/230 pasando |
| Archivos de test | 10 |
| Tablas DB | 8 |
| Endpoints API | ~60 |
| Generadores PDF | 9 |
| `tsc --noEmit` | 1 error (dependencia no instalada) |
| `eslint` | Limpio |
| `vite build` | **FALLA** (dependencia no instalada) |

---

## Capa 1: Infraestructura & Build

### Fortalezas
- Stack moderno y coherente: Hono + Drizzle + React 19 + TanStack Router
- Dependencias bien elegidas y sin conflictos de versiones
- Code splitting configurado (recharts, framer-motion, exceljs en chunks separados)
- Auto code splitting de rutas via TanStack Router
- ESLint flat config bien configurado con excepciones justificadas (full-width spaces japoneses)
- TypeScript strict mode sin `any`

### Issues

| ID | Severidad | Issue | Detalle |
|----|-----------|-------|---------|
| INF-1 | **MEDIO** | node_modules desincronizado | `vite build` falla: `@fontsource-variable/space-grotesk` no encontrado. Dependencia está en package.json pero no instalada localmente. `npm install` resuelve. No es un bug del build system — es estado local incompleto. Verificar que CI usa `npm ci` para builds reproducibles. |
| INF-2 | **BAJO** | Typecheck con 1 error | `pdf-parse` types no encontrados — mismo problema de node_modules incompleto. |
| INF-3 | **BAJO** | CLAUDE.md desactualizado | Documenta 184 tests, realmente son 230. Falta documentar `import-koritsu.ts`, `koritsu-pdf-parser.test.ts`, y el conteo actualizado de tests. |

### Recomendaciones
- **INF-1:** Ejecutar `npm install` y verificar que CI instala dependencias frescas. Considerar `npm ci` en CI para builds reproducibles.
- **INF-3:** Actualizar CLAUDE.md con conteo real de tests y nuevas rutas.

---

## Capa 2: Base de Datos

### Fortalezas
- Pragmas SQLite óptimos: WAL mode, FK habilitadas, 20MB cache, busy timeout 5s
- Drizzle ORM previene inyección SQL en todas las queries
- `escapeLike()` helper para búsquedas LIKE seguras
- Unique constraint correctamente aplicado en factories (companyId, factoryName, department, lineName)
- Cascade delete bien aplicado en contract_employees y factory_calendars
- Audit log cubre todas las mutaciones significativas (27 puntos de registro)

### Issues

| ID | Severidad | Issue | Detalle |
|----|-----------|-------|---------|
| DB-1 | **CRÍTICO** | 10 campos en schema.ts sin migración SQL | `complaintUnsAddress`, `managerUnsAddress`, `jobDescription2`, `overtimeOutsideDays`, `workerClosingDay`, `workerPaymentDay`, `workerCalendar`, `agreementPeriodEnd`, `explainerName`, `hasRobotTraining`. Estos campos se usan en PDFs pero pueden no existir en la BD real si solo se aplicó la migración base. |
| DB-2 | **MEDIO** | 16 índices definidos en schema.ts no están en migración | Para el dataset actual (~400 empleados, ~76 fábricas) el impacto es despreciable (SQLite full scan en cientos de rows es microsegundos). Se vuelve relevante si la app escala. Afectaría: `GET /contracts?companyId&status`, `GET /employees?companyId&status`, queries de dashboard. |
| DB-4 | **BAJO** | Audit log sin operationId | Batch operations (crear 50 contratos) generan 50 entradas sin relación entre sí. No hay forma de agrupar operaciones de una transacción. |

### Recomendaciones
- **DB-1:** Verificar primero con `sqlite3 data/kobetsu.db ".schema factories"` si `db:push` ya agregó los campos. **Si ya existen:** solo generar migración para tener trail (`npm run db:generate`). **Si no existen:** generar migración + ejecutar `npm run db:migrate`.
- **DB-2:** Mismo procedimiento — generar migración incremental con los 16 índices. Prioridad baja dado el tamaño actual del dataset.
- **DB-3:** Agregar campo `operationId` (text, nullable) a audit_log para agrupar operaciones batch.

---

## Capa 3: Servidor (API)

### Fortalezas
- **Error handling consistente:** 81 instancias de `catch (err: unknown)` con patrón uniforme `{ error: string }`
- **Transacciones atómicas:** 13 usos de `sqlite.transaction()` en operaciones batch
- **Type safety:** Zod validation en boundaries de API en la mayoría de rutas
- **Separación de capas:** routes → services → db/pdf bien definida
- **0 TODOs/FIXMEs** en código de producción
- **0 importaciones circulares** detectadas
- **Routers consistentes:** Todos exportan `new Hono()` con naming uniforme
- **Rate priority chain** bien implementada con `??` (nullish coalescing, no `||`)

### Issues

| ID | Severidad | Issue | Detalle |
|----|-----------|-------|---------|
| SRV-1 | **ALTO** | `documents-generate.ts` tiene 1,490 líneas | Mezcla 7 responsabilidades: routing HTTP, inicialización de fonts, orquestación de 9 generadores PDF, bundling ZIP, manejo de índices, transacciones de auditoría, transformación de datos (`buildCommonData`). Cuello de botella para mantenimiento y testing. |
| SRV-2 | **BAJO** | Race condition teórica en contractNumber | `generateContractNumber()` se ejecuta dentro de `sqlite.transaction()` que en better-sqlite3 es síncrona (bloquea event loop). Para esta app single-user con SQLite síncrono, es prácticamente imposible de triggear. Solo relevante si la app migra a multi-proceso. |
| SRV-3 | **MEDIO** | Sin timeout en parsing de PDF (import-koritsu) | `parser.getText()` puede colgar con PDFs malformados. Sin `Promise.race()` ni timeout. Para app local single-user, el riesgo es que el usuario cuelgue su propia sesión, no DoS externo. |
| SRV-4 | **MEDIO** | Shift templates POST sin validación Zod | Ruta acepta JSON sin schema, a diferencia de todas las demás rutas. Datos inválidos pueden guardarse. |
| SRV-5 | **MEDIO** | Validación Content-Type usa OR en vez de AND | `import-koritsu.ts:40-42`: acepta archivo si EITHER filename es .pdf OR MIME es application/pdf. Debería requerir ambos. |
| SRV-6 | **MEDIO** | Sin límite global de body size | Hono no limita tamaño de payload por defecto. Zod valida max 10,000 rows pero el JSON ya está en memoria. |
| SRV-7 | **MEDIO** | JSON.parse sin try/catch en calendars | `JSON.parse(holidays)` puede lanzar 500 en vez de 400 para JSON malformado. |
| SRV-8 | **BAJO** | Credenciales default débiles | `middleware/security.ts`: fallback a "jpkken"/"admin123". Aceptable para app local pero documentar que se deben cambiar. |
| SRV-9 | **BAJO** | `koritsu-pdf-parser.ts` (778 líneas) mezcla dos conceptos | PDF text parsing + haizokusaki string decomposition en un solo archivo. |

### Recomendaciones
- **SRV-1:** Refactorizar en 3 módulos: `routes/documents-generate.ts` (routing, ~300L), `services/document-orchestrator.ts` (orquestación), `services/document-bundling.ts` (ZIP + indexing). Criterio de éxito: mismos endpoints, misma respuesta, tests pasan.
- **SRV-3:** Envolver con `Promise.race([parser.getText(), rejectAfter(5000)])`.
- **SRV-4:** Crear Zod schema para shift templates.

---

## Capa 4: Generación de PDFs

### Fortalezas
- 9 generadores cubriendo todos los tipos de documentos legales requeridos
- Grid system pixel-perfect con arrays pre-computados (CX[], RY[])
- Auto-shrink de texto que ajusta font size para caber en celdas
- Detección automática Koritsu via `companyName.includes("コーリツ")`
- Fonts correctamente separados: "JP" (NotoSansJP) para celdas pequeñas, "Mincho" (BIZ UD明朝) para 管理台帳
- 印鑑 (seal) con variación humana (rotación, posición, opacidad)
- Scripts de test manual para cada variante PDF

### Issues

| ID | Severidad | Issue | Detalle |
|----|-----------|-------|---------|
| PDF-1 | **MEDIO** | Duplicación ~90% entre 3 pares Koritsu/estándar | `kobetsu-pdf.ts` (558L) ↔ `koritsu-kobetsu-pdf.ts` (577L), `tsuchisho-pdf.ts` (163L) ↔ `koritsu-tsuchisho-pdf.ts` (275L), `hakensakikanridaicho-pdf.ts` (338L) ↔ `koritsu-hakensakidaicho-pdf.ts` (373L). La diferencia es el grid size y estilo de bordes (rect vs per-side). |
| PDF-2 | **MEDIO** | 0 tests automatizados para PDFs | Solo scripts manuales (`test-pdf.ts`, etc.) que generan archivos — sin assertions. No detectarían regresiones automáticamente. |
| PDF-3 | **BAJO** | `helpers.ts` (444L) mezcla helpers genéricos con específicos | `yen()`, `parseDate()`, `calculateAge()` junto con `getTakaoJigyosho()` (específico de 高雄). |

### Recomendaciones
- **PDF-1:** Evaluar abstracción `GridBasedPDFGenerator` que parametrice grid specs y border strategy. Trade-off: los PDFs son pixel-perfect clones de Excel, así que la abstracción debe preservar fidelidad exacta.
- **PDF-2:** Crear smoke tests que verifiquen: PDF se genera sin error, tiene N páginas esperadas, contiene strings clave (nombre empresa, fecha contrato).

---

## Capa 5: Frontend

### Fortalezas
- **Calidad excepcional (9/10)**
- 0 tipos `any`, 0 TODOs, 0 FIXMEs en todo el frontend
- 85+ anotaciones ARIA (role, aria-label, aria-required, aria-invalid, aria-pressed, aria-hidden, aria-live, aria-current)
- Keyboard navigation con skip link y Escape handlers
- React Query centralizado con `queryKeys` factory — nunca strings raw
- Mutations estandarizadas con `onMutationError()` / `onMutationSuccess()`
- Zustand store con persistence + migration + versionamiento
- Error boundary en root con fallback UI + reset
- `useUnsavedWarning` para prevenir pérdida de datos en forms
- Virtual scrolling en tabla de empleados
- Loading states consistentes (skeletons)
- Empty states con componente reutilizable

### Issues

| ID | Severidad | Issue | Detalle |
|----|-----------|-------|---------|
| FE-1 | **MEDIO** | Solo 2 archivos de test frontend | `table-grid.test.tsx` (3 tests) y `table-controls.test.tsx` (2 tests) son smoke tests. 95%+ de componentes sin tests. |
| FE-2 | **BAJO** | Error boundary solo en root | Si un componente en una ruta falla, toda la app muestra error. Error boundaries por ruta darían mejor UX. |
| FE-3 | **BAJO** | Archivos de ruta grandes pero justificados | `koritsu.tsx` (1,024L), `batch.tsx` (769L), `new-hires.tsx` (730L) — cada uno es un flujo completo con estado local. No son god objects pero podrían beneficiarse de extracción de sub-componentes. |

### Recomendaciones
- **FE-1:** Priorizar tests para: contract wizard (5 steps), employee selector (rate grouping), batch preview (cálculos).
- **FE-2:** Agregar error boundaries por ruta para aislar fallos.

---

## Capa 6: Testing

### Fortalezas
- **230 tests determinísticos** que pasan en ~6 segundos
- Tests enfocados en lógica de negocio crítica: rate priority chain, business days, factory assignment, dispatch mapping, majority vote
- Test de seguridad: path traversal prevention
- Test de edge cases: billingRate=0 (nullish vs falsy), dates con timezone, Zod empty strings
- Koritsu PDF parser con 42 tests usando datos reales desordenados

### Issues

| ID | Severidad | Issue | Detalle |
|----|-----------|-------|---------|
| TST-1 | **ALTO** | 0 tests de integración para rutas API | 13 archivos de rutas con ~60 endpoints, ninguno tiene test de HTTP request/response. |
| TST-2 | **ALTO** | 0 tests automatizados para PDFs | 9 generadores sin ninguna assertion automática. |
| TST-3 | **MEDIO** | 6 servicios sin tests | `contract-number.ts`, `db-utils.ts`, `document-files.ts`, `document-index.ts`, `import-utils.ts`, `contract-assignment.ts` (parcial). |
| TST-4 | **MEDIO** | Coverage thresholds bajos | 60% lines/statements (industria: 80%+). Coverage solo mide `server/services/` + 2 archivos frontend. |
| TST-5 | **MEDIO** | 0 tests E2E | Playwright está en devDependencies pero sin tests. Flujo completo (crear contrato → generar PDF → descargar) no tiene cobertura automatizada. |

### Recomendaciones
- **TST-1:** Crear `routes.integration.test.ts` con: POST /contracts (válido/inválido), GET /contracts con filtros, POST /contracts/batch, error responses.
- **TST-2:** Smoke tests por generador: genera sin error, N páginas, contiene strings clave.
- **TST-5:** 1-2 tests E2E con Playwright para flujos críticos.
- **TST-4:** Subir thresholds a 75% lines cuando se agreguen tests de rutas.

---

## Capa 7: Operaciones & Mantenibilidad

### Fortalezas
- CI pipeline en GitHub Actions: lint → typecheck → build → test → coverage
- Audit log exhaustivo con 27 puntos de registro
- Endpoint de backup: `POST /api/backup`
- SQLite WAL mode para durabilidad
- `.gitignore` bien configurado (excluye db, output, env, dist)

### Issues

| ID | Severidad | Issue | Detalle |
|----|-----------|-------|---------|
| OPS-1 | **MEDIO** | Sin backup automático | Solo manual via `POST /backup`. No hay cron ni pre-operation backup. Backups se guardan en mismo directorio que BD activa (single point of failure). Sin política de retención — se acumulan indefinidamente. |
| OPS-2 | **MEDIO** | Sin logging estructurado | Errores van a `console.error`. No hay logger (winston, pino) con niveles y timestamps. |
| OPS-3 | **MEDIO** | Scripts orphan en package.json | `memory:ui` y `memory:test` apuntan a `.claude/memory-engine/` que **no existe**. Artefactos de integración legacy removida. |
| OPS-4 | **MEDIO** | Ruta EXPORT_DIR hardcodeada | `server/routes/factories.ts`: `const EXPORT_DIR = "E:\\TestKintai"` — path Windows-specific, no configurable. Debería ser env var. |
| OPS-5 | **BAJO** | Sin `npm audit` en CI | Pipeline no verifica vulnerabilidades de dependencias. |
| OPS-6 | **BAJO** | Sin Dockerfile ni deploy config | App local sin deployment automatizado. Aceptable para uso actual. |
| OPS-7 | **BAJO** | Sin health check profundo | `GET /health` solo devuelve `{ status: "ok" }`. No verifica conectividad DB. |

### Recomendaciones
- **OPS-1:** Agregar backup automático antes de operaciones destructivas + política de retención (últimos N backups).
- **OPS-3:** Eliminar `memory:ui` y `memory:test` de package.json.
- **OPS-4:** `const EXPORT_DIR = process.env.EXPORT_DIR ?? "E:\\TestKintai"`.
- **OPS-5:** Agregar `npm audit --audit-level=moderate` al CI.
- **OPS-7:** Health check que verifique `SELECT 1` en SQLite.

---

## Scorecard Global

| Capa | Puntuación | Fortaleza principal | Debilidad principal |
|------|-----------|---------------------|---------------------|
| Infraestructura | **7.5/10** | Stack moderno y coherente | node_modules local desincronizado |
| Base de datos | **7/10** | Pragmas óptimos, Drizzle seguro | Migraciones desincronizadas (verificar si db:push ya aplicó) |
| Servidor | **7.5/10** | Error handling consistente, type safety | `documents-generate.ts` monolítico (1,490L) |
| PDFs | **8/10** | Pixel-perfect, grid system robusto | Duplicación 90% Koritsu/estándar |
| Frontend | **9/10** | 0 any, ARIA excelente, patterns limpios | Solo 2 tests frontend |
| Testing | **6.5/10** | Tests enfocados en lógica crítica | 0 integration tests, 0 E2E, 0 PDF tests |
| Operaciones | **6/10** | CI pipeline, audit log exhaustivo | Scripts orphan, EXPORT_DIR hardcodeado, sin backup auto |

### **Score General: 7.3 / 10**

**Veredicto:** Código maduro y profesional con excelente frontend y type safety. Las debilidades están en testing (falta de integration/E2E), base de datos (verificar si migraciones están sincronizadas via db:push), y un archivo monolítico en servidor. La app funciona bien para uso diario single-user. Los riesgos principales son de mantenibilidad a largo plazo, no de estabilidad actual.

### Gaps no cubiertos en esta auditoría
- Verificación de integridad de datos existentes (huérfanos, FK rotas)
- Verificación de backup/restore funcional
- Compliance legal de campos PDF vs 派遣法第26条
- Auditoría de dependencias (`npm audit`)
- Comportamiento bajo errores parciales en generación de PDF batch

---

## Plan de Acción Priorizado

### P0 — Crítico (resolver antes de agregar features)

| # | Acción | Esfuerzo | Verificación | Issue(s) |
|---|--------|----------|-------------|----------|
| 1 | Verificar/sincronizar migraciones DB (10 campos) | 1 hora | `sqlite3 data/kobetsu.db ".schema factories"` muestra los 10 campos | DB-1 |
| 2 | Verificar node_modules y CI (`npm ci` en workflow) | 30 min | `npm run build` pasa | INF-1, INF-2 |
| 3 | Agregar timeout a PDF parsing en import-koritsu | 30 min | Test manual con PDF corrupto no cuelga | SRV-3 |
| 4 | Eliminar scripts orphan de package.json | 5 min | `npm run memory:ui` ya no existe | OPS-3 |
| 5 | Hacer EXPORT_DIR configurable via env var | 10 min | Ruta funciona sin hardcode | OPS-4 |

### P1 — Alto (próximas 2 semanas)

| # | Acción | Esfuerzo | Verificación | Issue(s) |
|---|--------|----------|-------------|----------|
| 4 | Agregar Zod validation a shift-templates POST/PUT | 1 hora | POST con datos inválidos retorna 400 | SRV-4 |
| 5 | Corregir validación Content-Type (OR→AND) | 30 min | Upload de .txt renombrado a .pdf es rechazado | SRV-5 |
| 6 | Crear integration tests para rutas API principales | 4-5 días | `npm run test:run` incluye tests de POST/GET /contracts, /batch, error responses | TST-1 |
| 7 | Crear smoke tests para generadores PDF | 3-4 días | Cada generador tiene al menos 1 test: genera sin error, N páginas | TST-2, PDF-2 |
| 8 | Agregar body size limit middleware | 1 hora | Payload >10MB retorna 413 | SRV-6 |

### P2 — Medio (próximo mes)

| # | Acción | Esfuerzo | Verificación | Issue(s) |
|---|--------|----------|-------------|----------|
| 9 | Refactorizar `documents-generate.ts` en 3 módulos | 3-5 días | Todos los PDF endpoints funcionan igual, tests pasan | SRV-1 |
| 10 | Tests para 6 servicios sin cobertura | 1-2 días | Coverage de services sube a 85%+ | TST-3 |
| 11 | Tests frontend para wizard, employee selector, batch | 5+ días | Al menos 1 test por step del wizard | FE-1 |
| 12 | Error boundaries por ruta (TanStack errorComponent) | 2 horas | Error en /contracts no mata la app completa | FE-2 |
| 13 | Backup automático pre-operaciones destructivas | 3 horas | `POST /contracts/purge` crea backup previo | OPS-1 |
| 14 | Actualizar CLAUDE.md (230 tests, nuevas rutas) | 1 hora | Conteos y rutas reflejan estado actual | INF-3 |
| 15 | Generar migración para 16 índices | 1 hora | `npm run db:generate` + `db:migrate` completo | DB-2 |

### P3 — Bajo (cuando haya tiempo)

| # | Acción | Esfuerzo | Issue(s) |
|---|--------|----------|----------|
| 16 | Evaluar abstracción PDF Koritsu/estándar | 2-3 días | PDF-1 |
| 17 | Dividir `koritsu-pdf-parser.ts` en 2 módulos | 1 día | SRV-9 |
| 18 | Agregar operationId a audit_log | 2 horas | DB-3 |
| 19 | Health check con verificación DB | 30 min | OPS-4 |
| 20 | Structured logging (pino) | 1 día | OPS-2 |
| 21 | Subir coverage thresholds a 75% | Depende de P1-P2 | TST-4 |
| 22 | Agregar `npm audit` al CI pipeline | 30 min | OPS-5 |

---

## Lo Bueno — Resumen Ejecutivo

1. **Frontend excepcional** — 9/10, zero `any`, 85+ ARIA annotations, patterns consistentes
2. **Type safety de punta a punta** — Strict TS + Zod en boundaries
3. **Tests enfocados en lo que importa** — Rate priority, business days, dispatch mapping, factory assignment
4. **Error handling profesional** — 81 catch blocks consistentes, toast standardization
5. **Domain knowledge embebido** — CLAUDE.md exhaustivo, reglas de negocio bien codificadas
6. **Zero marcadores de deuda** — 0 TODOs, 0 FIXMEs, 0 hacks en código de producción (verificado con grep en server/ y src/)
7. **Audit trail completo** — 27 puntos de registro cubriendo todas las mutaciones
8. **Generación PDF pixel-perfect** — Grid system robusto con auto-shrink

## Lo Malo — Resumen Ejecutivo

1. **Migraciones DB desincronizadas** — 10 campos + 16 índices en schema.ts sin migración SQL (verificar si db:push ya los aplicó)
2. **Testing incompleto** — 0 integration tests, 0 E2E, 0 PDF tests, 6 servicios sin cobertura
3. **Archivo monolítico** — `documents-generate.ts` (1,490L) con 7 responsabilidades
4. **Sin timeout en parsing PDF** — Riesgo de hang de sesión de usuario
5. **Duplicación PDF** — 3 pares Koritsu/estándar con 90% overlap
6. **Concurrencia bloqueante** — better-sqlite3 síncrono bloquea event loop durante transacciones largas (batch creates), deteniendo ALL HTTP requests
