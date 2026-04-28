---
name: PDF shift detector — fix uniforme para 就業時間/休憩時間
description: El detector de turnos del PDF fallaba para empresas con separador 、 (六甲) — reemplazado por patrón de nombres de turno
type: project
auto_saved: true
trigger: bugfix
date: 2026-04-28
---

# Bug

PDFs de 個別契約書 para 六甲電子 mostraban solo 2 turnos (昼勤/夜勤) en 就業時間 y duplicaban etiqueta `【昼勤】昼勤①…` en 休憩時間, mientras que 高雄 y コーリツ salían bien.

## Síntoma

```
就業時間: 【昼勤】8：30～17：30（8H）
          【夜勤】21：30～30：30（8H）・20：30～32：45（11.25H）
休憩時間: 【昼勤】昼勤①12:00~13:00、交替勤務②…  ← double-prefix
          【夜勤】25:30~26:30…                       ← legacy duplicado
```

Cuando el dato real en `factory.work_hours` (canónico) ya tenía los 6 turnos correctamente nombrados.

## Root cause

`server/services/document-generation.ts` decidía entre usar el campo canónico
`work_hours` vs. legacy `work_hours_day`/`work_hours_night` con esta heurística:

```ts
const fullShiftCount = fullWorkHours.split(/[　\s]+/).filter(s => /[：～]/.test(s)).length;
if (fullShiftCount > 2 && fullWorkHours) { ... }
```

- **六甲** separa turnos con `、` (coma japonesa, sin whitespace) → split devuelve 1 token → cae al legacy con solo 2 turnos.
- **高雄** separa turnos con `　` (full-width space) → split devuelve N tokens → usa canónico OK.
- **コーリツ** ya guardaba con `\n` → OK.

Para los descansos, otra regex `hasName` exigía `<nombre>：` con `：`, pero los datos reales venían como `昼勤①12:00…` sin colon entre nombre y hora → fallback a wrap `【昼勤】` redundante.

## Fix aplicado (commit pending)

Archivo único: `server/services/document-generation.ts` líneas 195–253.

1. **Detector basado en patrón de nombres de turno** (no por whitespace):
   ```ts
   const NAMED_SHIFT_RE = /(?:[A-Za-z]+|[一-鿿]+[勤直務番])[①-⑩\d０-９]*\s*[：:]?\s*\d{1,2}\s*[時:：]\s*\d{2}/g;
   ```
   Detecta `昼勤①8:30`, `交替勤務②13:00`, `A勤務：7時00分`, `シフト1：8:00`, etc.

2. **Normalizador de separadores** — reemplaza `、` por `\n` solo cuando hay ≥ 2 turnos detectados:
   ```ts
   const normalizeShiftText = (text: string): string => {
     if (!text || text.includes("\n")) return text || "";
     if (countNamedShifts(text) < 2) return text;
     return text.replace(/、/g, "\n").trim();
   };
   ```

3. **Lógica de prioridad uniforme**:
   - workHours: si `countNamedShifts(canónico) >= 2` → usar canónico normalizado.
   - breakTime: si `countNamedShifts(breakTimeDay) >= 2` → usar `breakTimeDay`, IGNORAR `breakTimeNight` (evita duplicación).
   - Sin double-prefix `【昼勤】` cuando el texto ya tiene nombres de turno.
   - Fallback a legacy `work_hours_day/night` con etiquetas `【】` solo si no hay multi-turno detectable.

## Verificación

- ✅ 781/781 tests passed (suite completa)
- ✅ typecheck clean
- ✅ PDF de 六甲 (contract 112): 6 turnos en 就業時間 + 6 en 休憩時間, sin etiquetas duplicadas
- ✅ PDF de 高雄 (contract 81): 9 turnos sin cambios (regresión OK)

## Cómo prevenir regresión

- El detector ahora se basa en **nombres de turno + tiempo**, no en whitespace. Funciona para cualquier separador futuro (`、`, `　`, `\n`, `；`, etc.) siempre que el dato canónico tenga nombres tipo `<kanji|latín>+[勤|直|務|番][①-⑩|0-9]*` seguido de tiempo.
- Si una empresa nueva guarda turnos sin nombres explícitos (ej: `8:00～17:00` solo), cae al fallback legacy `【昼勤】/【夜勤】` automáticamente.
- Tests futuros: cuando agreguen un caso edge con separador raro, agregar al smoke test inline en este memory.

## Decisión sobre templates per-empresa

El usuario preguntó si convenía templates. Respuesta: **no**. El problema era detección, no formato. Los datos canónicos están bien estructurados por empresa. Templates por empresa solo tendrían sentido para branding/layout distinto (fuentes, colores, secciones extra), no para parsing.
