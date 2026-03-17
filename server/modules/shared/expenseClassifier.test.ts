import assert from "node:assert/strict";
import test from "node:test";
import { classifyExpenseCategory } from "./expenseClassifier";

test("classifyExpenseCategory cobre merchants e palavras-chave principais", () => {
  const scenarios = [
    { description: "Uber 32", expected: "Transporte" },
    { description: "iFood 48", expected: "Delivery" },
    { description: "mercado 210", expected: "Mercado" },
    { description: "camisa 110", expected: "Roupas" },
    { description: "cinema 45", expected: "Lazer" },
    { description: "gasolina 200", expected: "Transporte" },
    { description: "farmacia 67", expected: "Saude" },
  ];

  for (const scenario of scenarios) {
    const result = classifyExpenseCategory({ description: scenario.description });
    assert.equal(result.category, scenario.expected);
    assert.equal(result.usedFallback, false);
  }
});

test("classifyExpenseCategory aprende com historico do usuario antes de cair em Outros", () => {
  const result = classifyExpenseCategory({
    description: "Padoca do bairro 28",
    history: [
      {
        description: "Padoca do bairro 19",
        category: "Alimentacao",
        type: "saida",
      },
    ],
  });

  assert.equal(result.category, "Alimentacao");
  assert.equal(result.usedFallback, false);
});
