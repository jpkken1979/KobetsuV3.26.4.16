---
name: Decision — No tocar auth en hardening porque es uso local-only
description: Por que skipeamos BACK-HIGH-1, FRONT-HIGH-1 y FRONT-HIGH-2 del audit 2026-04-29
type: project
auto_saved: true
trigger: decision
date: 2026-04-29
---

## Contexto

El audit profesional del 2026-04-29 identifico 4 hallazgos de severidad ALTA. Tres
de ellos son issues de auth/auth-related:

1. **BACK-HIGH-1**: `POST /api/backup` publico sin auth → DoS por copia repetida de DB
2. **FRONT-HIGH-1**: `ADMIN_TOKEN` persistido en `localStorage` → exfiltrable por XSS futuro
3. **FRONT-HIGH-2**: `x-admin-token` solo viaja en paths `/admin`; no hay validacion de Origin/Referer en mutaciones non-admin

## Decision

**No aplicar ninguna de las 3.** El usuario indico explicitamente que la app es de
uso local-only — solo el corre en su PC, no se expone a internet, no hay otros
usuarios.

## Alternativas descartadas

- **Aplicar igualmente** como defense-in-depth: descartado porque agregaria friccion
  (login, headers extra) sin valor real en el modelo de threat actual.
- **Aplicar solo BACK-HIGH-1** (gateado por token): descartado porque tambien rompe
  el flujo de backup automatico que invoca el endpoint sin token.
- **Mover token a HttpOnly cookie con login local**: descartado porque requiere
  agregar capa de auth completa (sesiones, login form) que es overkill para
  single-user local.

## Cuando re-evaluar

Si en algun momento futuro:
- La app se expone a internet (ej. servidor compartido, deploy publico)
- Otro usuario usa la misma instancia
- Se monta un proxy/tunnel que expone los puertos

→ Reabrir las 3 issues. Estan documentadas en `.claude/memory/session_2026-04-29.md`
y en el reporte del audit con archivo:linea exacto.

## Lo que SI se aplico

Hardening que NO depende de auth (todos en branch `claude/audit-app-refactor-1r0Fw`):
- BACK-HIGH-2: realpath/lstat en restore (filesystem hardening)
- MED-1, MED-2, MED-3, MED-4: filenames, error messages, validacion
- FRONT-MED-1, FRONT-MED-2, FRONT-MED-3: ID validation, noopener, iframe URL whitelist
- LOW-1, LOW-3, calidad: parseInt radix, JSON.parse try/catch, paths absolutos en errores

Total: 832 → 889 tests, 0 lint errors, 0 typecheck errors.

## Riesgo residual aceptado

Si un dia un atacante con write en la red local hace una request a
`http://localhost:8026/api/backup` desde el browser del usuario (CSRF same-origin),
podria disparar copias de DB hasta llenar el disco. **Mitigado parcialmente** por
rate-limit (180 mutaciones/min) y por el hecho de que cada copia es de la DB
completa (~MB), no GB. En local-only el riesgo es bajo.
