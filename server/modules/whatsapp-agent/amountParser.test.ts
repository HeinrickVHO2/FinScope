import test from "node:test";
import assert from "node:assert/strict";
import { parseMonetaryAmountFromNaturalLanguage } from "./amountParser";

test("parseMonetaryAmountFromNaturalLanguage handles common Brazilian monetary phrases", () => {
  assert.equal(parseMonetaryAmountFromNaturalLanguage("10 mil reais"), 10000);
  assert.equal(parseMonetaryAmountFromNaturalLanguage("2,5 mil"), 2500);
  assert.equal(parseMonetaryAmountFromNaturalLanguage("3k"), 3000);
  assert.equal(parseMonetaryAmountFromNaturalLanguage("mil e quinhentos"), 1500);
  assert.equal(parseMonetaryAmountFromNaturalLanguage("dez mil"), 10000);
  assert.equal(parseMonetaryAmountFromNaturalLanguage("gastei 50 reais"), 50);
  assert.equal(parseMonetaryAmountFromNaturalLanguage("recebi 1200"), 1200);
});
