BEGIN;

CREATE TABLE IF NOT EXISTS user_report_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  focus_saving boolean NOT NULL DEFAULT false,
  focus_debts boolean NOT NULL DEFAULT false,
  focus_investments boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_report_preferences_user
  ON user_report_preferences (user_id);

COMMIT;
