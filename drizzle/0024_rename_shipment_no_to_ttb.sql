UPDATE `shipments`
SET `shipment_no` = 'TTB' || substr(`shipment_no`, 4)
WHERE `shipment_no` LIKE 'KRM%';
