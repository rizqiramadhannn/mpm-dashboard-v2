CREATE TABLE `finance_sync_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_used_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finance_sync_credentials_token_hash_idx` ON `finance_sync_credentials` (`token_hash`);