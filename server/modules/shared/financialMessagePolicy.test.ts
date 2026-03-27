import assert from "node:assert/strict";
import test from "node:test";
import {
  detectExplicitAccountScope,
  getMissingBusinessAccountMessage,
  isSocialOnlyMessage,
  resolveAccountForScope,
  resolveAccountForText,
} from "./financialMessagePolicy";

function buildAccount(id: string, type: "pf" | "pj", name: string) {
  return {
    id,
    userId: "user-1",
    name,
    type,
    businessCategory: null,
    initialBalance: "0",
    createdAt: new Date(),
  };
}

test("financialMessagePolicy classifies social-only replies without financial evidence", () => {
  assert.equal(isSocialOnlyMessage("obrigado"), true);
  assert.equal(isSocialOnlyMessage("ok, obrigado"), true);
  assert.equal(isSocialOnlyMessage("valeu"), true);
  assert.equal(isSocialOnlyMessage("👍"), true);
  assert.equal(isSocialOnlyMessage("recebi 500"), false);
  assert.equal(isSocialOnlyMessage("ok registra 500"), false);
});

test("financialMessagePolicy detects only explicit business scope", () => {
  assert.equal(detectExplicitAccountScope("recebi 500"), null);
  assert.equal(detectExplicitAccountScope("recebi 1200 na empresa"), "PJ");
  assert.equal(detectExplicitAccountScope("recebi 50 na conta PJ"), "PJ");
  assert.equal(detectExplicitAccountScope("foi na conta pessoal"), "PF");
});

test("financialMessagePolicy defaults to personal account when scope is omitted", () => {
  const accounts = [
    buildAccount("acc-pf", "pf", "Conta pessoal"),
    buildAccount("acc-pj", "pj", "Minha empresa"),
  ];

  const resolution = resolveAccountForText(accounts as any, "recebi 500");
  assert.equal(resolution.ok, true);
  assert.equal(resolution.accountType, "PF");
  assert.equal(resolution.account?.id, "acc-pf");
});

test("financialMessagePolicy blocks explicit business scope when PJ account does not exist", () => {
  const accounts = [buildAccount("acc-pf", "pf", "Conta pessoal")];

  const resolution = resolveAccountForText(accounts as any, "recebi 1200 na empresa");
  assert.equal(resolution.ok, false);
  assert.equal(resolution.accountType, "PJ");
  assert.equal(resolution.message, getMissingBusinessAccountMessage());
});

test("financialMessagePolicy resolves explicit business scope when PJ account exists", () => {
  const accounts = [
    buildAccount("acc-pf", "pf", "Conta pessoal"),
    buildAccount("acc-pj", "pj", "Minha empresa"),
  ];

  const resolution = resolveAccountForScope(accounts as any, "PJ", true);
  assert.equal(resolution.ok, true);
  assert.equal(resolution.account?.id, "acc-pj");
  assert.equal(resolution.accountType, "PJ");
});
