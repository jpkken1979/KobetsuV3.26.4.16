# lib/ — Helpers y Hooks compartidos

## Hooks React Query (21 archivos)

### Dominio — CRUD

| Hook | Propósito |
|------|-----------|
| `use-companies.ts` | Companies CRUD + lista con fábricas embebidas |
| `use-factories.ts` | Factories CRUD + bulk roles/calendars |
| `use-employees.ts` | Employees CRUD + filtro por fábrica |
| `use-contracts.ts` | Contracts CRUD + operaciones batch |
| `use-data-check.ts` | Matriz de completitud de datos |
| `use-shift-templates.ts` | Shift pattern CRUD |
| `use-company-yearly-config.ts` | Config anual por empresa |
| `use-factory-yearly-config.ts` | Config anual por línea |
| `use-contract-wizard.ts` | Wiring del wizard 5-step + split por tarifa |
| `use-koritsu-import.ts` | Flujo import コーリツ (Excel + PDF parse) |
| `use-pdf-versions.ts` | Historial de versiones PDF generadas |

### Admin Panel — token-gated

| Hook | Propósito |
|------|-----------|
| `use-admin-tables.ts` | Lista de tablas disponibles |
| `use-admin-columns.ts` | Metadata de columnas para grilla admin |
| `use-admin-rows.ts` | Paginación de filas de cualquier tabla |
| `use-admin-crud.ts` | Create / update / delete (controlado por servidor) |
| `use-admin-sql.ts` | SELECT-only runner con blocklist |
| `use-admin-stats.ts` | Métricas agregadas (totales, drift, mutaciones) |
| `use-admin-backup.ts` | Backup manual + listado de snapshots |

### Utility / UX

| Hook | Propósito |
|------|-----------|
| `use-theme.ts` | Estado de tema light/dark |
| `use-debounce.ts` | Utility debounced value |
| `use-unsaved-warning.ts` | Guard against accidental navigation with unsaved changes |
| `use-reduced-motion.ts` | Respeta `prefers-reduced-motion` para animaciones |

## Helpers

| Archivo | Propósito |
|---------|----------|
| `api-types.ts` | Todas las interfaces TypeScript agrupadas por dominio |
| `api.ts` | Wrapper fetch typed con manejo de errores |
| `query-keys.ts` | Factory centralizado de claves React Query |
| `mutation-helpers.ts` | Helpers compartidos de toast para mutations |
| `constants.ts` | Constantes globales (rate multipliers, formatos) |
| `app-settings.ts` | Configuración de la app (tema, densidad, etc.) |
| `chart-colors.ts` | Paleta compartida para Recharts (light/dark) |

## Utils

| Función/Archivo | Propósito |
|----------------|-----------|
| `utils.ts` | `cn()` — clsx + tailwind-merge, join classes safely |
| `shift-utils.ts` | Cálculos de turnos, horas y descansos |
| `contract-dates.ts` | Espejo parcial de `server/services/contract-dates` para el cliente |
| `excel/` | Parsers/builders ExcelJS compartidos (import/export) |

## API Types

Todas las interfaces TypeScript del dominio viven en `api-types.ts`, agrupadas por:
- Company / Factory / Employee
- Contract / ContractEmployee
- Calendar / ShiftTemplate
- PDF / Document
- Admin / Stats
- Import (Koritsu, Factories, Employees)

## API Client

`api.ts` exporta un wrapper fetch typed que:
- Añade `Authorization: Bearer <token>` cuando corresponde
- Maneja errores HTTP con mensajes legibles
- Valida respuestas con Zod (where applicable)
- Proxea a `/api/*` en dev (Vite) y directo a `localhost:8026` en producción
