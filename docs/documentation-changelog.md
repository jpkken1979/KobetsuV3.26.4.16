# Documentation Changelog

## 2026-03-25

### Cambios

- creado `README.md` raíz como onboarding rápido
- actualizado `AGENTS.md` para reflejar:
  - 8 tablas reales
  - rutas backend actuales
  - rutas frontend actuales
  - tooling/config real
- actualizado `ESTADO_PROYECTO.md` con estado documental
- creado `docs/architecture.md`
- alineados `CLAUDE.md`, `GEMINI.md` y `RULES.md` con la documentación real del repo
  - `CLAUDE.md` ahora refleja seguridad operativa real y referencia docs primarias
  - `GEMINI.md` ahora apunta a `docs/architecture.md`
  - `RULES.md` ya no exige `Co-Authored-By` y no asume Prettier si no existe
- limpiadas reglas secundarias heredadas
  - `WORKFLOW_RULES.md` ya no asume `tasks/todo.md`, `pytest`/`ruff` ni build obligatorio
  - `.antigravity/rules.md` ya no asume `Co-Authored-By` ni Prettier obligatorio
  - `.claude/rules/typescript.md` dejó de referenciar `nexus-app` y Electron
  - `.claude/rules/security.md` dejó de asumir preload/IPC y ahora refleja seguridad real del backend
- corregida memoria contextual heredada
  - `.claude/rules/AI_MEMORY.md` ahora describe JP個別契約書v26.3.10 en vez de OpenAntigravity
  - `.claude/rules/domain-rules.md` y `.claude/rules/ecosystem-usage.md` ahora remiten explícitamente a las docs principales del repo

### Motivo

La documentación principal estaba repartida y parcialmente desactualizada respecto del código real.

---

## Checklist para futuras features

Cada vez que se haga una feature o refactor que toque arquitectura, revisar:

- [ ] ¿cambió `server/db/schema.ts`?
- [ ] ¿se agregó/eliminó una ruta en `server/routes/`?
- [ ] ¿se agregó un workflow nuevo en `src/routes/`?
- [ ] ¿se agregó un cliente especial con lógica propia?
- [ ] ¿cambió un script de `package.json`?
- [ ] ¿cambió el flujo de generación documental?
- [ ] ¿cambió el flujo de importación?
- [ ] ¿cambió la seguridad operativa?

Si la respuesta es sí, actualizar al menos:

- [ ] `README.md`
- [ ] `AGENTS.md`
- [ ] `docs/architecture.md`
- [ ] `ESTADO_PROYECTO.md` si el cambio es relevante históricamente

---

## Regla práctica

### Actualizar `README.md` cuando:

- cambie onboarding
- cambien scripts
- cambie stack visible
- cambien workflows principales para un dev nuevo

### Actualizar `AGENTS.md` cuando:

- cambie estructura real del repo
- cambien tablas/rutas/servicios
- cambien reglas de negocio críticas
- cambien workflows operativos

### Actualizar `docs/architecture.md` cuando:

- cambie el modelo mental del sistema
- aparezca una nueva rama vertical
- cambie el pipeline import → contrato → documento

---

## Nota

La documentación de este repo ya no debe vivir en un único archivo.  
La separación correcta es:

- `README.md` → entrada rápida
- `AGENTS.md` → profundidad operativa
- `docs/architecture.md` → visión de arquitectura
- `ESTADO_PROYECTO.md` → memoria histórica
