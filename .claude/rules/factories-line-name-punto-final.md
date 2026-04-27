# Regla: Factories con punto final en `line_name` NO son duplicados

Aplica a todas las sesiones de Claude Code en este repositorio.

## Principio

Cuando dos filas de `factories` comparten `companyId + factoryName + department` y solo se diferencian por un **punto al final del `line_name`** (ej: `1次旋係` vs `1次旋係.`), **NO son duplicados**. El punto es intencional y discrimina variantes con **仕事内容 (shigoto naiyō / job description)** distinto.

## Casos conocidos

| company | factory | department | line_name (sin punto) | line_name (con punto) | Significado |
|---|---|---|---|---|---|
| 高雄工業 | HUB工場 | 製作1課 | `1次旋係` | `1次旋係.` | Job description distinto entre los dos |
| 高雄工業 | HUB工場 | 岡山HUB品証課 | `HUB 検査課係` | `HUB 検査課係.` | Job description distinto entre los dos |
| 高雄工業 | 海南第一工場 | 製作1課 | `HUB` | `HUB。` | Variante con `。` (punto japonés full-width) |
| 高雄工業 | CVJ工場 | (varios) | `CVJ研磨係` | `CVJ研磨係.` | Job description distinto entre los dos |

(Lista no exhaustiva — pueden existir más casos. Ante la duda, asumir que son intencionales y NO mergear/borrar.)

## Reglas operativas

- **NUNCA** proponer borrar ni mergear factories que solo difieran por `.` (punto ASCII) o `。` (punto japonés) al final del `line_name`.
- **NUNCA** "deduplicar" estas filas en imports/migraciones/scripts de limpieza.
- **NUNCA** sugerir corrección de "typo" en el punto final de un `line_name`.
- Si un import o validación los marca como sospechosos, ignorar la sugerencia y conservar ambas filas.
- En auditorías o reportes, listar ambos como entries separados, sin agrupar.

## Por qué existe este patrón

El sistema de contratos de UNS necesita distinguir variantes de la misma línea con responsabilidades operativas distintas (turnos diferentes, tareas distintas, supervisores distintos, etc.). Como el modelo de `factories` no tiene un campo "variant", el usuario codifica la diferencia con un sufijo ortográfico. Cualquier "limpieza" automática rompe esta distinción y mezcla contratos que deben mantenerse separados.

## Cómo aplicar en el día a día

- Al investigar un contrato/factory: si ves dos filas casi idénticas, **leer el `jobDescription` (仕事内容)** de cada una antes de asumir nada. Si difieren, son intencionales.
- Al escribir scripts SQL: filtrar siempre por `factoryName + department + lineName` exactos, sin normalización (sin `TRIM()`, sin `RTRIM(.)`, sin lowercase).
- Al revisar imports de Excel: el `line_name` debe respetarse byte-by-byte tal como viene en la fuente.
