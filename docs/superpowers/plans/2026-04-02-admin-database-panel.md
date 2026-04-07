# Admin Database Panel

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan phase-by-phase.

**Goal:** Crear un panel de administracion de base de datos completo para la app JP個別契約書 — explorador de tablas, CRUD universal, SQL runner, gestion de contratos y empleados, backup/restore, estadisticas y log de auditoria.

**Architecture:** Nueva ruta `/admin` con sub-tabs. Backend endpoint unificado `/api/admin` + routers dedicados para SQL y stats. Frontend: TanStack Table para grids, Dialog para CRUD forms. Modo developer flaggeable para acceso.

**Tech Stack:** Hono 4 + Drizzle ORM + React 19 + TanStack Table v8 + React Hook Form + Zod 4 + Tailwind CSS 4 + existing backup service

---

## Alcance

### Incluido
- Tab 1: Explorador de tablas (todas las 8 tablas con filter/sort/pagination)
- Tab 2: SQL Runner (consultas SELECT arbitrarias, resultado en grid)
- Tab 3: CRUD universal (create/edit/delete por tabla, forms dinamicos)
- Tab 4: Gestion de contratos (especializada: status, renew, bulk cancel)
- Tab 5: Gestion de empleados (especializada: import/export Excel)
- Tab 6: Backup/Restore (exportar .db, importar .db, listar backups)
- Tab 7: Estadisticas (counts, distributions, missing data analysis)
- Tab 8: Log de auditoria (explorador del audit_log existente)
- Modo developer flag (enable/disable via app-settings, default OFF)

