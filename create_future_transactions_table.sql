BEGIN;

CREATE TABLE IF NOT EXISTS future_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  expected_date timestamptz NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('PF','PJ')),
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'received')) DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_future_transactions_user_date
  ON future_transactions (user_id, expected_date DESC);

COMMIT;
