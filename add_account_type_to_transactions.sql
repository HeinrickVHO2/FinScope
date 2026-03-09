-- Add account_type column to transactions and initialize data
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'PF';

UPDATE transactions
SET account_type = 'PF'
WHERE account_type IS NULL OR account_type = '';

-- Minimal business profile table
CREATE TABLE IF NOT EXISTS business_profile (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cnpj text,
  business_type text CHECK (business_type IN ('mei', 'empresa')),
  created_at timestamptz NOT NULL DEFAULT NOW()
);
