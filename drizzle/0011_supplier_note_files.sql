ALTER TABLE `supplier_notes` ADD `invoice_file_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `invoice_file_mime_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `invoice_file_size` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `invoice_file_base64` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `invoice_file_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `invoice_file_sha256` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `payment_proof_file_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `payment_proof_file_mime_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `payment_proof_file_size` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `payment_proof_file_base64` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `payment_proof_file_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `payment_proof_file_sha256` text DEFAULT '' NOT NULL;
