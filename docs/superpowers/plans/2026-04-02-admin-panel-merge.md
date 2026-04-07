# Admin Panel Merge + adminMode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mergear el worktree `feature/admin-database-panel` a `main` e implementar el toggle `adminMode` en settings + sidebar condicional.

**Architecture:** Squash merge del worktree (30 archivos, 4 fases ya implementadas). Luego 3 modificaciones en archivos existentes: `app-settings.ts` agrega `adminMode: boolean`, `settings/index.tsx` agrega la sección toggle, `sidebar.tsx` lee `adminMode` y muestra el link `/admin` condicionalmente.

**Tech Stack:** TypeScript, React 19, Zustand-less (localStorage directo via `app-settings.ts`), TanStack Router, Tailwind CSS 4, Lucide React.

---

## File Map

| Archivo | Acción | Propósito |
|---------|--------|-----------|
| `src/lib/app-settings.ts` | MODIFY | Agregar `adminMode: boolean` al store |
| `src/routes/settings/index.tsx` | MODIFY | Agregar sección "Modo Developer" con toggle |
| `src/components/layout/sidebar.tsx` | MODIFY | Link `/admin` condicional a `adminMode` |

---

## Task 1: Squash merge del worktree a main

**Files:** ninguno (operación git)

- [ ] **Step 1.1: Verificar que estás en main**

```bash
cd "C:\Users\kenji\Github\Jpkken1979\JP-v1.26.3.25-30"
git branch --show-current
```
Esperado: `main`

- [ ] **Step 1.2: Squash merge del worktree**

```bash
git merge --squash feature/admin-database-panel
```
Esperado: "Squash commit -- not updating HEAD" + lista de archivos staged

- [ ] **Step 1.3: Verificar archivos staged**

```bash
git diff --cached --stat | head -30
```
Esperado: ver `src/routes/admin.tsx`, `src/routes/admin/-*.tsx`, `server/routes/admin-*.ts`, etc.

- [ ] **Step 1.4: Commitear el squash**

```bash
git commit -m "feat(admin): panel de administracion de base de datos"
```

- [ ] **Step 1.5: Verificar que los archivos admin existen en main**

```bash
ls src/routes/admin/
```
Esperado: `table-explorer.tsx  -sql-runner.tsx  -crud-dialog.tsx  -contract-manager.tsx  -employee-manager.tsx  -backup-manager.tsx  -stats-dashboard.tsx  -audit-explorer.tsx`

- [ ] **Step 1.6: Correr tests para verificar baseline post-merge**

```bash
npm run test:run 2>&1 | tail -10
```
Esperado: al menos 1217 passed, 0 failed (el fallo del worktree ya no aplica)

- [ ] **Step 1.7: Correr typecheck**

```bash
npm run typecheck 2>&1 | head -20
```
Esperado: sin errores

---

## Task 2: Agregar adminMode a app-settings.ts

**Files:**
- Modify: `src/lib/app-settings.ts`

- [ ] **Step 2.1: Reemplazar el contenido de `src/lib/app-settings.ts`**

```typescript
export interface AppSettings {
  conflictWarningDays: number;
  adminMode: boolean;
}

const STORAGE_KEY = "app_settings_v1";
const DEFAULT_SETTINGS: AppSettings = {
  conflictWarningDays: 90,
  adminMode: false,
};

function clampWarningDays(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.conflictWarningDays;
  return Math.min(365, Math.max(1, Math.round(n)));
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
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }
  return merged;
}
```

- [ ] **Step 2.2: Verificar typecheck**

```bash
npm run typecheck 2>&1 | head -10
```
Esperado: sin errores

- [ ] **Step 2.3: Commit**

```bash
git add src/lib/app-settings.ts
git commit -m "feat(settings): agregar adminMode al store de configuracion"
```

---

## Task 3: Toggle "Modo Developer" en /settings

**Files:**
- Modify: `src/routes/settings/index.tsx`

- [ ] **Step 3.1: Agregar `adminMode` al estado local en `SettingsPage`**

En `src/routes/settings/index.tsx`, dentro de la función `SettingsPage`, después de la línea con `conflictWarningDays` (línea 57):

