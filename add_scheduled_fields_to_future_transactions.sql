BEGIN;

ALTER TABLE future_transactions
  ADD COLUMN IF NOT EXISTS is_scheduled boolean NOT NULL DEFAULT false;

ALTER TABLE future_transactions
  ADD COLUMN IF NOT EXISTS due_date timestamptz;

UPDATE future_transactions
SET due_date = COALESCE(due_date, expected_date);

COMMIT;
