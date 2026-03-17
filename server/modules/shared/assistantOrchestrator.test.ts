import assert from "node:assert/strict";
import test from "node:test";
import { AssistantOrchestrator } from "./assistantOrchestrator";
import { CategoryLimitService } from "./categoryLimitService";
import { GoalService } from "./goalService";

function buildFakeStorage() {
  const reminders: any[] = [];

  return {
    reminders,
    async getTransactionsByUserId() {
      return [
        {
          id: "tx-1",
          userId: "user-1",
          accountId: "acc-1",
          description: "Mercado do bairro",
          type: "saida",
          amount: "250.00",
          category: "Mercado",
          date: new Date(),
          accountType: "PF",
          autoRuleApplied: false,
          source: "manual",
          createdAt: new Date(),
        },
        {
          id: "tx-2",
          userId: "user-1",
          accountId: "acc-1",
          description: "Uber",
          type: "saida",
          amount: "80.00",
          category: "Transporte",
          date: new Date(),
          accountType: "PF",
          autoRuleApplied: false,
          source: "manual",
          createdAt: new Date(),
        },
      ];
    },
    async createFutureExpense(payload: any) {
      const record = { id: `reminder-${reminders.length + 1}`, createdAt: new Date(), ...payload };
      reminders.push(record);
      return record;
    },
    async getFutureExpenses() {
      return reminders;
    },
    async updateFutureExpenseStatus(id: string, userId: string, status: string) {
      const reminder = reminders.find((item) => item.id === id && item.userId === userId);
      if (!reminder) return undefined;
      reminder.status = status;
      return reminder;
    },
    async getInvestmentsSummary() {
      return {
        totalInvested: 4200,
        byType: [
          { type: "cdb", amount: 2500, goal: 3000 },
          { type: "reserva_emergencia", amount: 1700, goal: 5000 },
        ],
      };
    },
  };
}

function patchMethod<T extends object, K extends keyof T>(target: T, key: K, replacement: T[K]) {
  const original = target[key];
  target[key] = replacement;
  return () => {
    target[key] = original;
  };
}

