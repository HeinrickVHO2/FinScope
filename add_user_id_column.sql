-- Add missing user_id column to investment_transactions table
ALTER TABLE investment_transactions 
ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_investment_transactions_user_id ON investment_transactions(user_id);

-- Reload PostgREST schema cache after DDL change
SELECT reload_postgrest_schema();