### Excluido
- Schema migrations o cambios al schema existente (schema.ts es sagrado)
- Autenticacion de usuarios (app es local-first)
- Modificaciones a rutas existentes (solo se agrega /admin/*)
- PDF generation (ya existe en /documents)
- Batch document generation (ya existe en /contracts/batch)

---

## Arquitectura

### Backend (server/routes/)

```
server/routes/
  admin-tables.ts        # GET /api/admin/tables — listar tablas + metadata
  admin-rows.ts          # GET /api/admin/rows/:table — paginated rows
  admin-sql.ts           # POST /api/admin/sql — ejecutar SQL SELECT
  admin-crud.ts          # POST|PUT|DELETE /api/admin/crud/:table — universal CRUD
  admin-stats.ts         # GET /api/admin/stats — estadisticas globales
  admin-backup.ts        # POST /api/admin/backup, POST /api/admin/restore
```

**Nota:** Se reutiliza `server/services/backup.ts` existente para backup. Restore: mejor-sqlite3 `sqlite.backup()` inverse operation.

### Backend (server/services/)

```
server/services/
  admin-sql.ts           # SQL parser seguro (solo SELECT), query executor
  admin-stats.ts         # Computar stats: counts, distributions, missing data
  admin-crud.ts          # Generic CRUD dispatcher via Drizzle
```

### Frontend (src/routes/admin/)

```
src/routes/
  admin.tsx              # Layout con tabs: TableExplorer | SQLRunner | CRUD |
                          #   Contracts | Employees | Backup | Stats | Audit
  admin/
    -table-explorer.tsx  # Tab 1: grid de datos por tabla
    -sql-runner.tsx      # Tab 2: editor SQL + resultado grid
    -crud-dialog.tsx     # Tab 3: dialog para create/edit/delete
    -contract-manager.tsx # Tab 4: vista especializada contratos
    -employee-manager.tsx # Tab 5: vista especializada empleados
    -backup-manager.tsx  # Tab 6: backup/restore/export/import
    -stats-dashboard.tsx # Tab 7: estadisticas
    -audit-explorer.tsx  # Tab 8: log de auditoria
```

### Frontend (src/lib/)

```
src/lib/
  api-types.ts           # AGREGAR: AdminTableMeta, AdminRowResult,
                         #   AdminSqlResult, AdminStats, AdminBackupResult
  hooks/
    use-admin-tables.ts  # Listar tablas disponibles
    use-admin-rows.ts    # Fetch rows con filter/sort/page
    use-admin-sql.ts     # Execute SQL query
    use-admin-crud.ts    # CRUD operations
    use-admin-stats.ts   # Dashboard stats
    use-admin-backup.ts  # Backup/restore ops
  stores/
    app-settings.ts      # AGREGAR: adminMode: boolean
```

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/tables` | Lista de 8 tablas con metadata (count, columns) |
| GET | `/api/admin/rows/:table` | Filas paginadas (page, pageSize, filter, sort) |
| POST | `/api/admin/sql` | Ejecutar SQL SELECT seguro |
| POST | `/api/admin/crud/:table` | Create row |
| PUT | `/api/admin/crud/:table/:id` | Update row |
| DELETE | `/api/admin/crud/:table/:id` | Delete row (con audit) |
| GET | `/api/admin/stats` | Estadisticas: counts, distributions, nulls |
| GET | `/api/admin/backups` | Listar archivos de backup en data/ |
| POST | `/api/admin/backup` | Crear backup manual |
| POST | `/api/admin/restore` | Restaurar desde backup |

---

## Dependencias del stack actual

- **Drizzle ORM**: usado para todos los queries y mutations — no agregar SQL builder nuevo
- **better-sqlite3**: `sqlite.backup()` para restore (ya disponible en `server/db/index.ts`)
- **TanStack Table v8**: para grids en table explorer y SQL runner
- **React Hook Form + Zod**: para forms de CRUD dinamicos (verificar si ya esta en package.json)
- **ExcelJS**: para import/export de empleados (ya instalado)
- **server/services/backup.ts**: reutilizar para backup creation
- **server/db/schema.ts**: leer metadata de columnas para forms dinamicos
- **app-settings**: agregar `adminMode` flag

---

## Fase 1: Fundamentos + Explorador de Tablas + SQL Runner

**Esfuerzo:** Alto | **Archivos:** ~18 | **Objetivo:** Tab 1 y Tab 2 funcionales

### Task 1: Backend base — Admin router + table metadata

**Files:**
- Create: `server/routes/admin-tables.ts`
- Create: `server/services/admin-sql.ts`

**Step 1.1 — admin-tables.ts GET /tables**

- [ ] Crear `server/routes/admin-tables.ts` con router `adminRouter`
- [ ] `GET /tables`: retornar array con metadata de las 8 tablas:
  ```ts
  {
    name: string,           // "employees"
    displayName: string,    // "社員 (Employees)"
    count: number,          // row count
    columns: {
      name: string,
      type: string,         // "text"|"integer"|"real"|"boolean"
      nullable: boolean,
      isPrimaryKey: boolean,
      isForeignKey: boolean,
      references?: { table: string, column: string },
    }[],
    foreignKeys: { column: string, refs: { table: string, column: string } }[],
  }
  ```
- [ ] Usar `db.select().from(information_schema)` o mejor: introspectar Drizzle schema directamente
- [ ] Para counts, usar `db.select({ count: count() }).from(table)` por tabla
- [ ] Agregar ruta en `server/index.ts`: `app.route("/api/admin", adminTablesRouter)`

**Step 1.2 — admin-sql.ts SQL parser seguro**

- [ ] Crear `server/services/admin-sql.ts`
- [ ] `parseAndValidate(sql: string): { safe: boolean; message?: string }`
  - Solo permitir SELECT (no INSERT/UPDATE/DELETE/DROP/CREATE/ALTER/TRUNCATE/ATTACH)
  - Validar que no contenga strings peligrosos (';', '--', '/*', '*/')
  - Max 10000 chars en query
  - Timeout de 30s
- [ ] `executeSql(sql: string): Promise<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number; time: number }>`
  - Ejecutar via `db.get()` o `db.all()` de better-sqlite3 raw
  - Medir tiempo de ejecucion
  - Para queries con params, usar placeholders `?`

### Task 2: Frontend base — API client + hooks

**Files:**
- Update: `src/lib/api-types.ts` — AGREGAR AdminTableMeta, AdminSqlResult
- Update: `src/lib/api.ts` — AGREGAR metodos admin
- Update: `src/lib/query-keys.ts` — AGREGAR admin keys
- Create: `src/lib/hooks/use-admin-tables.ts`
- Create: `src/lib/hooks/use-admin-rows.ts`
- Create: `src/lib/hooks/use-admin-sql.ts`

**Step 2.1 — api-types.ts**

- [ ] Agregar `AdminTableMeta` interface
- [ ] Agregar `AdminRowResult` interface (rows + total + columns metadata)
- [ ] Agregar `AdminSqlResult` interface (columns + rows + rowCount + executionTime)
- [ ] Agregar `AdminQueryParams` interface (table, page, pageSize, sortBy, sortDir, filters)

**Step 2.2 — api.ts**

- [ ] Agregar metodos:
  - `getAdminTables(): Promise<AdminTableMeta[]>`
  - `getAdminRows(table: string, params: AdminQueryParams): Promise<AdminRowResult>`
  - `executeSql(sql: string): Promise<AdminSqlResult>`

**Step 2.3 — hooks**

- [ ] `useAdminTables()` — query tables metadata, staleTime 5min
- [ ] `useAdminRows(table, params)` — query rows con filtros
- [ ] `useAdminSql(sql)` — mutation para ejecutar SQL

### Task 3: Route /admin + Table Explorer tab

**Files:**
- Create: `src/routes/admin.tsx` — layout con tabs
- Create: `src/routes/admin/-table-explorer.tsx` — Tab 1
- Update: `src/routeTree.gen.ts` — AUTO-GENERATED

**Step 3.1 — admin.tsx layout**

- [ ] Crear `src/routes/admin.tsx` con `createFileRoute("/admin")`
- [ ] Usar tab navigation (pills o tabs de Radix): Tables | SQL | CRUD | Contracts | Employees | Backup | Stats | Audit
- [ ] Leer `adminMode` de app-settings — si false, mostrar "Modo developer desactivado" con boton para activar
- [ ] Importar y renderizar cada tab component
- [ ] Agregar `errorComponent` y `pendingComponent`
- [ ] Layout consistente con PageHeader y AnimatedPage

**Step 3.2 — Table Explorer (-table-explorer.tsx)**

- [ ] Sidebar: lista de 8 tablas con iconos y row counts
- [ ] Main area: TanStack Table mostrando filas de la tabla seleccionada
- [ ] Features por columna:
  - Filter input por texto (search en todas las columnas)
  - Sort por header click (asc/desc)
  - Pagination: page size selector (10/25/50/100), prev/next, page indicator
  - Row count total en header
- [ ] Columnas relacionales: mostrar valor en vez de ID (ej: companyId → companyName)
- [ ] Filtro rapido: per-column filter dropdown para columnas clave
- [ ] Boton "Refresh" para recargar datos

### Task 4: SQL Runner tab

**Files:**
- Create: `src/routes/admin/-sql-runner.tsx` — Tab 2

**Step 4.1 — SQL Runner**

- [ ] Textarea para escribir SQL (monospace font, syntax highlighting con CSS simple)
- [ ] Boton "Execute" (solo habilita si query empieza con SELECT)
- [ ] Validacion del query antes de ejecutar (solo SELECT, max length)
- [ ] Resultado: TanStack Table con las columnas devueltas
- [ ] Metadatos: row count, tiempo de ejecucion (ms), columnas
- [ ] Error display si la query falla
- [ ] Query history: ultimas 10 queries ejecutadas (en localStorage)
- [ ] Botones rapidos: "SELECT * FROM employees LIMIT 50", "SELECT * FROM contracts LIMIT 50", etc.

---

## Fase 2: CRUD Universal + Gestion de Contratos

**Esfuerzo:** Alto | **Archivos:** ~12 | **Objetivo:** Tab 3 y Tab 4 funcionales

### Task 5: Backend CRUD universal

**Files:**
- Create: `server/routes/admin-crud.ts`

**Step 5.1 — admin-crud.ts**

- [ ] `POST /crud/:table` — Create
  - Validar que la tabla existe (whitelist de las 8 tablas)
  - Validar body contra schema de Drizzle (usar `typeof table.$inferInsert`)
  - Insertar con `db.insert(table).values(data).returning()`
  - Escribir audit_log entry
  - Retornar el registro creado
- [ ] `PUT /crud/:table/:id` — Update
  - Verificar que el registro existe
  - Validar body
  - Update con `db.update(table).set(data).where(eq(table.id, id))`
  - Audit log entry (action: "update")
  - Retornar registro actualizado
- [ ] `DELETE /crud/:table/:id` — Delete
  - Solo permitir para: employees, contracts, shift_templates
  - Bloquear DELETE de: client_companies, factories, audit_log
  - Ejecutar delete
  - Audit log entry (action: "delete")
  - Retornar `{ deleted: true, id }`

### Task 6: Frontend CRUD

**Files:**
- Create: `src/lib/hooks/use-admin-crud.ts`
- Create: `src/routes/admin/-crud-dialog.tsx`

**Step 6.1 — use-admin-crud.ts**

- [ ] Hook con `useMutation` para create, update, delete
- [ ] Funciones: `createRow(table, data)`, `updateRow(table, id, data)`, `deleteRow(table, id)`
- [ ] Invalidate queries apropiadas post-mutation

**Step 6.2 — CRUD Dialog**

- [ ] Dialog que recibe: `mode: 'create' | 'edit' | 'delete'`, `table: string`, `row?: Record<string, unknown>`
- [ ] Generar campos del form dinamicamente desde `AdminTableMeta.columns`
  - Text inputs para `text`
  - Number inputs para `integer` y `real`
  - Checkbox/toggle para `boolean`
  - Date inputs para columnas con nombre que incluye "date" o "Date"
  - Select con opciones para columnas foreign key (cargar opciones desde la tabla referenciada)
- [ ] Zod schema dinamico: inferir del AdminTableMeta
- [ ] Form validation con React Hook Form + Zod
- [ ] Submit handler que llama al API
- [ ] Delete confirmation con ConfirmDialog (ConfirmDialog ya existe en el proyecto)
- [ ] Integrar en Table Explorer: agregar botones [+] Create, [Edit], [Delete] por fila

### Task 7: Contract Manager tab

**Files:**
- Create: `src/routes/admin/-contract-manager.tsx` — Tab 4

**Step 7.1 — Contract Manager**

- [ ] Vista especializada para contratos (no es el CRUD generico)
- [ ] TanStack Table con columnas: contractNumber, company, factory, startDate, endDate, employeeCount, status, hourlyRate, actions
- [ ] Filtros: por status (active/draft/expired/cancelled), por empresa, por rango de fechas
- [ ] Acciones masivas: bulk cancel (soft delete), bulk renew (extender fechas)
- [ ] Accion individual: renew contract (crear nuevo contrato copiando del anterior)
- [ ] Historial de renovaciones (chain de previousContractId)
- [ ] Boton para ir a /documents para el contrato seleccionado

---

## Fase 3: Gestion de Empleados + Backup/Restore

**Esfuerzo:** Medio | **Archivos:** ~8 | **Objetivo:** Tab 5 y Tab 6 funcionales

### Task 8: Employee Manager tab

**Files:**
- Create: `src/routes/admin/-employee-manager.tsx` — Tab 5

**Step 8.1 — Employee Manager**

- [ ] Vista especializada para empleados
- [ ] TanStack Table: employeeNumber, fullName, katakanaName, nationality, company, factory, hourlyRate, billingRate, status, visaExpiry, actions
- [ ] Filtros: por status, por empresa, por nacionalidad, por visa expiry (expired/expiring/none)
- [ ] Exportar a Excel: usar ExcelJS existente para generar .xlsx con los datos filtrados
- [ ] Importar desde Excel: boton que abre el import dialog existente (reutilizar)
- [ ] Bulk assign: seleccionar empleados y asignarlos a una factory
- [ ] Bulk status change: cambiar status de varios empleados

### Task 9: Backup Manager tab

**Files:**
- Create: `server/routes/admin-backup.ts`
- Create: `src/routes/admin/-backup-manager.tsx` — Tab 6
- Update: `src/lib/api.ts` — AGREGAR metodos backup
- Create: `src/lib/hooks/use-admin-backup.ts`

**Step 9.1 — admin-backup.ts backend**

- [ ] `GET /api/admin/backups`: listar archivos .db en data/ (ordenados por fecha desc)
  - Retornar: filename, path, size (bytes), createdAt
- [ ] `POST /api/admin/backup`: crear backup manual
  - Reutilizar `server/services/backup.ts` — ya existe
- [ ] `POST /api/admin/restore`: restaurar desde archivo
  - Validar que el archivo existe y tiene extension .db
  - Hacer backup automatico antes de restaurar
  - Copiar archivo al path de la DB activa
  - IMPORTANTE: requiere reiniciar el servidor para que SQLite reconozca — retornar mensaje instructivo
- [ ] `DELETE /api/admin/backup/:filename`: eliminar archivo de backup
  - Solo permitir borrar archivos en data/ que matcheen patron kobetsu-*.db

**Step 9.2 — backup-manager.tsx**

- [ ] Listar backups existentes en una tabla (filename, size, fecha)
- [ ] Boton "Nuevo backup" (llama a POST /backup)
- [ ] Boton "Restaurar" por cada backup (con ConfirmDialog)
- [ ] Boton "Descargar" por cada backup (link al archivo)
- [ ] Boton "Eliminar" por cada backup (con ConfirmDialog)
- [ ] Advertencia visible: "Restaurar sobreescribe la base de datos actual. Se creara un backup automatico antes."
- [ ] Boton "Exportar SQL" — exportar toda la DB como SQL dump (usar better-sqlite3 `export()` o `.dump`)

---

## Fase 4: Estadisticas + Audit Log + Modo Developer

**Esfuerzo:** Medio | **Archivos:** ~8 | **Objetivo:** Tab 7, Tab 8, y adminMode flag

### Task 10: Statistics tab

**Files:**
- Create: `server/routes/admin-stats.ts`
- Create: `server/services/admin-stats.ts`
- Create: `src/routes/admin/-stats-dashboard.tsx` — Tab 7
- Update: `src/lib/api.ts` — AGREGAR metodos stats
- Create: `src/lib/hooks/use-admin-stats.ts`

**Step 10.1 — admin-stats.ts + admin-stats.ts service**

- [ ] `GET /api/admin/stats`:
  - Counts por tabla (8 tablas)
  - Distribution de contratos por status
  - Distribution de empleados por status
  - Distribution de empleados por nacionalidad (top 10)
  - Distribution de contratos por mes (ultimos 12 meses)
  - Top 10 factories con mas empleados
  - Null counts: columnas con mayor cantidad de valores nulos en employees y factories
  - Contracts expiry forecast: proximos 3 meses
- [ ] Retornar todo en un solo response

**Step 10.2 — stats-dashboard.tsx**

- [ ] Cards con stat summaries (counts totales)
- [ ] Bar chart: contratos por mes (usar Recharts existente)
- [ ] Pie chart: distribution por status de contratos
- [ ] Top tables: ranking de tablas por cantidad de registros
- [ ] "Missing data" section: listar campos con muchos nulls
- [ ] Warning badges para: contracts expiring soon, visas por expirar

### Task 11: Audit Log tab (extend)

**Files:**
- Create: `src/routes/admin/-audit-explorer.tsx` — Tab 8

**Step 11.1 — Audit Explorer**

- [ ] Usar el existente `/audit` route como referencia visual
- [ ] Mejorar: filtros avanzados por action, entityType, rango de fechas, userName
- [ ] TanStack Table para resultados
- [ ] Exportar a CSV
- [ ] Ver detalle de cada audit entry (JSON expandido)

### Task 12: Developer Mode flag

**Files:**
- Update: `src/lib/app-settings.ts` — AGREGAR adminMode: boolean
- Update: `src/routes/admin.tsx` — validar adminMode
- Update: `settings/index.tsx` — AGREGAR seccion "Modo Developer"

**Step 12.1 — adminMode**

- [ ] En `app-settings.ts`, agregar `adminMode: boolean` (default: false)
- [ ] En `/admin` route, leer `adminMode` al inicio
- [ ] Si `adminMode === false`: mostrar pantalla bloqueada con mensaje explicativo y boton para ir a /settings
- [ ] En `/settings`, agregar seccion "Modo Developer" con toggle switch
- [ ] Toggle llama `updateAppSettings({ adminMode: !adminMode })`
- [ ] Nota de advertencia: "El panel de administracion da acceso directo a la base de datos. Solo activar en desarrollo."

---

## Resumen de archivos por fase

| Fase | Archivos | Tipo |
|------|----------|------|
| 1 | `server/routes/admin-tables.ts` | CREATE |
| 1 | `server/services/admin-sql.ts` | CREATE |
| 1 | `server/routes/admin-sql.ts` | CREATE |
| 1 | `src/lib/api-types.ts` | UPDATE |
| 1 | `src/lib/api.ts` | UPDATE |
| 1 | `src/lib/query-keys.ts` | UPDATE |
| 1 | `src/lib/hooks/use-admin-tables.ts` | CREATE |
| 1 | `src/lib/hooks/use-admin-rows.ts` | CREATE |
| 1 | `src/lib/hooks/use-admin-sql.ts` | CREATE |
| 1 | `src/routes/admin.tsx` | CREATE |
| 1 | `src/routes/admin/-table-explorer.tsx` | CREATE |
| 1 | `src/routes/admin/-sql-runner.tsx` | CREATE |
| 2 | `server/routes/admin-crud.ts` | CREATE |
| 2 | `src/lib/hooks/use-admin-crud.ts` | CREATE |
| 2 | `src/routes/admin/-crud-dialog.tsx` | CREATE |
| 2 | `src/routes/admin/-contract-manager.tsx` | CREATE |
| 3 | `server/routes/admin-backup.ts` | CREATE |
| 3 | `src/lib/api.ts` | UPDATE |
| 3 | `src/lib/hooks/use-admin-backup.ts` | CREATE |
| 3 | `src/routes/admin/-employee-manager.tsx` | CREATE |
| 3 | `src/routes/admin/-backup-manager.tsx` | CREATE |
| 4 | `server/routes/admin-stats.ts` | CREATE |
| 4 | `server/services/admin-stats.ts` | CREATE |
| 4 | `src/lib/api.ts` | UPDATE |
| 4 | `src/lib/hooks/use-admin-stats.ts` | CREATE |
| 4 | `src/routes/admin/-stats-dashboard.tsx` | CREATE |
| 4 | `src/routes/admin/-audit-explorer.tsx` | CREATE |
| 4 | `src/lib/app-settings.ts` | UPDATE |
| 4 | `src/routes/admin.tsx` | UPDATE (adminMode check) |
| 4 | `src/routes/settings/index.tsx` | UPDATE (adminMode toggle) |

**Total: ~30 archivos (20 nuevos, 10 actualizados)**

---

## Estimacion de esfuerzo

| Fase | Esfuerzo | Tiempo estimado | Scope |
|------|----------|-----------------|-------|
| Fase 1 | Alto | 2-3 sesiones | Table explorer + SQL runner completos |
| Fase 2 | Alto | 2-3 sesiones | CRUD universal + Contract manager |
| Fase 3 | Medio | 1-2 sesiones | Employee manager + Backup manager |
| Fase 4 | Medio | 1-2 sesiones | Stats + Audit + Dev mode flag |

**Total estimado:** 6-10 sesiones de implementacion

---

## Riesgos

### Riesgo 1: SQL Injection en SQL Runner (ALTO)
- **Problema:** aunque solo se permite SELECT, queries malformados podrian crashear el servidor o exponerse informacion del schema
- **Mitigacion:** whitelist estricto de SELECT, timeout de 30s, max 10000 chars, no exponer stack traces al cliente

### Riesgo 2: DELETE accidental en CRUD (ALTO)
- **Problema:** el CRUD universal permite borrar de cualquier tabla
- **Mitigacion:** blacklist de tablas criticas (client_companies, factories, audit_log) para DELETE; usar ConfirmDialog con nombre del registro

### Riesgo 3: Restore corrompe la DB activa (MEDIO)
- **Problema:** copiar un archivo .db sobre la DB activa mientras el servidor esta corriendo puede corromper el WAL
- **Mitigacion:** hacer backup automatico antes de restore, instruir al usuario que reinicie el servidor post-restore

### Riesgo 4: Introspection del schema incorrecta (BAJO)
- **Problema:** Drizzle introspecciona las tablas del SQLite en runtime, podria no matchear el schema.ts si hay discrepancias
- **Mitigacion:** usar las constantes del schema.ts directamente (las 8 tablas), no hacer introspection dinamica

### Riesgo 5: Admin mode accesible por cualquier usuario (BAJO)
- **Problema:** app local-first sin auth, cualquier persona con acceso a la maquina puede habilitar admin mode
- **Mitigacion:** admin mode es opt-in (default OFF), requiere toggle manual en settings con advertencia visible

### Riesgo 6: Performance en tablas grandes (MEDIO)
- **Problema:** `SELECT * FROM audit_log` con 10000+ registros puede ser lento
- **Mitigacion:** pagination obligatoria (max 1000 rows por request), lazy loading, indices en audit_log ya existen

### Riesgo 7: Contexto inflado (BAJO)
- **Problema:** 8 tabs + hooks + servicios + rutas = muchos archivos que inflan el contexto del agente
- **Mitigacion:** crear las fases secuencialmente, no cargar toda la planificacion en cada sesion

---

## Notas de implementacion

1. **Server index.ts:** agregar `app.route("/api/admin", adminRouter)` una sola vez cuando se creen todas las rutas de admin
2. **TanStack Table v8:** verificar que esta en `package.json` antes de importar
3. **React Hook Form + Zod:** verificar que esta en `package.json` — si no esta, usar `useState` para forms simples
4. **ExcelJS:** ya esta instalado para import de empleados — reutilizar para export
5. **Recharts:** ya instalado para dashboard — reutilizar para charts de stats
6. **app-settings.ts:** verificar ubicacion exacta del archivo en src/lib/
7. **Backup restore:** el path de la DB esta en `server/db/index.ts` como constante — leerla de ahi, no hardcodear
