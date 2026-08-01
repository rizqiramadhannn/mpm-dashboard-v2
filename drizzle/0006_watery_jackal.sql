DROP INDEX `shipment_journeys_sph_item_idx`;--> statement-breakpoint
ALTER TABLE `shipment_journeys` ADD `split_no` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `shipment_journeys` ADD `quantity` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `shipment_journeys_sph_item_split_idx` ON `shipment_journeys` (`sph_item_id`,`split_no`);--> statement-breakpoint
CREATE INDEX `shipment_journeys_sph_item_idx` ON `shipment_journeys` (`sph_item_id`);