# Settings + Admin Bug Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir 5 bugs en Settings y Admin panel: purgeEmployees roto, admin sin route guard, holiday dates que no persisten, bulk calendar sin validación, y CRUD tab placeholder.

**Architecture:** Cambios quirúrgicos en 3 capas — `src/lib/app-settings.ts` (extender tipo), `src/routes/settings/index.tsx` + `src/routes/admin.tsx` (frontend), y un nuevo componente `src/routes/admin/-crud-tab.tsx`. No se toca el server — el backend de purge ya está correcto.

**Tech Stack:** React 19, TypeScript strict, TanStack React Query 5, Zustand, `src/lib/app-settings.ts` (localStorage), Vitest 4.

---

## File Map

| Archivo | Acción | Bug |
|---------|--------|-----|
| `src/lib/api.ts` | Modify | B1 |
| `src/routes/settings/index.tsx` | Modify | B1, B3, B4 |
| `src/lib/app-settings.ts` | Modify | B3 |
| `src/routes/admin.tsx` | Modify | B2, B5 |
| `src/routes/admin/-crud-tab.tsx` | Create | B5 |

---

## Task 1: Fix B1 — purgeEmployees API mismatch

**Files:**
- Modify: `src/lib/api.ts` (línea ~156)
- Modify: `src/routes/settings/index.tsx` (línea ~108)

El endpoint `POST /api/employees/purge` espera `{ confirm: "DELETE" }` pero el frontend llama `api.purgeEmployees()` sin body. El server devuelve 400 silenciosamente.

- [ ] **Step 1: Verificar el bug**

```bash
cd "C:\Users\kenji\OneDrive\Desktop\KobetsuVsKonetsu\KobetsuV3"
grep -n "purgeEmployees" src/lib/api.ts
```

Esperado: ver línea ~156 con `purgeEmployees: () => request<...>("/employees/purge", { method: "POST" })` — sin body.

- [ ] **Step 2: Corregir `api.ts`**

En `src/lib/api.ts`, reemplazar:

```typescript
purgeEmployees: () =>
  request<{ success: boolean; deleted: number; backup: string | null }>("/employees/purge", {
    method: "POST",
  }),
```

Por:

```typescript
purgeEmployees: () =>
  request<{ success: boolean; deleted: number; backup: string | null }>("/employees/purge", {
    method: "POST",
    body: JSON.stringify({ confirm: "DELETE" }),
  }),
```

- [ ] **Step 3: Verificar typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

