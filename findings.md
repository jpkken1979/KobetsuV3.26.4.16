# Findings

> Estado del archivo: este documento conserva hallazgos de la auditoría de 2026-03-15/16. No debe leerse como lista de bugs actualmente abiertos salvo en la sección `Remaining risks (non-blocking)`.

## Documentation / Memory

- `CLAUDE.md` describe una versión más madura del sistema que todavía debe contrastarse contra el código real.
- `ESTADO_PROYECTO.md` presenta al proyecto como "producción-listo" y "estable"; esta afirmación necesita verificación porque el usuario pidió una auditoría de punta a punta.

## Architecture

- Backend: Hono + Drizzle + better-sqlite3, con rutas de contratos/documentos/importación especialmente grandes.
- Frontend: React 19 + TanStack Router/Query + Zustand, con peso desproporcionado en `src/routes/companies/index.tsx` y su tabla asociada.

## Early Risk Signals

- `src/routes/companies/index.tsx` supera 2100 líneas.
- `src/routes/companies/table.tsx` supera 1300 líneas.
- `server/routes/documents.ts` y `server/routes/contracts.ts` concentran demasiada lógica de orquestación y negocio.

## Confirmed Issues At Audit Time

- `src/components/contract/employee-selector.tsx`: permite seleccionar empleados del mismo cliente pero fuera del factory/line elegido.
- `src/components/contract/employee-selector.tsx`: reconstruye `selectedByRate` desde dos queries superpuestas y puede duplicar `employeeAssignments`.
- `server/routes/import.ts`: infiere `factoryId` por `resolvedFactoryName` incluso cuando `配属先`/`配属ライン` están vacíos.
- `src/routes/settings/index.tsx` + `server/routes/factories.ts`: la UI habla de `workerCalendar`, pero el endpoint actualiza `calendar`.
- `src/routes/settings/index.tsx` + `server/routes/dashboard.ts`: el ajuste `conflictWarningDays` no gobierna el dashboard.
- `server/routes/dashboard.ts`: ventanas distintas para contratos por vencer (30 vs 60 días).

## Resolved After Audit

- Restricción de selección de empleados al `factoryId` correcto en el wizard de contratos.
- Eliminación de duplicados en `employeeAssignments` y rechazo backend de duplicados.
- Corrección del import para no inferir `factoryId` con `配属先` / `配属ライン` vacíos.
- Alineación de `workerCalendar` en Settings con el endpoint backend.
- Consumo real de `conflictWarningDays` desde dashboard.
- Unificación de la ventana de contratos por vencer.

## 2026-03-16 — Post-implementation status

### Resolved in this cycle

- Se estabilizó el entorno y desaparecieron errores de toolchain (lint/typecheck/tests/build en verde).
- Se redujo duplicación en rutas críticas mediante servicios extraídos:
  - `contract-writes`, `import-assignment`, `document-files`.
- Se separó lógica compartida de frontend en módulos dedicados:
  - `src/routes/companies/-shared.tsx`
  - `src/routes/contracts/-batch-preview.ts`
- Se incorporó gobernanza de calidad con workflow CI y template de PR.
- Se retiraron artefactos operativos versionados y se reforzó `.gitignore`.

### Remaining risks (non-blocking)

- `exceljs` sigue siendo el chunk más pesado en build y requiere evaluación futura.
- Persisten upgrades mayores diferidos para una ventana separada de migración (Vite, Drizzle ORM, Recharts, Framer Motion).
- Falta suite E2E mínima para cobertura funcional de flujos críticos de UI.
