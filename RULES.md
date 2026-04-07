# REGLAS OBLIGATORIAS PARA TODA IA - Antigravity Ecosystem v2.1.0

> **INSTRUCCIÓN CRÍTICA**: Cualquier IA (Claude, GPT, Gemini, Cursor, Copilot, Windsurf, o cualquier otro) que trabaje en este proyecto DEBE leer este archivo PRIMERO y seguir estas reglas sin excepción.

---

## 1. SIEMPRE CONSULTA EL ECOSISTEMA ANTES DE ACTUAR

Antes de escribir código, crear archivos, o resolver cualquier tarea:

1. **Verifica si ya existe un AGENTE especializado** en `.agent/agents/`
2. **Verifica si ya existe un SKILL** en `.agent/skills/`
3. **Consulta la documentación** en `.context/APP_KNOWLEDGE.md`
4. **Revisa las reglas de código** en `.antigravity/rules.md`

**NO reinventes la rueda.** Este ecosistema tiene 120 agentes activos y 931+ skills. Es muy probable que lo que necesitas ya exista.

---

## 2. MAPA DE AGENTES DISPONIBLES (40 activos)

### Tier 1 - Orquestación
| Agente | Cuándo usarlo |
|--------|--------------|
| `super-orchestrator` | Tareas complejas que requieren múltiples agentes |
| `planner` | Planificación de features, roadmaps, WBS |
| `architect` | Decisiones de arquitectura, prevención de deuda técnica |
| `activator` | Instalar Antigravity en un proyecto nuevo |

### Tier 2 - Desarrollo Core
| Agente | Cuándo usarlo |
|--------|--------------|
| `coder` | Implementar código según specs |
| `frontend-specialist` | React/Next.js, Tailwind, componentes UI |
| `backend-specialist` | APIs REST/GraphQL, FastAPI, Express |
| `api-designer` | Diseño de contratos API, OpenAPI/Swagger |
| `database-architect` | Esquemas SQL/NoSQL, migraciones, optimización |
| `react-specialist` | Hooks, patrones React, rendimiento |

### Tier 3 - Calidad
| Agente | Cuándo usarlo |
|--------|--------------|
| `code-reviewer` | Code review, SOLID, best practices |
| `test-engineer` | pytest, Playwright, Jest, estrategias de testing |
| `critic` | Cuestionar decisiones antes de implementar |
| `explorer` | Investigación profunda de código existente |

### Tier 4 - Seguridad
| Agente | Cuándo usarlo |
|--------|--------------|
| `security-auditor` | OWASP Top 10, detección de secrets |
| `debugger` | Debugging sistemático, root cause analysis |
| `performance-optimizer` | Web Vitals, bundle size, rendering |
| `penetration-tester` | Pentesting, vulnerability scanning |

### Tier 5 - DevOps
| Agente | Cuándo usarlo |
|--------|--------------|
| `devops-engineer` | Docker, K8s, CI/CD, deployment |
| `mcp-integrator` | Conectar MCP servers nuevos |
| `git-orchestrator` | Git workflows, branching, merging |

### Tier 6 - Especialistas
| Agente | Cuándo usarlo |
|--------|--------------|
| `ui-ux-designer` | Nielsen heuristics, WCAG, design tokens |
| `refactor` | Code smells, refactoring patterns, clean code |
| `migrator` | Migraciones de frameworks/lenguajes/BD |
| `i18n` | Internacionalización |
| `a11y` | Accesibilidad WCAG 2.2 |

### Tier 7 - UNS Enterprise (派遣)
| Agente | Cuándo usarlo |
|--------|--------------|
| `uns-hr-specialist` | RRHH japonés, contratos, nóminas UNS |
| `haken-document-specialist` | Documentos de 派遣 (個別契約書, 基本契約書) |
| `haken-system-architect` | Arquitectura de sistemas para 派遣 SaaS |
| `inteligente-shain-agent` | Datos de empleados, sincronización Excel-DB |
| `excel-parser` | Parsing de Excel japonés (Shift-JIS, 勤怠表) |

### Tier 8 - Inteligencia
| Agente | Cuándo usarlo |
|--------|--------------|
| `cognitive-analyst` | Análisis cognitivo, metacognición |
| `learning-engine` | Aprendizaje de patrones y errores |
| `self-improver` | Auto-mejora de agentes y prompts |

### Tier 9 - Sistema
| Agente | Cuándo usarlo |
|--------|--------------|
| `memory` | Guardar/recuperar contexto persistente |
| `finalizer` | Cerrar sesión: tests → docs → commit → push |
| `stuck` | Escalamiento cuando hay problemas |
| `context-keeper` | Mantener contexto de conversación |

### Tier 10 - Data & ML
| Agente | Cuándo usarlo |
|--------|--------------|
| `data-engineer` | ETL, pipelines de datos |
| `ml-engineer` | Machine Learning, modelos, MLOps |
| `report-generator` | Reportes PDF/Excel automatizados |

