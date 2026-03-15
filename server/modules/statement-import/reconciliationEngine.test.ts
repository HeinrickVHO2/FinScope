import test from "node:test";
import assert from "node:assert/strict";
import { ReconciliationEngine } from "./reconciliationEngine";
import type { NormalizedStatementEntry } from "./types";

const baseEntry: NormalizedStatementEntry = {
  lineNumber: 1,
  transactionDate: new Date("2026-03-06T00:00:00.000Z"),
  amount: 120,
  direction: "debit",
  currency: "BRL",
  originalDescription: "Mercado Central",
  normalizedDescription: "mercado central",
  fingerprint: "fp-1",
};

test("ReconciliationEngine marks matched for strong candidate", () => {
  const engine = new ReconciliationEngine({ dateToleranceDays: 3 });
  const result = engine.reconcile({
    entry: baseEntry,
    existingTransactions: [
      {
        transactionId: "tx-1",
        amount: 120,
        type: "saida",
        date: new Date("2026-03-05T00:00:00.000Z"),
        description: "Mercado Central",
        normalizedDescription: "mercado central",
      },
    ],
    knownFingerprints: new Set(),
  });

  assert.equal(result.status, "matched");
  assert.equal(result.matchedTransactionId, "tx-1");
  assert.ok(result.confidenceScore >= 0.82);
});

test("ReconciliationEngine marks duplicate when fingerprint exists", () => {
  const engine = new ReconciliationEngine({ dateToleranceDays: 2 });
  const result = engine.reconcile({
    entry: baseEntry,
    existingTransactions: [],
    knownFingerprints: new Set(["fp-1"]),
  });

  assert.equal(result.status, "duplicate");
  assert.equal(result.confidenceScore, 1);
});

test("ReconciliationEngine marks pending review for weak match", () => {
  const engine = new ReconciliationEngine({ dateToleranceDays: 1 });
  const result = engine.reconcile({
    entry: baseEntry,
    existingTransactions: [
      {
        transactionId: "tx-9",
        amount: 400,
        type: "entrada",
        date: new Date("2026-02-20T00:00:00.000Z"),
        description: "Salario",
        normalizedDescription: "salario",
      },
    ],
    knownFingerprints: new Set(),
  });

  assert.equal(result.status, "pending_review");
});

