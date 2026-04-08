Genera un resumen de la sesion actual y guardalo en memoria del proyecto.

## Instrucciones

1. Revisa todos los cambios realizados en esta sesion usando `git diff` y `git status`.
2. Identifica:
   - Archivos creados, modificados y eliminados
   - Decisiones de arquitectura tomadas
   - Bugs corregidos
   - Patrones nuevos establecidos
   - Tareas pendientes o incompletas
3. Genera un archivo `.claude/memory/session_{fecha_actual}.md` con este formato:

```markdown
---
name: Sesion {fecha}
description: {resumen en una linea}
type: project
auto_saved: true
trigger: session
date: {YYYY-MM-DD}
---

## Resumen

{1-3 oraciones describiendo que se hizo}

## Cambios principales

- {lista de cambios significativos}

## Decisiones tomadas

- {decisiones de arquitectura o diseno, si hubo}

## Archivos tocados

- {lista de archivos principales modificados}

## Pendientes

- {tareas que quedaron incompletas o proximos pasos}
```

4. Actualiza `ESTADO_PROYECTO.md` agregando una entrada al historial de sesiones con fecha, resumen y archivos principales.
5. Muestra el resumen generado al usuario para confirmacion antes de guardar.
