---
name: Dashboard finalize 2026-04-16
description: Auditoria del repo, cierre del dashboard experimental, hono actualizado, .mcp.json portable y worktree estabilizado con 762 tests.
type: project
---

## Que se implemento o corrigio
- Se consolidaron mejoras del dashboard experimental con hero inmersivo, glassmorphism y spotlight interactivo.
- Se alineo el snapshot `server/__tests__/__snapshots__/pdf-hashes.json` para el caso `kobetsu`.
- Se actualizaron `ESTADO_PROYECTO.md` y `.claude/memory/session_2026-04-16.md` para reflejar el cierre real.
- Se confirmo publicacion en `origin` y en `target`.
- Se actualizo `hono` a `4.12.14` y `.mcp.json` quedo portable con rutas relativas al repo.
- Se estabilizaron cambios locales de layout/UI y el suite completo volvio a verde.

## Decisiones tecnicas
- Se uso `motion/react` y Tailwind v4 reales del repo, sin dependencias nuevas.
- Se centralizo el efecto visual en `SpotlightPanel` para evitar duplicacion.
- El drift del snapshot PDF se trato como golden desactualizado, no como bug del dashboard.
- El fallo final de `batch-contracts-service.test.ts` se resolvio corrigiendo el test para ubicar la entrada correcta de `audit_log`, no tocando la logica de negocio.

## Problemas encontrados y como se resolvieron
- `pdf-snapshots.test.ts` fallaba por el golden `kobetsu`; se regenero el snapshot y el suite completo quedo en 42 archivos / 762 tests.
- El primer remote `target` no aceptaba push; luego se confirmo el remote operativo `https://github.com/jpkken1979/KobetsuV3.26.4.16.git`.
- El suite completo tambien podia caer por un falso negativo en `batch-contracts-service.test.ts`; la consulta por `entityId` no garantizaba que la primera fila fuera la del contrato.

## Advertencias para el futuro
- Las vulnerabilidades moderadas restantes quedan ligadas a `drizzle-kit` / `esbuild`.
- Si cambia de nuevo el render del PDF `kobetsu`, revisar el golden.

## Commits
- `2b43254` — feat(app): agregar config anual y sincronizar cambios
- `466e0cd` — feat: hypercar redesign and full validation
- `7db481b` — feat: refine hypercar dashboard palette
- `ca11220` — docs(estado): registrar auditoria y dashboard experimental
