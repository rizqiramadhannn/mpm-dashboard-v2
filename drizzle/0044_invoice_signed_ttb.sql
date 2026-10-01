ALTER TABLE `invoice_documents` ADD `ttb_signed_file_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoice_documents` ADD `ttb_signed_file_mime_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoice_documents` ADD `ttb_signed_file_size` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoice_documents` ADD `ttb_signed_file_base64` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoice_documents` ADD `ttb_signed_file_sha256` text DEFAULT '' NOT NULL;