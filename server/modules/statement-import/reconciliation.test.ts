import test from "node:test";
import assert from "node:assert/strict";
import { reconcileStatementEntry, scoreTransactionMatch } from "./reconciliation";

const entry = {
  lineNumber: 2,
  rawPayload: {},
  rawText: "",
  originalDescription: "Uber viagem",
  normalizedDescription: "uber viagem",
  amount: 42.9,
  transactionDate: "2026-03-14",
  direction: "debit" as const,
  currency: "BRL",
  fingerprint: "abc",
};

test("scoreTransactionMatch prioriza valor, data e descrição parecidos", () => {
  const score = scoreTransactionMatch(entry, {
    id: "tx-1",
    description: "uber viagem centro",
    amount: 42.9,
    date: "2026-03-14",
    type: "saida",
    category: "Transporte",
  });

  assert.ok(score > 0.8);
});

test("reconcileStatementEntry marca duplicado quando fingerprint já existe", () => {
  const result = reconcileStatementEntry(entry, [], new Set(["abc"]));
  assert.equal(result.status, "duplicate");
  assert.equal(result.confidenceScore, 1);
});

test("reconcileStatementEntry encontra match forte", () => {
  const result = reconcileStatementEntry(
    entry,
    [
      {
        id: "tx-1",
        description: "uber viagem centro",
        amount: 42.9,
        date: "2026-03-14",
        type: "saida",
        category: "Transporte",
      },
    ],
    new Set(),
  );

  assert.equal(result.status, "matched");
  assert.equal(result.matchedTransactionId, "tx-1");
});
