---
name: Decision — Override esbuild>=0.25.0 en package.json
description: Cerrar CVE GHSA-67mh-4wv8-2f99 via overrides en vez de esperar upstream drizzle-kit
type: project
auto_saved: true
trigger: decision
date: 2026-04-21
---

## Contexto

drizzle-kit 0.31.10 (latest al 2026-04-21) pulls transitivamente:
```
drizzle-kit -> @esbuild-kit/esm-loader -> @esbuild-kit/core-utils -> esbuild@<=0.24.2
```
esbuild <=0.24.2 tiene **GHSA-67mh-4wv8-2f99** (CVSS 5.3): su dev server acepta requests cross-origin de cualquier sitio. En este proyecto, solo afecta `npm run db:studio` (no `db:push`, no prod runtime).

## Decision

Agregar a `package.json`:
```json
"overrides": {
  "esbuild": ">=0.25.0"
}
```

## Alternativas evaluadas

| Opcion | Decisivo contra |
|--------|-----------------|
| Esperar upstream drizzle-kit | PR abierto hace meses, sin ETA. |
| `npm audit fix --force` | Sugeria downgrade a drizzle-kit@0.18.1 (breaking) — rompe todo. |
| Eliminar `db:studio` | Util para debug, no queremos perderlo. |
| Override con `^0.25.0` | Conflicto con tsx que pide esbuild mas nuevo — npm reportaba "invalid". |
| **Override con `>=0.25.0`** ✓ | Permite cualquier version moderna, cierra el CVE sin romper tsx. |

## Por que fue seguro

- `@esbuild-kit/esm-loader` usa esbuild solo para cargar archivos TS en runtime (transform).
- No depende de API breaking changes entre 0.24 y 0.25+.
- Verificado post-override: `drizzle-kit --version` OK, `generate --help` OK, 762 tests pass, build OK.

## Como revertir

Si alguna vez drizzle-kit upgrade rompe con esbuild nuevo:
1. Quitar el bloque `"overrides"` de `package.json`.
2. `rm -rf node_modules package-lock.json && npm install`.
3. Aceptar los 4 moderates de `npm audit` otra vez.

## Estado

Aplicado en commit `2c96ed7`. Resultado: **`npm audit` = 0 vulnerabilities**.
