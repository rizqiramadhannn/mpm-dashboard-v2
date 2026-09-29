ALTER TABLE `shipment_journeys` ADD `handling_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shipment_journeys` ADD `air_shipping_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shipment_journeys` ADD `sea_shipping_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shipment_journeys` ADD `land_shipping_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shipment_journeys` ADD `maxim_shipping_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shipment_journeys` ADD `other_shipping_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shipments` ADD `handling_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shipments` ADD `air_shipping_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shipments` ADD `sea_shipping_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shipments` ADD `land_shipping_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shipments` ADD `maxim_shipping_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shipments` ADD `other_shipping_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `shipment_journeys` SET `land_shipping_cost` = `shipping_cost`;--> statement-breakpoint
UPDATE `shipments` SET `land_shipping_cost` = `shipping_cost`;
