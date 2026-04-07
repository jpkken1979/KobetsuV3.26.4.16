-- 0003_pdf_versions.sql
-- Tabla de trazabilidad legal de PDFs generados.
-- Almacena el hash SHA256 del buffer del PDF para probar qué documento
-- concreto fue entregado en qué momento (派遣個別契約書、通知書、管理台帳 etc.)
-- No guarda el binario — solo el fingerprint.

CREATE TABLE IF NOT EXISTS `pdf_versions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `pdf_type` text NOT NULL,
  `contract_id` integer REFERENCES `contracts`(`id`) ON DELETE SET NULL,
  `factory_id` integer REFERENCES `factories`(`id`) ON DELETE SET NULL,
  `sha256` text NOT NULL,
  `byte_length` integer NOT NULL,
  `generated_at` text NOT NULL DEFAULT (datetime('now')),
  `generated_by` text DEFAULT 'system',
  `regenerated_from` integer REFERENCES `pdf_versions`(`id`) ON DELETE SET NULL,
  `metadata` text
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_pdf_versions_type_contract` ON `pdf_versions` (`pdf_type`, `contract_id`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_pdf_versions_generated_at` ON `pdf_versions` (`generated_at`);
