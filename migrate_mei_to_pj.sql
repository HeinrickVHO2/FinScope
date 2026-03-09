-- Consolidação dos tipos de conta PF/PJ com backup dos dados MEI
BEGIN;

-- Backup de contas MEI existentes
CREATE TABLE IF NOT EXISTS mei_accounts_backup AS
SELECT *, NOW()::timestamptz AS backup_at FROM accounts WHERE false;

ALTER TABLE mei_accounts_backup
  ADD COLUMN IF NOT EXISTS backup_at timestamptz DEFAULT NOW();

-- Garante colunas recém-adicionadas
ALTER TABLE mei_accounts_backup
  ADD COLUMN IF NOT EXISTS business_category text;

INSERT INTO mei_accounts_backup
  (id, user_id, name, type, business_category, initial_balance, created_at, backup_at)
SELECT 
  a.id,
  a.user_id,
  a.name,
  a.type,
  a.business_category,
  a.initial_balance,
  a.created_at,
  NOW()::timestamptz AS backup_at
FROM accounts a
WHERE a.type = 'mei';

-- Backup das transações vinculadas às contas MEI
CREATE TABLE IF NOT EXISTS mei_transactions_backup AS
SELECT *, NOW()::timestamptz AS backup_at FROM transactions WHERE false;

ALTER TABLE mei_transactions_backup
  ADD COLUMN IF NOT EXISTS backup_at timestamptz DEFAULT NOW();

INSERT INTO mei_transactions_backup
  (id, user_id, account_id, description, type, amount, category, date, auto_rule_applied, created_at, backup_at)
SELECT 
  t.id,
  t.user_id,
  t.account_id,
  t.description,
  t.type,
  t.amount,
  t.category,
  t.date,
  t.auto_rule_applied,
  t.created_at,
  NOW()::timestamptz AS backup_at
FROM transactions t
WHERE t.account_id IN (
  SELECT id FROM accounts WHERE type = 'mei'
);

-- Adiciona coluna de categoria empresarial para consolidar MEI em PJ
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS business_category text;

UPDATE accounts
SET business_category = 'mei'
WHERE type = 'mei';

-- Converte tipos MEI para PJ antes de criar a constraint
UPDATE accounts
SET type = 'pj'
WHERE type = 'mei';

-- Atualiza constraint para permitir apenas PF/PJ
ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_type_check;

ALTER TABLE accounts
  ADD CONSTRAINT accounts_type_check CHECK (type IN ('pf', 'pj'));

COMMIT;
