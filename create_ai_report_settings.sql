BEGIN;

CREATE TABLE IF NOT EXISTS ai_report_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  focus_economy boolean NOT NULL DEFAULT false,
  focus_debt boolean NOT NULL DEFAULT false,
  focus_investments boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMIT;
