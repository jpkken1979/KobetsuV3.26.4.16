# Spec: Reset Total de Base de Datos — Plan B

**Fecha:** 2026-04-15  
**Estado:** Aprobado por usuario  
**Alcance:** Endpoint de reset + UI Danger Zone en Settings

---

## 1. Objetivo

Permitir al usuario borrar todos los datos operativos de la base de datos (contratos, empleados, empresas, fábricas) dejando el sistema en estado vacío listo para producción real. La operación es irreversible y requiere confirmación explícita.

---

## 2. Fuera de alcance

- No borra `audit_log` (registro histórico permanente)
- No borra `__drizzle_migrations`
- No toca configuración de appSettings (localStorage)
- No resetea backups existentes en `data/backups/`

---

## 3. Backend — `POST /api/admin/reset-all`

### Ruta

`server/routes/admin-reset.ts` — nuevo archivo, registrado en `server/index.ts`.

### Request

```typescript
// Body validado por Zod
{ confirm: "RESET" }
```

### Implementación

Protegida por `adminGuard` middleware (token `ADMIN_TOKEN`), igual que todos los endpoints `/api/admin/*`.

Dentro de una transacción SQLite atómica:

```
1. DELETE FROM contract_employees
2. DELETE FROM pdf_versions
3. DELETE FROM contracts
4. DELETE FROM factory_calendars
5. DELETE FROM employees
6. DELETE FROM shift_templates
7. DELETE FROM factories
8. DELETE FROM client_companies
```

Orden respeta foreign keys (hijos antes que padres).

Post-transacción: insertar en `audit_log`:
```typescript
{
  action: "RESET_ALL",
  tableName: "all",
  recordId: null,
  userName: "admin",
  details: JSON.stringify(counts)  // { contracts: N, employees: N, ... }
}
```

### Response

```typescript
// 200 OK
{
  success: true,
  deleted: {
    clientCompanies: number,
    factories: number,
    employees: number,
    contracts: number,
    contractEmployees: number,
    factoryCalendars: number,
    shiftTemplates: number,
    pdfVersions: number
  }
}
```

### Errores

- Body no es `{ confirm: "RESET" }` → 400 `{ error: "Confirmación inválida" }`
- Sin token admin → 401 (middleware)
- Error en transacción → 500, rollback automático

---

## 4. Frontend — Danger Zone en Settings

### Ubicación

Nueva sección al final de `src/routes/settings/index.tsx`, después de la sección de System Info y antes del cierre del componente.

### Query de conteos

Antes de abrir el ConfirmDialog, hacer una query rápida para mostrar los conteos actuales al usuario. Usar React Query con `queryKeys.dashboard` (stats ya existentes) o query ad-hoc a `/api/dashboard/stats`.

### UI — Danger Zone

```
┌─────────────────────────────────────────────────┐
│  ⚠ Zona de peligro                               │
│  ─────────────────────────────────────────────  │
│  Estas acciones son irreversibles.               │
│                                                  │
│  [Reset completo de base de datos]               │
│  Borra todos los contratos, empleados,           │
│  empresas y fábricas. El audit log se conserva. │
│                                           [🗑 Borrar todo] │
└─────────────────────────────────────────────────┘
```

- Borde `border border-destructive/30 rounded-2xl`
- Título con `AlertTriangle` icon en `text-destructive`
- Botón variant `destructive`

### ConfirmDialog

Al hacer click en "Borrar todo":

1. Mostrar conteos actuales: `"Se borrarán: 47 contratos, 392 empleados, 14 empresas, 76 fábricas"`
2. Input de confirmación: el usuario debe escribir `RESET` (mayúsculas exactas)
3. Botón "Confirmar borrado" habilitado solo cuando el input es exactamente `RESET`
4. Loading state durante el request (deshabilitar botón, spinner)

### Post-reset

- Toast de éxito: `"Base de datos reseteada. Se borraron X contratos, Y empleados, Z empresas."`
- Invalidar todas las queries de React Query (`queryClient.invalidateQueries()`)
- Redirect a `/` después de 1.5s

### Error

- Toast de error con mensaje del servidor
- No redirect, el usuario puede reintentar

---

## 5. API client (`src/lib/api.ts`)

Agregar:

```typescript
async resetAllData(body: { confirm: string }): Promise<ResetAllResponse> {
  return this.request("/api/admin/reset-all", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN }
  });
}
```

Tipo `ResetAllResponse` en `src/lib/api-types.ts`.

---

## 6. Tests

- `server/__tests__/admin-reset.test.ts` — nuevo archivo:
  - Reset exitoso devuelve conteos correctos
  - Body sin `confirm: "RESET"` → 400
  - Sin token → 401
  - Verifica que las tablas quedan vacías post-reset
  - Verifica que `audit_log` tiene la entrada del reset
  - Verifica que `audit_log` preexistente NO se borró

---

## 7. Restricciones técnicas

- Transacción SQLite obligatoria — o todo o nada
- `adminGuard` obligatorio en el endpoint
- TypeScript strict — cero `any`
- `ConfirmDialog` existente, no modal custom
- No agregar nuevas dependencias

---

## 8. Criterios de éxito

- [ ] `POST /api/admin/reset-all` con `{ confirm: "RESET" }` trunca las 8 tablas y retorna conteos
- [ ] Sin body correcto → 400
- [ ] `audit_log` conservado + nueva entrada de reset
- [ ] UI Danger Zone visible al final de Settings
- [ ] Input `RESET` habilita el botón de confirmación
- [ ] Post-reset: redirect a `/`, todas las queries invalidadas
- [ ] Tests del endpoint pasan
- [ ] `npm run lint && npm run typecheck && npm run test:run` sin errores nuevos
