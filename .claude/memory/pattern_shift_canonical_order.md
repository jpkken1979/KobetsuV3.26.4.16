---
name: Orden canonico de turnos (shifts)
description: Todos los shifts en UI, DB y PDF se ordenan con sortShiftEntries — dia→noche→numerados→letras
type: feedback
trigger: pattern
date: 2026-04-23
originSessionId: 7b92d8fb-cb64-4286-946a-d8c625c2f703
---
Los turnos (`workHours` / `breakTimeDay` / `breakTimeNight`) siguen un **orden canonico unico** en todo el sistema:

```
Grupo 0 (kanji dia→noche, prioridad fija):
  日勤 / 通常勤務  →  昼勤 / 早番  →  夕勤 / 準夜 / 遅番  →  夜勤 / 交替勤務  →  深夜
Grupo 1 (kanji numerados):  1直, 2直, 3直, シフト1, シフト2, …
Grupo 2 (letras latinas):   A勤務, B勤務, …, Z勤務   (alfabetico)
Grupo 3 (otros kanji):      fallback
Dentro de cada nombre:      por sufijo ①②③ o numero trailing
```

**Why:** sin orden canonico, el usuario veia los shifts "bara-bara" tanto en PDF como en tabla.

**How to apply:**
- Frontend: `sortShiftEntries` en `src/lib/shift-utils.ts`, llamado desde compose/parse.
- Server: `normalizeWorkHoursString` + `normalizeBreakTimeString` en `server/services/shift-sort.ts`.
- Migracion: `scripts/normalize-shifts.ts` (dry-run default; `--apply` para escribir con backup).

**Gotchas:**
- Regex acepta `昼勤①`, `深夜`, `早番`, `A勤務`, `シフト1`, `1直`.
- `workHoursDay`/`workHoursNight` NO se reordenan (usan shifts[0]/[1] sin sort) — es aceptable.
- Texto extra (`(実働…)`, `(8H)`) se preserva intacto.
