---
name: Refactor formato 労働契約書 (keiyakusho-pdf)
description: Grid 16 columnas, sin spacer C/M, fonts uniformes 7pt, shifts adaptativos
type: project
auto_saved: true
trigger: decision
date: 2026-04-23
---

# Refactor de keiyakusho-pdf.ts para matchear "個別契約書TEXPERT2026.1Perfect.pdf"

## Qué cambió

`server/pdf/keiyakusho-pdf.ts` reescrito completo para alinear con la plantilla oficial UNS de referencia.

### Cambios de grid
- **18 → 16 columnas útiles**: eliminado el spacer vertical `C` (izquierda) y `M` (derecha) que creaba una franja gris de 21px
- Índices renombrados: `_D-_I` pasaron a `_C-_H`, `_K,_L` a `_J,_K`, `_N-_R` a `_L-_P`
- Ancho absorbido por la primera columna de valores en cada mitad (C y L)

### Cambios visuales
- Sacado el fondo gris `LBG` de TODOS los labels — distinción por borde + posición en columnas A-B / J-K
- Font base **7pt uniforme** (antes 4.5-6pt) con auto-shrink hasta 3.5pt mínimo
- Labels via helper `lbl()` que fuerza center-align

### Rendering adaptativo de turnos
`parseShifts()` parsea `workHours` en lista estructurada (label/time/break). Luego decide layout:
- 0 shifts: filas vacías
- 1-2 shifts: layout clásico 昼勤 / 休憩 / 夜勤 / 休憩 (4 filas)
- 3-5 shifts: 1 turno por fila con break inline
- 6+ shifts: 2 turnos por fila (hasta 10), font más chico

Fallback del regex FUERZA que el label empiece con letra (no dígito) para evitar partir "8:00~17:00" en label="8" + time="00~17:00". Misma lógica para breakTime.

## Por qué

**Why**: el formato anterior tenía fonts de 4.5pt ilegibles, spacers grises verticales que rompían el flow, y vomitaba 9 turnos en una sola línea corrida. El usuario pidió matchear la plantilla oficial `個別契約書TEXPERT2026.1Perfect.pdf` usando las dimensiones de esa referencia.

**How to apply**: cualquier futuro tweak al layout del 労働契約書 debe:
1. Respetar el grid de 16 columnas (A-B labels | C-H values | I separator | J-K labels | L-P values)
2. Nunca volver a meter `bg: LBG` en celdas — los labels se distinguen por posición
3. Si hay que partir texto multilínea de label, balancear los caracteres por línea (8-8-8 estilo plantilla) para evitar wraps feos en columnas angostas

## Archivos tocados

- `server/pdf/keiyakusho-pdf.ts` — rewrite completo (578 líneas)
- `server/__tests__/__snapshots__/pdfs/keiyakusho.hash` — regenerado via `npm run test:pdf-snapshots:update`

## Verificación

- `npm run typecheck` ✓
- `npm run lint` ✓
- `npm run test:run` ✓ (770 tests)
- `npx tsx test-keiyakusho-shugyojoken.ts` → visual OK en `output/TEST_契約書_労働契約書.pdf`
