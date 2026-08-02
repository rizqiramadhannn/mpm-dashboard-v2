ALTER TABLE `customers` ADD `default_payment_term` text DEFAULT 'CBD' NOT NULL;
--> statement-breakpoint
ALTER TABLE `supplier_note_imports` ADD `customer_id` text;
--> statement-breakpoint
ALTER TABLE `supplier_note_imports` ADD `customer_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `supplier_note_imports` ADD `payment_term` text DEFAULT 'CBD' NOT NULL;
--> statement-breakpoint
ALTER TABLE `supplier_note_imports` ADD `purchase_purpose` text DEFAULT 'Pembelian Langsung' NOT NULL;
