---
name: Paridad byte-exacta entre Kobetsu v1 y v3
description: Audit de 7 dominios criticos confirmo zero regresiones; sharp nunca existio en ninguna version
type: project
auto_saved: true
trigger: discovery
date: 2026-04-07
---

## Hipotesis original (refutada)

El usuario sospechaba que v3 (KobetsuV3, esta app) era inferior a v1 (JP-v1.26.3.25-30) y v2 (Kobetsuv2.26.4.1). La sensacion era subjetiva: "creo que la primera version funcionaba mejor".

## Lo que se descubrio

**v3 NO tiene ninguna regresion funcional vs v1.** Los 7 dominios auditados dieron paridad total, varios byte-exacta:

| Dominio | Resultado |
|---|---|
| `contract-dates.ts` (28 tests) | byte-identico |
| `batch-helpers.ts` + `batch-contracts.ts` (9 tests) | byte-identico |
| `koritsu-excel-parser.ts` + `koritsu-pdf-parser.ts` (42 cases) | MD5 identico |
| 9 generators PDF + helpers (4075 LOC) | 0 LOC diff |
| Factory wizard 5 pasos (`-factory-drawer.tsx`) | identico |
| Contract wizard 5 pasos (zustand store) | identico |
| Schema DB (8 tablas, 135 columnas) | identico |
| Admin panel (6 routers admin-*) | identico, mismo middleware seguridad |
| Sellos 印鑑 (`InkanUNS-transparent.png` via PDFKit) | identico |

**v3 es estrictamente mejor que v1 en un punto:** tiene `server/db/migrations/` con SQL generado por Drizzle (v1 usa solo `db:push`).

**v2** es un experimento abandonado: 14K LOC, 7 routers, 4 archivos de tests. No es referencia.

## Bonus: `sharp` nunca existio

`CLAUDE.md` decia "sharp (印鑑 seal processing for PDFs)" desde v1. Pero `sharp` NUNCA estuvo en `package.json` de ninguna version. Los sellos siempre se procesaron con `pdfkit.image()` nativo sobre `InkanUNS-transparent.png`. La rotacion/jitter aleatorio se hace con `Math.random()` en `kobetsu-pdf.ts:574`.

Drift documental heredado de v1 → v3. Eliminado del CLAUDE.md y bloqueado por `claude-md-drift.test.ts`.

## Implicaciones para futuras sesiones

- **No restaurar nada de v1 a v3.** No hay nada que traer.
- **No tirar v3.** Es objetivamente igual o mejor que v1.
- **Si el usuario dice "v1 era mejor", ya tenemos evidencia objetiva de lo contrario.** La sensacion proviene del problema documentado en `decision_db_test_isolation.md`.
- **Verificar siempre antes de creer drift documental.** El audit confirmo que CLAUDE.md tenia 6+ items obsoletos (versiones, lista de routers, conteo de servicios, mencion fantasma de sharp, coverage thresholds). Drift es real y constante.
