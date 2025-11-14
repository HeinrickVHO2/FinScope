-- Script SQL para criar as tabelas de investimentos manualmente no Supabase

-- 1. Tabela de investimentos
CREATE TABLE IF NOT EXISTS investments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('reserva-emergencia', 'cdb', 'renda-fixa', 'renda-variavel')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de metas de investimento
CREATE TABLE IF NOT EXISTS investment_goals (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  investment_id VARCHAR NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  target_amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de transações de investimento
CREATE TABLE IF NOT EXISTS investment_transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  investment_id VARCHAR NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  source_account_id VARCHAR NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount NUMERIC(10, 2) NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_goals_investment_id ON investment_goals(investment_id);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_investment_id ON investment_transactions(investment_id);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_account_id ON investment_transactions(source_account_id);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_date ON investment_transactions(date);

-- Recarregar o schema cache do PostgREST (IMPORTANTE!)
NOTIFY pgrst, 'reload schema';