Esperado: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "fix(api): purgeEmployees envía body { confirm: 'DELETE' } requerido por el endpoint"
```

---

## Task 2: Fix B2 — Admin panel sin route guard

**Files:**
- Modify: `src/routes/admin.tsx` (líneas 84-115)

El componente `AdminPage` siempre muestra el banner de warning Y siempre permite usar los tabs, sin verificar si `adminMode` está activo.

- [ ] **Step 1: Leer el estado actual**

```bash
grep -n "adminMode\|ShieldAlert\|Modo Developer" src/routes/admin.tsx | head -20
```

- [ ] **Step 2: Agregar route guard en `AdminPage`**

En `src/routes/admin.tsx`, importar `getAppSettings`:

```typescript
import { getAppSettings } from "@/lib/app-settings";
```

Reemplazar la función `AdminPage()` completa — agregar el guard al inicio y corregir el banner:

```typescript
function AdminPage() {
  const [activeTab, setActiveTab] = useState<string>("tables");
  const adminMode = getAppSettings().adminMode;

  const tabFallback = (
    <div className="flex items-center justify-center py-14">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
    </div>
  );

  // Route guard: si adminMode está desactivado, mostrar pantalla bloqueada
  if (!adminMode) {
    return (
      <AnimatedPage>
        <PageHeader
          title="データベース管理"
          subtitle="Admin Database Panel"
        />
        <div className="p-6">
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/60 bg-card p-12 text-center">
            <div className="rounded-full bg-amber-500/10 p-4">
              <ShieldAlert className="h-8 w-8 text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Modo Developer desactivado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Activá el Modo Developer en{" "}
                <a href="/settings" className="text-primary underline underline-offset-2">
                  Settings
                </a>{" "}
                para acceder a este panel.
              </p>
            </div>
          </div>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        title="データベース管理"
        subtitle="Admin Database Panel"
      />
      <div className="p-6 space-y-4">
        {/* Tab navigation */}
        <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-lg w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="min-h-[400px]">
          <Suspense fallback={tabFallback}>
            {activeTab === "tables"    && <TableExplorerLazy />}
            {activeTab === "sql"       && <SqlRunnerLazy />}
            {activeTab === "crud"      && <AdminCrudTabLazy />}
            {activeTab === "contracts" && <ContractManagerLazy />}
            {activeTab === "employees" && <EmployeeManagerLazy />}
            {activeTab === "backup"    && <BackupManagerLazy />}
            {activeTab === "stats"     && <StatsDashboardLazy />}
            {activeTab === "audit"     && <AuditExplorerLazy />}
          </Suspense>
        </div>
      </div>
    </AnimatedPage>
  );
}
```

**Nota:** `AdminCrudTabLazy` se agrega en Task 4. Por ahora se puede dejar comentado `{/* activeTab === "crud" && <AdminCrudTabLazy /> */}` o usar un placeholder.

- [ ] **Step 3: Verificar typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin.tsx
git commit -m "fix(admin): agregar route guard — panel bloqueado si adminMode está desactivado"
```

---

## Task 3: Fix B3 — Holiday dates no persisten

**Files:**
- Modify: `src/lib/app-settings.ts`
- Modify: `src/routes/settings/index.tsx` (líneas 58-70)

Los 6 estados de fechas son `useState` locales con strings hardcodeados. Se pierden al recargar.

- [ ] **Step 1: Extender `AppSettings` en `app-settings.ts`**

Reemplazar el contenido completo de `src/lib/app-settings.ts`:

```typescript
export interface AppSettings {
  conflictWarningDays: number;
  adminMode: boolean;
  nenmatsuFrom: string;
  nenmatsuTo: string;
  gwFrom: string;
  gwTo: string;
  obonFrom: string;
  obonTo: string;
}

const STORAGE_KEY = "app_settings_v1";
const DEFAULT_SETTINGS: AppSettings = {
  conflictWarningDays: 90,
  adminMode: false,
  nenmatsuFrom: "12月26日",
  nenmatsuTo: "1月5日",
  gwFrom: "4月29日",
  gwTo: "5月5日",
  obonFrom: "8月8日",
  obonTo: "8月16日",
};

function clampWarningDays(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.conflictWarningDays;
  return Math.min(365, Math.max(1, Math.round(n)));
}

function parseString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

export function getAppSettings(): AppSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      conflictWarningDays: clampWarningDays(parsed.conflictWarningDays),
      adminMode: typeof parsed.adminMode === "boolean" ? parsed.adminMode : false,
      nenmatsuFrom: parseString(parsed.nenmatsuFrom, DEFAULT_SETTINGS.nenmatsuFrom),
      nenmatsuTo: parseString(parsed.nenmatsuTo, DEFAULT_SETTINGS.nenmatsuTo),
      gwFrom: parseString(parsed.gwFrom, DEFAULT_SETTINGS.gwFrom),
      gwTo: parseString(parsed.gwTo, DEFAULT_SETTINGS.gwTo),
      obonFrom: parseString(parsed.obonFrom, DEFAULT_SETTINGS.obonFrom),
      obonTo: parseString(parsed.obonTo, DEFAULT_SETTINGS.obonTo),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function updateAppSettings(next: Partial<AppSettings>): AppSettings {
  const prev = getAppSettings();
  const merged: AppSettings = {
    conflictWarningDays: clampWarningDays(next.conflictWarningDays ?? prev.conflictWarningDays),
    adminMode: typeof next.adminMode === "boolean" ? next.adminMode : prev.adminMode,
    nenmatsuFrom: parseString(next.nenmatsuFrom, prev.nenmatsuFrom),
    nenmatsuTo: parseString(next.nenmatsuTo, prev.nenmatsuTo),
    gwFrom: parseString(next.gwFrom, prev.gwFrom),
    gwTo: parseString(next.gwTo, prev.gwTo),
    obonFrom: parseString(next.obonFrom, prev.obonFrom),
    obonTo: parseString(next.obonTo, prev.obonTo),
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }
  return merged;
}
```

- [ ] **Step 2: Actualizar los `useState` de holiday dates en settings**

En `src/routes/settings/index.tsx`, reemplazar las líneas de los 6 estados hardcodeados:

```typescript
// ANTES (hardcoded):
const [nenmatsuFrom, setNenmatsuFrom] = useState("12月26日");
const [nenmatsuTo, setNenmatsuTo] = useState("1月5日");
const [gwFrom, setGwFrom] = useState("4月29日");
const [gwTo, setGwTo] = useState("5月5日");
const [obonFrom, setObonFrom] = useState("8月8日");
const [obonTo, setObonTo] = useState("8月16日");

// DESPUÉS (desde appSettings):
const [nenmatsuFrom, setNenmatsuFrom] = useState(() => getAppSettings().nenmatsuFrom);
const [nenmatsuTo, setNenmatsuTo] = useState(() => getAppSettings().nenmatsuTo);
const [gwFrom, setGwFrom] = useState(() => getAppSettings().gwFrom);
const [gwTo, setGwTo] = useState(() => getAppSettings().gwTo);
const [obonFrom, setObonFrom] = useState(() => getAppSettings().obonFrom);
const [obonTo, setObonTo] = useState(() => getAppSettings().obonTo);
```

- [ ] **Step 3: Guardar al aplicar el calendario**

En `handleBulkCalendar`, antes de llamar al endpoint, persistir los valores:

```typescript
const handleBulkCalendar = async () => {
  // Persistir fechas en appSettings antes de aplicar
  updateAppSettings({ nenmatsuFrom, nenmatsuTo, gwFrom, gwTo, obonFrom, obonTo });

  try {
    setCalendarUpdating(true);
    const result = await api.bulkUpdateCalendar(calendarPreview);
    toast.success(`${result.updated} 工場のカレンダーを更新しました`, {
      description: calendarPreview,
    });
  } catch {
    toast.error("カレンダーの一括更新に失敗しました");
  } finally {
    setCalendarUpdating(false);
  }
};
```

- [ ] **Step 4: Verificar typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/app-settings.ts src/routes/settings/index.tsx
git commit -m "fix(settings): persistir holiday dates en appSettings (localStorage)"
```

---

## Task 4: Fix B4 — Bulk calendar sin validación + Fix B5 CRUD tab

**Files:**
- Modify: `src/routes/settings/index.tsx` (función `handleBulkCalendar`)
- Create: `src/routes/admin/-crud-tab.tsx`
- Modify: `src/routes/admin.tsx` (agregar lazy import + tab content)

### B4: Validación en bulk calendar

Los inputs de holiday dates son texto libre. Validar que ninguno esté vacío antes de enviar.

- [ ] **Step 1: Agregar validación en `handleBulkCalendar`**

En `src/routes/settings/index.tsx`, en `handleBulkCalendar`, agregar validación antes del `updateAppSettings`:

```typescript
const handleBulkCalendar = async () => {
  // Validar que ningún campo esté vacío
  const fields = [
    { label: "年末年始 開始", value: nenmatsuFrom },
    { label: "年末年始 終了", value: nenmatsuTo },
    { label: "GW 開始", value: gwFrom },
    { label: "GW 終了", value: gwTo },
    { label: "夏季休暇 開始", value: obonFrom },
    { label: "夏季休暇 終了", value: obonTo },
  ];
  const emptyField = fields.find((f) => !f.value.trim());
  if (emptyField) {
    toast.error(`入力エラー: ${emptyField.label}が空です`);
    return;
  }

  // Persistir fechas en appSettings antes de aplicar
  updateAppSettings({ nenmatsuFrom, nenmatsuTo, gwFrom, gwTo, obonFrom, obonTo });

  try {
    setCalendarUpdating(true);
    const result = await api.bulkUpdateCalendar(calendarPreview);
    toast.success(`${result.updated} 工場のカレンダーを更新しました`, {
      description: calendarPreview,
    });
  } catch {
    toast.error("カレンダーの一括更新に失敗しました");
  } finally {
    setCalendarUpdating(false);
  }
};
```

### B5: CRUD tab

- [ ] **Step 2: Crear `src/routes/admin/-crud-tab.tsx`**

```typescript
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { Trash2, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// Tablas permitidas para CRUD (excluye client_companies, factories, audit_log — protegidas)
const ALLOWED_TABLES = [
  "employees",
  "contracts",
  "shift_templates",
  "factory_calendars",
] as const;

type AllowedTable = (typeof ALLOWED_TABLES)[number];

export function AdminCrudTab() {
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<AllowedTable>("employees");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [showInsertForm, setShowInsertForm] = useState(false);
  const [insertData, setInsertData] = useState<Record<string, string>>({});

  // Obtener metadata de la tabla para conocer columnas
  const { data: tableMeta } = useQuery({
    queryKey: queryKeys.adminTables,
    queryFn: () => api.getAdminTables(),
    staleTime: 60_000,
  });

  // Obtener rows de la tabla seleccionada (últimas 20)
  const { data: rows, isLoading, refetch } = useQuery({
    queryKey: [...queryKeys.adminRows(selectedTable), { limit: 20 }],
    queryFn: () => api.getAdminRows(selectedTable, { limit: 20, offset: 0 }),
    staleTime: 10_000,
  });

  const currentMeta = tableMeta?.find((t) => t.name === selectedTable);
  // Columnas editables: excluir id, createdAt, updatedAt
  const editableColumns = (currentMeta?.columns ?? []).filter(
    (col) => col.name !== "id" && col.name !== "createdAt" && col.name !== "updatedAt"
  );

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.adminDelete(selectedTable, id),
    onSuccess: () => {
      toast.success("削除しました");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminRows(selectedTable) });
    },
    onError: () => toast.error("削除に失敗しました"),
  });

  const insertMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.adminInsert(selectedTable, data),
    onSuccess: () => {
      toast.success("追加しました");
      setShowInsertForm(false);
      setInsertData({});
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminRows(selectedTable) });
    },
    onError: () => toast.error("追加に失敗しました"),
  });

  return (
    <div className="space-y-4">
      {/* Table selector */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 flex-wrap">
          {ALLOWED_TABLES.map((table) => (
            <button
              key={table}
              onClick={() => { setSelectedTable(table); setShowInsertForm(false); }}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                selectedTable === table
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {table}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" onClick={() => setShowInsertForm(!showInsertForm)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Insert
        </Button>
      </div>

      {/* Insert form */}
      {showInsertForm && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            New row — {selectedTable}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {editableColumns.map((col) => (
              <div key={col.name}>
                <label className="text-xs text-muted-foreground mb-1 block">{col.name}</label>
                <input
                  className="w-full rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs focus:border-primary/50 focus:outline-none"
                  placeholder={col.type}
                  value={insertData[col.name] ?? ""}
                  onChange={(e) => setInsertData((prev) => ({ ...prev, [col.name]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setShowInsertForm(false); setInsertData({}); }}>
              キャンセル
            </Button>
            <Button
              size="sm"
              onClick={() => insertMutation.mutate(insertData)}
              disabled={insertMutation.isPending}
            >
              {insertMutation.isPending ? "追加中..." : "追加"}
            </Button>
          </div>
        </div>
      )}

      {/* Rows table */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/30 border-b border-border/60">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">id</th>
                {(currentMeta?.columns ?? [])
                  .filter((c) => c.name !== "id")
                  .slice(0, 5)
                  .map((col) => (
                    <th key={col.name} className="px-3 py-2 text-left font-medium text-muted-foreground">
                      {col.name}
                    </th>
                  ))}
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(rows?.rows ?? []).map((row: Record<string, unknown>) => (
                <tr key={String(row.id)} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-muted-foreground">{String(row.id)}</td>
                  {(currentMeta?.columns ?? [])
                    .filter((c) => c.name !== "id")
                    .slice(0, 5)
                    .map((col) => (
                      <td key={col.name} className="px-3 py-2 truncate max-w-[140px]">
                        {String(row[col.name] ?? "")}
                      </td>
                    ))}
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(Number(row.id))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
              {(rows?.rows ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="行を削除"
        description={`ID ${deleteTarget} のレコードを削除します。この操作は取り消せません。`}
        confirmLabel="削除"
        variant="destructive"
        onConfirm={() => { if (deleteTarget !== null) deleteMutation.mutate(deleteTarget); }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Agregar `api.adminInsert` y `api.adminDelete` a `src/lib/api.ts` si no existen**

Buscar si ya existen:
```bash
grep -n "adminInsert\|adminDelete\|admin/crud" src/lib/api.ts
```

Si no existen, agregar a `api.ts`:

```typescript
adminInsert: (table: string, data: Record<string, string>) =>
  request<{ id: number }>(`/admin/crud/${table}`, {
    method: "POST",
    body: JSON.stringify(data),
  }),

adminDelete: (table: string, id: number) =>
  request<{ success: boolean }>(`/admin/crud/${table}/${id}`, {
    method: "DELETE",
  }),
```

- [ ] **Step 4: Agregar `adminRows` y `adminTables` a `query-keys.ts` si no existen**

```bash
grep -n "adminRows\|adminTables" src/lib/query-keys.ts
```

Si no existen, agregar al objeto `queryKeys`:

```typescript
adminTables: ["admin", "tables"] as const,
adminRows: (table: string) => ["admin", "rows", table] as const,
```

- [ ] **Step 5: Agregar lazy import y tab content en `admin.tsx`**

En `src/routes/admin.tsx`, agregar el lazy import junto a los otros:

```typescript
const AdminCrudTabLazy = lazy(async () => {
  const mod = await import("./admin/-crud-tab");
  return { default: mod.AdminCrudTab };
});
```

En el tab content, reemplazar el placeholder de CRUD:

```tsx
{activeTab === "crud" && <AdminCrudTabLazy />}
```

- [ ] **Step 6: Verificar typecheck y lint**

```bash
npm run typecheck 2>&1 | tail -8
npm run lint 2>&1 | tail -8
```

Esperado: sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add src/routes/settings/index.tsx src/routes/admin/-crud-tab.tsx src/routes/admin.tsx src/lib/api.ts src/lib/query-keys.ts
git commit -m "feat(admin): CRUD tab implementado + validación bulk calendar vacío"
```

---

## Task 5: Verificación final + fix de issues colaterales

**Files:** Los que el implementer encuentre durante la revisión.

- [ ] **Step 1: Correr suite completa**

```bash
npm run lint && npm run typecheck && npm run test:run 2>&1 | tail -15
```

Esperado: 0 errores, 755+ tests pasando.

- [ ] **Step 2: Smoke test manual de cada fix**

1. **B1**: Settings → "社員テーブルをクリア" → escribir DELETE → confirmar. No debe dar error 400.
2. **B2**: Sin adminMode activo, navegar a `/admin` → ver pantalla bloqueada. Activar adminMode en Settings → volver a `/admin` → ver tabs.
3. **B3**: Settings → cambiar fecha GW → recargar → la fecha debe persistir.
4. **B4**: Settings → vaciar un campo de fecha → click "一括更新" → debe mostrar toast de error sin hacer request.
5. **B5**: Admin → tab CRUD → seleccionar tabla → ver rows → delete con confirmación.

- [ ] **Step 3: Fix de issues colaterales**

Si durante la implementación se encontraron issues adicionales en los archivos tocados (tipos incorrectos, error handling faltante, UX inconsistente), corregirlos ahora con commit descriptivo separado.

- [ ] **Step 4: Commit final si hay fixes colaterales**

```bash
git add <archivos afectados>
git commit -m "fix(<scope>): <descripción del issue colateral encontrado>"
```

- [ ] **Step 5: Push**

```bash
git push origin master
```

---

## Notas para el implementer

- `getAppSettings()` y `updateAppSettings()` están en `src/lib/app-settings.ts`
- El patrón de persistencia de settings es: `updateAppSettings({ campo: valor })` — no hay store de Zustand para esto, es localStorage directo
- `api.getAdminTables()` y `api.getAdminRows()` probablemente ya existen — verificar antes de crear duplicados
- `queryKeys.adminRows` puede ya existir en `query-keys.ts` — verificar
- El `ConfirmDialog` acepta `variant="destructive"` para el botón de confirmación
- No usar `p-5` — solo `p-4` o `p-6`
