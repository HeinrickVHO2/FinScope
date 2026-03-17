import assert from "node:assert/strict";
import test from "node:test";
import { parseAssistantRouteIntent } from "./intentRouter";

test("parseAssistantRouteIntent identifica meta, aporte e lembrete", () => {
  const createGoal = parseAssistantRouteIntent("Crie uma meta para iPhone 16, preciso de 5399");
  assert.deepEqual(createGoal, {
    type: "create_goal",
    title: "iPhone 16",
    targetValue: 5399,
  });

  const contribution = parseAssistantRouteIntent("Ja guardei 500 hoje");
  assert.deepEqual(contribution, {
    type: "add_goal_contribution",
    amount: 500,
  });

  const reminder = parseAssistantRouteIntent("Boleto do carro todo dia 12, R$ 1300");
  assert.deepEqual(reminder, {
    type: "create_reminder",
    title: "Boleto do carro",
    amount: 1300,
    dayOfMonth: 12,
  });
});

test("parseAssistantRouteIntent identifica resumo, categoria dominante e limites", () => {
  assert.deepEqual(parseAssistantRouteIntent("quanto eu gastei nos ultimos dias?"), {
    type: "summary",
    periodKey: "last_7_days",
    focus: "general",
  });

  assert.deepEqual(parseAssistantRouteIntent("onde eu gastei mais essa semana?"), {
    type: "summary",
    periodKey: "current_week",
    focus: "top_category",
  });

  assert.deepEqual(parseAssistantRouteIntent("como estao meus limites de gastos?"), {
    type: "limits_status",
  });

  assert.deepEqual(parseAssistantRouteIntent("como estao meus investimentos?"), {
    type: "investments_summary",
  });
});

test("parseAssistantRouteIntent identifica alternancia entre metas e investimentos", () => {
  assert.deepEqual(parseAssistantRouteIntent("abrir metas"), {
    type: "switch_financial_view",
    view: "goals",
  });

  assert.deepEqual(parseAssistantRouteIntent("ir para investimentos"), {
    type: "switch_financial_view",
    view: "investments",
  });
});
