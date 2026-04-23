---
name: Contract wizard — split 既存社員/新規入社 + filtros de estado 2026-04-23
description: El Step 2 del wizard divide empleados en 既存/新規入社 según hireDate vs startDate del contrato, con filtros independientes por status (active/onLeave/inactive) y agrupación por (rate, effectiveStartDate)
type: project
auto_saved: true
trigger: decision
date: 2026-04-23
---

## Qué se decidió

El Step 2 del wizard de nuevo contrato (`src/components/contract/employee-selector.tsx`) ahora:

1. **Divide la lista de empleados en 2 secciones visuales**:
   - **既存社員** — `hireDate < contract.startDate` (o sin hireDate). Usan el startDate del wizard.
   - **新規入社** — `startDate ≤ hireDate ≤ endDate`. Cada uno usa SU `hireDate` como startDate efectivo del contrato.
   - Empleados con `hireDate > endDate` se excluyen silenciosamente.

2. **3 checkboxes de filtro por status** (reemplazan el toggle anterior `includeInactive`):
   - ☑ 在職中 (active) — default ON
   - ☐ 休職中 (onLeave) — default OFF
   - ☐ 退職者 (inactive) — default OFF, carga query secundaria lazy por `companyId`

3. **Agrupación de contratos por `(billingRate, effectiveStartDate)`** — antes era solo por rate.
   - 5 既存 @ ¥1700 + 2 新規入社 @ ¥1700 (hireDate 2026/1/8) → 2 contratos, no 1.
   - Para 新規入社, `contractDate`/`notificationDate` se recalculan con `calculateContractDates(hireDate)` (-2/-3 días hábiles).

4. **Preview de split extendido** — cada grupo muestra rate + startDate + badge 既存/新規.

## Por qué

- UX: el usuario trabaja con dos flujos distintos (empleados que vienen del contrato anterior vs nuevos ingresos durante el período) y necesita verlos separados.
- Legal: cada 個別契約書 debe tener el startDate real del empleado. Un empleado que ingresa 2026/1/8 no puede tener contrato con startDate 2025/10/1.
- Los 3 status filters separados son más claros que el toggle binario anterior, especialmente para 休職中 que antes no se podía filtrar.

## Alternativas descartadas

- **Crear un solo contrato con "startDate lógica" por empleado** — rechazado: el schema del contract es uno solo, no puede tener múltiples startDates.
- **Obligar al usuario a hacer 2 wizards separados** (uno para existing, otro para nuevos) — rechazado: fricción innecesaria, el grouping automático es mejor UX.
- **Usar `/contracts/new-hires` existente** — ese flujo es batch por rango de fechas, sin selección manual; no cubre el caso de mezclar existing + new en un mismo wizard.

## Cómo aplicarlo

- Al tocar `employee-selector.tsx`, mantener la agrupación por `(rate, effectiveStartDate)` en `selectedGroups`.
- `getEffectiveStartDate(emp)` es la función clave: si `emp.hireDate >= contract.startDate`, retorna `emp.hireDate`; si no, retorna `contract.startDate`.
- El `handleSubmit` itera `selectedGroups` y dispara `createContract.mutateAsync` por cada uno, con su propio `contractDate`/`notificationDate` recalculado via `calculateContractDates()`.
- El store (`contract-form.ts`) NO se tocó — la lógica de split vive solo en el componente al momento de crear.

## Archivos tocados

- `src/components/contract/employee-selector.tsx` (reescrito, 551 → ~600 líneas)

## Cómo prevenir regresiones

- Verificar siempre que `selectedGroups` use `||` y no `??` al acceder `data.hourlyRate` como fallback — 0 es valor válido para rate.
- Si se modifica `calculateContractDates()` en `src/lib/contract-dates.ts`, verificar que el recálculo para 新規入社 siga siendo consistente.
- La query secundaria de `inactive` corre solo con `showInactive=true` (lazy) — no regresar a cargar siempre.
