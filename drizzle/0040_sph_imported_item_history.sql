CREATE TABLE `sph_imported_item_history` (
	`id` text PRIMARY KEY NOT NULL,
	`source_spreadsheet_id` text NOT NULL,
	`source_sheet_name` text NOT NULL,
	`source_row` integer NOT NULL,
	`source_key` text NOT NULL,
	`sph_date` text NOT NULL,
	`part_number` text DEFAULT '' NOT NULL,
	`part_name` text NOT NULL,
	`customer_name` text NOT NULL,
	`sph_no` text NOT NULL,
	`quantity` real,
	`uom` text DEFAULT '' NOT NULL,
	`unit_price` integer NOT NULL,
	`total_price` integer,
	`status` text DEFAULT '-' NOT NULL,
	`imported_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sph_imported_item_history_source_key_idx` ON `sph_imported_item_history` (`source_key`);--> statement-breakpoint
CREATE INDEX `sph_imported_item_history_date_idx` ON `sph_imported_item_history` (`sph_date`);--> statement-breakpoint
CREATE INDEX `sph_imported_item_history_sph_no_idx` ON `sph_imported_item_history` (`sph_no`);