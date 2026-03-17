# Agent Orchestrator Refactor

## Arquitetura encontrada

Antes da expansao, a base estava dividida em tres polos:

- `server/modules/whatsapp-agent/*` para parser, webhook, OCR e persistencia do WhatsApp.
- `ai/*` para o assistente interno e execucao de acoes com OpenAI.
- `server/routes.ts` concentrando contratos REST e parte da logica de dominio.

Os principais riscos de regressao eram:

- inteligencia duplicada entre canais;
- categorizacao espalhada e caindo cedo em `Outros`;
- metas sem menu proprio nem dominio desacoplado;
- responsabilidades excessivas em `server/routes.ts`.

## Refatoracao aplicada

Sem mudar a estrutura de pastas existente, a camada compartilhada ficou em `server/modules/shared/`:

- `expenseClassifier.ts`
- `financialSummaryService.ts`
- `intentRouter.ts`
- `goalService.ts`
- `categoryLimitService.ts`
- `assistantOrchestrator.ts`

Fluxo:

1. A mensagem chega pelo WhatsApp ou chat interno.
2. O `AssistantOrchestrator` tenta resolver intencoes deterministicas primeiro.
3. Se nao houver match:
   - WhatsApp segue para o fluxo transacional atual.
   - Chat interno segue para o fluxo atual com OpenAI.

## Categorizacao

Toda nova despesa com categoria vazia ou generica agora passa por:

- regras do usuario;
- palavras-chave e merchant hints;
- historico do proprio usuario;
- fallback real em `Outros` apenas quando nao houver confianca suficiente.

Integracao aplicada em:

- `server/storage.ts`
- `server/supabaseStorage.ts`
- `server/modules/whatsapp-agent/*`
- `server/modules/statement-import/service.ts`
- `ai/agentActionsHandler.ts`

## Metas

Foi adicionada uma experiencia propria de metas com:

- rota `/goals`;
- item `Metas` no menu;
- alternancia visual entre `Investimentos` e `Metas`;
- criacao, edicao, aporte, conclusao e arquivamento.

## Contratos adicionados

- `GET /api/goals`
- `POST /api/goals`
- `PATCH /api/goals/:id`
- `POST /api/goals/:id/contributions`
- `GET /api/goals/:id/contributions`
- `POST /api/goals/:id/archive`
- `POST /api/goals/:id/complete`
- `GET /api/category-limits`
- `POST /api/category-limits`

Os contratos antigos foram preservados.

## SQL

Rodar:

- `docs/migrations/2026-03-17-agent-orchestrator.sql`

## Validacao recomendada

- `quanto eu gastei nos ultimos dias?`
- `onde eu gastei mais essa semana?`
- `como estao meus limites de gastos?`
- `crie uma meta para iPhone 16, preciso de 5399`
- `ja guardei 500 hoje`
- `boleto do carro todo dia 12, R$ 1300`
- `paguei ja`
- `Uber 32`, `iFood 48`, `camisa 110`, `farmacia 67`
