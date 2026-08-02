CREATE TABLE `shipments` (
	`id` text PRIMARY KEY NOT NULL,
	`shipment_no` text NOT NULL,
	`shipment_date` text NOT NULL,
	`customer_code` text DEFAULT '' NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`destination` text DEFAULT '' NOT NULL,
	`shipping_vendor` text DEFAULT '' NOT NULL,
	`shipping_cost` integer DEFAULT 0 NOT NULL,
	`is_shipping_paid` integer DEFAULT false NOT NULL,
	`latest_status` text DEFAULT 'TERJADWAL' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipments_shipment_no_idx` ON `shipments` (`shipment_no`);
--> statement-breakpoint
CREATE INDEX `shipments_customer_idx` ON `shipments` (`customer_code`);
--> statement-breakpoint
CREATE INDEX `shipments_date_idx` ON `shipments` (`shipment_date`);
--> statement-breakpoint
ALTER TABLE `shipment_journeys` ADD `shipment_id` text REFERENCES `shipments`(`id`) ON UPDATE no action ON DELETE set null;
--> statement-breakpoint
CREATE INDEX `shipment_journeys_shipment_idx` ON `shipment_journeys` (`shipment_id`);
