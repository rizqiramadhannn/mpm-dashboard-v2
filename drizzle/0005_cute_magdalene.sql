CREATE TABLE `shipment_journeys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sph_item_id` integer NOT NULL,
	`supply_type` text DEFAULT 'stock' NOT NULL,
	`supplier_id` integer,
	`origin` text DEFAULT '' NOT NULL,
	`destination` text DEFAULT '' NOT NULL,
	`latest_status` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`sph_item_id`) REFERENCES `sph_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipment_journeys_sph_item_idx` ON `shipment_journeys` (`sph_item_id`);--> statement-breakpoint
CREATE INDEX `shipment_journeys_supplier_idx` ON `shipment_journeys` (`supplier_id`);