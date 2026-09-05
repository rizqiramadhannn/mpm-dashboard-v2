UPDATE `payment_requests`
SET `source_fund` = CASE
  WHEN `source_fund` IN ('BCA MP', 'BCA MPN')
    THEN 'BCA MPM'
  WHEN `source_fund` IN (
    'DANA JAGO',
    'DANA JAGO MPM',
    'DANA MPM JAGO',
    'JAGO AJM',
    'JAGO PACKET ONGKIR',
    'JAGO POCKET ONGKIR',
    'JAGO POCKET SUPPLIER',
    'Jago ongkir',
    'Jago pocket AJM',
    'Jago pocket ongkir',
    'Jago poket ongkir',
    'PETTY CASH MPM',
    'POCKET JAGO PATTY CASH',
    'POKET ONGKIR',
    'Pocket Jago AJM',
    'pocket jago ongkir'
  ) THEN 'JAGO DANA MPM'
  WHEN `source_fund` IN ('JAGO OPERASIONAL AGUSTUS', 'JAGO POCKET GAJI')
    THEN 'JAGO OPERASIONAL MPM'
  ELSE `source_fund`
END
WHERE `source_fund` NOT IN (
  'BCA MPM',
  'JAGO DANA MPM',
  'JAGO OPERASIONAL MPM',
  'BCA GUNTUR'
);--> statement-breakpoint
DELETE FROM `payment_requests`
WHERE `id` = 'id_a91182118d7c462dad045a2320675e4d'
  AND `source_fund` = 'BCA GUNTUR'
  AND `amount` = 600000
  AND `request_date` = '2026-08-01';
