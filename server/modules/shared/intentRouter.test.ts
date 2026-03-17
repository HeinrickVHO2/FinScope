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

  const naturalGoal = parseAssistantRouteIntent("Quero guardar dinheiro para comprar um Iphone no valor de 5760 reais");
  assert.deepEqual(naturalGoal, {
    type: "create_goal",
    title: "Iphone",
    targetValue: 5760,
  });

  const goalWithInitialAmount = parseAssistantRouteIntent("Quero juntar dinheiro para comprar uma moto de 13.500 reais. Ja tenho 3 mil guardado");
  assert.deepEqual(goalWithInitialAmount, {
    type: "create_goal",
    title: "moto",
    targetValue: 13500,
    initialContribution: 3000,
  });

  const goalWithCommaThousands = parseAssistantRouteIntent("Quero juntar dinheiro para comprar um playstation 5 no valor de 3,700 reais. Ja juntei 850.");
  assert.deepEqual(goalWithCommaThousands, {
    type: "create_goal",
    title: "playstation 5",
    targetValue: 3700,
    initialContribution: 850,
  });

  const debtGoal = parseAssistantRouteIntent("Quero pagar uma divida de 17 mil. Ja juntei 4,200 reais");
  assert.deepEqual(debtGoal, {
    type: "create_goal",
    title: "divida",
    targetValue: 17000,
    initialContribution: 4200,
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

  assert.deepEqual(parseAssistantRouteIntent("me mostra a divisao dos meus gastos"), {
    type: "summary",
    periodKey: "current_month",
    focus: "category_breakdown",
  });

  assert.deepEqual(parseAssistantRouteIntent("gere um grafico dos meus ultimos 7 dias"), {
    type: "summary",
    periodKey: "last_7_days",
    focus: "general",
  });

  assert.deepEqual(parseAssistantRouteIntent("por que meus gastos aumentaram?"), {
    type: "summary",
    periodKey: "current_month",
    focus: "increase_reason",
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
