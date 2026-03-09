# 🚀 Guia de Configuração do Supabase - FinScope

## Status Atual

✅ **Concluído:**
- Pacote `@supabase/supabase-js` instalado
- Credenciais do Supabase adicionadas como Replit Secrets
- Cliente Supabase configurado (`server/supabase.ts`)
- Implementação `SupabaseStorage` criada (`server/supabaseStorage.ts`)
- Storage migrado para usar Supabase em vez de memória

## 📋 Próximos Passos

### Passo 1: Criar as Tabelas no Supabase

1. Acesse o **Supabase SQL Editor**:
   - URL: https://tiwlisugjwlmctbmfedx.supabase.co/project/_/sql

2. Clique em **"New query"** (Nova consulta)

3. Copie todo o conteúdo do arquivo `setup-database.sql` (localizado na raiz do projeto)

4. Cole no editor SQL e clique em **"Run"** (Executar)

5. Você verá mensagens de sucesso confirmando que as tabelas foram criadas:
   - ✓ users
   - ✓ accounts
   - ✓ transactions
   - ✓ rules

### Passo 2: Verificar as Tabelas

Após executar o SQL, verifique se as tabelas foram criadas:

1. No Supabase, vá para **Table Editor** (Editor de Tabelas)
2. Você deve ver 4 tabelas:
   - `users`
   - `accounts`
   - `transactions`
   - `rules`

### Passo 3: Testar a Aplicação

A aplicação já está configurada para usar o Supabase! 

**O que mudou:**
- ✅ Dados agora são persistidos no PostgreSQL (não mais em memória)
- ✅ Dados sobrevivem a reinicializações do servidor
- ✅ Row Level Security (RLS) ativado para segurança
- ✅ Índices criados para melhor performance

**Teste o fluxo completo:**

1. **Signup** - Criar nova conta → Dados salvos no Supabase
2. **Login** - Entrar com credenciais → Sessão autenticada
3. **Criar conta financeira** → Persistido na tabela `accounts`
4. **Adicionar transação** → Persistido na tabela `transactions`
5. **Ver dashboard** → Métricas calculadas a partir do banco real

## 🔐 Segurança

**Row Level Security (RLS) está ATIVADO:**
- Usuários só podem ver/editar seus próprios dados
- Políticas RLS criadas para todas as tabelas
- Autenticação baseada em sessões do Express

## 🛠️ Arquitetura Técnica

**Backend:**
- `server/supabase.ts` - Cliente Supabase com service role key
- `server/supabaseStorage.ts` - Implementação IStorage usando Supabase
- `server/storage.ts` - Exporta SupabaseStorage (antes era MemStorage)

**Banco de Dados:**
- PostgreSQL gerenciado pelo Supabase
- 4 tabelas principais + índices
- RLS para segurança de dados

**Fluxo de Dados:**
```
Frontend (React)
    ↓
API Routes (Express)
    ↓
Storage Interface (IStorage)
    ↓
SupabaseStorage
    ↓
Supabase PostgreSQL
```

## 🎯 Benefícios da Migração

**Antes (MemStorage):**
- ❌ Dados perdidos ao reiniciar servidor
- ❌ Sem persistência real
- ❌ Limitado para testes

**Depois (Supabase):**
- ✅ Persistência real de dados
- ✅ Banco de dados profissional (PostgreSQL)
- ✅ Escalável para produção
- ✅ Backups automáticos
- ✅ Row Level Security
- ✅ Performance otimizada com índices

## 📊 Estrutura das Tabelas

### users
- `id` (UUID, PK)
- `email` (UNIQUE)
- `password` (hash bcrypt)
- `full_name`
- `plan` (free/pro/premium)
- `trial_start`, `trial_end`
- `created_at`

### accounts
- `id` (UUID, PK)
- `user_id` (FK → users)
- `name`
- `type` (pessoal/empresa)
- `initial_balance` (DECIMAL)
- `created_at`

### transactions
- `id` (UUID, PK)
- `user_id` (FK → users)
- `account_id` (FK → accounts)
- `description`
- `type` (entrada/saida)
- `amount` (DECIMAL)
- `category`
- `date`
- `auto_rule_applied` (BOOLEAN)
- `created_at`

### rules
- `id` (UUID, PK)
- `user_id` (FK → users)
- `rule_name`
- `contains` (palavra-chave)
- `category_result`
- `is_active`
- `created_at`

## ✅ Checklist de Verificação

Após configurar, verifique:

- [ ] Tabelas criadas no Supabase
- [ ] RLS ativado em todas as tabelas
- [ ] Índices criados
- [ ] Signup funciona e salva usuário
- [ ] Login funciona com credenciais
- [ ] Criar conta financeira persiste dados
- [ ] Adicionar transação persiste dados
- [ ] Dashboard mostra métricas corretas
- [ ] Logout funciona
- [ ] Dados permanecem após reiniciar servidor

## 🆘 Solução de Problemas

**Erro: "Missing Supabase environment variables"**
- Verifique se os secrets estão configurados no Replit

**Erro ao criar tabelas:**
- Confirme que você copiou TODO o conteúdo de `setup-database.sql`
- Execute novamente (comandos `CREATE TABLE IF NOT EXISTS` são seguros)

**Dados não aparecem:**
- Verifique se as tabelas foram criadas
- Confirme que não há erros no console do servidor
- Verifique se o RLS foi configurado corretamente

## 🎉 Sucesso!

Se você seguiu todos os passos, sua aplicação FinScope agora está usando um banco de dados real e profissional! 🚀

Os dados agora são persistentes e a aplicação está pronta para crescer.
