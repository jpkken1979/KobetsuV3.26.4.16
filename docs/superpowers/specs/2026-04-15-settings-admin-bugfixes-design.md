# Spec: Settings + Admin Bug Fixes — Plan A

**Fecha:** 2026-04-15  
**Estado:** Aprobado por usuario  
**Alcance:** 5 bug fixes quirúrgicos en Settings y Admin panel

---

## 1. Objetivo

Corregir los 5 issues identificados en la auditoría de Settings y Admin. Ninguno requiere nuevas dependencias ni cambios de arquitectura. Durante la implementación, corregir cualquier issue colateral que se encuentre.

---

## 2. Fixes

### B1 — purgeEmployees API mismatch (CRÍTICO)

**Síntoma:** `api.purgeEmployees()` en `settings/index.tsx:108` se llama sin argumentos. El endpoint `DELETE /api/employees/purge` requiere body `{ confirm: "DELETE" }` validado por Zod (`employees.ts:65-71`). Resultado: error 400 silencioso.

**Fix:**
- `src/routes/settings/index.tsx`: pasar `{ confirm: "DELETE" }` en la llamada
- Verificar que `src/lib/api.ts` expone `purgeEmployees(body: { confirm: string })` con el tipo correcto
- Si el tipo en `api.ts` no acepta body, actualizarlo

**Archivos:** `src/routes/settings/index.tsx`, `src/lib/api.ts`

---

### B2 — Admin panel sin route guard (SEGURIDAD)

**Síntoma:** `/admin` es accesible por cualquier usuario sin verificar `adminMode`. El banner de warning aparece siempre, incluso cuando adminMode está activado.

**Fix:**
- `src/routes/admin.tsx`: al montar, leer `adminMode` desde appSettings (localStorage key `app-settings` o el store de Zustand equivalente)
- Si `adminMode === false`: renderizar pantalla de acceso bloqueado con mensaje y link a Settings — NO renderizar los tabs
- Si `adminMode === true`: renderizar normalmente, ocultar el banner warning
- El banner actual (línea 100-106) debe mostrarse SOLO cuando `adminMode === false` y el usuario intentó acceder

**Archivos:** `src/routes/admin.tsx`, verificar `src/lib/hooks/use-theme.ts` o store de settings para el patrón de lectura de appSettings

---

### B3 — Holiday dates no persisten (MEDIO)

**Síntoma:** Los 6 estados de fechas en Settings (`nenmatsuFrom`, `nenmatsuTo`, `gwFrom`, `gwTo`, `obonFrom`, `obonTo`) son `useState` locales — se pierden al recargar la página.

**Fix:**
- Persistir los 6 valores en `appSettings` (localStorage), siguiendo el patrón existente de `conflictWarningDays`
- Al montar Settings, inicializar los estados desde `appSettings` con fallback a los valores por defecto actuales
- Guardar automáticamente al cambiar (o con botón explícito si ya hay uno para esta sección)

**Archivos:** `src/routes/settings/index.tsx`, verificar cómo se lee/escribe `conflictWarningDays` para replicar el patrón exacto

---

### B4 — Bulk calendar sin validación de fechas (MEDIO)

**Síntoma:** `handleBulkCalendar()` en `settings/index.tsx:72-84` no valida formato ni que start ≤ end. Puede enviar fechas inválidas al endpoint.

**Fix:**
- Antes de llamar al endpoint, validar cada rango:
  - Formato `YYYY-MM-DD` con regex `/^\d{4}-\d{2}-\d{2}$/`
  - `start_date <= end_date` como Date comparison
- Si algún rango falla: toast de error con mensaje específico ("Formato de fecha inválido: nenmatsu_from") y NO llamar al endpoint
- No cambiar la UX del input — solo agregar la validación antes del submit

**Archivos:** `src/routes/settings/index.tsx`

---

### B5 — CRUD tab placeholder sin implementar (BAJO)

**Síntoma:** `admin.tsx:143-145` muestra texto placeholder "CRUD — requires adminMode ON". El endpoint `/api/admin/crud/:table` está completamente implementado en `admin-crud.ts`.

**Fix:** Componente `AdminCrudTab` con:
- Select de tabla (whitelist: `employees`, `contracts`, `shift_templates`, `factory_calendars` — excluir tablas protegidas)
- Al seleccionar tabla: muestra botón "Insert" y lista de últimas 20 rows con botón Delete por fila
- Insert: form dinámico con inputs por columna (solo las editables — excluir `id`, `createdAt`, `updatedAt`)
- Delete: `ConfirmDialog` antes de llamar `DELETE /api/admin/crud/:table/:id`
- No implementar Update (complejidad innecesaria para admin)

**Archivos:** `src/routes/admin.tsx` o nuevo `src/routes/admin/-crud-tab.tsx`

---

## 3. Restricciones técnicas

- TypeScript strict — cero `any`
- Seguir patrón de React Query + mutation helpers existentes en `src/lib/mutation-helpers.ts`
- `ConfirmDialog` para toda acción destructiva (no `window.confirm()`)
- No agregar nuevas dependencias
- Tests: los cambios no deben romper los 755 tests existentes

---

## 4. Issues colaterales

Durante la implementación, si se encuentran issues adicionales en los archivos tocados (tipos incorrectos, error handling faltante, UX inconsistente), corregirlos en el mismo commit o en commit separado con descripción clara.

---

## 5. Criterios de éxito

- [ ] `purgeEmployees` en Settings funciona sin error 400
- [ ] `/admin` sin `adminMode` muestra pantalla bloqueada, no los tabs
- [ ] Holiday dates se mantienen al recargar Settings
- [ ] Bulk calendar rechaza fechas inválidas con toast de error
- [ ] CRUD tab permite insert/delete en tablas permitidas
- [ ] `npm run lint && npm run typecheck && npm run test:run` pasa sin errores nuevos
