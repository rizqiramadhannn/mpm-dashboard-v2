ALTER TABLE `shipment_journeys` ADD `customer_received` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `shipment_journeys` ADD `customer_received_at` text;
--> statement-breakpoint
UPDATE `shipment_journeys`
SET `customer_received` = true,
    `customer_received_at` = COALESCE(`updated_at`, CURRENT_TIMESTAMP),
    `latest_status` = 'TERKIRIM'
WHERE lower(trim(`latest_status`)) IN ('arrived', 'delivered', 'done', 'received', 'selesai', 'terkirim');
--> statement-breakpoint
UPDATE `sph_documents`
SET `status` = CASE
  WHEN `status` = 'draft' THEN 'cek_harga'
  WHEN `status` IN ('pending_invoice', 'invoiced') THEN 'menunggu_pengiriman'
  WHEN `status` = 'cancelled' THEN 'cancel'
  ELSE `status`
END;
