ALTER TABLE `shipment_journeys` ADD `shipping_vendor` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shipment_journeys` ADD `shipping_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shipment_journeys` ADD `is_shipping_paid` integer DEFAULT false NOT NULL;