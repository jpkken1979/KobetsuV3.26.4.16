# Regla: Seguridad

Aplica a todo el código Python, TypeScript y Bash del repositorio.

## Obligatorio

- **NUNCA** hardcodear secrets, tokens o API keys en código fuente — usar variables de entorno
- **NUNCA** usar `shell=True` en subprocess — siempre `shlex.split()` + `shell=False`
- `.env` está **gitignoreado** (ver `.gitignore` línea con `.env`) y NO debe
  commitearse. Cada dev / máquina mantiene su propio `.env` local a partir de
  `.env.example`, que sí se versiona como plantilla sin secretos. Si en algún
  momento se detecta que `.env` fue commiteado por error, sacarlo con
  `git rm --cached .env` y rotar todos los tokens.
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
