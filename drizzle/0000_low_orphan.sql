CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`detail_line_1` text DEFAULT '' NOT NULL,
	`detail_line_2` text DEFAULT '' NOT NULL,
	`detail_line_3` text DEFAULT '' NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_code_idx` ON `customers` (`code`);--> statement-breakpoint
CREATE INDEX `customers_name_idx` ON `customers` (`name`);--> statement-breakpoint
CREATE TABLE `invoice_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_no` text NOT NULL,
	`sph_id` integer NOT NULL,
	`ttb_id` integer,
	`po_no` text DEFAULT '-' NOT NULL,
	`invoice_date` text NOT NULL,
	`payment_due_date` text,
	`payment_term` text DEFAULT 'CBD' NOT NULL,
	`franco` text DEFAULT '' NOT NULL,
	`customer_name` text NOT NULL,
	`customer_detail_line_1` text DEFAULT '' NOT NULL,
	`customer_detail_line_2` text DEFAULT '' NOT NULL,
	`customer_detail_line_3` text DEFAULT '' NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`amount_in_words` text DEFAULT '' NOT NULL,
	`pdf_file_id` text,
	`pdf_url` text,
	`ledger_row` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`processed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`sph_id`) REFERENCES `sph_documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ttb_id`) REFERENCES `ttb_documents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_documents_invoice_no_idx` ON `invoice_documents` (`invoice_no`);--> statement-breakpoint
CREATE INDEX `invoice_documents_sph_idx` ON `invoice_documents` (`sph_id`);--> statement-breakpoint
CREATE INDEX `invoice_documents_ttb_idx` ON `invoice_documents` (`ttb_id`);--> statement-breakpoint
CREATE INDEX `invoice_documents_status_idx` ON `invoice_documents` (`status`);--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL,
	`sph_item_id` integer,
	`line_no` integer NOT NULL,
	`part_number` text DEFAULT '' NOT NULL,
	`part_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`uom` text DEFAULT 'pcs' NOT NULL,
	`unit_price` integer NOT NULL,
	`total_price` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoice_documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sph_item_id`) REFERENCES `sph_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_items_invoice_line_idx` ON `invoice_items` (`invoice_id`,`line_no`);--> statement-breakpoint
CREATE INDEX `invoice_items_sph_item_idx` ON `invoice_items` (`sph_item_id`);--> statement-breakpoint
CREATE TABLE `invoice_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer,
	`sph_id` integer,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`sph_no` text NOT NULL,
	`invoice_no` text DEFAULT '' NOT NULL,
	`pdf_file_id` text,
	`pdf_url` text,
	`ledger_row` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`snapshot_json` text,
	`processed_at` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoice_documents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sph_id`) REFERENCES `sph_documents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `invoice_logs_sph_no_idx` ON `invoice_logs` (`sph_no`);--> statement-breakpoint
CREATE INDEX `invoice_logs_invoice_no_idx` ON `invoice_logs` (`invoice_no`);--> statement-breakpoint
CREATE INDEX `invoice_logs_status_idx` ON `invoice_logs` (`status`);--> statement-breakpoint
CREATE TABLE `sph_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sph_no` text NOT NULL,
	`yy` text NOT NULL,
	`mm` text NOT NULL,
	`sequence` integer NOT NULL,
	`customer_code` text NOT NULL,
	`customer_id` integer,
	`customer_name` text NOT NULL,
	`customer_detail_line_1` text DEFAULT '' NOT NULL,
	`customer_detail_line_2` text DEFAULT '' NOT NULL,
	`customer_detail_line_3` text DEFAULT '' NOT NULL,
	`payment_term` text DEFAULT 'CBD' NOT NULL,
	`franco` text DEFAULT '' NOT NULL,
	`source_fund` text DEFAULT 'MPM' NOT NULL,
	`sph_date` text NOT NULL,
	`delivery_date` text,
	`eta_date` text,
	`payment_due_date` text,
	`additional_info` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`amount_in_words` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sph_documents_sph_no_idx` ON `sph_documents` (`sph_no`);--> statement-breakpoint
CREATE INDEX `sph_documents_period_idx` ON `sph_documents` (`yy`,`mm`);--> statement-breakpoint
CREATE INDEX `sph_documents_customer_idx` ON `sph_documents` (`customer_code`);--> statement-breakpoint
CREATE INDEX `sph_documents_status_idx` ON `sph_documents` (`status`);--> statement-breakpoint
CREATE TABLE `sph_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sph_id` integer NOT NULL,
	`line_no` integer NOT NULL,
	`part_number` text DEFAULT '' NOT NULL,
	`part_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`uom` text DEFAULT 'pcs' NOT NULL,
	`unit_price` integer NOT NULL,
	`total_price` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`sph_id`) REFERENCES `sph_documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sph_items_sph_line_idx` ON `sph_items` (`sph_id`,`line_no`);--> statement-breakpoint
CREATE INDEX `sph_items_part_number_idx` ON `sph_items` (`part_number`);--> statement-breakpoint
CREATE TABLE `ttb_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ttb_no` text NOT NULL,
	`sph_id` integer NOT NULL,
	`po_no` text DEFAULT '-' NOT NULL,
	`ttb_date` text NOT NULL,
	`handover_text` text DEFAULT '' NOT NULL,
	`sender_name` text DEFAULT 'PT Morowali Putra Mandiri' NOT NULL,
	`sender_role` text DEFAULT 'Admin Logistik MPM' NOT NULL,
	`receiver_name` text DEFAULT '' NOT NULL,
	`receiver_company` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`sph_id`) REFERENCES `sph_documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ttb_documents_ttb_no_idx` ON `ttb_documents` (`ttb_no`);--> statement-breakpoint
CREATE INDEX `ttb_documents_sph_idx` ON `ttb_documents` (`sph_id`);--> statement-breakpoint
CREATE INDEX `ttb_documents_status_idx` ON `ttb_documents` (`status`);--> statement-breakpoint
CREATE TABLE `ttb_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ttb_id` integer NOT NULL,
	`sph_item_id` integer,
	`line_no` integer NOT NULL,
	`part_number` text DEFAULT '' NOT NULL,
	`part_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`uom` text DEFAULT 'pcs' NOT NULL,
	`is_checked` integer DEFAULT false NOT NULL,
	`checked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`ttb_id`) REFERENCES `ttb_documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sph_item_id`) REFERENCES `sph_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ttb_items_ttb_line_idx` ON `ttb_items` (`ttb_id`,`line_no`);--> statement-breakpoint
CREATE INDEX `ttb_items_sph_item_idx` ON `ttb_items` (`sph_item_id`);