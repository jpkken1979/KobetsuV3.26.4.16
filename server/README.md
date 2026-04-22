# Server — Hono API

## Stack

- Hono 4.12 (port 8026)
- Drizzle ORM + better-sqlite3 (WAL mode)
- PDFKit + NotoSansJP / BIZ UD Mincho / MSGothic fonts

## Rutas (32 archivos)

### Domain CRUD (13)

| Archivo | Descripción |
|---------|-------------|
| `companies.ts` | CRUD de empresas clientes |
| `factories.ts` | CRUD de fábricas / líneas |
| `employees.ts` | CRUD de empleados |
| `contracts.ts` | CRUD de contratos individuales |
| `contracts-batch.ts` | Batch update de contratos |
| `documents.ts` | CRUD de documentos generados |
| `shift-templates.ts` | CRUD de patrones de turno/descanso |
| `calendars.ts` | CRUD de calendarios laborales por fábrica |
| `data-check.ts` | Matriz de completitud de datos |
| `dashboard.ts` | Estadísticas del dashboard |
| `pdf-versions.ts` | Log de versiones PDF generadas |
| `factory-yearly-config.ts` | Config anual por línea (就業日/休日/指揮命令者) |
| `company-yearly-config.ts` | Config anual por empresa (休日/休暇処理) |

### Document Generation (9)

| Archivo | Descripción |
|---------|-------------|
| `documents-generate.ts` | Router principal de generación PDF |
| `documents-generate-individual.ts` | Generación por contrato individual |
| `documents-generate-single.ts` | Generación single-shot por ID |
| `documents-generate-batch.ts` | Generación batch por filtros |
| `documents-generate-batch-factory.ts` | Batch por fábrica completa |
| `documents-generate-batch-ids.ts` | Batch por IDs de contrato |
| `documents-generate-batch-set.ts` | Batch por set predefinido |
| `documents-generate-batch-bundle.ts` | Bundle ZIP de múltiples PDFs |
| `documents-generate-batch-utils.ts` | Utilidades compartidas de batch |

### Imports (3)

| Archivo | Descripción |
|---------|-------------|
| `import.ts` | Router principal de importación Excel |
| `import-factories.ts` | Importación de fábricas desde Excel |
| `import-koritsu.ts` | Importación específica コーリツ (Excel + PDF parse) |

### Admin Panel (7) — token-gated (`ADMIN_TOKEN`)

| Archivo | Descripción |
|---------|-------------|
| `admin-tables.ts` | Lista de tablas disponibles |
| `admin-rows.ts` | Lectura/escritura de filas |
| `admin-sql.ts` | SELECT-only runner con blocklist regex |
| `admin-crud.ts` | DELETE bloqueado en `client_companies`/`factories`/`audit_log` |
| `admin-stats.ts` | Métricas agregadas |
| `admin-backup.ts` | Backup manual y listado de snapshots |
| `admin-reset.ts` | DELETE atómico de todos los datos operativos |

## Servicios (26 módulos)

| Módulo | Descripción |
|--------|-------------|
| `admin-sql.ts` | SELECT safe con regex blocklist |
| `admin-stats.ts` | Métricas agregadas del sistema |
| `backup.ts` | Backup manual con snapshots |
| `batch-contracts.ts` | Creación de contratos en lote |
| `batch-helpers.ts` | Helpers compartidos para batch |
| `completeness.ts` | Matriz de completitud de datos |
| `contract-assignment.ts` | Asignación de empleados a contratos |
| `contract-dates.ts` | Cálculo de fechas contractuales |
| `contract-number.ts` | Generación de números de contrato (KOB-YYYYMM-XXXX) |
| `contract-writes.ts` | Escritura de contratos con validaciones |
| `dashboard-stats.ts` | Estadísticas para el dashboard |
| `db-utils.ts` | Utilidades de base de datos |
| `dispatch-mapping.ts` | Mapeo de empresas de dispatch |
| `document-files.ts` | Gestión de archivos PDF en disco |
| `document-generation.ts` | Orquestación de generación de PDFs |
| `document-index.ts` | Índice de documentos generados |
| `employee-mapper.ts` | Mapeo de empleados en imports |
| `factory-roles.ts` | Gestión de roles por fábrica |
| `factory-yearly-config.ts` | Configuración anual por línea |
| `haizokusaki-parser.ts` | Parser de 配置先 (lugar de asignación) |
| `import-assignment.ts` | Lógica de asignación en imports |
| `import-employees.ts` | Importación de empleados desde Excel |
| `import-factories-service.ts` | Lógica de importación de fábricas |
| `import-utils.ts` | Utilidades compartidas de importación |
| `koritsu-excel-parser.ts` | Parser Excel específico コーリツ |
| `koritsu-pdf-parser.ts` | Parser de PDFs anuales コーリツ |
| `pdf-data-builders.ts` | Construcción de datos para PDFs |
| `pdf-versioning.ts` | Versionado y trazabilidad de PDFs |
| `takao-detection.ts` | Detección de 高雄 事業所 |
| `validation.ts` | Validaciones de dominio |

## Scripts útiles

```bash
npm run dev:server     # API solo (tsx watch --env-file .env)
npm run db:push        # Push schema a SQLite
npm run db:studio      # Drizzle Studio GUI
```
