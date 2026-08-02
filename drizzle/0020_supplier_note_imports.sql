CREATE TABLE `supplier_note_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`flag` text DEFAULT 'MPM' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`file_name` text NOT NULL,
	`file_mime_type` text NOT NULL,
	`file_size` integer DEFAULT 0 NOT NULL,
	`file_base64` text DEFAULT '' NOT NULL,
	`file_sha256` text DEFAULT '' NOT NULL,
	`imported_supplier_note_id` text,
	`imported_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`imported_supplier_note_id`) REFERENCES `supplier_notes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `supplier_note_imports_status_idx` ON `supplier_note_imports` (`status`);
--> statement-breakpoint
CREATE INDEX `supplier_note_imports_flag_idx` ON `supplier_note_imports` (`flag`);
--> statement-breakpoint
CREATE INDEX `supplier_note_imports_note_idx` ON `supplier_note_imports` (`imported_supplier_note_id`);
