ALTER TABLE `supplier_notes` ADD `source_file_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `source_file_mime_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `source_file_size` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `source_file_base64` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `source_file_sha256` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `extraction_json` text;