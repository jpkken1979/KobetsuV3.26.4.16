# AUDIT_REPORT.md — Auditoría Técnica y Refactor

**Fecha:** 2026-03-16  
**Proyecto:** JP-v26.3.10 個別契約書管理システム  
**Commit de implementación:** `9d98a08`

---

## 1) Baseline de salud (bloqueante)

Se normalizó el entorno con instalación limpia y se validó el estado técnico final:

- ✅ `npm ci`
- ✅ `npm run lint`
- ✅ `npm run typecheck`
- ✅ `npm run test:run` (**163/163 tests passing**)
- ✅ `npm run build`

Resultado: entorno consistente y reproducible (sin fallos de toolchain).

---

## 2) Cambios aplicados por fases

### Fase 1 — Auditoría estructural

Entregables agregados:

- `docs/audit/2026-03-16-risk-matrix.md`
- `docs/ARCHITECTURE_GUIDELINES.md`

### Fase 2 — Actualización conservadora (Context7)

Actualizados (solo patch/minor):

- `@tanstack/react-router` → `1.167.3`
- `@tanstack/router-devtools` → `1.166.9`
- `@tanstack/router-plugin` → `1.166.12`
- `hono` → `4.12.8`
- `drizzle-kit` → `0.30.6`

Registro: `docs/audit/2026-03-16-context7-upgrade-backlog.md`

### Fase 3 — Limpieza de repo / deuda de mantenibilidad

- Eliminados artefactos operativos versionados (`output/*`, logs, `typecheck_output.txt`).
- Endurecido `.gitignore` para prevenir recidiva.
- Añadida gobernanza:
  - `.github/pull_request_template.md`
  - `.github/workflows/quality.yml`

### Fase 4 — Refactor de hotspots (sin cambio funcional)

Backend:
- `server/services/contract-writes.ts` (normalización de asignaciones de contrato)
- `server/services/import-assignment.ts` (resolución de `factoryId` por reglas explícitas)
- `server/services/document-files.ts` (sanitización/descarga segura)
- Rutas adaptadas:
  - `server/routes/contracts.ts`
  - `server/routes/import.ts`
  - `server/routes/documents.ts`

Frontend:
- `src/routes/companies/-shared.tsx` (constantes + inputs reutilizables)
- `src/routes/contracts/-batch-preview.ts` (preview local puro)
- Rutas adaptadas:
  - `src/routes/companies/index.tsx`
  - `src/routes/contracts/batch.tsx`

---

## 3) Riesgos residuales (no bloqueantes)

- `exceljs` sigue generando chunk grande en build (esperable, ya aislado por chunking).
- Hay mejoras diferidas para próximas rondas mayores:
  - `vite` major
  - `drizzle-orm` major
  - `recharts` major
  - `framer-motion` major

---

## 4) Recomendaciones siguientes

1. Añadir tests de integración para payload legacy vs preferido en contratos (`employeeIds` vs `employeeAssignments`).
2. Incorporar smoke E2E (Playwright) para:
   - `/contracts/new`
   - `/contracts/batch`
   - flujo de generación de documentos
3. Planificar una ronda separada de upgrades mayores con ventana de migración y rollback explícito.
