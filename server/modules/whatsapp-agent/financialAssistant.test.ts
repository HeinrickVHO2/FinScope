import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFinancialAssistantReply,
  buildStructuredFinancialSummary,
  formatStructuredFinancialSummary,
} from "../shared/financialAssistant";

class FinancialStorageFake {
  public transactions: any[] = [];
  public futureTransactions: any[] = [];
  public futureExpenses: any[] = [];
  public recurringTransactions: any[] = [];

  async getTransactionsByUserId(userId: string, scope: "PF" | "PJ" | "ALL" = "ALL") {
    return this.transactions.filter((item) => {
      if (item.userId !== userId) return false;
      if (scope === "ALL") return true;
      return (item.accountType || "PF") === scope;
    });
  }

  async getFutureTransactions() {
    return this.futureTransactions;
  }

  async getFutureExpenses() {
    return this.futureExpenses;
  }

  async getRecurringTransactions() {
    return this.recurringTransactions;
  }
}

function createTransaction(overrides: Partial<any> = {}) {
  return {
    id: `tx-${Math.random()}`,
    userId: "user-1",
    accountId: "acc-1",
    description: "Mercado",
    type: "saida",
    amount: "120.00",
    category: "Alimentacao",
    date: new Date("2026-03-16T12:00:00.000Z"),
    accountType: "PF",
    autoRuleApplied: false,
    source: "manual",
    createdAt: new Date("2026-03-16T12:00:00.000Z"),
    ...overrides,
  };
}

test("buildStructuredFinancialSummary consolidates totals, recurring spends and whatsapp source", async () => {
  const storage = new FinancialStorageFake();
  storage.transactions = [
    createTransaction({
      id: "income-1",
      description: "Salario",
      type: "entrada",
      amount: "5000.00",
      category: "Salario",
      source: "manual",
    }),
    createTransaction({
      id: "expense-1",
      description: "Mercado do bairro",
      type: "saida",
      amount: "420.00",
      category: "Alimentacao",
      source: "whatsapp_agent",
    }),
    createTransaction({
      id: "expense-2",
      description: "Assinatura streaming",
      type: "saida",
      amount: "60.00",
      category: "Lazer",
      source: "manual",
    }),
    createTransaction({
      id: "expense-3",
      description: "Assinatura streaming",
      type: "saida",
      amount: "60.00",
      category: "Lazer",
      date: new Date("2026-02-16T12:00:00.000Z"),
      source: "manual",
    }),
  ];
  storage.futureExpenses = [{ amount: "200.00" }];

  const summary = await buildStructuredFinancialSummary(storage as any, "user-1", "ALL", {
    referenceDate: new Date("2026-03-20T12:00:00.000Z"),
  });

  assert.equal(summary.totalEntries, 5000);
  assert.equal(summary.totalExits, 480);
  assert.equal(summary.balance, 4520);
  assert.equal(summary.topCategories[0]?.category, "Alimentacao");
  assert.equal(summary.sourceBreakdown[0]?.source, "manual");
  assert.equal(summary.sourceBreakdown[1]?.source, "whatsapp_agent");
  assert.ok(summary.recurringExpenses.some((item) => item.label === "Assinatura streaming"));
  assert.ok(summary.savingsSuggestion > 0);
});

test("buildFinancialAssistantReply returns concise whatsapp summary and richer internal summary", async () => {
  const storage = new FinancialStorageFake();
  storage.transactions = [
    createTransaction({
      id: "income-1",
      description: "Salario",
      type: "entrada",
      amount: "3500.00",
      category: "Salario",
    }),
    createTransaction({
      id: "expense-1",
      description: "Mercado",
      type: "saida",
      amount: "700.00",
      category: "Alimentacao",
      source: "whatsapp_agent",
    }),
    createTransaction({
      id: "expense-2",
      description: "Uber",
      type: "saida",
      amount: "180.00",
      category: "Transporte",
    }),
  ];
  storage.recurringTransactions = [
    {
      id: "rec-1",
      userId: "user-1",
      type: "expense",
      description: "Academia",
      amount: "89.90",
      frequency: "monthly",
      nextDate: new Date("2026-03-25T12:00:00.000Z"),
      accountType: "PF",
      createdAt: new Date("2026-03-01T12:00:00.000Z"),
    },
  ];

  const whatsappReply = await buildFinancialAssistantReply(
    storage as any,
    "user-1",
    "Me mostra meu resumo financeiro",
    "whatsapp",
  );
  const internalReply = await buildFinancialAssistantReply(
    storage as any,
    "user-1",
    "Me mostra meu resumo financeiro",
    "internal_chat",
  );

  assert.match(whatsappReply, /Resumo de marco\/2026/i);
  assert.match(whatsappReply, /Categoria com maior peso: Alimentacao/i);
  assert.match(whatsappReply, /Dica principal:/i);
  assert.match(internalReply, /Resumo financeiro de marco\/2026/i);
  assert.match(internalReply, /Categorias com maior peso:/i);
  assert.match(internalReply, /Recorrencias observadas:/i);

  const summary = await buildStructuredFinancialSummary(storage as any, "user-1", "ALL", {
    referenceDate: new Date("2026-03-20T12:00:00.000Z"),
  });
  const formatted = formatStructuredFinancialSummary(summary, "internal_chat");
  assert.match(formatted, /Proximos passos:/i);
});

test("buildFinancialAssistantReply gives personalized saving guidance and transparent low-data fallback", async () => {
  const storage = new FinancialStorageFake();

  const lowDataReply = await buildFinancialAssistantReply(
    storage as any,
    "user-1",
    "quanto posso guardar esse mes?",
    "whatsapp",
  );
  assert.match(lowDataReply, /Ainda nao encontrei movimentacoes suficientes/i);

  storage.transactions = [
    createTransaction({
      id: "income-1",
      description: "Salario",
      type: "entrada",
      amount: "4500.00",
      category: "Salario",
    }),
    createTransaction({
      id: "expense-1",
      description: "Mercado",
      type: "saida",
      amount: "900.00",
      category: "Alimentacao",
    }),
  ];

  const savingsReply = await buildFinancialAssistantReply(
    storage as any,
    "user-1",
    "quanto posso guardar esse mes?",
    "whatsapp",
  );
  assert.match(savingsReply, /voce pode separar algo perto de R\$/i);
});
