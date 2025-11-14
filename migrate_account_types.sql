-- Migração dos tipos de conta de 'pessoal'/'empresa' para 'pf'/'pj'/'mei'
-- Execute este script no Supabase SQL Editor

BEGIN;

-- Atualizar contas do tipo 'pessoal' para 'pf' (Pessoa Física)
UPDATE accounts
SET type = 'pf'
WHERE type = 'pessoal';

-- Atualizar contas do tipo 'empresa' para 'pj' (Pessoa Jurídica)
-- Nota: contas MEI precisarão ser convertidas manualmente pelos usuários Premium
UPDATE accounts
SET type = 'pj'
WHERE type = 'empresa';

-- Verificar os resultados
SELECT type, COUNT(*) as total
FROM accounts
GROUP BY type
ORDER BY type;

COMMIT;

-- Após executar, você deverá ver apenas tipos: 'pf', 'pj', 'mei'
-- Se houver erros, execute ROLLBACK; para reverter as mudanças
