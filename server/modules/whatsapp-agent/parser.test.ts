import test from "node:test";
import assert from "node:assert/strict";
import {
  detectIntentType,
  extractAmountFromText,
  extractTransactionDateFromText,
  parseWhatsAppTransactionIntents,
} from "./parser";

test("parser do WhatsApp identifica gasto com valor e data relativa", () => {
  const intents = parseWhatsAppTransactionIntents("paguei R$ 42,90 no mercado ontem");
  assert.equal(intents.length, 1);
  assert.equal(intents[0].proposedType, "expense");
  assert.equal(intents[0].amount, 42.9);
  assert.ok(intents[0].description.length > 0);
});

test("helpers do parser reconhecem tipo, valor e data", () => {
  assert.equal(detectIntentType("recebi 500 do cliente"), "income");
  assert.equal(extractAmountFromText("gastei 89,90"), 89.9);
  assert.match(extractTransactionDateFromText("recebi hoje"), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(detectIntentType("Quero guardar dinheiro para comprar um Iphone no valor de 5760 reais"), null);
});
