CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_code` text NOT NULL,
	`item_name` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`asset_value` integer DEFAULT 0 NOT NULL,
	`current_or_last_pic` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`condition` text DEFAULT 'Baik' NOT NULL,
	`status` text DEFAULT 'Aktif' NOT NULL,
	`acquisition_date` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_asset_code_idx` ON `assets` (`asset_code`);--> statement-breakpoint
CREATE INDEX `assets_item_name_idx` ON `assets` (`item_name`);--> statement-breakpoint
CREATE INDEX `assets_category_idx` ON `assets` (`category`);--> statement-breakpoint
CREATE INDEX `assets_location_idx` ON `assets` (`location`);--> statement-breakpoint
CREATE INDEX `assets_status_idx` ON `assets` (`status`);
