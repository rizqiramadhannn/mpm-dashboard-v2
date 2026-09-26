UPDATE `finance_records`
SET `finance_category` = 'Stock'
WHERE `finance_category` = 'Stock & Penjualan';
--> statement-breakpoint
UPDATE `finance_category_overrides`
SET `finance_category` = 'Stock'
WHERE `finance_category` = 'Stock & Penjualan';
