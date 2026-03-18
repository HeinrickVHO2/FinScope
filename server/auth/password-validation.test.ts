import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcrypt";
import {
  buildPasswordUserContext,
  getPasswordSubmissionErrors,
} from "./password-validation";

test("validação de reset e troca rejeita mismatch, reutilização e senha fraca", () => {
  const userContext = buildPasswordUserContext({
    email: "victor@finscope.com",
    fullName: "Victor Silva",
  });

  const mismatchErrors = getPasswordSubmissionErrors({
    password: "Planejamento$2026",
    confirmPassword: "OutraSenha$2026",
    userContext,
  });
  assert.match(mismatchErrors.join(" "), /não coincidem/i);

  const reusedErrors = getPasswordSubmissionErrors({
    password: "Planejamento$2026",
    confirmPassword: "Planejamento$2026",
    userContext,
    disallowCurrentPasswordReuse: true,
  });
  assert.match(reusedErrors.join(" "), /diferente da atual/i);

  const weakErrors = getPasswordSubmissionErrors({
    password: "senha123",
    confirmPassword: "senha123",
    userContext,
  });
  assert.ok(weakErrors.length > 0);
});

test("validação de reset e troca aceita senha forte", () => {
  const errors = getPasswordSubmissionErrors({
    password: "Planejamento$2026",
    confirmPassword: "Planejamento$2026",
    userContext: buildPasswordUserContext({
      email: "maria@finscope.com",
      fullName: "Maria Souza",
    }),
  });

  assert.deepEqual(errors, []);
});

test("login legado continua funcionando com senha antiga já armazenada", async () => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "service-role-key";

  const { MemStorage } = await import("../storage");
  const storage = new MemStorage();
  const legacyPassword = "123456";

  (storage as any).users.set("legacy-user", {
    id: "legacy-user",
    email: "legacy@finscope.com",
    password: await bcrypt.hash(legacyPassword, 10),
    fullName: "Legacy User",
    plan: "pro",
    trialStart: null,
    trialEnd: null,
    caktoSubscriptionId: null,
    billingStatus: "active",
    createdAt: new Date(),
  });

  const authenticatedUser = await storage.verifyPassword("legacy@finscope.com", legacyPassword);
  assert.equal(authenticatedUser?.id, "legacy-user");
});
