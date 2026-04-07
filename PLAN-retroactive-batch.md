# Plan: Generación Retroactiva Masiva — Nuevos Ingresos

## Escenario del Usuario

```
Contratos anuales entregados → hasta 抵触日 (ej: 2026-09-30)
Desde enero entraron empleados nuevos a varias fábricas
Quiere: seleccionar empresa + fecha de corte → sistema detecta nuevos ingresos
        por 入社日 (hireDate/actualHireDate) y genera TODOS los documentos
        con fechas individuales por empleado
```

## Resultado Esperado

```
Empresa: トヨタ
Fecha desde: 2026-01-01
Hasta: hoy (2026-03-11) ← auto

→ Sistema encuentra 15 empleados con actualHireDate >= 2026-01-01
→ Agrupa por fábrica/línea + 単価 (billing rate)
→ Genera contratos con:
   - startDate individual = actualHireDate de cada empleado
   - endDate = 抵触日 de su fábrica (o fecha manual)
→ Genera 4 documentos por contrato:
   1. 個別契約書 (contrato individual)
   2. 通知書 (notificación)
   3. 派遣先管理台帳 (registro lado cliente)
   4. 派遣元管理台帳 (registro lado UNS)
```

---

## Fases de Implementación

### Fase 1: Backend — Endpoint de detección de nuevos ingresos
**Archivo:** `server/routes/contracts.ts`

**Nuevo endpoint:** `POST /api/contracts/batch/new-hires`

```typescript
// Request
{
  companyId: number,
  factoryIds?: number[],        // opcional, null = todas
  hireDateFrom: string,         // "2026-01-01" — fecha de corte
  hireDateTo?: string,          // default: hoy
  endDate?: string,             // override manual, default: 抵触日 de cada fábrica
  generateDocs: boolean         // auto-generar PDFs
}

// Response
{
  detected: {
    total: number,
    byFactory: [{
      factoryId: number,
      factoryName: string,
      department: string,
      lineName: string,
      conflictDate: string,
      employees: [{
        id: number,
        fullName: string,
        actualHireDate: string,   // su fecha real de ingreso
        billingRate: number,
        hourlyRate: number,
        visaExpiry: string | null
      }],
      rateGroups: [{
        rate: number,
        employees: Employee[],
        contractStartDate: string,  // = min(actualHireDate) del grupo
        contractEndDate: string     // = 抵触日 o override
      }]
    }]
  },
  // Después de confirmar:
  created: Contract[],
  documents: { contractId: number, files: string[] }[]
}
```

**Lógica clave:**
1. Buscar empleados activos de la empresa con `actualHireDate >= hireDateFrom`
   - Usar `actualHireDate` primero, fallback a `hireDate`
2. Filtrar por fábricas seleccionadas (o todas)
3. Agrupar por fábrica/línea → luego por 単価 (billing rate)
4. Para cada grupo:
   - `startDate` del contrato = fecha más temprana de `actualHireDate` del grupo
   - `endDate` = `factory.conflictDate` o override manual
   - Cada empleado guarda su `individualStartDate` = su propio `actualHireDate`
   - `individualEndDate` = endDate del contrato (o null si `isIndefinite`)
5. Calcular `contractDate` y `notificationDate` como business days

### Fase 2: Backend — Activar `individualStartDate/EndDate` en contratos
**Archivos:** `server/routes/contracts.ts`

**Cambios en POST /api/contracts y POST /batch:**
- Aceptar `individualStartDate`, `individualEndDate`, `isIndefinite` dentro de `employeeAssignments[]`
- Guardarlos en `contract_employees`

```typescript
// employeeAssignments actualizado
employeeAssignments: [{
  employeeId: number,
  hourlyRate?: number,
  individualStartDate?: string,   // NUEVO
  individualEndDate?: string,     // NUEVO
  isIndefinite?: boolean          // NUEVO
}]
```

### Fase 3: Backend — Generación automática de 4 documentos
**Archivo:** `server/routes/documents.ts`

**Nuevo endpoint:** `POST /api/documents/generate-all/:contractId`

- Genera los 4 documentos de un solo golpe:
  1. 個別契約書 + 通知書 (ya existe como par en `/generate/:contractId`)
  2. 派遣先管理台帳 (por empleado)
  3. 派遣元管理台帳 (por empleado)
- Pasa `individualStartDate`/`individualEndDate` a los PDFs

**Cambio en PDFs existentes:**
- `tsuchisho-pdf.ts`: Usar `individualStartDate` si existe (para la fecha de inicio del empleado)
- `hakensakikanridaicho-pdf.ts`: Mostrar `individualStartDate` → `endDate` por empleado
- `hakenmotokanridaicho-pdf.ts`: Mostrar `individualStartDate` → `endDate` por empleado

