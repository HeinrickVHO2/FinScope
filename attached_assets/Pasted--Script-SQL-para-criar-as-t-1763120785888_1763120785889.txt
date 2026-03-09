-- ===================================================================
-- Script SQL para criar as tabelas de investimentos no Supabase
-- IMPORTANTE: Execute este script no SQL Editor do Supabase
-- ===================================================================

-- 1. Deletar tabelas existentes se houver (para recriar do zero)
DROP TABLE IF EXISTS investment_transactions CASCADE;
DROP TABLE IF EXISTS investment_goals CASCADE;
DROP TABLE IF EXISTS investments CASCADE;

-- 2. Tabela de investimentos
CREATE TABLE investments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('reserva-emergencia', 'cdb', 'renda-fixa', 'renda-variavel')),
  current_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Tabela de metas de investimento
CREATE TABLE investment_goals (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR NOT NULL,
  investment_id VARCHAR NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  target_amount NUMERIC(10, 2) NOT NULL,
  target_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Tabela de transações de investimento
CREATE TABLE investment_transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR NOT NULL,
  investment_id VARCHAR NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  source_account_id VARCHAR NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount NUMERIC(10, 2) NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Criar índices para melhor performance
CREATE INDEX idx_investments_user_id ON investments(user_id);
CREATE INDEX idx_investment_goals_investment_id ON investment_goals(investment_id);
CREATE INDEX idx_investment_goals_user_id ON investment_goals(user_id);
CREATE INDEX idx_investment_transactions_investment_id ON investment_transactions(investment_id);
CREATE INDEX idx_investment_transactions_account_id ON investment_transactions(source_account_id);
CREATE INDEX idx_investment_transactions_user_id ON investment_transactions(user_id);
CREATE INDEX idx_investment_transactions_date ON investment_transactions(date);

-- 6. CRÍTICO: Recarregar o schema cache do PostgREST
-- Sem isso, a API não enxerga as novas tabelas!
NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Pronto! As tabelas foram criadas.
-- Verifique se funcionou executando:
-- SELECT * FROM investments;
-- ===================================================================
