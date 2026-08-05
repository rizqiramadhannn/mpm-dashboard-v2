CREATE TABLE `app_login_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `username` text NOT NULL,
  `ip_address` text NOT NULL,
  `success` integer DEFAULT false NOT NULL,
  `attempted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `app_login_attempts_attempted_at_idx` ON `app_login_attempts` (`attempted_at`);
--> statement-breakpoint
CREATE INDEX `app_login_attempts_identity_idx` ON `app_login_attempts` (`username`, `ip_address`);
