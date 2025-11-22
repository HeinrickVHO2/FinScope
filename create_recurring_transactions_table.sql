BEGIN;

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('monthly', 'weekly')),
  next_date timestamptz NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('PF','PJ')),
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_transactions_user_next
  ON recurring_transactions (user_id, next_date DESC);

COMMIT;
