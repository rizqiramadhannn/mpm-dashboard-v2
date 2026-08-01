CREATE TABLE `payment_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `request_date` text NOT NULL,
  `source_fund` text DEFAULT '' NOT NULL,
  `amount` integer DEFAULT 0 NOT NULL,
  `destination_account` text DEFAULT '' NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `transaction_purpose` text DEFAULT '' NOT NULL,
  `status` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX `payment_requests_request_date_idx` ON `payment_requests` (`request_date`);
CREATE INDEX `payment_requests_source_fund_idx` ON `payment_requests` (`source_fund`);
CREATE INDEX `payment_requests_status_idx` ON `payment_requests` (`status`);
