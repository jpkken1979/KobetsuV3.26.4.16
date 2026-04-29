---
name: discovery_department_space_inconsistency
description: Excel vs DB department espacios inconsistentes afectan matching
type: project
auto_saved: true
trigger: discovery
date: 2026-04-29
---

# Descubrimiento: Inconsistencia de espacios en department

## Problema
Carolina (阿波根 カロリーナ サチコ, 社員№ 212056) no se asignaba a factory 222 (本社工場).

## Root Cause
- **Excel (DBGenzaiX):** `"第一営業部本社営業課"` — sin espacios después de 部
- **DB (factories):** `"第一営業部 本社営業課"` — con espacio después de 部

El matching en `buildFactoryLookup` usaba `normKey` que solo hace trim, sin agregar espacios faltantes.

## Solución
En `extractDepartmentFromDispatch()` (import-employees.ts), regex simplificado:
```javascript
dept = dept.replace(/部([^　 ])/g, '部 $1');
```
Esto agrega espacio después de 部 cuando sigue texto directo (no espacio).

## Columnas relevantes en DBGenzaiX
- D (派遣先ID): `高雄工業 本社` → para resolver companyId + factoryName
- E (派遣先): `高雄工業株式会社 営業本部 第一営業部本社営業課` → hierarchy completo
- F (配属先): `リフト作業` → solo shift type en este caso
- G (配属ライン): `鑄造材料の工場内加工ラインへの供給` → job description
- H (仕事内容): vacío o job description adicional

## Prevention
Verificar que exports de Excel respeten el mismo formato que la DB
(no agregar/quitar espacios arbitrariamente).
