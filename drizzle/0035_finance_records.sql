CREATE TABLE `finance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`source_key` text NOT NULL,
	`source_spreadsheet_id` text NOT NULL,
	`source_sheet` text NOT NULL,
	`source_row` integer NOT NULL,
	`transaction_date` text NOT NULL,
	`transaction_time` text DEFAULT '' NOT NULL,
	`source_document` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`counterparty` text DEFAULT '' NOT NULL,
	`source_category` text DEFAULT '' NOT NULL,
	`direction` text NOT NULL,
	`finance_category` text NOT NULL,
	`amount` integer NOT NULL,
	`source_status` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`import_batch_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finance_records_source_key_idx` ON `finance_records` (`source_key`);--> statement-breakpoint
CREATE INDEX `finance_records_date_idx` ON `finance_records` (`transaction_date`);--> statement-breakpoint
CREATE INDEX `finance_records_direction_idx` ON `finance_records` (`direction`);--> statement-breakpoint
CREATE INDEX `finance_records_category_idx` ON `finance_records` (`finance_category`);--> statement-breakpoint
CREATE INDEX `finance_records_source_period_idx` ON `finance_records` (`source_spreadsheet_id`,`transaction_date`);