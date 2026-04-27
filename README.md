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
- `npm run build`: build de producción

## Seguridad admin

- En producción, si `ADMIN_TOKEN` no está definido, `/api/admin/*` queda deshabilitado.
- Si `ADMIN_TOKEN` está definido, se requiere header `x-admin-token`.
- El frontend puede enviarlo guardando `adminApiToken` en `localStorage`.

## Documentación de ejecución

- [Roadmap V3](docs/v3/ROADMAP_V3.md)
- [Matriz de Migración](docs/v3/MIGRATION_MATRIX.md)
- [Registro de Riesgos](docs/v3/RISK_REGISTER.md)
