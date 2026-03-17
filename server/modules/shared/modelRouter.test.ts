import assert from "node:assert/strict";
import test from "node:test";
import { resolveModel, resolveModelForIntent, resolveModelForText } from "./modelRouter";

test("ModelRouter usa modelo leve para transacao simples", () => {
  const selection = resolveModelForText("camisa 110");
  assert.equal(selection.tier, "light");
  assert.equal(selection.taskType, "simple_transaction");
});

test("ModelRouter usa modelo avancado para resumo e metas", () => {
  const summarySelection = resolveModelForIntent({
    type: "summary",
    periodKey: "last_7_days",
    focus: "increase_reason",
  });
  assert.equal(summarySelection.tier, "advanced");

  const goalSelection = resolveModelForIntent({
    type: "create_goal",
    title: "Iphone 16",
    targetValue: 5399,
  });
  assert.equal(goalSelection.tier, "advanced");
});

test("ModelRouter escala por ambiguidade", () => {
  const selection = resolveModel("simple_transaction", { ambiguous: true });
  assert.equal(selection.tier, "advanced");
});
