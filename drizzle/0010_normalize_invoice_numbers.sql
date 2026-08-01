UPDATE `invoice_documents`
SET `invoice_no` = 'INV' || substr(`invoice_no`, 4)
WHERE `invoice_no` LIKE 'SPH%';