test("AssistantOrchestrator responde resumo e status de limites", async () => {
  const restoreListByUser = patchMethod(
    CategoryLimitService.prototype,
    "listByUser",
    (async () => [
      {
        id: "limit-1",
        userId: "user-1",
        category: "Mercado",
        scope: "ALL",
        period: "monthly",
        amount: "400.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]) as CategoryLimitService["listByUser"],
  );

  const restoreBuildStatus = patchMethod(
    CategoryLimitService.prototype,
    "buildStatus",
    (async () => [
      {
        category: "Mercado",
        spent: 250,
        limit: 400,
        remaining: 150,
        utilization: 0.625,
        status: "ok" as const,
      },
    ]) as CategoryLimitService["buildStatus"],
  );

  try {
    const orchestrator = new AssistantOrchestrator(buildFakeStorage() as any);

    const summary = await orchestrator.handleMessage({
      userId: "user-1",
      text: "quanto eu gastei nos ultimos dias?",
      channel: "internal_chat",
    });
    assert.equal(summary.handled, true);
    assert.match(summary.reply || "", /Resumo de/i);
    assert.equal((summary.payload as any)?.data?.topExpense?.category, "Mercado");

    const limits = await orchestrator.handleMessage({
      userId: "user-1",
      text: "como estao meus limites de gastos?",
      channel: "whatsapp",
    });
    assert.equal(limits.handled, true);
    assert.match(limits.reply || "", /Seus limites ativos/i);
    assert.equal((limits.payload as any)?.data?.limits?.[0]?.category, "Mercado");
  } finally {
    restoreListByUser();
    restoreBuildStatus();
  }
});

test("AssistantOrchestrator cria meta, registra aporte e lista metas com payload de navegacao", async () => {
  const restoreCreateGoal = patchMethod(
    GoalService.prototype,
    "createGoal",
    (async (_userId: string, payload: any) => ({
      id: "goal-1",
      userId: "user-1",
      title: payload.title,
      targetValue: String(payload.targetValue),
      currentValue: "0",
      targetDate: null,
      status: "active",
      archivedAt: null,
      completedAt: null,
      metadata: payload.metadata ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as GoalService["createGoal"],
  );

  const restoreGetLatestActiveGoal = patchMethod(
    GoalService.prototype,
    "getLatestActiveGoal",
    (async () => ({
      id: "goal-1",
      userId: "user-1",
      title: "iPhone 16",
      targetValue: "5399",
      currentValue: "0",
      targetDate: null,
      status: "active",
      archivedAt: null,
      completedAt: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as GoalService["getLatestActiveGoal"],
  );

  const restoreAddContribution = patchMethod(
    GoalService.prototype,
    "addContribution",
    (async ({ amount }: any) => ({
      goal: {
        id: "goal-1",
        userId: "user-1",
        title: "iPhone 16",
        targetValue: "5399",
        currentValue: String(amount),
        targetDate: null,
        status: "active",
        archivedAt: null,
        completedAt: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      contribution: {
        id: "contrib-1",
        goalId: "goal-1",
        userId: "user-1",
        amount: String(amount),
        contributedAt: new Date(),
        note: "Aporte via assistente",
        createdAt: new Date(),
      },
    })) as GoalService["addContribution"],
  );

  const restoreListGoals = patchMethod(
    GoalService.prototype,
    "listGoals",
    (async () => [
      {
        id: "goal-1",
        userId: "user-1",
        title: "iPhone 16",
        targetValue: "5399",
        currentValue: "500",
        targetDate: null,
        status: "active",
        archivedAt: null,
        completedAt: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]) as GoalService["listGoals"],
  );

  try {
    const orchestrator = new AssistantOrchestrator(buildFakeStorage() as any);

    const created = await orchestrator.handleMessage({
      userId: "user-1",
      text: "Quero juntar dinheiro para comprar uma moto de 13.500 reais. Ja tenho 3 mil guardado",
      channel: "internal_chat",
    });
    assert.equal(created.handled, true);
    assert.equal((created.payload as any)?.data?.route, "/goals");
    assert.equal((created.payload as any)?.ui_payload?.type, "goal_progress");
    assert.equal((created.payload as any)?.ui_payload?.chart?.type, "goal_ring");
    assert.equal((created.payload as any)?.model?.tier, "advanced");
    assert.equal((created.payload as any)?.data?.goal?.currentValue, "3000");
    assert.match(created.reply || "", /3\.000,00|3000/);

    const contributed = await orchestrator.handleMessage({
      userId: "user-1",
      text: "Ja guardei 500 hoje",
      channel: "whatsapp",
    });
    assert.equal(contributed.handled, true);
    assert.match(contributed.reply || "", /500/);
    assert.equal((contributed.payload as any)?.data?.route, "/goals");

    const listed = await orchestrator.handleMessage({
      userId: "user-1",
      text: "minhas metas",
      channel: "internal_chat",
    });
    assert.equal(listed.handled, true);
    assert.match(listed.reply || "", /Suas metas/i);
    assert.equal((listed.payload as any)?.data?.view, "goals");
    assert.equal((listed.payload as any)?.ui_payload?.chart?.type, "goal_progress_bars");
  } finally {
    restoreCreateGoal();
    restoreGetLatestActiveGoal();
    restoreAddContribution();
    restoreListGoals();
  }
});

test("AssistantOrchestrator cria lembrete, marca como pago, resume investimentos e alterna visao", async () => {
  const storage = buildFakeStorage();
  const orchestrator = new AssistantOrchestrator(storage as any);

  const reminder = await orchestrator.handleMessage({
    userId: "user-1",
    text: "Boleto do carro todo dia 12, R$ 1300",
    channel: "whatsapp",
  });
  assert.equal(reminder.handled, true);
  assert.equal(storage.reminders.length, 1);

  const paid = await orchestrator.handleMessage({
    userId: "user-1",
    text: "paguei ja",
    channel: "whatsapp",
  });
  assert.equal(paid.handled, true);
  assert.match(paid.reply || "", /paga/i);
  assert.equal(storage.reminders[0]?.status, "paid");

  const investments = await orchestrator.handleMessage({
    userId: "user-1",
    text: "como estao meus investimentos?",
    channel: "internal_chat",
  });
  assert.equal(investments.handled, true);
  assert.equal((investments.payload as any)?.data?.route, "/investments");
  assert.match(investments.reply || "", /investidos/i);

  const switchView = await orchestrator.handleMessage({
    userId: "user-1",
    text: "abrir metas",
    channel: "internal_chat",
  });
  assert.equal(switchView.handled, true);
  assert.equal((switchView.payload as any)?.data?.route, "/goals");
  assert.equal((switchView.payload as any)?.data?.view, "goals");
});

test("AssistantOrchestrator devolve payload estruturado para divisao e explicacao de aumento", async () => {
  const restoreListByUser = patchMethod(
    CategoryLimitService.prototype,
    "listByUser",
    (async () => []) as CategoryLimitService["listByUser"],
  );

  try {
    const orchestrator = new AssistantOrchestrator(buildFakeStorage() as any);

    const breakdown = await orchestrator.handleMessage({
      userId: "user-1",
      text: "me mostra a divisao dos meus gastos",
      channel: "internal_chat",
    });
    assert.equal(breakdown.handled, true);
    assert.equal((breakdown.payload as any)?.ui_payload?.type, "expense_breakdown");
    assert.equal((breakdown.payload as any)?.model?.tier, "advanced");

    const increase = await orchestrator.handleMessage({
      userId: "user-1",
      text: "por que meus gastos aumentaram?",
      channel: "whatsapp",
    });
    assert.equal(increase.handled, true);
    assert.match(increase.reply || "", /nao houve aumento|puxou a alta/i);
  } finally {
    restoreListByUser();
  }
});

test("AssistantOrchestrator usa dados da conta para dicas financeiras com payload visual", async () => {
  const orchestrator = new AssistantOrchestrator(buildFakeStorage() as any);

  const guidance = await orchestrator.handleMessage({
    userId: "user-1",
    text: "me de dicas para economizar",
    channel: "whatsapp",
  });

  assert.equal(guidance.handled, true);
  assert.equal((guidance.payload as any)?.ui_payload?.type, "financial_guidance");
  assert.equal((guidance.payload as any)?.ui_payload?.chart?.type, "guidance");
  assert.match(guidance.reply || "", /Transporte|Mercado|separar perto de|ponto de atencao/i);
});
