PRAGMA foreign_keys=OFF;--> statement-breakpoint
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
BEGIN TRANSACTION;--> statement-breakpoint
CREATE TABLE `_idmap_customers` AS SELECT `id` AS `old_id`, 'id_' || lower(hex(randomblob(16))) AS `id` FROM `customers`;--> statement-breakpoint
CREATE TABLE `_idmap_invoice_documents` AS SELECT `id` AS `old_id`, 'id_' || lower(hex(randomblob(16))) AS `id` FROM `invoice_documents`;--> statement-breakpoint
CREATE TABLE `_idmap_invoice_items` AS SELECT `id` AS `old_id`, 'id_' || lower(hex(randomblob(16))) AS `id` FROM `invoice_items`;--> statement-breakpoint
CREATE TABLE `_idmap_invoice_logs` AS SELECT `id` AS `old_id`, 'id_' || lower(hex(randomblob(16))) AS `id` FROM `invoice_logs`;--> statement-breakpoint
CREATE TABLE `_idmap_shipment_journeys` AS SELECT `id` AS `old_id`, 'id_' || lower(hex(randomblob(16))) AS `id` FROM `shipment_journeys`;--> statement-breakpoint
CREATE TABLE `_idmap_sph_documents` AS SELECT `id` AS `old_id`, 'id_' || lower(hex(randomblob(16))) AS `id` FROM `sph_documents`;--> statement-breakpoint
CREATE TABLE `_idmap_sph_items` AS SELECT `id` AS `old_id`, 'id_' || lower(hex(randomblob(16))) AS `id` FROM `sph_items`;--> statement-breakpoint
CREATE TABLE `_idmap_supplier_note_items` AS SELECT `id` AS `old_id`, 'id_' || lower(hex(randomblob(16))) AS `id` FROM `supplier_note_items`;--> statement-breakpoint
CREATE TABLE `_idmap_supplier_notes` AS SELECT `id` AS `old_id`, 'id_' || lower(hex(randomblob(16))) AS `id` FROM `supplier_notes`;--> statement-breakpoint
CREATE TABLE `_idmap_suppliers` AS SELECT `id` AS `old_id`, 'id_' || lower(hex(randomblob(16))) AS `id` FROM `suppliers`;--> statement-breakpoint
CREATE TABLE `_idmap_ttb_documents` AS SELECT `id` AS `old_id`, 'id_' || lower(hex(randomblob(16))) AS `id` FROM `ttb_documents`;--> statement-breakpoint
CREATE TABLE `_idmap_ttb_items` AS SELECT `id` AS `old_id`, 'id_' || lower(hex(randomblob(16))) AS `id` FROM `ttb_items`;--> statement-breakpoint
CREATE TABLE `__new_customers` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`detail_line_1` text DEFAULT '' NOT NULL,
	`detail_line_2` text DEFAULT '' NOT NULL,
	`detail_line_3` text DEFAULT '' NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_customers`("id", "code", "name", "detail_line_1", "detail_line_2", "detail_line_3", "contact_name", "created_at", "updated_at") SELECT m."id", t."code", t."name", t."detail_line_1", t."detail_line_2", t."detail_line_3", t."contact_name", t."created_at", t."updated_at" FROM `customers` t INNER JOIN `_idmap_customers` m ON m."old_id" = t."id";--> statement-breakpoint
DROP TABLE `customers`;--> statement-breakpoint
ALTER TABLE `__new_customers` RENAME TO `customers`;--> statement-breakpoint
CREATE UNIQUE INDEX `customers_code_idx` ON `customers` (`code`);--> statement-breakpoint
CREATE INDEX `customers_name_idx` ON `customers` (`name`);--> statement-breakpoint
CREATE TABLE `__new_invoice_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_no` text NOT NULL,
	`sph_id` text NOT NULL,
	`ttb_id` text,
	`po_no` text DEFAULT '-' NOT NULL,
	`invoice_date` text NOT NULL,
	`payment_due_date` text,
	`payment_term` text DEFAULT 'CBD' NOT NULL,
	`franco` text DEFAULT '' NOT NULL,
	`customer_name` text NOT NULL,
	`customer_detail_line_1` text DEFAULT '' NOT NULL,
	`customer_detail_line_2` text DEFAULT '' NOT NULL,
	`customer_detail_line_3` text DEFAULT '' NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`amount_in_words` text DEFAULT '' NOT NULL,
	`pdf_file_id` text,
	`pdf_url` text,
	`ledger_row` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`processed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_invoice_documents`("id", "invoice_no", "sph_id", "ttb_id", "po_no", "invoice_date", "payment_due_date", "payment_term", "franco", "customer_name", "customer_detail_line_1", "customer_detail_line_2", "customer_detail_line_3", "total_amount", "amount_in_words", "pdf_file_id", "pdf_url", "ledger_row", "status", "processed_at", "created_at", "updated_at") SELECT m."id", t."invoice_no", sm."id", tm."id", t."po_no", t."invoice_date", t."payment_due_date", t."payment_term", t."franco", t."customer_name", t."customer_detail_line_1", t."customer_detail_line_2", t."customer_detail_line_3", t."total_amount", t."amount_in_words", t."pdf_file_id", t."pdf_url", t."ledger_row", t."status", t."processed_at", t."created_at", t."updated_at" FROM `invoice_documents` t INNER JOIN `_idmap_invoice_documents` m ON m."old_id" = t."id" INNER JOIN `_idmap_sph_documents` sm ON sm."old_id" = t."sph_id" LEFT JOIN `_idmap_ttb_documents` tm ON tm."old_id" = t."ttb_id";--> statement-breakpoint
DROP TABLE `invoice_documents`;--> statement-breakpoint
ALTER TABLE `__new_invoice_documents` RENAME TO `invoice_documents`;--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_documents_invoice_no_idx` ON `invoice_documents` (`invoice_no`);--> statement-breakpoint
CREATE INDEX `invoice_documents_sph_idx` ON `invoice_documents` (`sph_id`);--> statement-breakpoint
CREATE INDEX `invoice_documents_ttb_idx` ON `invoice_documents` (`ttb_id`);--> statement-breakpoint
CREATE INDEX `invoice_documents_status_idx` ON `invoice_documents` (`status`);--> statement-breakpoint
CREATE TABLE `__new_invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`sph_item_id` text,
	`line_no` integer NOT NULL,
	`part_number` text DEFAULT '' NOT NULL,
	`part_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`uom` text DEFAULT 'pcs' NOT NULL,
	`unit_price` integer NOT NULL,
	`total_price` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_invoice_items`("id", "invoice_id", "sph_item_id", "line_no", "part_number", "part_name", "quantity", "uom", "unit_price", "total_price", "created_at", "updated_at") SELECT m."id", im."id", sm."id", t."line_no", t."part_number", t."part_name", t."quantity", t."uom", t."unit_price", t."total_price", t."created_at", t."updated_at" FROM `invoice_items` t INNER JOIN `_idmap_invoice_items` m ON m."old_id" = t."id" INNER JOIN `_idmap_invoice_documents` im ON im."old_id" = t."invoice_id" LEFT JOIN `_idmap_sph_items` sm ON sm."old_id" = t."sph_item_id";--> statement-breakpoint
DROP TABLE `invoice_items`;--> statement-breakpoint
ALTER TABLE `__new_invoice_items` RENAME TO `invoice_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_items_invoice_line_idx` ON `invoice_items` (`invoice_id`,`line_no`);--> statement-breakpoint
CREATE INDEX `invoice_items_sph_item_idx` ON `invoice_items` (`sph_item_id`);--> statement-breakpoint
CREATE TABLE `__new_invoice_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text,
	`sph_id` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`sph_no` text NOT NULL,
	`invoice_no` text DEFAULT '' NOT NULL,
	`pdf_file_id` text,
	`pdf_url` text,
	`ledger_row` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`snapshot_json` text,
	`processed_at` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_invoice_logs`("id", "invoice_id", "sph_id", "updated_at", "sph_no", "invoice_no", "pdf_file_id", "pdf_url", "ledger_row", "status", "snapshot_json", "processed_at", "note", "created_at") SELECT m."id", im."id", sm."id", t."updated_at", t."sph_no", t."invoice_no", t."pdf_file_id", t."pdf_url", t."ledger_row", t."status", t."snapshot_json", t."processed_at", t."note", t."created_at" FROM `invoice_logs` t INNER JOIN `_idmap_invoice_logs` m ON m."old_id" = t."id" LEFT JOIN `_idmap_invoice_documents` im ON im."old_id" = t."invoice_id" LEFT JOIN `_idmap_sph_documents` sm ON sm."old_id" = t."sph_id";--> statement-breakpoint
DROP TABLE `invoice_logs`;--> statement-breakpoint
ALTER TABLE `__new_invoice_logs` RENAME TO `invoice_logs`;--> statement-breakpoint
CREATE INDEX `invoice_logs_sph_no_idx` ON `invoice_logs` (`sph_no`);--> statement-breakpoint
CREATE INDEX `invoice_logs_invoice_no_idx` ON `invoice_logs` (`invoice_no`);--> statement-breakpoint
CREATE INDEX `invoice_logs_status_idx` ON `invoice_logs` (`status`);--> statement-breakpoint
CREATE TABLE `__new_shipment_journeys` (
	`id` text PRIMARY KEY NOT NULL,
	`sph_item_id` text NOT NULL,
	`split_no` integer DEFAULT 1 NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`supply_type` text DEFAULT 'stock' NOT NULL,
	`supplier_id` text,
	`origin` text DEFAULT '' NOT NULL,
	`destination` text DEFAULT '' NOT NULL,
	`latest_status` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_shipment_journeys`("id", "sph_item_id", "split_no", "quantity", "supply_type", "supplier_id", "origin", "destination", "latest_status", "created_at", "updated_at") SELECT m."id", sm."id", t."split_no", t."quantity", t."supply_type", supm."id", t."origin", t."destination", t."latest_status", t."created_at", t."updated_at" FROM `shipment_journeys` t INNER JOIN `_idmap_shipment_journeys` m ON m."old_id" = t."id" INNER JOIN `_idmap_sph_items` sm ON sm."old_id" = t."sph_item_id" LEFT JOIN `_idmap_suppliers` supm ON supm."old_id" = t."supplier_id";--> statement-breakpoint
