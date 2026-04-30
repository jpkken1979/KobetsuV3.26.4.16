# Manual de Generación de 個別契約書 (Kobetsu)

Este documento lista todas las formas de generar contratos kobetsu en la aplicación, con descripción funcional, ruta de UI, y detalles técnicos.

---

## Tabla de Contenido

1. [Generación por Contrato Individual](#1-generación-por-contrato-individual)
2. [Wizard de 5 Pasos](#2-wizard-de-5-pasos)
3. [召聘者 / 外国人材 Recruiting](#3-召聘者--外国人材-recruiting)
4. [Batch Estándar](#4-batch-estándar)
5. [Batch 新規入社者 (New Hires)](#5-batch-新規入社者-new-hires)
6. [Batch 途中入社者 (Mid-Hires)](#6-batch-途中入社者-mid-hires)
7. [Batch スマート (Smart-Batch)](#7-batch-スマート-smart-batch)
8. [Batch 工場一括 (Factory Batch)](#8-batch-工場一括-factory-batch)
9. [Batch ID指定 (ID Batch)](#9-batch-id指定-id-batch)
10. [労働契約書 (Keiyakusho)](#10-労働契約書-keiyakusho)
11. [一口要約](#11-一口要約)

---

## 1. Generación por Contrato Individual

### Descripción
Genera los 5 tipos de documentos para **un contrato existente seleccionado**. Es el método más directo: seleccionás el contrato → generás todos los PDFs → descargás o previsualizás.

### Documentos Generados
| Documento | Tipo | Cantidad |
|-----------|------|----------|
| 個別契約書 | kobetsu | 1 por contrato |
| 通知書 | tsuchisho | 1 por contrato |
| 派遣先管理台帳 | hakensakiDaicho | 1 por empleado |
| 派遣元管理台帳 | hakenmotoDaicho | 1 por empleado |
| 就業条件明示書 | shugyoJoken | 1 por empleado |

### Ruta de UI
```
/documents/
├── Pestaña "契約別" (default)
│   ├── Selector de contrato (izquierda)
│   └── DocumentGenerator (derecha)
│       ├── Resumen del contrato
│       ├── Tipos de documentos (5 cards)
│       ├── Botón "全書類生成"
│       └── Descarga/Preview
```

### Endpoint Backend
```
POST /api/documents/generate/:contractId
```

### Cuándo Usar
- Contrato ya existe y solo necesitás regenerar PDFs
- Necesitás previsualizar antes de entregar
- Verificación de documentos existentes

---

## 2. Wizard de 5 Pasos

### Descripción
Creación de contratos **desde cero** guiado por 5 pasos. Al finalizar, ofrece generar los PDFs automáticamente.

### Pasos del Wizard
1. **Selección**: Company → Factory → Department → Line
2. **Fechas**: Cálculo automático de endDate (抵触日 / contractPeriod)
3. **Tarifas**: Preview de tasas (単業)
4. **Empleados**: Selección de empleados, agrupamiento por rate
5. **Confirmación**: Review final

### Ruta de UI
```
/contracts/new
```

### Endpoint Backend
```
POST /api/contracts (wizard completo)
POST /api/contracts/:id (actualizar)
```

### Flujo de PDF
Al confirmar la creación, aparece opción de generar PDFs o volver a lista.

### Cuándo Usar
- Crear contratos individuales con control total
- Casos especiales que no encajan en batch
- Alta personalización de fechas por empleado

---

## 3. 召聘者 / 外国人材 Recruiting

### Descripción
Flujo especializado para reclutamiento de personal extranjero (vietnamita principalmente). Detecta nyushabi, visa expiry, y maneja reclutados en masa.

### Características
- Pasos guiados: Company → Factory → Pricing → Dates → Form
-生成 de PDFs para cada reclutado
- Detección de visa expiry
- Validación de nyushabi vs 継続

### Ruta de UI
```
/shouheisha
├── Step 1: Company select
├── Step 2: Factory defaults
├── Step 3: Pricing & dates
├── Step 4: Recruit form
└── Step 5: Result panel (con PDF)
```

### Endpoint Backend
```
POST /api/contracts/batch/individual (por cada reclutado)
POST /api/documents/generate/:contractId (generación PDF)
```

### Cuándo Usar
- Reclutamiento masivo de personal extranjero
- Necesitás trackear visa expiry
- Casos que requieren validación especial de nyushabi

---

## 4. Batch Estándar

### Descripción
Crea contratos para **todos los empleados activos** de una empresa (o factories seleccionadas), agrupándolos por `factoryId + billingRate`.

### Agrupamiento
```
empresa/全工場
├── Factory A, rate=1050 → 1 contrato
├── Factory A, rate=1100 → 1 contrato
└── Factory B, rate=1000 → 1 contrato
```

### Ruta de UI
```
/contracts/batch
├── Company selector
├── Date range picker
├── Factory filter (opcional)
├── Preview table
└── Create button
```

### Endpoint Backend
```
POST /api/contracts/batch/preview
POST /api/contracts/batch
POST /api/documents/generate-batch (PDF opcional)
```

### Opciones
- `factoryIds`: filtrar por factories específicas
- `startDate` / `endDate`: rango de fechas
- `generatePdf`: generar PDFs junto con contratos
- `groupByLine`: agrupar por línea en vez de por factory (NEW)

### Cuándo Usar
- Renovación masiva de contratos
- Sincronización de fechas de inicio
- Cuando todos los empleados de una empresa necesitan contratos nuevos

---

## 5. Batch 新規入社者 (New Hires)

### Descripción
Detecta automáticamente **empleados nuevos** (入社日 dentro de un rango) y crea contratos para ellos.

### Lógica de Detección
```
employees WHERE actualHireDate BETWEEN :hireDateFrom AND :hireDateTo
                         OR hireDate BETWEEN :hireDateFrom AND :hireDateTo
```

### Agrupamiento
- Por `factoryId + billingRate` (default)
- O por `department + lineName + billingRate` (groupByLine)

### Ruta de UI
```
/contracts/new-hires
├── Company selector
├── Hire date range (FROM / TO)
├── End date override (opcional)
├── Checkbox "PDFも生成"
├── Checkbox "配和工作場で分组" (NEW)
├── Search button
├── Preview (empleados detectados)
├── Exclude toggle por empleado
└── Create button
```

### Endpoint Backend
```
POST /api/contracts/batch/new-hires/preview
POST /api/contracts/batch/new-hires
```

### Características
- Muestra nyushabi y visa expiry por empleado
- Permite excluir empleados individuales
- Calcula endDate automáticamente por factory

### Cuándo Usar
- Final de mes: crear contratos para todos los本月入社
- После импорта Excel con empleados nuevos
- Batch mensual de nuevos empleados

---

## 6. Batch 途中入社者 (Mid-Hires)

### Descripción
Detecta empleados que **ya tenían contrato previo** pero necesitan uno nuevo (por ejemplo, después de 抵触日).

### Lógica de Detección
```
employees WITH existing contracts WHERE:
  - nyushabi próxima a vencer
  - O contrato existente próximo a terminar
  - Y hay fábricas con 抵触日 activa
```

### Agrupamiento
- Por `factoryId + billingRate` (default)
- O por `department + lineName + billingRate` (groupByLine)

### Ruta de UI
```
/contracts/mid-hires
├── Company selector
├── Conflict date overrides (opcional)
├── Start date override (opcional)
├── Checkbox "PDFも生成"
├── Checkbox "配和工作場で分组" (NEW)
├── Preview table
└── Create button
```

### Endpoint Backend
```
POST /api/contracts/batch/mid-hires/preview
POST /api/contracts/batch/mid-hires
```

### Características
- Detecta 抵触日 automáticamente
- Permite override manual de fechas de inicio
- Agrupa por fábrica / rate

### Cuándo Usar
- Renovación post-抵触日
- Empleados que requieren contratos nuevos
- Sincronización de fechas de renovación

---

## 7. Batch スマート (Smart-Batch)

### Descripción
**Auto-clasificación** de empleados en 継続 (continuación) / 途中入社者 (mid-hire) / future-skip, con un solo click.

### Clasificación Automática
```
Para cada empleado con nyushabi entre globalStartDate y globalEndDate:
├── effectiveHireDate < globalStartDate → 継続
│   └── Contrato: globalStartDate → globalEndDate
├── globalStartDate ≤ effectiveHireDate ≤ globalEndDate → 途中入社者
│   └── Contrato: effectiveHireDate → globalEndDate
└── effectiveHireDate > globalEndDate → 将来スキップ (descartado)
```

### Ruta de UI
```
/contracts/smart-batch
├── Company selector
├── Factory filter (opcional)
├── Global date range
├── Checkbox "PDFも生成"
├── Checkbox "配和工作場で分组" (NEW)
├── Preview table
│   ├── 継続 (verde)
│   ├── 途中入社者 (azul)
│   └── 将来スキップ (gris)
└── Create button
```

### Endpoint Backend
```
POST /api/contracts/batch/smart-by-factory/preview
POST /api/contracts/batch/smart-by-factory
```

### Características
- Estadísticas visuales por categoría
- Preview completo antes de crear
- groupByLine disponible (NEW)

### Cuándo Usar
- Inicio de mes fiscal: crear contratos para todos
- Batch mensual completo
- Cuando no sabés qué empleados necesitan qué tipo de contrato

---

## 8. Batch 工場一括 (Factory Batch)

### Descripción
Genera PDFs para **todos los contratos activos** de una fábrica específica, sin crear nuevos contratos.

### Diferencia con otros métodos
- **NO crea contratos** — solo genera PDFs
- Útil para regenerar documentos existentes
- Descarga en ZIP por fábrica

### Ruta de UI
```
/documents/batch-factory
├── /documents/ → Pestaña "工場一括"
├── /documents/batch-factory (ruta directa)
└── Factory selector
    └── Generate button
```

### Endpoint Backend
```
POST /api/documents/generate-factory
```

### Flujo de Documentos
```
1 ZIP por contrato:
├── KOB-202604-0001/
│   ├── 個別契約書.pdf
│   ├── 通知書.pdf
│   ├── 派遣先管理台帳.pdf
│   └── 派遣元管理台帳.pdf
└── KOB-202604-0002/
    └── ...
```

### Cuándo Usar
- Regeneración de documentos perdidos
- Actualización de PDFs con nuevos datos
- Preparación de entrega mensual

---

## 9. Batch ID指定 (ID Batch)

### Descripción
Busca empleados por **派遣先ID o 派遣元番号** y crea contratos con PDFs.

### Tipos de ID Soportados
1. **派遣先ID (hakensaki)**: ID del cliente/receptor
2. **派遣元番号 (hakenmoto)**: Número de UNS como dispatch

### Ruta de UI
```
/documents/batch-ids
├── /documents/ → Pestaña "ID指定"
├── /documents/batch-ids (ruta directa)
└── Input: Lista de IDs
    └── Generate button
```

### Endpoint Backend
```
POST /api/documents/generate-by-ids
```

### Características
- Búsqueda por múltiples IDs
- Preview de empleados encontrados
- Creación de contratos + PDF en un paso

### Cuándo Usar
- Cuando solo tenés IDs de algún sistema externo
- Matching con base de datos por ID
- Casos edge donde no hay match por nombre

---

## 10. 労働契約書 (Keiyakusho)

### Descripción
Genera el **労働契約書** (labor contract) por número de empleado. Es un documento separado del kobetsu.

### Documento
- **労働契約書** (Keiyakusho): Contract between employee and UNS
- **就業条件明示書** (Shugyojoken): Employment terms disclosure

### Ruta de UI
```
/documents/
├── Quick input: "社員番号"
├── Checkbox: "就業条件明示書も生成"
└── Generate button
```

### Endpoint Backend
```
POST /api/documents/keiyakusho/:employeeNumber
POST /api/documents/shugyojoken/:employeeNumber
```

### Diferencia con Kobetsu
| Aspecto | Kobetsu (個別契約書) | Keiyakusho (労働契約書) |
|---------|----------------------|--------------------------|
| Partes | UNS ↔ 派遣先 | Employee ↔ UNS |
| Concepto | Dispatch | Employment |
| Legislación | 派遣法第26条 | 労働基準法 |

### Cuándo Usar
- Documentación laboral del empleado
- Requisitos legales de empleo
- HR records separados del dispatch

---

## 11. 一口要約

| # | Método | Ruta UI | Endpoint | Crea Contratos | Genera PDF |
|---|--------|---------|----------|----------------|------------|
| 1 | Individual | /documents/ | `generate/:id` | No | Sí |
| 2 | Wizard | /contracts/new | `POST /contracts` | Sí | Opcional |
| 3 | Recruiting | /shouheisha | `batch/individual` | Sí | Sí |
| 4 | Batch Estándar | /contracts/batch | `batch` | Sí | Opcional |
| 5 | New Hires | /contracts/new-hires | `batch/new-hires` | Sí | Opcional |
| 6 | Mid-Hires | /contracts/mid-hires | `batch/mid-hires` | Sí | Opcional |
| 7 | Smart-Batch | /contracts/smart-batch | `batch/smart-by-factory` | Sí | Opcional |
| 8 | Factory Batch | /documents/batch-factory | `generate-factory` | No | Sí |
| 9 | ID Batch | /documents/batch-ids | `generate-by-ids` | Sí | Sí |
| 10 | Keiyakusho | /documents/ | `keiyakusho/:empNum` | No | Sí |

### Árbol de Decisión

```
¿Necesitás crear contratos nuevos?
├── SÍ
│   ├── ¿Tenés empleados nuevos (入社日)?
│   │   ├── SÍ → New Hires Batch (/contracts/new-hires)
│   │   └── NO → ¿Empleados existentes?
│   │       ├── ¿Renovación post-抵触日? → Mid-Hires Batch (/contracts/mid-hires)
│   │       └── ¿Todo mezclado? → Smart-Batch (/contracts/smart-batch)
│   └── ¿Creación manual/controlado?
│       ├── Wizard (/contracts/new)
│       └── Recruiting (/shouheisha)
└── NO (solo PDFs)
    ├── ¿Una fábrica completa? → Factory Batch (/documents/batch-factory)
    ├── ¿Solo IDs? → ID Batch (/documents/batch-ids)
    └── ¿Un contrato? → Individual (/documents/)
```

---

## Notas Técnicas

### Rate Grouping
Por defecto, empleados con el mismo `billingRate` van al mismo contrato:
```
factory + rate=1050 → 1 contrato para todos
```

Con `groupByLine=true`, cada línea diferente genera contrato separado:
```
factory + line A + rate=1050 → contrato 1
factory + line B + rate=1050 → contrato 2 (separado!)
```

### Opción `generatePdf` / `generateDocs`
Todos los endpoints de creación aceptan:
- `generatePdf: true` → genera PDFs después de crear contratos
- `generateDocs: true` → mismo efecto, diferente nombre

### Contratos Individuales
`/contracts/batch/individual` crea **1 contrato por empleado seleccionado**, sin agrupamiento por rate.

### Contratos Por Línea
`/contracts/batch/by-line` permite fechas individuales `startDate/endDate` por empleado dentro de la misma línea.

---

*Documento generado automáticamente. Última actualización: 2026-04-30*
