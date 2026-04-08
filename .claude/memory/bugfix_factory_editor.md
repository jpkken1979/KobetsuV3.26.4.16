---
name: Bugfix — edición de fábricas no abría el editor
description: handleEditFactory no seteaba selectedCompany; FactoryEditor no cargaba datos existentes
type: project
auto_saved: true
trigger: bugfix
date: 2026-04-07
---

## Síntoma

El usuario reportó que no podía editar fábricas. Al hacer clic en "editar" en una fábrica existente, no pasaba nada visible.

## Root cause (2 bugs combinados)

### Bug 1 — `handleEditFactory` no seteaba `selectedCompany`

En `src/routes/companies/index.tsx`:

```ts
// ANTES (roto):
const handleEditFactory = (id: number) => {
  setFactoryId(id);
  setFactoryEditorOpen(true);
  // selectedCompany nunca se seteaba ← BUG
};

// El JSX tenía:
{selectedCompany && (    // ← nunca true al editar, el dialog nunca abría
  <FactoryEditor ... />
)}
```

`selectedCompany` solo se seteaba en `handleAddFactory` (al crear). Al editar, quedaba `null` y el bloque JSX nunca se renderizaba.

### Bug 2 — `FactoryEditor` no cargaba datos existentes

`-factory-editor.tsx` no tenía `useQuery` + `useEffect` para obtener los datos de la fábrica existente. Todos los campos aparecían vacíos.

## Fix aplicado

En `src/routes/companies/index.tsx`:

1. Import: `FactoryEditor` → `FactoryDrawer` (que ya implementa useQuery + useEffect correctamente)
2. `handleEditFactory`: busca la empresa dueña iterando `companies?.find(co => co.factories?.some(f => f.id === id))`
3. JSX: renderiza `FactoryDrawer` con `companyId`, `editingId`, `onClose`

## Como prevenir

- Al reportar "todo está bien" luego de cambios, auditar los flujos CRUD de la UI, no solo typecheck/lint/tests unitarios
- Los tests unitarios del servidor no detectan bugs de lógica en componentes React
- `FactoryEditor` y `FactoryDrawer` son dos implementaciones paralelas — cuando existen duplicados, verificar cuál está activo

## Archivos modificados

- `src/routes/companies/index.tsx` (3 cambios: import, handleEditFactory, JSX)
