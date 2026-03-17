import assert from "node:assert/strict";
import test from "node:test";
import { buildFinancialSummaryPayload } from "./financialSummaryService";

class SummaryStorageFake {
  constructor(private readonly transactions: any[]) {}

  async getTransactionsByUserId() {
    return this.transactions;
  }
}

function tx(overrides: Partial<any>) {
  return {
    id: `tx-${Math.random()}`,
    userId: "user-1",
    accountId: "acc-1",
    description: "Compra",
    type: "saida",
    amount: "100.00",
    category: "Compras",
    date: new Date("2026-03-15T12:00:00.000Z"),
    accountType: "PF",
    autoRuleApplied: false,
    source: "manual",
    createdAt: new Date("2026-03-15T12:00:00.000Z"),
    ...overrides,
  };
}

test("buildFinancialSummaryPayload consolida 7 dias, categorias e comparacao", async () => {
  const storage = new SummaryStorageFake([
    tx({ type: "entrada", amount: "5000.00", category: "Salario", description: "Salario" }),
    tx({ category: "Mercado", amount: "300.00", description: "Mercado" }),
    tx({ category: "Transporte", amount: "150.00", description: "Uber" }),
    tx({ category: "Lazer", amount: "90.00", description: "Cinema", date: new Date("2026-03-10T12:00:00.000Z") }),
    tx({ category: "Mercado", amount: "120.00", description: "Mercado", date: new Date("2026-03-05T12:00:00.000Z") }),
  ]);

  const payload = await buildFinancialSummaryPayload({
    storage: storage as any,
    userId: "user-1",
    periodKey: "last_7_days",
    referenceDate: new Date("2026-03-16T12:00:00.000Z"),
    limits: [
      {
        id: "limit-1",
        userId: "user-1",
        category: "Mercado",
        scope: "ALL",
        period: "monthly",
        amount: "500",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });

  assert.equal(payload.totals.income, 5000);
  assert.equal(payload.totals.expenses, 540);
  assert.equal(payload.topExpense?.category, "Mercado");
  assert.equal(payload.limits[0]?.category, "Mercado");
  assert.ok(payload.comparison.expensesDelta >= 0);
});
