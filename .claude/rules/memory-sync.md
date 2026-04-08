# Regla: Sincronización de Memorias en Git

Aplica a todas las sesiones de Claude Code en este repositorio.

## Principio

Las memorias del proyecto deben vivir DENTRO del repositorio (`.claude/memory/`) para sincronizarse entre PCs via git. La ubicación externa (`~/.claude/projects/...`) es volátil y se pierde al cambiar de máquina.

## Obligatorio

Cuando guardes una memoria (MEMORY.md o archivos individuales), escribirla en AMBAS ubicaciones:

1. **Ubicación del sistema** (auto-memory de Claude Code): `~/.claude/projects/<proyecto>/memory/`
2. **Ubicación del repositorio** (sincronizable): `.claude/memory/`

La ubicación del repositorio es la **fuente de verdad**. Si hay conflicto entre ambas, priorizar la del repositorio.

## Al iniciar sesión

Si `.claude/memory/MEMORY.md` existe en el repositorio, leerlo para recuperar contexto de sesiones anteriores (incluso de otras PCs).

## Al cerrar sesión (CRÍTICO)

1. Copiar TODAS las memorias nuevas del sistema a `.claude/memory/` en el repositorio
2. **Commitear y pushear** las memorias — el repo es privado, las memorias DEBEN subir a git
3. Esto aplica especialmente en `/finalize`: las memorias se commitean junto con el resto del trabajo

**NO** dejar memorias sin commitear. El usuario trabaja en múltiples PCs y necesita acceso desde cualquiera.

## Política de gitignore — NO ignorar nada de .claude/

**NUNCA** agregar archivos de `.claude/` al `.gitignore`. Todo debe subirse al repositorio para sincronizar entre PCs:

| Ubicación | Propósito | Sincroniza por git |
|---|---|---|
| `.claude/memory/MEMORY.md` | Índice de memorias | **Si** |
| `.claude/memory/*.md` | Memorias individuales | **Si** |
| `.claude/settings.json` | Settings compartidos del proyecto | **Si** |
| `.claude/settings.local.json` | Settings locales (modelo, effort) | **Si** |
| `.claude/commands/*.md` | Slash commands | **Si** |
| `.claude/hooks/scripts/*.sh` | Hook scripts | **Si** |
| `.claude/rules/*.md` | Reglas auto-inyectadas | **Si** |
| `.claude/skills/` | Skills instalados (skills.sh) | **Si** |
| `~/.claude/projects/.../memory/` | Auto-memory de Claude Code | No (externo) |

**Excepción**: `.claude/worktrees/` se ignora porque son temporales de sesión.
