ALTER TABLE `payment_requests` ADD `requested_by_user_id` text REFERENCES `app_users`(`id`) ON DELETE set null;
--> statement-breakpoint
ALTER TABLE `payment_requests` ADD `requested_by_username` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE INDEX `payment_requests_requested_by_idx` ON `payment_requests` (`requested_by_username`);
