CREATE TABLE `supplier_note_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_note_id` integer NOT NULL,
	`line_no` integer NOT NULL,
	`part_number` text DEFAULT '' NOT NULL,
	`description` text NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`uom` text DEFAULT 'Pcs' NOT NULL,
	`unit_price` integer DEFAULT 0 NOT NULL,
	`total_price` integer DEFAULT 0 NOT NULL,
	`due_date` text,
	`status` text DEFAULT '' NOT NULL,
	`short_code` text DEFAULT '' NOT NULL,
	`flag` text DEFAULT 'MPM' NOT NULL,
	`source_sheet_row` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`supplier_note_id`) REFERENCES `supplier_notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_note_items_note_line_idx` ON `supplier_note_items` (`supplier_note_id`,`line_no`);--> statement-breakpoint
CREATE INDEX `supplier_note_items_part_number_idx` ON `supplier_note_items` (`part_number`);--> statement-breakpoint
CREATE INDEX `supplier_note_items_flag_idx` ON `supplier_note_items` (`flag`);--> statement-breakpoint
CREATE TABLE `supplier_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_id` integer NOT NULL,
	`note_no` text NOT NULL,
	`note_date` text NOT NULL,
	`item_summary` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'Spareparts' NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`payment_status` text DEFAULT 'BELUM BAYAR' NOT NULL,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`remaining_payment` integer DEFAULT 0 NOT NULL,
	`payment_term` text DEFAULT '' NOT NULL,
	`payment_deadline` text,
	`payment_date` text,
	`purchase_purpose` text DEFAULT '' NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`flag` text DEFAULT 'MPM' NOT NULL,
	`source_sheet_row` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_notes_supplier_note_no_idx` ON `supplier_notes` (`supplier_id`,`note_no`);--> statement-breakpoint
CREATE INDEX `supplier_notes_note_date_idx` ON `supplier_notes` (`note_date`);--> statement-breakpoint
CREATE INDEX `supplier_notes_payment_status_idx` ON `supplier_notes` (`payment_status`);--> statement-breakpoint
CREATE INDEX `supplier_notes_payment_deadline_idx` ON `supplier_notes` (`payment_deadline`);--> statement-breakpoint
CREATE INDEX `supplier_notes_flag_idx` ON `supplier_notes` (`flag`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`supplier_type` text DEFAULT 'Supplier Sparepart' NOT NULL,
	`supplied_items` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`contact_person` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`default_payment_term` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_normalized_name_idx` ON `suppliers` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `suppliers_name_idx` ON `suppliers` (`name`);