```typescript
// Agregar junto a los otros useState al inicio de SettingsPage:
const [adminMode, setAdminMode] = useState(() => getAppSettings().adminMode);
```

- [ ] **Step 3.2: Agregar el handler del toggle**

Dentro de `SettingsPage`, después de los otros handlers existentes:

```typescript
const handleAdminModeToggle = () => {
  const next = !adminMode;
  updateAppSettings({ adminMode: next });
  setAdminMode(next);
  toast.success(next ? "Modo Developer activado" : "Modo Developer desactivado");
};
```

- [ ] **Step 3.3: Agregar importaciones necesarias**

En el bloque de imports de Lucide, agregar `Terminal` junto a los iconos existentes:

```typescript
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Database,
    Download,
    Eye,
    Factory,
    GitBranch,
    Globe,
    Info,
    Keyboard,
    Loader2,
    Server,
    Shield,
    Terminal,   // <-- agregar
    Trash2,
    Zap,
} from "lucide-react";
```

- [ ] **Step 3.4: Agregar la sección "Modo Developer" al JSX**

Al final del JSX de `SettingsPage`, antes del último `</AnimatedPage>` de cierre, agregar la nueva sección. Ubicarla después de la sección de backup/sistema existente:

```tsx
{/* Sección Modo Developer */}
<motion.section
  initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, delay: 0.2 }}
  className="rounded-2xl border border-border bg-card p-6 space-y-4"
>
  <div className="flex items-center gap-3">
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
      <Terminal className="h-4 w-4 text-amber-500" />
    </div>
    <div>
      <h2 className="text-sm font-semibold text-foreground">Modo Developer</h2>
      <p className="text-xs text-muted-foreground">
        Habilita el panel de administración con acceso directo a la base de datos
      </p>
    </div>
    {/* Toggle */}
    <button
      onClick={handleAdminModeToggle}
      aria-pressed={adminMode}
      aria-label={adminMode ? "Desactivar modo developer" : "Activar modo developer"}
      className={cn(
        "ml-auto relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        adminMode ? "bg-amber-500" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
          adminMode ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  </div>

  {/* Advertencia */}
  <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
    <span>
      El panel de administración permite modificar y eliminar datos directamente.
      Solo activar en entornos de desarrollo.
    </span>
  </div>

  {/* Link al panel cuando está activo */}
  {adminMode && (
    <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-foreground">
        <Shield className="h-3.5 w-3.5 text-amber-500" />
        <span>Panel de administración activo</span>
      </div>
      <Link
        to="/admin"
        className="text-xs font-medium text-primary hover:underline"
      >
        Abrir panel →
      </Link>
    </div>
  )}
</motion.section>
```

- [ ] **Step 3.5: Verificar typecheck**

```bash
npm run typecheck 2>&1 | head -10
```
Esperado: sin errores

- [ ] **Step 3.6: Commit**

```bash
git add src/routes/settings/index.tsx
git commit -m "feat(settings): agregar toggle de modo developer"
```

---

## Task 4: Link /admin condicional en sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 4.1: Agregar import de `getAppSettings` y `Shield` en sidebar.tsx**

En la parte superior de `src/components/layout/sidebar.tsx`, agregar imports:

```typescript
import { getAppSettings } from "@/lib/app-settings";
```

Y en el bloque de Lucide, agregar `Shield`:

```typescript
import {
    Building2,
    ClipboardCheck,
    FileDown,
    FileText,
    FileUp,
    History,
    LayoutDashboard,
    ScrollText,
    Settings,
    Shield,      // <-- agregar
    Table2,
    Upload,
    Users,
    X,
} from "lucide-react";
```

- [ ] **Step 4.2: Leer adminMode dentro del componente Sidebar**

En `src/components/layout/sidebar.tsx`, dentro de la función `Sidebar`, después de la línea `const currentPath = routerState.location.pathname;` (línea 107):

```typescript
const adminMode = getAppSettings().adminMode;
```

- [ ] **Step 4.3: Agregar el link /admin a la sección "システム" condicionalmente**

