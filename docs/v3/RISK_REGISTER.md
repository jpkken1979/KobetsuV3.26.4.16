# RISK REGISTER V3

| Riesgo | Severidad | Mitigación aplicada |
|---|---|---|
| Exposición de endpoints admin | Alta | Guard con `ADMIN_TOKEN` + bloqueo en producción sin token |
| Fallo de build por `manualChunks` en Vite 8 | Alta | Migrado a función `manualChunks(id)` compatible |
| Race condition de DB en tests | Alta | Seed previo obligatorio + tests seriales + inicialización robusta |
| Versionado accidental de SQLite/artefactos | Media | `.gitignore` reforzado para DB/caches/reports |
| Tamaño de bundle alto (`exceljs`) | Media | Chunk separado (`exceljs`); pendiente optimización incremental |
| Dependencias con advisories | Media | Identificado vía `npm audit`; pendiente ciclo de updates controlado |
