import assert from "node:assert/strict";
import test from "node:test";
import { insertUserSchema } from "./schema";
import { validatePasswordStrength } from "./password-policy";

test("valida senhas fracas, comuns e previsíveis", () => {
  const weakPasswords = [
    "123456",
    "12345678",
    "senha123",
    "abcdef12",
    "AAAAAAAA",
  ];

  weakPasswords.forEach((password) => {
    const result = validatePasswordStrength(password, {
      email: "victor@finscope.com",
      fullName: "Victor Silva",
    });

    assert.equal(result.isValid, false, `esperava senha inválida: ${password}`);
    assert.ok(result.errors.length > 0);
  });
});

test("bloqueia senha com nome ou e-mail do usuário", () => {
  const withName = validatePasswordStrength("Victor123!", {
    email: "victor@finscope.com",
    fullName: "Victor Silva",
  });
  assert.equal(withName.isValid, false);
  assert.match(withName.errors.join(" "), /nome ou e-mail/i);

  const withEmail = validatePasswordStrength("victor@finscope.comA!", {
    email: "victor@finscope.com",
    fullName: "Victor Silva",
  });
  assert.equal(withEmail.isValid, false);
  assert.match(withEmail.errors.join(" "), /nome ou e-mail/i);
});

test("aceita senhas fortes com 8+ e 12+ caracteres", () => {
  const good = validatePasswordStrength("F!nScope9", {
    email: "victor@finscope.com",
    fullName: "Victor Silva",
  });
  assert.equal(good.isValid, true);
  assert.ok(["good", "strong"].includes(good.label));

  const strong = validatePasswordStrength("Cofre$Seguro2026", {
    email: "victor@finscope.com",
    fullName: "Victor Silva",
  });
  assert.equal(strong.isValid, true);
  assert.equal(strong.label, "strong");
});

test("schema de cadastro aplica a política centralizada de senha", () => {
  const invalid = insertUserSchema.safeParse({
    fullName: "Victor Silva",
    email: "victor@finscope.com",
    password: "senha123",
  });

  assert.equal(invalid.success, false);
  assert.ok(invalid.error.issues.length > 0);

  const valid = insertUserSchema.safeParse({
    fullName: "Victor Silva",
    email: "victor@finscope.com",
    password: "Planejamento$2026",
  });

  assert.equal(valid.success, true);
});
