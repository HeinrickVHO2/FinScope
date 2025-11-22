BEGIN;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_source_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_source_check CHECK (source IN ('manual', 'ai'));

UPDATE transactions
SET source = 'manual'
WHERE source IS NULL OR source NOT IN ('manual', 'ai');

COMMIT;
