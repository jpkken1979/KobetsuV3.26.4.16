---
name: 8va forma de creación de contratos — /contracts/by-line
description: Selección granular de empleados de UNA línea con startDate/endDate individuales por persona; agrupa server-side por (rate, startDate, endDate)
type: project
auto_saved: true
trigger: decision
date: 2026-04-28
---

## Qué se decidió

Agregar una **8va vía** de creación de contratos: `/contracts/by-line`. A diferencia de `/contracts/batch` (que crea por línea entera con fechas globales) y `/contracts/mid-hires` (que solo permite override de fecha por línea), esta nueva ruta permite:

- Elegir **una sola línea** (radio único, no checkbox múltiple)
- Listar todos los empleados activos con `katakanaName + billingRate`
- Marcar/desmarcar cada empleado individualmente con checkbox
- Editar **startDate/endDate por empleado** (date picker inline en cada fila)

Útil para casos como **六甲電子 製造1課 con 15名** donde 13 tienen contrato 2025/8/3→2026/8/2 pero hay tochuunyuusha (中途入社者) con fechas distintas dentro de la misma línea.

## Por qué

Caso de uso real reportado por el usuario: en el batch normal solo aparecen las tarifas agrupadas, sin nombres ni capacidad de excluir individuos ni de mezclar fechas dentro de la misma línea. La opción A (ampliar `/contracts/batch`) hubiera inflado esa pantalla; la opción B (nueva ruta dedicada) separa el caso de uso "selección granular" del "todos a una".

## Decisiones específicas (confirmadas con el usuario)

1. **Defaults globales solo afectan filas limpias** — al cambiar el startDate/endDate global, solo se aplica a filas con `startDirty === false` / `endDirty === false`. Las ediciones manuales se preservan.
2. **billingRate read-only** — la pantalla muestra la tarifa pero no permite editarla. Para cambiarla, ir a `/employees`.
3. **PDFも生成** checkbox global, igual que en `/contracts/batch`.
4. **Nombre del menú**: `ラインで個別選択` con badge `NEW`.

## Cómo funciona la agrupación

Server-side en `executeByLineCreate()` (`server/services/batch-contracts/write.ts`):

```
groupKey = `${effectiveRate}|${startDate}|${endDate}`
effectiveRate = employee.billingRate ?? employee.hourlyRate ?? factory.hourlyRate
```

Una transacción única crea N contratos (uno por grupo) y asigna cada empleado al contrato de su grupo con su `hourlyRate` individual.

## Archivos tocados

**Backend (3):**
- `server/services/batch-contracts/types.ts` — tipos `ByLineParams`, `ByLineGroup`, `ByLineCreateResult`
- `server/services/batch-contracts/write.ts` — `executeByLineCreate()`
- `server/routes/contracts-batch.ts` — schema zod `byLineSchema` + handler `POST /api/contracts/batch/by-line`

**Frontend (4):**
- `src/lib/api-types.ts` — `ByLineBatchPayload`, `ByLineBatchResult`, `ByLineGroup`, `ByLineCreatedContract`
- `src/lib/api.ts` — método `api.byLineBatchCreate()`
- `src/lib/hooks/use-contracts.ts` — hook `useByLineBatchCreate()`
- `src/routes/contracts/by-line.tsx` — pantalla con cascade (1 línea), defaults globales con preset 1月/3月/6月/1年, lista de empleados con date pickers individuales, preview lateral agrupado
- `src/components/layout/sidebar.tsx` — entrada `ラインで個別選択` (icon `ListChecks`, badge `NEW`, indent en grupo principal)

**Tests (1):**
- `server/__tests__/by-line-batch.test.ts` — 5 tests (agrupación misma rate+fechas, fechas distintas, rates distintas, hourlyRate per-employee, vacío)

## Endpoint

`POST /api/contracts/batch/by-line`

```json
{
  "companyId": 1,
  "factoryId": 5,
  "employees": [
    { "employeeId": 12, "startDate": "2025-08-03", "endDate": "2026-08-02" },
    { "employeeId": 14, "startDate": "2026-02-15", "endDate": "2026-08-02" }
  ],
  "generatePdf": false
}
```

Response: `{ created, contracts[], contractIds[], groups[], generatePdf }`

## Cómo aplicar / cuándo usar esta ruta

- **Usar `/contracts/batch`** cuando todos los empleados de la línea tienen mismas fechas (sin tochuunyuusha en el medio).
- **Usar `/contracts/by-line`** cuando hay que mezclar fechas distintas dentro de la misma línea o excluir manualmente algunos empleados.
- El drift guard (`server/__tests__/claude-md-drift.test.ts`) **NO se actualiza** porque no se agregaron archivos nuevos en `server/routes/` (el handler vive dentro del existente `contracts-batch.ts`).

## Verificación

- `npm run typecheck` ✅
- `npm run lint` ✅
- `npx vitest run server/__tests__/by-line-batch.test.ts` ✅ 5/5 tests
- `npx vitest run server/__tests__/claude-md-drift.test.ts` ✅
