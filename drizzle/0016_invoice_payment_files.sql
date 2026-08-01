ALTER TABLE `invoice_documents` ADD `paid_amount` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoice_documents` ADD `ttd_materai_file_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoice_documents` ADD `ttd_materai_file_mime_type` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoice_documents` ADD `ttd_materai_file_size` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoice_documents` ADD `ttd_materai_file_base64` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoice_documents` ADD `ttd_materai_file_sha256` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoice_documents` ADD `invoice_payment_proof_files_json` text DEFAULT '[]' NOT NULL;