### Tier 11 - Desktop
| Agente | Cuándo usarlo |
|--------|--------------|
| `tauri-architect` | Arquitectura de apps Tauri |
| `tauri-frontend` | Frontend Tauri con React/Svelte |
| `game-developer` | Game logic, mechanics |

### Tier 12 - Contenido
| Agente | Cuándo usarlo |
|--------|--------------|
| `content-improver` | Mejorar contenido técnico y copywriting |
| `documentation-writer` | READMEs, guías, documentación técnica |

---

## 3. CÓMO INVOCAR AGENTES

### Vía Gateway HTTP (puerto 4747)
```bash
# Listar agentes
curl http://localhost:4747/v1/agents

# Ejecutar un agente
curl -X POST http://localhost:4747/v1/agents/explorer/run \
  -H "Content-Type: application/json" \
  -d '{"task": "analiza este código"}'

# Encontrar el mejor agente para una tarea
curl -X POST http://localhost:4747/v1/agents/find \
  -H "Content-Type: application/json" \
  -d '{"task_description": "optimizar rendimiento React"}'
```

### Vía MCP (para Claude Code, Cursor, etc.)
```
SSE:  http://127.0.0.1:4747/v1/mcp/sse
HTTP: http://127.0.0.1:4747/v1/mcp
```

### Vía Python SDK
```python
from antigravity.sdk.client import Client
client = Client()
result = client.run("explorer", "find security issues")
```

### Vía CLI / Scripts
```bash
python .agent/scripts/invoke-agent.py <nombre-agente> "<tarea>"
```

---

## 4. SKILLS DISPONIBLES (793+)

Las skills están en `.agent/skills/`. Antes de crear una solución nueva, busca:

```bash
# Buscar skills por nombre
ls .agent/skills/ | grep <keyword>

# Leer documentación de un skill
cat .agent/skills/<nombre>/SKILL.md

# Vía API
curl http://localhost:4747/v1/skills?search=<keyword>
```

### Skills Custom del Proyecto (6)
| Skill | Ubicación | Uso |
|-------|-----------|-----|
| `startup` | `.agent/skills-custom/startup/` | Verificar entorno, iniciar servidores |
| `finalizar` | `.agent/skills-custom/finalizar/` | Cierre interactivo de sesión |
| `finalizar-autonomo` | `.agent/skills-custom/finalizar-autonomo/` | Cierre automático sin intervención |
| `debug-server` | `.agent/skills-custom/debug-server/` | Troubleshooting de servidores |
| `excel-parsing` | `.agent/skills-custom/excel-parsing/` | Procesamiento de datos Excel |
| `type-validation` | `.agent/skills-custom/type-validation/` | Validación de tipos con mypy |

---

## 5. REGLAS DE CÓDIGO OBLIGATORIAS

### Idioma
- **Respuestas al usuario**: Español
- **Código** (variables, funciones, clases): Inglés
- **Documentación y comentarios**: Español
- **Commits**: Español con formato `<tipo>(<scope>): <descripción>`

### Python
- Type hints en TODAS las funciones
- Docstrings formato Google
- Variables de entorno para secrets (`.env`)
- `shlex.split()` para comandos shell
- NUNCA `subprocess.run(x, shell=True)`
- NUNCA hardcodear API keys, tokens o passwords
- Usar `python3`, no `python`

### TypeScript
- Interfaces tipadas siempre
- Error handling en toda operación async
- ESLint + Prettier

### Commits
```
<tipo>(<scope>): <descripción en español>

[cuerpo opcional]

Co-Authored-By: <modelo> <noreply@anthropic.com>
```

---

## 5.1 TESTING STANDARDS (CRÍTICO)

Todo código nuevo DEBE incluir tests. Mínimos obligatorios:

### Coverage Mínimo Requerido

| Componente | Líneas | Branches | Mutation | Status |
|---|---|---|---|---|
| `.agent/core/` | 85% | — | >75% (críticos) | ✅ Gate CI |
| `.agent/agents/` | 75% | — | — | ✅ Gate CI |
| `.agent/mcp/` | 80% | — | — | ✅ Gate CI |
| `src/` (Bot TS) | 70% | 60% | — | ✅ Gate CI |
| `nexus-app/src/` | 60% | 50% | — | ✅ Gate CI |

### Estrategia de Testing

- **Unit tests**: 75% de la suite total
- **Integration tests**: 20% de la suite total
- **E2E tests**: 5% de la suite total

### Herramientas Requeridas

**Python:**
- `pytest` con `--cov`
- `pytest-asyncio` (async mode: auto)
- `hypothesis` (property-based)
- `mutmut` (mutation testing para módulos críticos)

**TypeScript:**
- `vitest` con `c8`
- `@testing-library/react`
- `MSW` (mock HTTP)

### Checklist Pre-Commit

- [ ] Tests pasan: `pytest tests/ -x` o `npm test`
- [ ] Coverage > threshold: `--cov-fail-under=70`
- [ ] Linting: `ruff check .agent/` o `npm run lint`
- [ ] Tipos: `mypy .agent/core` o `npm run ts:app`
- [ ] Mutation score: `mutmut run` para módulos críticos

