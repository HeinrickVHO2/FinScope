import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const { executeAgentActions } = await import("./agentActionsHandler");
const { storage } = await import("../server/storage");
const { supabase } = await import("../server/supabase");

function patchMethod<T extends object, K extends keyof T>(target: T, key: K, replacement: T[K]) {
  const original = target[key];
  target[key] = replacement;
  return () => {
    target[key] = original;
  };
}

function buildUser(plan: "pro" | "premium" = "premium") {
  return {
    id: "user-1",
    email: "user@example.com",
    password: "hashed",
    fullName: "Teste",
    plan,
    trialStart: null,
    trialEnd: null,
    caktoSubscriptionId: "sub-1",
    billingStatus: "active",
    createdAt: new Date(),
  };
}

function buildContext() {
  return {
    lastTransactions: [],
    futureTransactions: [],
    activeInvestments: [],
  } as any;
}

test("executeAgentActions defaults web AI transactions to the personal account", async () => {
  const accounts = [
    {
      id: "acc-pf",
      userId: "user-1",
      name: "Conta pessoal",
      type: "pf",
      businessCategory: null,
      initialBalance: "0",
      createdAt: new Date(),
    },
    {
      id: "acc-pj",
      userId: "user-1",
      name: "Minha empresa",
      type: "pj",
      businessCategory: null,
      initialBalance: "0",
      createdAt: new Date(),
    },
  ];

  const restoreGetAccounts = patchMethod(
    storage as any,
    "getAccountsByUserId",
    (async () => accounts) as any,
  );
  const restoreCreateAccount = patchMethod(
    storage as any,
    "createAccount",
    (async () => {
      throw new Error("Nao deveria criar conta nova neste teste");
    }) as any,
  );
  const restoreCreateTransaction = patchMethod(
    storage as any,
    "createTransaction",
    (async (payload: any) => ({
      id: "tx-1",
      ...payload,
      amount: String(payload.amount),
      createdAt: new Date(),
    })) as any,
  );
  const restoreSupabaseFrom = patchMethod(
    supabase as any,
    "from",
    ((table: string) => {
      if (table !== "accounts") {
        throw new Error(`Tabela inesperada no teste: ${table}`);
      }
      return {
        select() {
          return {
            eq() {
              return {
                async single() {
                  return { data: { initial_balance: "0" }, error: null };
                },
              };
            },
          };
        },
        update() {
          return {
            async eq() {
              return { data: null, error: null };
            },
          };
        },
      };
    }) as any,
  );

  try {
    const results = await executeAgentActions(
      buildUser("premium") as any,
      [
        {
          type: "transaction",
          data: {
            type: "income",
            description: "Recebimento",
            amount: 500,
            date: "2026-03-27",
          },
        },
      ],
      buildContext(),
    );

    assert.equal(results[0]?.success, true);
    assert.equal(results[0]?.data?.accountId, "acc-pf");
    assert.equal(results[0]?.data?.accountType, "PF");
  } finally {
    restoreGetAccounts();
    restoreCreateAccount();
    restoreCreateTransaction();
    restoreSupabaseFrom();
  }
});

test("executeAgentActions blocks explicit PJ launches when the business account does not exist", async () => {
  const accounts = [
    {
      id: "acc-pf",
      userId: "user-1",
      name: "Conta pessoal",
      type: "pf",
      businessCategory: null,
      initialBalance: "0",
      createdAt: new Date(),
    },
  ];

  const restoreGetAccounts = patchMethod(
    storage as any,
    "getAccountsByUserId",
    (async () => accounts) as any,
  );
  const restoreCreateTransaction = patchMethod(
    storage as any,
    "createTransaction",
    (async () => {
      throw new Error("Nao deveria criar transacao sem conta PJ");
    }) as any,
  );

  try {
    const results = await executeAgentActions(
      buildUser("premium") as any,
      [
        {
          type: "transaction",
          data: {
            type: "income",
            description: "Recebimento empresarial",
            amount: 1200,
            date: "2026-03-27",
            account_type: "PJ",
          },
        },
      ],
      buildContext(),
    );

    assert.equal(results[0]?.success, false);
    assert.match(results[0]?.message || "", /conta PJ cadastrada|Minha Empresa/i);
  } finally {
    restoreGetAccounts();
    restoreCreateTransaction();
  }
});
