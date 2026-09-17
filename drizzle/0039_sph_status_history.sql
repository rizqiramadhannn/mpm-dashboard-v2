CREATE TABLE `dashboard_status_tracking` (
	`id` integer PRIMARY KEY NOT NULL,
	`installed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sph_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`sph_id` text NOT NULL,
	`sph_no` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`changed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sph_status_history_deal_time_idx` ON `sph_status_history` (`from_status`,`to_status`,`changed_at`);
--> statement-breakpoint
INSERT INTO `dashboard_status_tracking` (`id`) VALUES (1);
--> statement-breakpoint
CREATE TRIGGER `sph_status_history_capture`
AFTER UPDATE OF `status` ON `sph_documents`
WHEN OLD.status IS NOT NEW.status
BEGIN
  INSERT INTO `sph_status_history` (`id`, `sph_id`, `sph_no`, `from_status`, `to_status`)
  VALUES (lower(hex(randomblob(16))), NEW.id, NEW.sph_no, OLD.status, NEW.status);
END;
