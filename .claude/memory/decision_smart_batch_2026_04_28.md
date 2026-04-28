---
name: Decision smart-batch — auto-clasificacion 継続/途中入社者
description: Justificacion de las 5 decisiones tecnicas del flujo smart-batch
type: project
auto_saved: true
trigger: decision
date: 2026-04-28
---

## Contexto

El usuario reporto un caso real: hacer ikkatsu de toda una fabrica con un
rango global (ej. 2025/10/1 → 2026/9/30) y que el sistema automaticamente
clasifique a los empleados:

- Antiguos (`hireDate < globalStart`) → contrato del rango completo
- Tochuunyusha (`globalStart ≤ hireDate ≤ globalEnd`) → contrato desde
  su nyushabi real hasta `globalEnd`
- Future (`hireDate > globalEnd`) → descartar

Antes habia que hacer dos operaciones (ikkatsu + mid-hires por separado).

## Decisiones tomadas

### 1. `hireDate IS NULL` → tratar como continuation

**Alternativa descartada:** excluir igual que mid-hires.

**Por que:** smart-batch es un flujo de "todo el factory de una vez".
Perder empleados sin fecha registrada arruina el flujo. Asumir que son
antiguos (continuation, contrato del rango completo) es el default mas
util. Si el usuario quiere ser estricto, edita el empleado y le agrega
fecha.

### 2. NO aplicar cap automatico por 抵触日

**Alternativa descartada:** cap como hace `mid-hires` (endDate =
conflictDate - 1 dia).

**Por que:** smart-batch es **multi-factory** y cada uno puede tener
conflictDate distinto. Hacer cap automatico haria que el endDate
"global" no sea respetado, sorprendiendo al usuario. Si quiere capear,
lo hace en la UI antes de submit (consistente con `by-line`).

### 3. Multi-factory: loop interno por factoryId

**Alternativa descartada:** una sola transaccion para TODOS los factories.

**Por que:** `executeByLineCreate` ya esta diseñado para single-factory
con su propia transaccion. Cambiar la firma seria breaking. Loop externo
+ una transaccion por factory es tan atomico para la UX (cada factory
falla o exito independiente) y mantiene la primitiva sin cambios.

### 4. Reusar `executeByLineCreate` en vez de duplicar logica

**Alternativa descartada:** funcion `executeSmartBatchCreate` con su
propia logica de agrupacion.

**Por que:** `executeByLineCreate` ya agrupa por (rate, startDate,
endDate) y maneja la transaccion. Smart-batch solo aporta la
clasificacion (`analyzeSmartBatch`); la creacion delega a la primitiva
existente. Cero duplicacion. Si en el futuro se cambia la logica de
agrupacion, smart-batch hereda automaticamente.

### 5. Preview obligatorio antes de crear

**Alternativa descartada:** un solo endpoint que clasifica + crea.

**Por que:** generar 50+ PDFs sin que el usuario vea quien entra como
continuation vs midHire es destructivo. El patron de mid-hires/new-hires
ya tiene preview, smart-batch lo replica.

## Consecuencias

- Smart-batch es la primitiva mas conveniente para el caso comun.
- Mid-hires sigue existiendo para el caso "solo procesar tochuunyusha
  con cap automatico por 抵触日" (workflows distintos).
- By-line sigue existiendo para "selecccion manual con fechas custom".
- Los 3 flujos coexisten porque cada uno cubre un caso de uso real.

## Archivos clave

- `server/services/batch-contracts/read.ts:380+` — `analyzeSmartBatch()`
- `server/services/batch-contracts/write.ts:670+` — `executeSmartBatch()`
- `server/routes/contracts-batch.ts` — 2 endpoints
- `src/routes/contracts/smart-batch.tsx` — page UI
- `server/__tests__/smart-batch.test.ts` — 12 tests
