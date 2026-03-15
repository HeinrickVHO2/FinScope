BEGIN;

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_source_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual', 'ai', 'statement_import', 'whatsapp_agent'));

UPDATE transactions
SET source = 'manual'
WHERE source IS NULL
   OR source NOT IN ('manual', 'ai', 'statement_import', 'whatsapp_agent');

COMMIT;
