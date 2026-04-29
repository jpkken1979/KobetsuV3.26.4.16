# Kobetsu V3

Aplicación unificada para gestión de 派遣 (labor dispatch) con foco en estabilidad, seguridad y mantenibilidad.

## Estado

- Base funcional consolidada (`companies`, `factories`, `employees`, `contracts`, `documents`, `admin`)
- Calidad técnica validada (`lint`, `typecheck`, `test`, `build`)
- Hardening mínimo aplicado (headers de seguridad, rate limit, guard de admin por token)

## Stack

- Frontend: React 19 + TypeScript + TanStack Router/Query
- Backend: Hono + Drizzle ORM + SQLite (`better-sqlite3`)
- Build: Vite 8
- Tests: Vitest

## Configuración

1. Copia `.env.example` a `.env`
2. Ajusta variables según entorno

Variables relevantes:

- `PORT` (default `8026`)
- `FRONTEND_ORIGIN` (default `http://localhost:3026`)
- `ADMIN_TOKEN` (obligatorio en producción para rutas `/api/admin/*`)
- `API_RATE_LIMIT_WINDOW_MS`
- `API_RATE_LIMIT_MAX`
- `BACKUP_KEEP_COUNT` (default `10`)
- `BACKUP_INTERVAL_HOURS` (default `24`)

## Arranque local

```bash
npm install
npm run db:seed -- --force
npm run dev
```

Puertos por default:

- Frontend: `http://localhost:3026`
- API: `http://localhost:8026`

## Scripts

- `npm run dev`: frontend + backend
- `npm run lint`: eslint en `src/` y `server/`
- `npm run typecheck`: `tsc --noEmit`
- `npm run test:run`: seed + tests (serial para evitar race en sqlite)
- `npm run test:coverage`: seed + coverage
- `npm run test:e2e`: tests E2E con Playwright (requiere `npx playwright install chromium` la primera vez)
- `npm run build`: build de producción
- `npm run verify`: lint + typecheck + tests + build

## Seguridad admin

- En producción, si `ADMIN_TOKEN` no está definido, `/api/admin/*` queda deshabilitado.
- Si `ADMIN_TOKEN` está definido, se requiere header `x-admin-token`.
- Las mutaciones admin y `POST /api/backup` requieren `x-admin-token` incluso en localhost.
- El frontend puede enviarlo guardando `adminApiToken` en `localStorage`.

## Dependencias

`npm audit` reporta una vulnerabilidad moderada transitiva de `uuid` vía `exceljs`.
La corrección sugerida por npm baja `exceljs` a `3.4.0`, un cambio mayor hacia atrás
para un flujo crítico de importación/exportación Excel; no aplicar `npm audit fix --force`
sin validar esos flujos.

## Flujos de creación de contratos + bundle PDF

El bundle (個別契約書 + 通知書 + 派遣先台帳 + 派遣元台帳) se puede generar desde
9 entry points distintos en la UI:

1. **Single** — `/contracts/:id` y `/documents` tab 契約別
2. **Set / 一括** — `/contracts` selección múltiple
3. **Batch bundles** (re-generar histórico) — `/history`
4. **Factory 一括** — `/documents` tab 工場一括
5. **ID指定** (派遣先/派遣元) — `/documents` tab ID指定
6. **新規入社者** — `/contracts/new-hires`
7. **途中入社者** — `/contracts/mid-hires`
8. **召聘者 / 外国人材** — `/shouheisha`
9. **Smart-Batch** (multi-factory + auto-clasifica 継続/途中入社者 por nyushabi) — `/contracts/smart-batch`

Detalle técnico en `CLAUDE.md` y `docs/architecture.md`.

## Documentación de ejecución

- [Roadmap V3](docs/v3/ROADMAP_V3.md)
- [Matriz de Migración](docs/v3/MIGRATION_MATRIX.md)
- [Registro de Riesgos](docs/v3/RISK_REGISTER.md)
