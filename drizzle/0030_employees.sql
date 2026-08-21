CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`jobdesk` text DEFAULT '' NOT NULL,
	`salary` integer DEFAULT 0 NOT NULL,
	`account_number` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Aktif' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `employees_name_idx` ON `employees` (`name`);--> statement-breakpoint
CREATE INDEX `employees_status_idx` ON `employees` (`status`);--> statement-breakpoint
CREATE TABLE `employee_salary_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`salary_month` text NOT NULL,
	`payment_date` text NOT NULL,
	`base_salary` integer DEFAULT 0 NOT NULL,
	`sales_amount` integer DEFAULT 0 NOT NULL,
	`commission_amount` integer DEFAULT 0 NOT NULL,
	`additional_bonus` integer DEFAULT 0 NOT NULL,
	`deduction` integer DEFAULT 0 NOT NULL,
	`total_paid` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employee_salary_payments_employee_month_idx` ON `employee_salary_payments` (`employee_id`,`salary_month`);--> statement-breakpoint
CREATE INDEX `employee_salary_payments_payment_date_idx` ON `employee_salary_payments` (`payment_date`);
