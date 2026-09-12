CREATE TABLE `manual_note_counters` (
	`note_date` text PRIMARY KEY NOT NULL,
	`last_sequence` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `note_source` text DEFAULT 'import' NOT NULL;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `manual_idempotency_key` text;--> statement-breakpoint
ALTER TABLE `supplier_notes` ADD `manual_payload_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_notes_manual_idempotency_idx` ON `supplier_notes` (`manual_idempotency_key`);
