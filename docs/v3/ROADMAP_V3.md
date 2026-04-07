# ROADMAP V3

## Fase 0 - Preparación
- Proyecto V3 creado en carpeta dedicada.
- Entorno y scripts normalizados.
- Alcance base definido.

## Fase 1 - Bootstrap técnico
- Base consolidada con arquitectura React + Hono + Drizzle.
- Build de Vite 8 corregido para producción.
- Ajustes de lint y typecheck aplicados.

## Fase 2 - Seguridad base
- `securityHeaders` activos.
- Rate limit para operaciones de mutación.
- Guard de admin por `ADMIN_TOKEN` en `/api/admin/*`.

## Fase 3 - Núcleo de dominio
- Módulos clave integrados: empresas, fábricas, empleados, contratos.
- Flujo de contratos por lote activo.

## Fase 4 - Documentos
- Generación PDF individual y batch disponible.
- Rutas de documentos operativas.

## Fase 5 - Módulos avanzados
- Data-check, importaciones y admin panel integrados.
- Warning de ruta admin corregido (`-table-explorer.tsx`).

## Fase 6 - Datos y migración
- Seed repetible para entorno local y tests.
- `.gitignore` reforzado para evitar versionado de DB y artefactos.

## Fase 7 - Calidad final
- Lint: OK
- Typecheck: OK
- Tests: OK
- Build: OK

## Fase 8 - Operación
- `.env.example` agregado.
- CI de validación agregado.
- Documentación V3 lista.
