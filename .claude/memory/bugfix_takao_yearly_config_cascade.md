---
name: Bug 高雄/HUB工場 calendario incorrecto en PDF — cascada yearly_config
description: Por qué el PDF mostraba feriados viejos cuando factory.calendar tenía el texto correcto, y cómo identificar/limpiar el yearly_config corrupto
type: project
auto_saved: true
trigger: bugfix
date: 2026-04-27
---

## Síntoma

PDF 個別契約書 (`server/pdf/kobetsu-pdf.ts:478` — Row 17 就業日) renderizaba un texto de feriado **distinto** al que el usuario había ingresado en `factory.calendar` desde 企業データ一覧.

Ejemplo concreto: contrato `KOB-202510-0042` (HUB工場 / 製作1課 / 1次旋係., factory_id=192) — usuario ingresó `月～金　4/26・8/9　ただし...12月27日～1月4日...4月29日～5月6日...8月8日～8月16日...` y el PDF mostró `月～金 ただし...12月29日～1月5...4月27日～5月4日...8月10日～8月17日...` (fechas distintas, faltaba `4/26・8/9`, había errores tipográficos como `1月5` sin `日`).

## Root cause

Cascada en `server/services/document-generation.ts:261`:

```typescript
calendar: yearlyConfig?.sagyobiText || factory.calendar || c.workDays || "",
```

`factory_yearly_config.sagyobi_text` **gana siempre sobre `factory.calendar`** cuando existe (no es null/empty). Esto es **comportamiento por diseño**, no bug de código — el yearly config permite override anual.

El verdadero bug era de **datos**: 74 filas en `factory_yearly_config` (FY 2024 y 2025) habían sido creadas el 2026-04-15 con un `sagyobi_text` corrupto que enmascaraba el texto correcto del factory base.

Solo 1 fila (id=75, CVJ工場 FY 2026) tenía texto correcto.

## Cómo se calcula el fiscal year (importante para diagnóstico)

`getFiscalYear()` en `server/services/factory-yearly-config.ts:17`:
- mes ≥ 10 → fiscalYear = año
- mes < 10 → fiscalYear = año - 1
- Calculado desde `contract.startDate`, no `contractDate`

Ej: startDate `2025-10-01` → fiscalYear **2025**. startDate `2026-03-31` → fiscalYear **2025** (no 2026).

Si el usuario edita el yearly config pensando que es FY 2026 pero el contrato cae en FY 2025, el cambio no se aplica.

## Fix aplicado (2026-04-27)

1. Backups previos en `data/kobetsu.db.backup-takao-fix-*` y `data/kobetsu.db.backup-mass-fix-*`.
2. UPDATE: `factory_yearly_config SET sagyobi_text = NULL` en las 74 filas con patrones rotos `12月29日～1月5)` o `12月30日～1月7日)`. La 13 fila correcta (id=75 + 12 nuevas FY 2026 creadas durante el debug) quedó intacta.
3. Cascada ahora cae a `factory.calendar` para todos los contratos FY 2024/2025; FY 2026 sigue tomando del yearly_config (ya correcto).

## Cómo prevenir / detectar

- Antes de hacer un import bulk a `factory_yearly_config`, **validar** el texto contra el patrón canónico esperado o contra `factory.calendar`.
- En la UI del editor 年度 (`/companies/table` botón 年度), mostrar al lado el valor actual de `factory.calendar` para que el usuario sepa qué texto va a "ganar" en la cascada.
- Considerar agregar un test que cuente filas con `sagyobi_text` que tengan patrones obviamente rotos (ej: `1月5` sin `日`).

## Relacionado

- `factory.calendar` es el campo en `factories` table (texto plano)
- `factory_yearly_config.sagyobi_text` es el override anual
- `factory_yearly_config.kyujitsu_text` existe en schema pero NO se usa en kobetsu-pdf.ts (potencial confusión semántica con sagyobi_text — `kyujitsu` = feriado, `sagyobi` = día de trabajo, pero en este PDF la celda es 就業日 = sagyobi)
- Drift de naming: el bug surgió porque "calendar" en `data.calendar` puede sonar a "feriados" pero en realidad es 就業日 (días de trabajo, descritos por exclusión)