### Fase 4: Frontend — Nueva página "新規入社一括作成"
**Archivo nuevo:** `src/routes/contracts/new-hires.tsx`

**UI Flow (3 pasos):**

#### Paso 1: Selección
- Dropdown de empresa
- Date picker: "入社日 desde" (default: primer día del mes anterior)
- Date picker: "入社日 hasta" (default: hoy)
- Checkbox: "終了日を手動設定" (override endDate, default usa 抵触日)
- Botón: "検索" (buscar)

#### Paso 2: Preview / Edición
- Tabla agrupada por fábrica/línea:
  ```
  ┌─────────────────────────────────────────────────────┐
  │ 🏭 トヨタ田原 → 組立 → ライン1                        │
  │    抵触日: 2026-09-30                                │
  │ ┌─────────────────────────────────────────────────┐  │
  │ │ ☑ グエン・ティ・ハン  入社: 01/15  ¥1,550       │  │
  │ │   開始: [2026-01-15]  終了: [2026-09-30]  ☐無期 │  │
  │ │ ☑ ファム・ヴァン・ドゥック  入社: 02/03  ¥1,550  │  │
  │ │   開始: [2026-02-03]  終了: [2026-09-30]  ☐無期 │  │
  │ │ ☑ レ・ヴァン・トゥアン  入社: 03/01  ¥1,609     │  │
  │ │   開始: [2026-03-01]  終了: [2026-09-30]  ☐無期 │  │
  │ └─────────────────────────────────────────────────┘  │
  │ ⚠ 2 contratos (2 grupos de 単価: ¥1,550 × 2名,     │
  │    ¥1,609 × 1名)                                    │
  └─────────────────────────────────────────────────────┘
  ```
- Cada empleado: checkbox (des)seleccionar, fechas editables, flag 無期
- Excluir empleados con visa expirada (⚠ alerta roja)
- Resumen total: N contratos × N fábricas × N empleados

#### Paso 3: Confirmación y Generación
- Modal de confirmación con resumen
- Barra de progreso: "Creando contrato 3/12... Generando PDF 8/48..."
- Resultado: tabla de contratos creados con links de descarga
- Botón: "全PDFダウンロード" (descargar todos como ZIP o mega-PDF)

### Fase 5: Sidebar + Navegación
**Archivo:** `src/components/layout/sidebar.tsx`

- Agregar link "新規入社一括" en sección 契約管理 (debajo de 一括作成)

### Fase 6: API client + hooks
**Archivos:**
- `src/lib/api.ts` — Agregar `detectNewHires()`, `batchCreateNewHires()`
- `src/lib/hooks/use-contracts.ts` — Agregar `useDetectNewHires()`, `useBatchCreateNewHires()`

---

## Archivos a Modificar (Resumen)

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `server/routes/contracts.ts` | + endpoint `/batch/new-hires` (preview + create) |
| 2 | `server/routes/contracts.ts` | Aceptar `individualStartDate/EndDate/isIndefinite` en `employeeAssignments` |
| 3 | `server/routes/documents.ts` | + endpoint `/generate-all/:contractId`, pasar fechas individuales a PDFs |
| 4 | `server/pdf/tsuchisho-pdf.ts` | Usar `individualStartDate` del empleado |
| 5 | `server/pdf/hakensakikanridaicho-pdf.ts` | Mostrar fechas individuales por empleado |
| 6 | `server/pdf/hakenmotokanridaicho-pdf.ts` | Mostrar fechas individuales por empleado |
| 7 | `src/routes/contracts/new-hires.tsx` | **NUEVO**: Página completa de 3 pasos |
| 8 | `src/lib/api.ts` | + métodos `detectNewHires`, `batchCreateNewHires` |
| 9 | `src/lib/hooks/use-contracts.ts` | + hooks React Query |
| 10 | `src/components/layout/sidebar.tsx` | + link en sidebar |
| 11 | `src/stores/contract-form.ts` | (opcional) Agregar soporte fechas individuales al wizard individual |

---

## Orden de Ejecución

```
1. Backend: employeeAssignments con fechas individuales (Fase 2)
2. Backend: endpoint /batch/new-hires (Fase 1)
3. Backend: generación de 4 docs con fechas individuales (Fase 3)
4. Frontend: API + hooks (Fase 6)
5. Frontend: página new-hires.tsx (Fase 4)
6. Frontend: sidebar link (Fase 5)
7. Testing: verificar flujo completo
```

## Estimación

- Backend (Fases 1-3): ~200 líneas nuevas
- Frontend (Fases 4-6): ~400 líneas nuevas
- Total: ~600 líneas de código
