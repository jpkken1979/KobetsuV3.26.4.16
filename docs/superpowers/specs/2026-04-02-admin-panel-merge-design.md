# Spec: Admin Panel Merge + adminMode Toggle

**Fecha:** 2026-04-02  
**Proyecto:** JP-v1.26.3.25-30 (個別契約書管理システム)  
**Estado:** Aprobado por usuario

---

## Contexto

El Admin Database Panel fue implementado completamente (30 archivos, 4 fases) en el worktree `feature/admin-database-panel`. El audit del 2026-04-02 confirmó que todos los componentes están funcionales pero el panel no está mergeado a `main` y el toggle `adminMode` no existe.

---

## Alcance

### Incluido
- Squash merge del worktree `feature/admin-database-panel` → `main`
- Agregar `adminMode: boolean` (default `false`) a `app-settings.ts`
- Toggle UI en `/settings` para activar/desactivar admin mode
- Link `/admin` en sidebar condicional a `adminMode === true`

### Excluido
- Modificaciones a los componentes del admin panel (ya están completos)
- Autenticación (decisión: no-auth, app local-only)
- Cambios al schema de base de datos

---

## Arquitectura

### Merge strategy

Squash merge desde el worktree para mantener historial de `main` limpio:

```bash
# Desde la rama main
git merge --squash feature/admin-database-panel
git commit -m "feat(admin): panel de administración de base de datos"
```

Los 4 commits del worktree (Phase 1, Phase 2, Phase 3+4, memory sync) quedan aplastados en un solo commit atómico.

**Post-merge:** eliminar worktree y rama feature.

### adminMode en app-settings.ts

Agregar campo `adminMode` al store Zustand existente en `src/lib/app-settings.ts`:

```typescript
interface AppSettings {
  conflictWarningDays: number;
  adminMode: boolean;          // NUEVO — default false
}

const DEFAULT_SETTINGS: AppSettings = {
  conflictWarningDays: 30,
  adminMode: false,            // NUEVO
};
```

El `src/routes/admin.tsx` ya existe (viene del worktree) y ya lee `adminMode` para mostrar la pantalla bloqueada. Solo falta que la propiedad exista en el store.

### Toggle en /settings

Nueva sección al final de `src/routes/settings/index.tsx`:

**Posición:** última sección de la página, después de las secciones existentes (backup, system info).

**Contenido:**
- Encabezado: "Modo Developer"
- Descripción: "Habilita el panel de administración con acceso directo a la base de datos, SQL runner y gestión avanzada. Solo activar en entornos de desarrollo."
- Toggle switch: on/off — llama `updateAppSettings({ adminMode: !adminMode })`
- Advertencia visible (amber/warning): "El panel de administración permite modificar y eliminar datos directamente. Usar con precaución."
- Cuando `adminMode === true`: badge verde "Activo" + link directo a `/admin`

**Componentes a reutilizar:** los existentes en `src/components/ui/` (Switch si existe, Card, Badge).

### Sidebar condicional

En `src/components/layout/sidebar.tsx`, agregar el link a `/admin` condicionado a `adminMode`:

```typescript
// Solo visible cuando adminMode está activo
...(adminMode ? [{ name: "Admin", href: "/admin", icon: Shield }] : [])
```

El link va al final de la lista de navegación, antes del separador de settings.

---

## Archivos modificados

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `src/lib/app-settings.ts` | UPDATE | Agregar `adminMode: boolean` (default false) |
| `src/routes/settings/index.tsx` | UPDATE | Agregar sección "Modo Developer" con toggle |
| `src/components/layout/sidebar.tsx` | UPDATE | Link `/admin` condicional a `adminMode` |

**Archivos nuevos:** ninguno (vienen todos del merge del worktree).

---

## Flujo de usuario

1. Usuario abre la app → sidebar sin link a `/admin`
2. Va a `/settings` → ve sección "Modo Developer" al final
3. Activa el toggle → `adminMode = true` persiste en localStorage
4. Sidebar muestra link "Admin"
5. Navega a `/admin` → acceso completo al panel
6. Para desactivar: vuelve a `/settings` y apaga el toggle

---

## Data flow

```
app-settings.ts (Zustand + localStorage)
    ↓ adminMode
sidebar.tsx  ←─── condicional: muestra/oculta link
admin.tsx    ←─── condicional: acceso o pantalla bloqueada
settings/index.tsx ──→ updateAppSettings({ adminMode })
```

---

## Testing

- Verificar que `npm run test:run` pasa después del merge (baseline: 1217/1218)
- Verificar que `npm run typecheck` pasa (0 errores)
- Verificar que `npm run lint` pasa
- Smoke test manual: activar toggle → sidebar muestra Admin → navegar a /admin → tabs funcionales

---

## Orden de implementación

1. Squash merge del worktree a main
2. Actualizar `app-settings.ts` (agregar adminMode)
3. Actualizar `settings/index.tsx` (toggle UI)
4. Actualizar `sidebar.tsx` (link condicional)
5. Correr tests y typecheck
6. Commit final + eliminar worktree y rama feature
