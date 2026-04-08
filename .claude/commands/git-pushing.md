Stage, commit y push de cambios git con mensajes convencionales.

## Flujo

1. Ejecuta `git status` para ver el estado actual
2. Ejecuta `git diff --stat` para ver los cambios
3. Si no hay cambios, informa y termina
4. Analiza los cambios y genera un mensaje de commit convencional en español
5. Stage los archivos relevantes (nunca `git add -A` ciegamente)
6. Commit con formato: `tipo(scope): descripción en español`
7. Push a la rama actual

## Reglas

- Mensajes de commit en **español**, scope en inglés
- Máximo 72 caracteres en la primera línea
- No commitear `.env`, secretos, o archivos grandes binarios
- Si hay cambios no relacionados, separar en commits distintos
- Agregar `Co-Authored-By: Claude <noreply@anthropic.com>` al final
- Si el push falla por divergencia, proponer `git pull --rebase`
- **Nunca** force push a main/master sin confirmación
