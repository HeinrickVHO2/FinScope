import assert from "node:assert/strict";
import test from "node:test";
import { FinancialIntentParser } from "./intentParser";

test("FinancialIntentParser extracts expense intent", () => {
  const parser = new FinancialIntentParser();
  const intent = parser.parse({ text: "gastei 42,30 com gasolina ontem" });

  assert.equal(intent.kind, "expense");
  assert.equal(intent.amount, 42.3);
  assert.ok(intent.confidence > 0.7);
  assert.ok(intent.description.includes("gasolina"));
});

test("FinancialIntentParser keeps pending fields when ambiguous", () => {
  const parser = new FinancialIntentParser();
  const intent = parser.parse({ text: "essa nota e da farmacia" });

  assert.equal(intent.kind, "expense");
  assert.equal(intent.amount, null);
  assert.equal(intent.categorySuggestion, "Saude");
  assert.ok(intent.missingFields.includes("amount"));
});

test("FinancialIntentParser parses thousand-based Brazilian payment phrases deterministically", () => {
  const parser = new FinancialIntentParser();
  const intent = parser.parse({ text: "Recebi meu pagamento. 10 mil reais" });

  assert.equal(intent.kind, "income");
  assert.equal(intent.amount, 10000);
  assert.equal(intent.categorySuggestion, "Salario");
});

test("FinancialIntentParser infers expense category from merchant-only phrases", () => {
  const parser = new FinancialIntentParser();
  const intent = parser.parse({ text: "Camisa 110" });

  assert.equal(intent.kind, "expense");
  assert.equal(intent.amount, 110);
  assert.equal(intent.categorySuggestion, "Roupas");
});