DROP TABLE `shipment_journeys`;--> statement-breakpoint
ALTER TABLE `__new_shipment_journeys` RENAME TO `shipment_journeys`;--> statement-breakpoint
CREATE INDEX `shipment_journeys_sph_item_idx` ON `shipment_journeys` (`sph_item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shipment_journeys_sph_item_split_idx` ON `shipment_journeys` (`sph_item_id`,`split_no`);--> statement-breakpoint
CREATE INDEX `shipment_journeys_supplier_idx` ON `shipment_journeys` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `__new_sph_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`sph_no` text NOT NULL,
	`yy` text NOT NULL,
	`mm` text NOT NULL,
	`sequence` integer NOT NULL,
	`customer_code` text NOT NULL,
	`customer_id` text,
	`customer_name` text NOT NULL,
	`customer_detail_line_1` text DEFAULT '' NOT NULL,
	`customer_detail_line_2` text DEFAULT '' NOT NULL,
	`customer_detail_line_3` text DEFAULT '' NOT NULL,
	`payment_term` text DEFAULT 'CBD' NOT NULL,
	`franco` text DEFAULT '' NOT NULL,
	`source_fund` text DEFAULT 'MPM' NOT NULL,
	`sph_date` text NOT NULL,
	`delivery_date` text,
	`eta_date` text,
	`payment_due_date` text,
	`additional_info` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`amount_in_words` text DEFAULT '' NOT NULL,
	`static_snapshot_json` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_sph_documents`("id", "sph_no", "yy", "mm", "sequence", "customer_code", "customer_id", "customer_name", "customer_detail_line_1", "customer_detail_line_2", "customer_detail_line_3", "payment_term", "franco", "source_fund", "sph_date", "delivery_date", "eta_date", "payment_due_date", "additional_info", "notes", "total_amount", "amount_in_words", "static_snapshot_json", "status", "created_at", "updated_at") SELECT m."id", t."sph_no", t."yy", t."mm", t."sequence", t."customer_code", cm."id", t."customer_name", t."customer_detail_line_1", t."customer_detail_line_2", t."customer_detail_line_3", t."payment_term", t."franco", t."source_fund", t."sph_date", t."delivery_date", t."eta_date", t."payment_due_date", t."additional_info", t."notes", t."total_amount", t."amount_in_words", t."static_snapshot_json", t."status", t."created_at", t."updated_at" FROM `sph_documents` t INNER JOIN `_idmap_sph_documents` m ON m."old_id" = t."id" LEFT JOIN `_idmap_customers` cm ON cm."old_id" = t."customer_id";--> statement-breakpoint
DROP TABLE `sph_documents`;--> statement-breakpoint
ALTER TABLE `__new_sph_documents` RENAME TO `sph_documents`;--> statement-breakpoint
CREATE UNIQUE INDEX `sph_documents_sph_no_idx` ON `sph_documents` (`sph_no`);--> statement-breakpoint
CREATE INDEX `sph_documents_period_idx` ON `sph_documents` (`yy`,`mm`);--> statement-breakpoint
CREATE INDEX `sph_documents_customer_idx` ON `sph_documents` (`customer_code`);--> statement-breakpoint
CREATE INDEX `sph_documents_status_idx` ON `sph_documents` (`status`);--> statement-breakpoint
CREATE TABLE `__new_sph_items` (
	`id` text PRIMARY KEY NOT NULL,
	`sph_id` text NOT NULL,
	`line_no` integer NOT NULL,
	`part_number` text DEFAULT '' NOT NULL,
	`part_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`uom` text DEFAULT 'pcs' NOT NULL,
	`unit_price` integer NOT NULL,
	`total_price` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_sph_items`("id", "sph_id", "line_no", "part_number", "part_name", "quantity", "uom", "unit_price", "total_price", "created_at", "updated_at") SELECT m."id", sm."id", t."line_no", t."part_number", t."part_name", t."quantity", t."uom", t."unit_price", t."total_price", t."created_at", t."updated_at" FROM `sph_items` t INNER JOIN `_idmap_sph_items` m ON m."old_id" = t."id" INNER JOIN `_idmap_sph_documents` sm ON sm."old_id" = t."sph_id";--> statement-breakpoint
DROP TABLE `sph_items`;--> statement-breakpoint
ALTER TABLE `__new_sph_items` RENAME TO `sph_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `sph_items_sph_line_idx` ON `sph_items` (`sph_id`,`line_no`);--> statement-breakpoint
CREATE INDEX `sph_items_part_number_idx` ON `sph_items` (`part_number`);--> statement-breakpoint
CREATE TABLE `__new_supplier_note_items` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_note_id` text NOT NULL,
	`line_no` integer NOT NULL,
	`part_number` text DEFAULT '' NOT NULL,
	`description` text NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`uom` text DEFAULT 'Pcs' NOT NULL,
	`unit_price` integer DEFAULT 0 NOT NULL,
	`total_price` integer DEFAULT 0 NOT NULL,
	`due_date` text,
	`status` text DEFAULT '' NOT NULL,
	`short_code` text DEFAULT '' NOT NULL,
	`flag` text DEFAULT 'MPM' NOT NULL,
	`source_sheet_row` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_supplier_note_items`("id", "supplier_note_id", "line_no", "part_number", "description", "quantity", "uom", "unit_price", "total_price", "due_date", "status", "short_code", "flag", "source_sheet_row", "created_at", "updated_at") SELECT m."id", nm."id", t."line_no", t."part_number", t."description", t."quantity", t."uom", t."unit_price", t."total_price", t."due_date", t."status", t."short_code", t."flag", t."source_sheet_row", t."created_at", t."updated_at" FROM `supplier_note_items` t INNER JOIN `_idmap_supplier_note_items` m ON m."old_id" = t."id" INNER JOIN `_idmap_supplier_notes` nm ON nm."old_id" = t."supplier_note_id";--> statement-breakpoint
DROP TABLE `supplier_note_items`;--> statement-breakpoint
ALTER TABLE `__new_supplier_note_items` RENAME TO `supplier_note_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_note_items_note_line_idx` ON `supplier_note_items` (`supplier_note_id`,`line_no`);--> statement-breakpoint
CREATE INDEX `supplier_note_items_part_number_idx` ON `supplier_note_items` (`part_number`);--> statement-breakpoint
CREATE INDEX `supplier_note_items_flag_idx` ON `supplier_note_items` (`flag`);--> statement-breakpoint
CREATE TABLE `__new_supplier_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`note_no` text NOT NULL,
	`note_date` text NOT NULL,
	`item_summary` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'Spareparts' NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`payment_status` text DEFAULT 'BELUM BAYAR' NOT NULL,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`remaining_payment` integer DEFAULT 0 NOT NULL,
	`payment_term` text DEFAULT '' NOT NULL,
	`payment_deadline` text,
	`payment_date` text,
	`purchase_purpose` text DEFAULT '' NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`flag` text DEFAULT 'MPM' NOT NULL,
	`source_sheet_row` integer,
	`source_file_name` text DEFAULT '' NOT NULL,
	`source_file_mime_type` text DEFAULT '' NOT NULL,
	`source_file_size` integer DEFAULT 0 NOT NULL,
	`source_file_base64` text DEFAULT '' NOT NULL,
	`source_file_sha256` text DEFAULT '' NOT NULL,
	`extraction_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_supplier_notes`("id", "supplier_id", "note_no", "note_date", "item_summary", "category", "amount", "payment_status", "paid_amount", "remaining_payment", "payment_term", "payment_deadline", "payment_date", "purchase_purpose", "customer_name", "flag", "source_sheet_row", "source_file_name", "source_file_mime_type", "source_file_size", "source_file_base64", "source_file_sha256", "extraction_json", "created_at", "updated_at") SELECT m."id", sm."id", t."note_no", t."note_date", t."item_summary", t."category", t."amount", t."payment_status", t."paid_amount", t."remaining_payment", t."payment_term", t."payment_deadline", t."payment_date", t."purchase_purpose", t."customer_name", t."flag", t."source_sheet_row", t."source_file_name", t."source_file_mime_type", t."source_file_size", t."source_file_base64", t."source_file_sha256", t."extraction_json", t."created_at", t."updated_at" FROM `supplier_notes` t INNER JOIN `_idmap_supplier_notes` m ON m."old_id" = t."id" INNER JOIN `_idmap_suppliers` sm ON sm."old_id" = t."supplier_id";--> statement-breakpoint
DROP TABLE `supplier_notes`;--> statement-breakpoint
ALTER TABLE `__new_supplier_notes` RENAME TO `supplier_notes`;--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_notes_supplier_note_no_idx` ON `supplier_notes` (`supplier_id`,`note_no`);--> statement-breakpoint
CREATE INDEX `supplier_notes_note_date_idx` ON `supplier_notes` (`note_date`);--> statement-breakpoint
CREATE INDEX `supplier_notes_payment_status_idx` ON `supplier_notes` (`payment_status`);--> statement-breakpoint
CREATE INDEX `supplier_notes_payment_deadline_idx` ON `supplier_notes` (`payment_deadline`);--> statement-breakpoint
CREATE INDEX `supplier_notes_flag_idx` ON `supplier_notes` (`flag`);--> statement-breakpoint
CREATE TABLE `__new_suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`supplier_type` text DEFAULT 'Supplier Sparepart' NOT NULL,
	`supplied_items` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`contact_person` text DEFAULT '' NOT NULL,
	`account_type` text DEFAULT '' NOT NULL,
	`account_number` text DEFAULT '' NOT NULL,
	`account_name` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`default_payment_term` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_suppliers`("id", "name", "normalized_name", "supplier_type", "supplied_items", "phone", "contact_person", "account_type", "account_number", "account_name", "address", "default_payment_term", "created_at", "updated_at") SELECT m."id", t."name", t."normalized_name", t."supplier_type", t."supplied_items", t."phone", t."contact_person", t."account_type", t."account_number", t."account_name", t."address", t."default_payment_term", t."created_at", t."updated_at" FROM `suppliers` t INNER JOIN `_idmap_suppliers` m ON m."old_id" = t."id";--> statement-breakpoint
DROP TABLE `suppliers`;--> statement-breakpoint
ALTER TABLE `__new_suppliers` RENAME TO `suppliers`;--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_normalized_name_idx` ON `suppliers` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `suppliers_name_idx` ON `suppliers` (`name`);--> statement-breakpoint
CREATE TABLE `__new_ttb_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`ttb_no` text NOT NULL,
	`sph_id` text NOT NULL,
	`po_no` text DEFAULT '-' NOT NULL,
	`ttb_date` text NOT NULL,
	`handover_text` text DEFAULT '' NOT NULL,
	`sender_name` text DEFAULT 'PT Morowali Putra Mandiri' NOT NULL,
	`sender_role` text DEFAULT 'Admin Logistik MPM' NOT NULL,
	`receiver_name` text DEFAULT '' NOT NULL,
	`receiver_company` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_ttb_documents`("id", "ttb_no", "sph_id", "po_no", "ttb_date", "handover_text", "sender_name", "sender_role", "receiver_name", "receiver_company", "status", "created_at", "updated_at") SELECT m."id", t."ttb_no", sm."id", t."po_no", t."ttb_date", t."handover_text", t."sender_name", t."sender_role", t."receiver_name", t."receiver_company", t."status", t."created_at", t."updated_at" FROM `ttb_documents` t INNER JOIN `_idmap_ttb_documents` m ON m."old_id" = t."id" INNER JOIN `_idmap_sph_documents` sm ON sm."old_id" = t."sph_id";--> statement-breakpoint
DROP TABLE `ttb_documents`;--> statement-breakpoint
ALTER TABLE `__new_ttb_documents` RENAME TO `ttb_documents`;--> statement-breakpoint
CREATE UNIQUE INDEX `ttb_documents_ttb_no_idx` ON `ttb_documents` (`ttb_no`);--> statement-breakpoint
CREATE INDEX `ttb_documents_sph_idx` ON `ttb_documents` (`sph_id`);--> statement-breakpoint
CREATE INDEX `ttb_documents_status_idx` ON `ttb_documents` (`status`);--> statement-breakpoint
CREATE TABLE `__new_ttb_items` (
	`id` text PRIMARY KEY NOT NULL,
	`ttb_id` text NOT NULL,
	`sph_item_id` text,
	`line_no` integer NOT NULL,
	`part_number` text DEFAULT '' NOT NULL,
	`part_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`uom` text DEFAULT 'pcs' NOT NULL,
	`is_checked` integer DEFAULT false NOT NULL,
	`checked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_ttb_items`("id", "ttb_id", "sph_item_id", "line_no", "part_number", "part_name", "quantity", "uom", "is_checked", "checked_at", "created_at", "updated_at") SELECT m."id", tm."id", sm."id", t."line_no", t."part_number", t."part_name", t."quantity", t."uom", t."is_checked", t."checked_at", t."created_at", t."updated_at" FROM `ttb_items` t INNER JOIN `_idmap_ttb_items` m ON m."old_id" = t."id" INNER JOIN `_idmap_ttb_documents` tm ON tm."old_id" = t."ttb_id" LEFT JOIN `_idmap_sph_items` sm ON sm."old_id" = t."sph_item_id";--> statement-breakpoint
DROP TABLE `ttb_items`;--> statement-breakpoint
ALTER TABLE `__new_ttb_items` RENAME TO `ttb_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `ttb_items_ttb_line_idx` ON `ttb_items` (`ttb_id`,`line_no`);--> statement-breakpoint
CREATE INDEX `ttb_items_sph_item_idx` ON `ttb_items` (`sph_item_id`);--> statement-breakpoint
DROP TABLE `_idmap_customers`;--> statement-breakpoint
DROP TABLE `_idmap_invoice_documents`;--> statement-breakpoint
DROP TABLE `_idmap_invoice_items`;--> statement-breakpoint
DROP TABLE `_idmap_invoice_logs`;--> statement-breakpoint
DROP TABLE `_idmap_shipment_journeys`;--> statement-breakpoint
DROP TABLE `_idmap_sph_documents`;--> statement-breakpoint
DROP TABLE `_idmap_sph_items`;--> statement-breakpoint
DROP TABLE `_idmap_supplier_note_items`;--> statement-breakpoint
DROP TABLE `_idmap_supplier_notes`;--> statement-breakpoint
DROP TABLE `_idmap_suppliers`;--> statement-breakpoint
DROP TABLE `_idmap_ttb_documents`;--> statement-breakpoint
DROP TABLE `_idmap_ttb_items`;--> statement-breakpoint
COMMIT;--> statement-breakpoint
PRAGMA foreign_keys=ON;
