CREATE TABLE `finance_category_overrides` (
	`source_key` text PRIMARY KEY NOT NULL,
	`finance_category` text NOT NULL,
	`direction` text NOT NULL,
	`updated_by_username` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
