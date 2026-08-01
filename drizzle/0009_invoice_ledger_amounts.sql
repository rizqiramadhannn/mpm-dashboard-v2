ALTER TABLE `invoice_documents` ADD `modal_amount` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoice_documents` ADD `fee_amount` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoice_documents` ADD `kod_amount` integer DEFAULT 0 NOT NULL;
