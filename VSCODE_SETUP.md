# Configuração do Projeto FinScope no VS Code Local

## 1. Clone o Projeto
Se ainda não clonou, use o Git para baixar o projeto do Replit. :)

## 2. Instale as Dependências
```bash
npm install
```

## 3. Configure as Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto com:

```env
# Supabase (copie do Replit Secrets)
SUPABASE_URL=sua_url_do_supabase
SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key

# Session (gere uma string aleatória)
SESSION_SECRET=cole_o_mesmo_do_replit_ou_gere_um_novo
```

**Importante:** Não commite o arquivo `.env` no Git!

## 4. Rode o Projeto Localmente
```bash
npm run dev
```

Isso vai iniciar:
- Backend (Express) na porta 5000
- Frontend (Vite) também na porta 5000 (proxy configurado)

Acesse: http://localhost:5000

## 5. Sincronizar Schema do Banco (Opcional)
Se precisar sincronizar as tabelas:
```bash
npm run db:push
```

## 6. Extensões Recomendadas do VS Code
- **ESLint** - Linting de código
- **Prettier** - Formatação automática
- **Tailwind CSS IntelliSense** - Autocomplete para Tailwind
- **ES7+ React/Redux/React-Native snippets** - Snippets úteis

## 7. Onde Pegar as Secrets do Replit
No Replit:
1. Clique no ícone de cadeado (🔒) na barra lateral esquerda
2. Copie os valores de:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_SECRET`

## 8. Estrutura do Projeto
```
FinScope/
├── client/                 # Frontend React + Vite
│   └── src/
│       ├── pages/         # Dashboard, Contas, Transações, Investimentos
│       ├── components/    # Componentes reutilizáveis (shadcn/ui)
│       ├── lib/          # Utilitários (queryClient, etc)
│       └── hooks/        # Custom hooks
├── server/                # Backend Express
│   ├── routes.ts         # Todos os endpoints da API
│   ├── supabase.ts       # Cliente Supabase
│   ├── supabaseStorage.ts # Camada de persistência
│   └── index.ts          # Servidor Express
├── shared/               # Código compartilhado
│   └── schema.ts         # Schemas Drizzle + Zod
└── package.json
```

## 9. Scripts Disponíveis

```bash
npm run dev          # Roda dev server (frontend + backend)
npm run build        # Build para produção
npm run db:push      # Sincroniza schema com Supabase
```

## Problemas Comuns

### Porta 5000 em uso
```bash
# No Mac/Linux
lsof -ti:5000 | xargs kill -9

# No Windows (PowerShell como Admin)
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process
```

### Erro de conexão com Supabase
- Verifique se as variáveis de ambiente estão corretas (`.env`)
- Confirme se o IP do seu computador está permitido no Supabase:
  1. Vá em Settings > Database no painel do Supabase
  2. Em "Connection Pooling", adicione seu IP ou use `0.0.0.0/0` (menos seguro)

### Tabelas não aparecem
Se as tabelas não aparecerem após `npm run db:push`:
1. Vá no SQL Editor do Supabase
2. Execute: `NOTIFY pgrst, 'reload schema';`
3. Isso recarrega o cache do PostgREST

## Desenvolvendo

### Adicionar nova página
1. Crie o arquivo em `client/src/pages/MinhaPage.tsx`
2. Registre a rota em `client/src/App.tsx`
3. Adicione item no sidebar em `client/src/components/app-sidebar.tsx`

### Adicionar novo endpoint
1. Defina o schema em `shared/schema.ts` (Drizzle + Zod)
2. Adicione método no storage em `server/supabaseStorage.ts`
3. Crie a rota em `server/routes.ts`

### Usar componentes UI
```tsx
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
```

Todos os componentes seguem o padrão shadcn/ui.

## Dica: Hot Reload
O projeto usa Vite com HMR (Hot Module Replacement). Qualquer mudança em arquivos `.tsx` ou `.ts` recarrega automaticamente sem perder o estado!

---

**Pronto para desenvolver! 🚀**
