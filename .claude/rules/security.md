# Regla: Seguridad

Aplica a todo el código Python, TypeScript y Bash del repositorio.

## Obligatorio

- **NUNCA** hardcodear secrets, tokens o API keys en código fuente — usar variables de entorno
- **NUNCA** usar `shell=True` en subprocess — siempre `shlex.split()` + `shell=False`
- `.env` **NO se versiona** en este repo (`.gitignore` líneas 14-17 excluyen
  `.env` y `.env.*`). Solo `.env.example` queda en git como plantilla con
  placeholders. Cada developer mantiene su propio `.env` local con
  `ADMIN_TOKEN`, rate-limit overrides, etc. (Política alineada con `.gitignore`
  en B-1 de auditoría 2026-04-28; el contexto histórico de la oscilación de
  esta decisión vive en `.claude/memory/session_2026-04-21.md`.)
- Si encontrás un `.env` rastreado por error en cualquier repo:
  `git rm --cached .env` + commit + **rotar todos los tokens** que estuvieron
  expuestos. La rotación es no-negociable: el secret se considera comprometido
  desde el momento que entró al histórico.
- **NUNCA** borrar ni sobreescribir snapshots de cuentas Codex en `~/.codex/accounts/`
  sin backup explícito. Mantener `index.json` y los `*.json` de cuentas para permitir
  switch inmediato entre perfiles en Nexus.
- Validar y sanear inputs del usuario antes de cualquier procesamiento
- Datos sensibles UNS (`UNS_BANK_*`, `UNS_DISPATCH_LICENSE`) solo en env vars
- IPC inputs validados en el preload bridge antes de llegar al proceso principal
- Gateway valida paths para prevenir directory traversal

## Patrón correcto para subprocess

```python
# MAL
subprocess.run(command, shell=True)

# BIEN
import shlex
result = subprocess.run(shlex.split(command), shell=False, capture_output=True)
```

## Electron

- `contextIsolation: true`, `nodeIntegration: false` siempre
- Solo IPC a través del bridge de preload — nunca exponer Node APIs directamente
