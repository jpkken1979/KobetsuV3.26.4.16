CREATE TABLE `shift_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`work_hours` text NOT NULL,
	`break_time` text NOT NULL,
	`shift_count` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_contract_employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contract_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`hourly_rate` real,
	`individual_start_date` text,
	`individual_end_date` text,
	`is_indefinite` integer DEFAULT false,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_contract_employees`("id", "contract_id", "employee_id", "hourly_rate", "individual_start_date", "individual_end_date", "is_indefinite") SELECT "id", "contract_id", "employee_id", "hourly_rate", "individual_start_date", "individual_end_date", "is_indefinite" FROM `contract_employees`;--> statement-breakpoint
DROP TABLE `contract_employees`;--> statement-breakpoint
ALTER TABLE `__new_contract_employees` RENAME TO `contract_employees`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_ce_contract` ON `contract_employees` (`contract_id`);--> statement-breakpoint
CREATE INDEX `idx_ce_employee` ON `contract_employees` (`employee_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ce_contract_employee` ON `contract_employees` (`contract_id`,`employee_id`);--> statement-breakpoint
ALTER TABLE `audit_log` ADD `operation_id` text;--> statement-breakpoint
CREATE INDEX `idx_audit_timestamp` ON `audit_log` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_audit_operation_id` ON `audit_log` (`operation_id`);--> statement-breakpoint
ALTER TABLE `employees` ADD `client_employee_id` text;--> statement-breakpoint
CREATE INDEX `idx_employees_company` ON `employees` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_employees_factory` ON `employees` (`factory_id`);--> statement-breakpoint
CREATE INDEX `idx_employees_status` ON `employees` (`status`);--> statement-breakpoint
CREATE INDEX `idx_employees_company_status` ON `employees` (`company_id`,`status`);--> statement-breakpoint
ALTER TABLE `factories` ADD `complaint_uns_address` text;--> statement-breakpoint
ALTER TABLE `factories` ADD `manager_uns_address` text;--> statement-breakpoint
ALTER TABLE `factories` ADD `hakensaki_manager_role` text;--> statement-breakpoint
ALTER TABLE `factories` ADD `supervisor_role` text;--> statement-breakpoint
ALTER TABLE `factories` ADD `overtime_outside_days` text;--> statement-breakpoint
ALTER TABLE `factories` ADD `job_description_2` text;--> statement-breakpoint
ALTER TABLE `factories` ADD `closing_day_text` text;--> statement-breakpoint
ALTER TABLE `factories` ADD `payment_day_text` text;--> statement-breakpoint
ALTER TABLE `factories` ADD `worker_closing_day` text;--> statement-breakpoint
ALTER TABLE `factories` ADD `worker_payment_day` text;--> statement-breakpoint
ALTER TABLE `factories` ADD `worker_calendar` text;--> statement-breakpoint
ALTER TABLE `factories` ADD `agreement_period_end` text;--> statement-breakpoint
ALTER TABLE `factories` ADD `explainer_name` text;--> statement-breakpoint
ALTER TABLE `factories` ADD `has_robot_training` integer DEFAULT false;--> statement-breakpoint
CREATE INDEX `idx_factories_company` ON `factories` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_factories_is_active` ON `factories` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_factories_conflict_date` ON `factories` (`conflict_date`);--> statement-breakpoint
CREATE INDEX `idx_contracts_company` ON `contracts` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_contracts_factory` ON `contracts` (`factory_id`);--> statement-breakpoint
CREATE INDEX `idx_contracts_status` ON `contracts` (`status`);--> statement-breakpoint
CREATE INDEX `idx_contracts_end_date` ON `contracts` (`end_date`);--> statement-breakpoint
CREATE INDEX `idx_contracts_status_end` ON `contracts` (`status`,`end_date`);--> statement-breakpoint
CREATE INDEX `idx_calendars_factory` ON `factory_calendars` (`factory_id`);