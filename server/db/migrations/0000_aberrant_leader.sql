CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` text DEFAULT (datetime('now')) NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer,
	`detail` text,
	`user_name` text DEFAULT 'system'
);
--> statement-breakpoint
CREATE TABLE `client_companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_kana` text,
	`short_name` text,
	`address` text,
	`phone` text,
	`representative` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contract_employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contract_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`hourly_rate` real,
	`individual_start_date` text,
	`individual_end_date` text,
	`is_indefinite` integer DEFAULT false,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contract_number` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`company_id` integer NOT NULL,
	`factory_id` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`contract_date` text NOT NULL,
	`notification_date` text NOT NULL,
	`work_days` text,
	`work_start_time` text,
	`work_end_time` text,
	`break_minutes` integer,
	`supervisor_name` text,
	`supervisor_dept` text,
	`supervisor_phone` text,
	`complaint_handler_client` text,
	`complaint_handler_uns` text,
	`hakenmoto_manager` text,
	`safety_measures` text,
	`termination_measures` text,
	`job_description` text,
	`responsibility_level` text,
	`overtime_max` text,
	`welfare` text,
	`is_kyotei_taisho` integer DEFAULT false,
	`hourly_rate` real,
	`overtime_rate` real,
	`night_shift_rate` real,
	`holiday_rate` real,
	`previous_contract_id` integer,
	`pdf_path` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `client_companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`previous_contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contract_number_unique` ON `contracts` (`contract_number`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_number` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`full_name` text NOT NULL,
	`katakana_name` text,
	`nationality` text,
	`gender` text,
	`birth_date` text,
	`hire_date` text,
	`actual_hire_date` text,
	`hourly_rate` real,
	`billing_rate` real,
	`visa_expiry` text,
	`visa_type` text,
	`address` text,
	`postal_code` text,
	`company_id` integer,
	`factory_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `client_companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employee_number_unique` ON `employees` (`employee_number`);--> statement-breakpoint
CREATE TABLE `factories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`factory_name` text NOT NULL,
	`address` text,
	`phone` text,
	`department` text,
	`line_name` text,
	`supervisor_dept` text,
	`supervisor_name` text,
	`supervisor_phone` text,
	`complaint_client_name` text,
	`complaint_client_phone` text,
	`complaint_client_dept` text,
	`complaint_uns_name` text,
	`complaint_uns_phone` text,
	`complaint_uns_dept` text,
	`manager_uns_name` text,
	`manager_uns_phone` text,
	`manager_uns_dept` text,
	`hakensaki_manager_name` text,
	`hakensaki_manager_phone` text,
	`hakensaki_manager_dept` text,
	`hourly_rate` real,
	`job_description` text,
	`shift_pattern` text,
	`work_hours` text,
	`work_hours_day` text,
	`work_hours_night` text,
	`break_time` integer,
	`break_time_day` text,
	`break_time_night` text,
	`overtime_hours` text,
	`work_days` text,
	`conflict_date` text,
	`contract_period` text,
	`calendar` text,
	`closing_day` integer,
	`payment_day` integer,
	`bank_account` text,
	`time_unit` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `client_companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `factory_unique_key` ON `factories` (`company_id`,`factory_name`,`department`,`line_name`);--> statement-breakpoint
CREATE TABLE `factory_calendars` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`year` integer NOT NULL,
	`holidays` text NOT NULL,
	`description` text,
	`total_work_days` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `factory_calendar_unique` ON `factory_calendars` (`factory_id`,`year`);