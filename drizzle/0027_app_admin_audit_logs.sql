CREATE TABLE `app_admin_audit_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `actor_user_id` text,
  `actor_username` text NOT NULL,
  `action` text NOT NULL,
  `target_user_id` text,
  `target_username` text DEFAULT '' NOT NULL,
  `ip_address` text DEFAULT 'unknown' NOT NULL,
  `details_json` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`actor_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`target_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `app_admin_audit_logs_action_idx` ON `app_admin_audit_logs` (`action`);
--> statement-breakpoint
CREATE INDEX `app_admin_audit_logs_actor_idx` ON `app_admin_audit_logs` (`actor_username`);
--> statement-breakpoint
CREATE INDEX `app_admin_audit_logs_created_at_idx` ON `app_admin_audit_logs` (`created_at`);
--> statement-breakpoint
CREATE INDEX `app_admin_audit_logs_target_idx` ON `app_admin_audit_logs` (`target_username`);
