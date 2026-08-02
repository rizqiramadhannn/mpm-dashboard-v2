ALTER TABLE `shipments` ADD `paid_amount` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `shipments` ADD `payment_proof_files_json` text DEFAULT '[]' NOT NULL;
