---
name: fix haizokusaki 営業 departments
description: parseHaizokusaki no maneja departamentos de 営業 (海南産機営業課, 本社営業課)
type: bugfix
auto_saved: true
trigger: bugfix
date: 2026-04-30
---

# Bug: parseHaizokusaki no reconoce departamentos de 営業

## Sintoma
- 神山 龍也 (社員№ 250904) asignado a 海南第一工場 incorrectamente
- 阿波根 カロリーナ (社員№ 250604) asignado a 海南第一工場 incorrectamente

## Root Cause
`parseHaizokusaki()` solo reconoce patrones tipo:
- `海南第一工場製作1課1工区1班` → {factoryName, department: 製作N課, lineName: N工区}

Cuando el `haizoku` es un departamento de **営業** (ventas), el regex no hace match:
- `海南第二工場 + 海南産機営業課` → null
- `本社工場 + 本社営業課` → null

## Solucion
En `server/services/import-employees.ts`, después de que `parseHaizokusaki` falla,
intentar `extractDepartmentFromDispatch` para extraer el department del string completo:

```typescript
} else if (resolvedFactoryName) {
  // parseHaizokusaki failed (e.g., 営業 departments)
  const extracted = extractDepartmentFromDispatch(dept);
  if (extracted) {
    dept = extracted;
  }
}
```

## Empleados corregidos en DB
- 神山 龍也: factory_id 193 → 205 (海南第一 → 海南第二)
- 阿波根 カロリーナ: factory_id 193 → 222 (海南第一 → 本社)

## Archivos cambiados
- `server/services/import-employees.ts`: fallback logic
- `server/services/document-generation.ts`: workHours/breakTime fix para single-shift
- `server/pdf/kobetsu-pdf.ts`: soshikiText font size 8→5
