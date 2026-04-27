---
name: Factories con punto final en line_name son intencionales
description: NUNCA borrar/mergear factories que solo difieran por `.` o `。` al final del line_name — el job description difiere entre variantes
type: feedback
auto_saved: true
trigger: pattern
date: 2026-04-27
---

# Factories con punto final en `line_name` NO son duplicados

## Regla
Si dos filas de `factories` comparten `companyId + factoryName + department` y solo se diferencian por un punto (`.` ASCII o `。` japonés) al final del `line_name`, son **intencionales** — el `仕事内容 (jobDescription)` difiere entre las variantes. Nunca proponer dedupe, merge ni corrección de "typo".

## Why
- El usuario lo confirmó explícitamente el 2026-04-27 cuando le señalé como "posibles duplicados" las filas `1次旋係` (id=191) vs `1次旋係.` (id=192) y `HUB 検査課係` (id=188) vs `HUB 検査課係.` (id=189).
- Su explicación textual: *"el shigoto naiou cambia por eso es asi"* — el modelo de `factories` no tiene un campo `variant`, así que el usuario codifica la diferencia operativa (turnos, tareas, supervisores) con un sufijo ortográfico.
- Cualquier "limpieza" rompe esa distinción y mezcla contratos que deben quedar separados.

## How to apply
- Al investigar contratos/factories duplicados aparentes, **leer `jobDescription` antes de cualquier sugerencia**. Si difieren, son intencionales.
- En scripts SQL: filtrar por `factoryName + department + lineName` exactos. NO usar `TRIM()`, `RTRIM('.')`, `lowercase()` ni normalizaciones similares.
- En imports/migraciones: respetar `line_name` byte-by-byte tal como viene en la fuente.
- En auditorías o validaciones: si una herramienta los marca como sospechosos, ignorarla.
- En reportes y listados: mostrar ambos como entries separados, sin agrupar.

## Casos conocidos (lista no exhaustiva)
| company | factory | department | sin punto | con punto |
|---|---|---|---|---|
| 高雄工業 | HUB工場 | 製作1課 | `1次旋係` (id=191) | `1次旋係.` (id=192) |
| 高雄工業 | HUB工場 | 岡山HUB品証課 | `HUB 検査課係` (id=188) | `HUB 検査課係.` (id=189) |
| 高雄工業 | 海南第一工場 | 製作1課 | `HUB` | `HUB。` (full-width) |
| 高雄工業 | CVJ工場 | (varios) | `CVJ研磨係` | `CVJ研磨係.` |

## Regla relacionada (auto-inyectada)
`.claude/rules/factories-line-name-punto-final.md` — esta regla se carga en cada sesión.
