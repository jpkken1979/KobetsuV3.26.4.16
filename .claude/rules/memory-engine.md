# Regla: Memoria del Ecosistema — antigravity-memory (mem0)

Aplica a las sesiones de Claude Code en este repositorio.

## Estado actual

- La memoria del ecosistema usa **antigravity-memory** basado en **mem0**.
- El servidor MCP está en `.agent/mcp/memory-server.py`.

## Qué se considera integración real

La memoria solo debe considerarse activa si se cumplen estas condiciones:

1. El servidor MCP `antigravity-memory` está registrado en `.mcp.json`.
2. El gateway local responde en `http://127.0.0.1:4747/v1/health`.
3. Los endpoints de memoria (`/v1/mem0/recall`, `/v1/mem0/store`, `/v1/mem0/stats`) responden.

## Qué no asumir

- No asumir que Claude Code guarda learnings automáticamente.

## Flujo correcto

- Usar `antigravity-memory` (mem0) como motor de memoria principal.
- Tratar `ESTADO_PROYECTO.md` como memoria documental del proyecto.
- La memoria semántica vía mem0 es persistente en `~/.antigravity/memory/`.

## Troubleshooting rápido

| Problema | Verificación |
|----------|--------------|
| Memoria no disponible | Confirmar que el gateway está activo en `http://127.0.0.1:4747` |
| Búsqueda semántica no funciona | Verificar que `antigravity-memory` está en `.mcp.json` y el servidor arrancó |
| Sin contexto automático | Revisar que el gateway esté iniciado |

## Fuente canónica

- Motor de memoria: `.agent/mcp/memory-server.py` (antigravity-memory, basado en mem0)
- Datos persistentes: `~/.antigravity/memory/`
- Memoria documental del proyecto: `ESTADO_PROYECTO.md`
