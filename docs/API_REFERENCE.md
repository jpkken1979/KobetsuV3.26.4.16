# API Reference — KobetsuV3

> Generado: 2026-04-30 | Versión: 26.4.16
> Base URL: `http://localhost:8026/api`

Este documento describe los endpoints HTTP del servidor Hono (puerto 8026).
Todos los endpoints reciben y responden JSON salvo que se indique lo contrario.

---

## Contratos Batch

### POST /api/contracts/batch/preview

Obtiene una vista previa del análisis batch sin crear contratos.

**Request Body**

```json
{
  "companyId": 1,
  "startDate": "2026-04-01",
  "endDate": "2026-04-30",
  "factoryIds": [1, 2, 3],
  "groupByLine": false
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `companyId` | `number` | Si | ID de la empresa cliente |
| `startDate` | `string` | Si | Fecha de inicio del contrato (YYYY-MM-DD) |
| `endDate` | `string` | No | Fecha de fin del contrato. Si se omite, se calcula desde `factory.conflictDate` |
| `factoryIds` | `number[]` | No | Filtrar por IDs de fábrica específicos |
| `groupByLine` | `boolean` | No | Agrupar por línea de producción en vez de por tasa (default: `false`) |

**Response** `200 OK`

```json
{
  "preview": true,
  "totalContracts": 5,
  "totalEmployees": 23,
  "totalDuplicates": 0,
  "lines": [
    {
      "factoryId": 1,
      "factoryName": "HUB工場",
      "department": "製作1課",
      "lineName": "1次旋盤",
      "effectiveEndDate": "2026-04-30",
      "capped": false,
      "autoCalculated": true,
      "contractPeriod": 30,
      "conflictDate": null,
      "totalEmployees": 8,
      "totalContracts": 2,
      "participationRate": 100,
      "isExempt": false,
      "exemptionReason": null,
      "rateGroups": [
        {
          "rate": 1700,
          "count": 5,
          "overtimeRate": 2125,
          "holidayRate": 2295,
          "employeeNames": ["TRAN VAN A", "NGUYEN THI B", "..."]
        }
      ],
      "duplicates": []
    }
  ],
  "skipped": []
}
```

| Campo | Descripción |
|---|---|
| `totalContracts` | Contratos a crear (1 por grupo de tasa) |
| `totalEmployees` | Total de empleados asignados |
| `effectiveEndDate` | Fecha de fin efectiva (capped si supera `conflictDate`) |
| `rateGroups[].rate` | Tasa de facturación (`billingRate ?? hourlyRate ?? factory.hourlyRate`) |
| `isExempt` | `true` si el periodo de participación es menor a 30 días |
| `duplicates` | Empleados que ya tienen un contrato activo en ese periodo |

---

### POST /api/contracts/batch

Crea contratos batch a partir del análisis. Los duplicados se skippean automáticamente.

**Request Body**

```json
{
  "companyId": 1,
  "startDate": "2026-04-01",
  "endDate": "2026-04-30",
  "factoryIds": [1, 2, 3],
  "generatePdf": false,
  "groupByLine": false
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `companyId` | `number` | Si | ID de la empresa |
| `startDate` | `string` | Si | Fecha de inicio (YYYY-MM-DD) |
| `endDate` | `string` | No | Fecha de fin |
| `factoryIds` | `number[]` | No | Filtrar por fábricas |
| `generatePdf` | `boolean` | No | Generar PDFs al crear (`false` por defecto) |
| `groupByLine` | `boolean` | No | Agrupar por línea en vez de por tasa |

**Response** `201 Created`

```json
{
  "created": 5,
  "skipped": 2,
  "contracts": [
    {
      "id": 42,
      "contractNumber": "KOB-202604-0001",
      "companyId": 1,
      "factoryId": 1,
      "startDate": "2026-04-01",
      "endDate": "2026-04-30",
      "status": "draft"
    }
  ],
  "skippedDetails": [
    {
      "employeeId": 7,
      "reason": "existing_active_contract",
      "contractNumber": "KOB-202603-0012"
    }
  ],
  "contractIds": [42, 43, 44, 45, 46],
  "generatePdf": false
}
```

| Campo | Descripción |
|---|---|
| `created` | Cantidad de contratos creados |
| `skipped` | Contratos omitidos (duplicados activos) |
| `contractIds` | IDs de los contratos creados (usar en `POST /api/documents/generate-batch`) |
| `generatePdf` | Flag que indica si se pidió generación de PDFs |

---

### POST /api/contracts/batch/new-hires/preview

Vista previa para empleados dados de alta recientemente (雇用開始日 >= fecha fija).

**Request Body**

```json
{
  "companyId": 1,
  "hireDateFrom": "2026-04-01",
  "hireDateTo": "2026-04-15",
  "endDate": "2026-06-30",
  "groupByLine": false,
  "factoryIds": [1, 2]
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `companyId` | `number` | Si | ID de la empresa |
| `hireDateFrom` | `string` | Si | Fecha de inicio del rango de contratación (YYYY-MM-DD) |
| `hireDateTo` | `string` | No | Fecha de fin del rango. Default: fecha actual |
| `endDate` | `string` | No | Fecha de fin del contrato. Si se omite, se calcula desde `conflictDate` |
| `groupByLine` | `boolean` | No | Agrupar por línea (default: `false`) |
| `factoryIds` | `number[]` | No | Filtrar por fábricas |

**Response** `200 OK`

```json
{
  "preview": true,
  "hireDateFrom": "2026-04-01",
  "hireDateTo": "2026-04-15",
  "totalContracts": 3,
  "totalEmployees": 12,
  "lines": [
    {
      "factoryId": 1,
      "factoryName": "HUB工場",
      "department": "製作1課",
      "lineName": "1次旋盤",
      "effectiveEndDate": "2026-06-30",
      "conflictDate": null,
      "totalEmployees": 8,
      "totalContracts": 2,
      "participationRate": 100,
      "isExempt": false,
      "exemptionReason": null,
      "rateGroups": [
        {
          "rate": 1700,
          "count": 5,
          "overtimeRate": 2125,
          "holidayRate": 2295,
          "employees": [
            {
              "id": 15,
              "fullName": "TRAN VAN A",
              "employeeNumber": "EMP-015",
              "effectiveHireDate": "2026-04-05",
              "billingRate": 1700,
              "hourlyRate": 1200,
              "visaExpiry": "2027-03-15",
              "nationality": "Vietnam"
            }
          ]
        }
      ]
    }
  ],
  "skipped": []
}
```

**Lógica de clasificación**: los empleados con `雇用開始日` (effective hire date) dentro del rango se clasifican como 新規入社者. Solo se incluyen empleados asignados a fábricas de la empresa con `factoryId` real.

---

### POST /api/contracts/batch/new-hires

Crea contratos batch para empleados dados de alta recientemente.

**Request Body**

```json
{
  "companyId": 1,
  "hireDateFrom": "2026-04-01",
  "hireDateTo": "2026-04-15",
  "endDate": "2026-06-30",
  "generateDocs": false,
  "groupByLine": false,
  "factoryIds": [1, 2]
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `companyId` | `number` | Si | ID de la empresa |
| `hireDateFrom` | `string` | Si | Inicio del rango de contratación |
| `hireDateTo` | `string` | No | Fin del rango. Default: hoy |
| `endDate` | `string` | No | Fecha de fin del contrato |
| `generateDocs` | `boolean` | No | Generar PDFs al crear (`false` por defecto) |
| `groupByLine` | `boolean` | No | Agrupar por línea |
| `factoryIds` | `number[]` | No | Filtrar por fábricas |

**Response** `201 Created`

```json
{
  "created": 3,
  "skipped": 1,
  "contracts": [...],
  "skippedDetails": [...],
  "contractIds": [47, 48, 49],
  "generateDocs": false
}
```

---

### POST /api/contracts/batch/mid-hires/preview

Vista previa para empleados que entran a mitad de un periodo de contrato existente (途中入社).

**Request Body**

```json
{
  "companyId": 1,
  "conflictDateOverrides": {
    "1": "2026-09-30"
  },
  "startDateOverride": "2026-04-01",
  "groupByLine": false,
  "factoryIds": [1, 2]
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `companyId` | `number` | Si | ID de la empresa |
| `conflictDateOverrides` | `Record<string, string>` | No | Override de `conflictDate` por factoryId. Formato: `{ "factoryId": "YYYY-MM-DD" }` |
| `startDateOverride` | `string` | No | Forzar fecha de inicio global para el análisis |
| `groupByLine` | `boolean` | No | Agrupar por línea |
| `factoryIds` | `number[]` | No | Filtrar por fábricas |

**Response** `200 OK`

```json
{
  "preview": true,
  "totalContracts": 4,
  "totalEmployees": 18,
  "startDateOverride": "2026-04-01",
  "lines": [
    {
      "factoryId": 1,
      "factoryName": "HUB工場",
      "department": "製作1課",
      "lineName": "1次旋盤",
      "contractStartDate": "2026-04-01",
      "contractEndDate": "2026-06-30",
      "effectiveConflictDate": "2026-06-30",
      "periodStart": "2026-04-01",
      "totalEmployees": 6,
      "totalContracts": 1,
      "participationRate": 100,
      "isExempt": false,
      "exemptionReason": null,
      "rateGroups": [...]
    }
  ],
  "skipped": []
}
```

**Lógica clave**: `effectiveConflictDate` es el mínimo entre `conflictDate` de la fábrica y la fecha calculada desde `periodStart + 3 años`. El endpoint ajusta el `contractEndDate` para que no supere este límite.

---

### POST /api/contracts/batch/mid-hires

Crea contratos para途中入社者.

**Request Body**

```json
{
  "companyId": 1,
  "conflictDateOverrides": {
    "1": "2026-09-30"
  },
  "startDateOverride": "2026-04-01",
  "generateDocs": false,
  "groupByLine": false,
  "factoryIds": [1, 2]
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `companyId` | `number` | Si | ID de la empresa |
| `factoryIds` | `number[]` | No | Filtrar por fábricas |
| `conflictDateOverrides` | `Record<string, string>` | No | Override de抵触日 por factory |
| `startDateOverride` | `string` | No | Forzar fecha de inicio global |
| `generateDocs` | `boolean` | No | Generar PDFs (`false` por defecto) |
| `groupByLine` | `boolean` | No | Agrupar por línea |

**Response** `201 Created`

```json
{
  "created": 4,
  "skipped": 1,
  "contracts": [...],
  "skippedDetails": [...],
  "contractIds": [50, 51, 52, 53],
  "generateDocs": false
}
```

---

### POST /api/contracts/batch/smart-by-factory/preview

Smart-batch: ikkatsu multi-fábrica con auto-clasificación 継続 (participación continua) vs 途中入社者 (nuevos en el periodo) vs future-skip (aún no contratados).

Empleados clasificados por `effectiveHireDate = actualHireDate ?? hireDate`:
- **継続**: `effectiveHireDate < globalStartDate` (o `null`) → contrato `globalStartDate → globalEndDate`
- **途中入社者**: `globalStartDate <= effectiveHireDate <= globalEndDate` → contrato `effectiveHireDate → globalEndDate`
- **future-skip**: `effectiveHireDate > globalEndDate` → descartados

**Request Body**

```json
{
  "companyId": 1,
  "factoryIds": [1, 2, 3],
  "globalStartDate": "2026-04-01",
  "globalEndDate": "2026-06-30",
  "groupByLine": false
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `companyId` | `number` | Si | ID de la empresa |
| `factoryIds` | `number[]` | No | Filtrar por fábricas. Si se omite, todas las de la empresa |
| `globalStartDate` | `string` | Si | Inicio global para contratos 継続 (YYYY-MM-DD) |
| `globalEndDate` | `string` | Si | Fin global para todos los contratos (YYYY-MM-DD) |
| `groupByLine` | `boolean` | No | Agrupar por línea |

**Validation**: `globalStartDate` debe ser menor o igual a `globalEndDate`.

**Response** `200 OK`

```json
{
  "lines": [
    {
      "factoryId": 1,
      "factoryName": "HUB工場",
      "department": "製作1課",
      "lineName": "1次旋盤",
      "estimatedContracts": 4,
      "continuation": [
        {
          "id": 15,
          "fullName": "TRAN VAN A",
          "employeeNumber": "EMP-015",
          "effectiveHireDate": null,
          "billingRate": 1700,
          "hourlyRate": 1200,
          "visaExpiry": "2027-03-15",
          "nationality": "Vietnam",
          "assignedContractStart": "2026-04-01",
          "assignedContractEnd": "2026-06-30",
          "isContinuation": true
        }
      ],
      "midHires": [
        {
          "id": 22,
          "fullName": "LE VAN C",
          "employeeNumber": "EMP-022",
          "effectiveHireDate": "2026-04-10",
          "billingRate": 1700,
          "hourlyRate": 1200,
          "visaExpiry": "2027-05-01",
          "nationality": "Vietnam",
          "assignedContractStart": "2026-04-10",
          "assignedContractEnd": "2026-06-30",
          "isContinuation": false
        }
      ],
      "futureSkip": [
        {
          "id": 30,
          "fullName": "PHAM THI D",
          "employeeNumber": "EMP-030",
          "effectiveHireDate": "2026-07-15"
        }
      ],
      "continuationContracts": 2,
      "midHireContracts": 2,
      "totalEmployees": 6,
      "totalSkipped": 1,
      "isExempt": false,
      "exemptionReason": null
    }
  ],
  "skipped": [],
  "totals": {
    "contracts": 8,
    "continuation": 4,
    "midHires": 4,
    "futureSkip": 2
  }
}
```

---

### POST /api/contracts/batch/smart-by-factory

Ejecuta el smart-batch: crea contratos para 継続 y 途中入社者, ignora future-skip.

**Request Body**

```json
{
  "companyId": 1,
  "factoryIds": [1, 2, 3],
  "globalStartDate": "2026-04-01",
  "globalEndDate": "2026-06-30",
  "generateDocs": false,
  "groupByLine": false
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `companyId` | `number` | Si | ID de la empresa |
| `factoryIds` | `number[]` | No | Filtrar por fábricas |
| `globalStartDate` | `string` | Si | Inicio global (YYYY-MM-DD) |
| `globalEndDate` | `string` | Si | Fin global (YYYY-MM-DD) |
| `generateDocs` | `boolean` | No | Generar PDFs (`false` por defecto) |
| `groupByLine` | `boolean` | No | Agrupar por línea |

**Response** `201 Created`

```json
{
  "created": 8,
  "contracts": [...],
  "contractIds": [54, 55, 56, 57, 58, 59, 60, 61],
  "perFactory": {
    "1": {
      "continuation": 2,
      "midHires": 2,
      "skipped": 1
    },
    "2": {
      "continuation": 2,
      "midHires": 2,
      "skipped": 0
    }
  },
  "skippedDetails": [],
  "generateDocs": false
}
```

---

### POST /api/contracts/preview-by-ids

Agrupa empleados por ID de派遣先 o 派遣元 para previsualizar sin crear contratos.

**Request Body**

```json
{
  "ids": ["1234", "5678"],
  "idType": "hakensaki",
  "contractStart": "2026-04-01",
  "contractEnd": "2026-06-30"
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `ids` | `string[]` | Si | Array de IDs (números como strings) |
| `idType` | `"hakensaki" \| "hakenmoto"` | Si | Tipo de ID: `hakensaki` (派遣先), `hakenmoto` (派遣元) |
| `contractStart` | `string` | Si | Inicio del contrato (YYYY-MM-DD) |
| `contractEnd` | `string` | Si | Fin del contrato (YYYY-MM-DD) |

**Response** `200 OK`

```json
{
  "groups": [
    {
      "groupIndex": 0,
      "factoryId": 1,
      "factoryName": "HUB工場",
      "department": "製作1課",
      "lineName": "1次旋盤",
      "companyId": 1,
      "companyName": "高雄工業",
      "billingRate": 1700,
      "startDate": "2026-04-01",
      "endDate": "2026-06-30",
      "employeeCount": 5,
      "employees": [...]
    }
  ],
  "notFoundIds": ["9999"],
  "totalEmployees": 5
}
```

---

### POST /api/contracts/batch/individual

Crea un contrato individual POR empleado seleccionado (sin agrupar por tasa). Cada empleado recibe su propio contrato.

**Request Body**

```json
{
  "companyId": 1,
  "factoryId": 1,
  "employeeAssignments": [
    { "employeeId": 15, "hourlyRate": 1700 },
    { "employeeId": 22, "hourlyRate": 1800 }
  ],
  "startDate": "2026-04-01",
  "endDate": "2026-04-30",
  "billingRate": 1700,
  "generateDocs": false
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `companyId` | `number` | Si | ID de la empresa |
| `factoryId` | `number` | Si | ID de la fábrica |
| `employeeAssignments` | `{ employeeId: number; hourlyRate?: number }[]` | Si* | Empleados con sus tasas individuales (preferido) |
| `employeeIds` | `number[]` | Si* | IDs de empleados (deprecated, usar `employeeAssignments`) |
| `startDate` | `string` | Si | Inicio del contrato |
| `endDate` | `string` | Si | Fin del contrato |
| `billingRate` | `number` | No | Tasa de referencia (fallback si no se especifica por empleado) |
| `generateDocs` | `boolean` | No | Generar PDFs (`false` por defecto) |

\* Al menos uno de `employeeAssignments` o `employeeIds` es requerido.

**Deprecation Notice**: payloads que usan solo `employeeIds` (sin `employeeAssignments`) reciben headers de advertencia:

```
Deprecation: true
Warning: 299 - "employeeIds is deprecated; use employeeAssignments: [{employeeId}] instead"
```

**Response** `201 Created`

```json
{
  "created": 2,
  "contracts": [
    { "id": 62, "contractNumber": "KOB-202604-0002" },
    { "id": 63, "contractNumber": "KOB-202604-0003" }
  ],
  "contractIds": [62, 63],
  "generateDocs": false
}
```

---

### POST /api/contracts/batch/by-line

Creación granular: empleados de UNA línea con `startDate`/`endDate` individuales por persona. Agrupa internamente por `(rate, startDate, endDate)` y crea N contratos en una transacción.

**Request Body**

```json
{
  "companyId": 1,
  "factoryId": 1,
  "employees": [
    { "employeeId": 15, "startDate": "2026-04-01", "endDate": "2026-06-30" },
    { "employeeId": 22, "startDate": "2026-04-10", "endDate": "2026-06-30" }
  ],
  "generatePdf": false
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `companyId` | `number` | Si | ID de la empresa |
| `factoryId` | `number` | Si | ID de la fábrica |
| `employees` | `{ employeeId: number; startDate: string; endDate: string }[]` | Si | Empleados con fechas individuales (mínimo 1) |
| `generatePdf` | `boolean` | No | Generar PDFs (`false` por defecto) |

**Validation**: `startDate` debe ser menor o igual a `endDate` para cada empleado.

**Response** `201 Created`

```json
{
  "created": 2,
  "contracts": [...],
  "contractIds": [64, 65],
  "groups": [
    {
      "rate": 1700,
      "startDate": "2026-04-01",
      "endDate": "2026-06-30",
      "employeeIds": [15]
    },
    {
      "rate": 1800,
      "startDate": "2026-04-10",
      "endDate": "2026-06-30",
      "employeeIds": [22]
    }
  ],
  "generatePdf": false
}
```

---

## Generación de Documentos

### POST /api/documents/generate/:contractId

Genera el paquete completo de PDFs para un contrato individual.

- **標準**: 個別契約書 + 通知書 (misma página), 派遣先管理台帳, 派遣元管理台帳
- **コーリツ**: generadores específicos con bordes por lado (`bT`/`bB`/`bL`/`bR`)

**Parámetros de URL**

| Parámetro | Tipo | Descripción |
|---|---|---|
| `contractId` | `number` | ID del contrato |

**Response** `200 OK` (JSON + archivos en output/)

```json
{
  "success": true,
  "contractId": 42,
  "contractNumber": "KOB-202604-0001",
  "files": [
    {
      "type": "kobetsu",
      "filename": "個別契約書_高雄工業_KOB-202604-0001_1次旋盤_2026-04-30.pdf",
      "path": "/api/documents/download/個別契約書_高雄工業_KOB-202604-0001_1次旋盤_2026-04-30.pdf"
    },
    {
      "type": "hakensakiDaicho",
      "filename": "派遣先管理台帳_高雄工業_KOB-202604-0001_1次旋盤_2026-04-30.pdf",
      "path": "/api/documents/download/派遣先管理台帳_高雄工業_KOB-202604-0001_1次旋盤_2026-04-30.pdf"
    },
    {
      "type": "hakenmotoDaicho",
      "filename": "派遣元管理台帳_高雄工業_KOB-202604-0001_1次旋盤_2026-04-30.pdf",
      "path": "/api/documents/download/派遣元管理台帳_高雄工業_KOB-202604-0001_1次旋盤_2026-04-30.pdf"
    }
  ]
}
```

**Endpoint de descarga**: `/api/documents/download/:filename`
- Los PDFs se almacenan en `output/kobetsu/` (estándar) o `output/koritsu/` (コーリツ)
- El ZIP se almacena en el mismo directorio de salida

---

### POST /api/documents/generate-batch

Genera un ZIP por contrato con todos los PDFs del paquete (個別契約書 + 台帳).

**Request Body**

```json
{
  "contractIds": [42, 43, 44]
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `contractIds` | `number[]` | Si | IDs de contratos (array, mínimo 1 elemento) |

**Response** `200 OK` (sin errores) | `207 Multi-Status` (con errores parciales)

```json
{
  "success": true,
  "contractCount": 3,
  "employeeCount": 12,
  "files": [
    {
      "type": "kobetsu",
      "filename": "個別契約書_高雄工業_KOB-202604-0001_1次旋盤_2026-04-30.pdf",
      "path": "/api/documents/download/個別契約書_高雄工業_KOB-202604-0001_1次旋盤_2026-04-30.pdf"
    },
    {
      "type": "contractBundleZip",
      "filename": "契約書類一式_高雄工業_KOB-202604-0001_1次旋盤_2026-04-30.zip",
      "path": "/api/documents/download/契約書類一式_高雄工業_KOB-202604-0001_1次旋盤_2026-04-30.zip"
    }
  ],
  "summary": {
    "total": 18,
    "errors": 0
  }
}
```

**Lógica**:
- Itera sobre cada `contractId`, genera PDFs individuales y luego hace ZIP por contrato
- Detecta automáticamente si la empresa es コーリツ (usa generadores específicos)
- Registra versión PDF en `pdf_versions` para trazabilidad

---

### POST /api/documents/generate-factory

Genera documentos para TODOS los contratos activos/draft de una o más fábricas, fusiona PDFs por tipo y entrega un ZIP unificado.

**Request Body**

```json
{
  "factoryId": 1,
  "factoryIds": [1, 2, 3],
  "kobetsuCopies": 2
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `factoryId` | `number` | Si* | ID de una fábrica |
| `factoryIds` | `number[]` | Si* | IDs de múltiples fábricas |
| `kobetsuCopies` | `1 \| 2` | No | Cantidad de copias de 個別契約書: `1` (única, default), `2` (派遣先用 + 派遣元用 mergeadas) |

\* Al menos `factoryId` o `factoryIds` es requerido.

**Restricción**: todas las fábricas seleccionadas deben pertenecer a la MISMA empresa.

**Response** `200 OK`

```json
{
  "success": true,
  "factoryId": 1,
  "factoryIds": [1, 2],
  "factoryName": "HUB工場",
  "department": "製作1課",
  "lineName": "1次旋盤",
  "lineCount": 2,
  "contractCount": 5,
  "employeeCount": 23,
  "fileCount": 8,
  "kobetsuCopies": 2,
  "zipFilename": "工場一括_HUB工場_工場全体_2026-04-30.zip",
  "zipPath": "/api/documents/download/工場一括_HUB工場_工場全体_2026-04-30.zip"
}
```

**Lógica**:
- Filtra contratos con `status = "active" | "draft"`
- 標準: fusiona PDFs por tipo (`個別契約書_一括_*, 派遣先管理台帳_一括_*, 派遣元管理台帳_一括_*`)
- コーリツ: mantiene archivos individuales sin merge
- `kobetsuCopies=2` genera两份 個別契約書 (派遣先用 + 派遣元用)

---

### POST /api/documents/generate-by-ids

Agrupación por ID (派遣先/派遣元), creación automática de contratos y generación de PDFs en un solo paso.

**Request Body**

```json
{
  "ids": ["1234", "5678"],
  "idType": "hakensaki",
  "contractStart": "2026-04-01",
  "contractEnd": "2026-06-30",
  "kobetsuCopies": 1
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `ids` | `string[]` | Si | IDs de empleados como strings |
| `idType` | `"hakensaki" \| "hakenmoto"` | Si | Tipo de agrupamiento |
| `contractStart` | `string` | Si | Inicio del contrato (YYYY-MM-DD) |
| `contractEnd` | `string` | Si | Fin del contrato (YYYY-MM-DD) |
| `kobetsuCopies` | `1 \| 2` | No | Cantidad de copias de 個別契約書 (default: `1`) |

**Response** `200 OK`

```json
{
  "success": true,
  "contractCount": 2,
  "employeeCount": 8,
  "fileCount": 8,
  "kobetsuCopies": 1,
  "notFoundIds": [],
  "zipFilename": "ID指定一括_高雄工業_ID指定_2026-04-30.zip",
  "zipPath": "/api/documents/download/ID指定一括_高雄工業_ID指定_2026-04-30.zip",
  "contracts": [
    {
      "id": 66,
      "contractNumber": "KOB-202604-0004",
      "factoryName": "HUB工場",
      "startDate": "2026-04-01",
      "endDate": "2026-06-30",
      "employeeCount": 5
    }
  ]
}
```

**Flujo interno**:
1. Agrupa empleados por factoryId (reutiliza `groupEmployeesByIds`)
2. Crea un contrato por grupo en transacción atómica
3. Genera PDFs para cada contrato creado
4. Fusiona PDFs por tipo (estándar) o mantiene individuales (コーリツ)
5. Genera ZIP unificado

---

### POST /api/documents/generate-set

Genera un PDF combinado para contratos que comparten la misma fábrica/línea. Fusiona todos los PDFs en un solo documento por tipo.

**Request Body**

```json
{
  "contractIds": [42, 43, 44],
  "factoryId": 1
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `contractIds` | `number[]` | Si | IDs de contratos (mínimo 1) |
| `factoryId` | `number` | No | ID de la fábrica (para verificar pertenencia) |

**Response** `200 OK` | `207 Multi-Status`

```json
{
  "success": true,
  "contractCount": 3,
  "employeeCount": 15,
  "files": [
    {
      "type": "kobetsu",
      "filename": "個別契約書_高雄工業_HUB工場_1次旋盤_2026-04-30.pdf",
      "path": "/api/documents/download/個別契約書_高雄工業_HUB工場_1次旋盤_2026-04-30.pdf"
    },
    {
      "type": "merged",
      "filename": "派遣先管理台帳_高雄工業_HUB工場_1次旋盤_2026-04-30.pdf",
      "path": "/api/documents/download/派遣先管理台帳_高雄工業_HUB工場_1次旋盤_2026-04-30.pdf"
    }
  ],
  "summary": {
    "total": 5,
    "errors": 0
  }
}
```

---

### POST /api/documents/keiyakusho/:employeeNumber

Genera el 労働契約書 (labor contract) para un empleado por número de empleado.

**Parámetros de URL**

| Parámetro | Tipo | Descripción |
|---|---|---|
| `employeeNumber` | `string` | Número de empleado (ej: `EMP-015`) |

**Response** `200 OK` + archivo PDF en `output/roudou/`

---

### POST /api/documents/shugyojoken/:employeeNumber

Genera la 就業条件明示書 (employment terms disclosure) para un empleado por número de empleado.

**Parámetros de URL**

| Parámetro | Tipo | Descripción |
|---|---|---|
| `employeeNumber` | `string` | Número de empleado |

**Response** `200 OK` + archivo PDF en `output/roudou/`

---

## Respuestas de Error

Todos los endpoints devuelven errores en formato JSON:

```json
{
  "error": "Mensaje de error descriptivo"
}
```

Código de estado más comunes:

| Código | Significado |
|---|---|
| `400` | Request body inválido (Zod validation failed) |
| `404` | Recurso no encontrado (factory, contrato, empleado) |
| `500` | Error interno del servidor |

---

## Notas de Implementación

### Detección de Empresa (コーリツ vs Estándar)

Los endpoints de documentos detectan automáticamente el tipo de generador a usar:

```typescript
const isKoritsu = companyName.includes("コーリツ");
```

- **Estándar** (`isKoritsu = false`): usa `generateKobetsuPDF`, `generateTsuchishoPDF`, `generateHakensakiKanriDaichoPDF`, `generateHakenmotoKanriDaichoPDF`
- **コーリツ**: usa `generateKoritsuKobetsuPDF`, `generateKoritsuTsuchishoPDF`, `generateKoritsuDaichoPDF` (bordes individuales por lado)

### Tasa de Facturación (Priority Chain)

```
billingRate ?? hourlyRate ?? factory.hourlyRate
```

Siempre usar `??` (nullish coalescing), NUNCA `||`. El valor `0` es válido y no debe ser tratado como falsy.

### Formato de Fechas

- Input: `YYYY-MM-DD` (string, regex validado por Zod)
- Output: `YYYY-MM-DD`
- Internamente: `toLocalDateStr(new Date())` para timestamps de archivos

### Output de PDFs

| Tipo | Directorio |
|---|---|
| 個別契約書 + 台帳 (estándar) | `output/kobetsu/` |
| 個別契約書 + 台帳 (コーリツ) | `output/koritsu/` |
| 労働契約書 + 就業条件明示書 | `output/roudou/` |