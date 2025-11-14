-- Migração dos tipos de conta de 'pessoal'/'empresa' para 'pf'/'pj'/'mei'
-- Execute este script no Supabase SQL Editor

BEGIN;

-- 1. Remover a constraint antiga
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;

-- 2. Criar nova constraint com os novos valores
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check 
  CHECK (type IN ('pf', 'pj', 'mei', 'pessoal', 'empresa'));

-- 3. Atualizar contas do tipo 'pessoal' para 'pf' (Pessoa Física)
UPDATE accounts
SET type = 'pf'
WHERE type = 'pessoal';

-- 4. Atualizar contas do tipo 'empresa' para 'pj' (Pessoa Jurídica)
UPDATE accounts
SET type = 'pj'
WHERE type = 'empresa';

-- 5. Remover valores antigos da constraint (agora que os dados foram migrados)
ALTER TABLE accounts DROP CONSTRAINT accounts_type_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check 
  CHECK (type IN ('pf', 'pj', 'mei'));

-- 6. Verificar os resultados
SELECT type, COUNT(*) as total
FROM accounts
GROUP BY type
ORDER BY type;

COMMIT;

-- Após executar, você deverá ver apenas tipos: 'pf', 'pj', 'mei'
-- Se houver erros, execute ROLLBACK; para reverter as mudanças
