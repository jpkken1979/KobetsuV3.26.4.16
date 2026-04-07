# Plan de Mejoras — Estado Actual (2026-03-16)

## Objetivo
Dejar la app en estado confiable, mantenible y verificable, con upgrades conservadores y sin romper comportamiento de negocio.

---

## Estado de ejecución

### Fase 0 — Baseline técnico
- [x] Reinstalación limpia de dependencias (`npm ci`)
- [x] `lint`, `typecheck`, `test:run`, `build` en verde

### Fase 1 — Auditoría estructural
- [x] Matriz de riesgos por severidad
- [x] Guía corta de arquitectura y convenciones

### Fase 2 — Verificación y upgrades Context7 (conservador)
- [x] Matriz `actual vs recomendado`
- [x] Aplicados solo patch/minor de bajo riesgo

### Fase 3 — Limpieza de código basura y gobernanza
- [x] Eliminación de artefactos operativos versionados
- [x] Endurecimiento de `.gitignore`
- [x] Template de PR y workflow de calidad en CI

### Fase 4 — Refactor Top hotspots
- [x] `server/routes/contracts.ts`
- [x] `server/routes/import.ts`
- [x] `server/routes/documents.ts`
- [x] `src/routes/companies/index.tsx`
- [x] `src/routes/contracts/batch.tsx`

---

## Worklog técnico (implementado)

### Servicios/helpers añadidos
- `server/services/contract-writes.ts`
- `server/services/import-assignment.ts`
- `server/services/document-files.ts`
- `src/routes/companies/-shared.tsx`
- `src/routes/contracts/-batch-preview.ts`

### Documentación añadida
- `docs/audit/2026-03-16-risk-matrix.md`
- `docs/audit/2026-03-16-context7-upgrade-backlog.md`
- `docs/ARCHITECTURE_GUIDELINES.md`

### Gobernanza añadida
- `.github/pull_request_template.md`
- `.github/workflows/quality.yml`

---

## Backlog vigente priorizado

### P1 — Cobertura funcional crítica

1. Suite E2E mínima (Playwright) para contratos, batch y documentos.
2. Smoke coverage del flujo de importación para validar fechas Excel/eras japonesas y preview frontend.

### P2 — Endurecimiento de contratos

1. Estrategia explícita de deprecación para payload legacy de contratos (`employeeIds`).
2. Tests de integración que documenten compatibilidad entre `employeeIds` y `employeeAssignments`.

### P3 — Backlog técnico diferido

1. Ronda separada para upgrades mayores con ventana de migración y rollback explícito.
2. Evaluación de reducción de peso de bundle/chunks grandes (`exceljs` y afines).

## Nota operativa

- Al 2026-03-31 se preservan cambios funcionales locales en el flujo de importación para mejorar parsing de fechas Excel y eras japonesas; no se consideran ruido de worktree.