### Patrón AAA (Arrange-Act-Assert)

```python
def test_example():
    # Arrange: preparar
    obj = MyClass(config)
    
    # Act: ejecutar
    result = obj.method()
    
    # Assert: verificar
    assert result is not None
```

### Documentación de Referencia

Ver `TESTING_METHODOLOGY.md` para:
- Patrones detallados por framework
- Ejemplos de mocking y fixtures
- Property-based testing (Hypothesis)
- Troubleshooting común

---

## 6. ESTRUCTURA DEL PROYECTO

```
AntigravitiSkillUSN/
├── .agent/                    # Core del ecosistema
│   ├── agents/                # 119 activos
│   ├── skills/                # 794 base skills (907 total con custom + plugins)
│   ├── skills-custom/         # 41 skills del proyecto
│   ├── plugins/               # 72 plugins integrados
│   ├── core/                  # 54 módulos core
│   ├── mcp/                   # MCP + HTTP Gateway servers
│   │   ├── gateway.py         # Gateway universal v3.0
│   │   ├── agents-server.py   # MCP con 96+ agentes
│   │   ├── intelligence-server.py  # 23 módulos de inteligencia
│   │   ├── ui-server.py       # Herramientas UI/UX
│   │   └── skills-server.py   # Acceso a 600+ skills
│   ├── cli/                   # Interfaz CLI
│   ├── sdk/                   # Python SDK
│   ├── scripts/               # 29 scripts utilitarios
│   └── workflows/             # 24 slash commands
├── .antigravity/              # Reglas y configuración
│   └── rules.md               # Estándares de código
├── .claude/                   # Config para Claude Code
│   ├── settings.json          # MCP servers, hooks, agentes
│   └── agents/                # Aliases de agentes
├── .context/                  # Contexto persistente
│   ├── APP_KNOWLEDGE.md       # Conocimiento del proyecto
│   ├── LEARNINGS.md           # Aprendizajes
│   └── SESSION_LOG.md         # Log de sesiones
├── tests/                     # 181 archivos de test
├── dashboard/                 # Web monitoring UI
├── mcp-server/                # Servidor MCP standalone
├── ESTADO_PROYECTO.md         # Estado actual del proyecto
├── AGENTS.md                  # Referencia de agentes
└── RULES.md                   # ← ESTE ARCHIVO
```

---

## 7. MCP SERVERS CONFIGURADOS

| Server | Puerto/Método | Descripción |
|--------|--------------|-------------|
| Gateway Universal | `:4747` HTTP/SSE | Control completo del ecosistema |
| antigravity-agents | MCP stdio | 96+ agentes como tools |
| antigravity-intelligence | MCP stdio | 23 módulos de inteligencia |
| antigravity-ui-ux | MCP stdio | Herramientas UI/UX |
| antigravity-skills | MCP stdio | 600+ skills |
| context7 | MCP stdio | Documentación actualizada de librerías |
| playwright | MCP stdio | Automatización de browser |
| filesystem | MCP stdio | Operaciones de archivos |
| git | MCP stdio | Operaciones Git |

---

## 8. FLUJO DE TRABAJO ESTÁNDAR

```
1. /startup              → Verificar entorno
2. Consultar RULES.md    → Este archivo
3. Buscar agente/skill   → .agent/agents/ o .agent/skills/
4. Implementar           → Siguiendo estándares
5. Tests                 → pytest tests/ -v
6. /finalizar            → Cerrar sesión correctamente
```

---

## 9. ARCHIVOS DE REFERENCIA PRIORITARIOS

Cuando necesites contexto, lee estos archivos en este orden:

1. **RULES.md** (este archivo) — Reglas universales
2. **.antigravity/rules.md** — Estándares de código detallados
3. **WORKFLOW_RULES.md** — Metodología de trabajo (consultar en tareas complejas)
4. **.context/APP_KNOWLEDGE.md** — Conocimiento del proyecto
5. **ESTADO_PROYECTO.md** — Estado actual y cambios recientes
6. **AGENTS.md** — Referencia completa de agentes
7. **.context/LEARNINGS.md** — Lecciones aprendidas

---

## 10. REGLA DE ORO

> **Antes de crear algo nuevo, SIEMPRE verifica si ya existe un agente o skill que lo haga.**
>
> Este ecosistema tiene 119 agentes activos y 907+ skills. La probabilidad de que tu tarea ya esté cubierta es muy alta.
>
> Si no existe, créalo como un nuevo skill en `.agent/skills-custom/` o como un nuevo agente en `.agent/agents/`, siguiendo las estructuras documentadas en `.antigravity/rules.md`.

---

*Antigravity Ecosystem v5.0.0 | 119 agentes | 907+ skills | 10+ IDEs | 4 LLM providers*
*Este archivo debe ser leído por TODA IA antes de trabajar en este proyecto.*
