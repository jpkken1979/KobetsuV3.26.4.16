---
name: pending_海南_factory_assignment_review
description: Verificar asignaciones 神山 y otros entre 海南第一 vs 海南第二
type: project
pending: true
date: 2026-04-29
---

# Tarea Pendiente: Revisar asignaciones 海南第一 vs 海南第二

## Problema identificado
神山 龍也 (社員№ 250904) está en **海南第一工場 (factory 193)** pero el usuario indica que debería estar en **海南第二**.

## Estado actual en DB
- 神山 龍也 → factory 193 (海南第一工場)
- Department: `営業本部 第二営業部 海南HUB営業課`
- Línea: `リフト作業`

## Factories de 高雄工業 en 海南
| ID | Factory | Department | Línea |
|----|---------|-------------|-------|
| 193 | 海南第一工場 | 営業本部 第二営業部 海南HUB営業課 | リフト作業 |
| 194-204 | 海南第一工場 | (otras líneas) | |
| 205 | 海南第二工場 | 営業本部 第三営業部 海南産機営業課 | リフト作業 |
| 206-210 | 海南第二工場 | (otras líneas) | |

## Acción requerida
1. Obtener daicho actualizado del usuario
2. Comparar asignaciones en Excel vs DB
3. Identificar empleados mal asignados entre 海南第一 y 海南第二
4. Corregir según los datos reales del daicho

## Nota
La asignación actual puede ser correcta si el Excel original ya tenía a 神山 en 海南第一. Solo se puede determinar con el daicho actualizado.