Modificar la sección `"システム"` en el array `navigationSections` para que sea dinámica. Reemplazar la sección estática:

```typescript
// ANTES (estático):
{
  label: "システム",
  items: [
    { name: "履歴・書類", href: "/history", icon: History },
    { name: "監査ログ", href: "/audit", icon: ScrollText },
    { name: "設定", href: "/settings", icon: Settings },
  ],
},

// DESPUÉS: mover la construcción del array dentro del componente
// Reemplazar la const navigationSections con una función que recibe adminMode:
```

Dado que `navigationSections` es una `const` fuera del componente, la forma más simple es construir las secciones dentro del componente. Reemplazar la declaración `const navigationSections` (líneas 20-53) con:

```typescript
// Eliminar const navigationSections = [...] del nivel del módulo
// (líneas 20-53 del archivo actual)
```

Y dentro de la función `Sidebar`, después de `const adminMode = getAppSettings().adminMode;`, agregar:

```typescript
const navigationSections = [
  {
    label: null,
    items: [
      { name: "ダッシュボード", href: "/", icon: LayoutDashboard },
      { name: "契約管理", href: "/contracts", icon: FileText },
    ],
  },
  {
    label: "基本データ",
    items: [
      { name: "派遣社員", href: "/employees", icon: Users },
      { name: "派遣先企業", href: "/companies", icon: Building2 },
      { name: "データ確認", href: "/data-check", icon: ClipboardCheck },
    ],
  },
  {
    label: "業務ツール",
    items: [
      { name: "書類生成", href: "/documents", icon: FileDown },
      { name: "インポート", href: "/import", icon: Upload },
      { name: "企業テーブル", href: "/companies/table", icon: Table2 },
      { name: "コーリツ管理", href: "/companies/koritsu", icon: FileUp },
    ],
  },
  {
    label: "システム",
    items: [
      { name: "履歴・書類", href: "/history", icon: History },
      { name: "監査ログ", href: "/audit", icon: ScrollText },
      { name: "設定", href: "/settings", icon: Settings },
      ...(adminMode ? [{ name: "Admin DB", href: "/admin", icon: Shield }] : []),
    ],
  },
];
```

- [ ] **Step 4.4: Verificar typecheck**

```bash
npm run typecheck 2>&1 | head -10
```
Esperado: sin errores

- [ ] **Step 4.5: Verificar lint**

```bash
npm run lint 2>&1 | head -20
```
Esperado: 0 errors (o solo el `let` pre-existente en use-contract-wizard.ts)

- [ ] **Step 4.6: Correr tests completos**

```bash
npm run test:run 2>&1 | tail -10
```
Esperado: ≥1217 passed, 0 failed

- [ ] **Step 4.7: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(sidebar): mostrar link Admin DB cuando adminMode esta activo"
```

---

## Task 5: Limpieza del worktree

**Files:** ninguno (operación git)

- [ ] **Step 5.1: Eliminar el worktree**

```bash
git worktree remove .worktrees/admin-db --force
```

- [ ] **Step 5.2: Eliminar la rama feature**

```bash
git branch -d feature/admin-database-panel
```
Si da error porque no está merged:
```bash
git branch -D feature/admin-database-panel
```

- [ ] **Step 5.3: Verificar estado final**

```bash
git log --oneline -6
git worktree list
```
Esperado: sin worktrees extra, historial limpio con el squash commit de admin.

- [ ] **Step 5.4: Commit final de limpieza (si hay cambios)**

```bash
git status
```
Si hay archivos .omc/ u otros residuos del worktree sin commitear, agregarlos o agregarlos al .gitignore según corresponda.

---

## Smoke test manual

Después de completar todos los tasks:

1. `npm run dev` — arrancar la app
2. Navegar a `/settings` → verificar que aparece la sección "Modo Developer" al final
3. Activar el toggle → verificar toast "Modo Developer activado"
4. Verificar que el sidebar muestra "Admin DB" link
5. Navegar a `/admin` → verificar que el panel carga con los 8 tabs
6. Desactivar el toggle → verificar que el link desaparece del sidebar
7. Navegar directamente a `/admin` → verificar que muestra la pantalla bloqueada
