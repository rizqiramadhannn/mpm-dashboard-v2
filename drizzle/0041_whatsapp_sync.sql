CREATE TABLE `whatsapp_connection` (
	`id` integer PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`session_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `whatsapp_daily_syncs` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`wib_date` text NOT NULL,
	`status` text NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`media_count` integer DEFAULT 0 NOT NULL,
	`failed_media_count` integer DEFAULT 0 NOT NULL,
	`checked_at` text NOT NULL,
	`note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_daily_syncs_group_date_idx` ON `whatsapp_daily_syncs` (`group_id`,`wib_date`);--> statement-breakpoint
CREATE INDEX `whatsapp_daily_syncs_date_idx` ON `whatsapp_daily_syncs` (`wib_date`);--> statement-breakpoint
CREATE TABLE `whatsapp_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`monitored` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `whatsapp_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`source_id` text NOT NULL,
	`sent_at` text NOT NULL,
	`wib_date` text NOT NULL,
	`sender_id` text DEFAULT '' NOT NULL,
	`sender_name` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`message_type` text DEFAULT '' NOT NULL,
	`media_name` text DEFAULT '' NOT NULL,
	`media_mime` text DEFAULT '' NOT NULL,
	`media_status` text DEFAULT 'none' NOT NULL,
	`media_base64` text DEFAULT '' NOT NULL,
	`media_sha256` text DEFAULT '' NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_messages_source_idx` ON `whatsapp_messages` (`group_id`,`source_id`);--> statement-breakpoint
CREATE INDEX `whatsapp_messages_date_idx` ON `whatsapp_messages` (`wib_date`,`group_id`);