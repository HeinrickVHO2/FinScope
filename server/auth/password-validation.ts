import type { PasswordUserContext } from "@shared/password-policy";
import { validatePasswordStrength } from "@shared/password-policy";

export const PASSWORD_MISMATCH_MESSAGE = "As senhas não coincidem.";
export const PASSWORD_REUSE_MESSAGE = "Escolha uma senha diferente da atual.";

type UserIdentity = {
  email?: string | null;
  fullName?: string | null;
};

type PasswordSubmissionParams = {
  password: string;
  confirmPassword?: string;
  userContext?: PasswordUserContext;
  disallowCurrentPasswordReuse?: boolean;
};

export function buildPasswordUserContext(user?: UserIdentity | null): PasswordUserContext {
  return {
    email: user?.email ?? null,
    fullName: user?.fullName ?? null,
  };
}

export function getPasswordSubmissionErrors({
  password,
  confirmPassword,
  userContext,
  disallowCurrentPasswordReuse = false,
}: PasswordSubmissionParams) {
  const errors: string[] = [];

  if (confirmPassword !== undefined && password !== confirmPassword) {
    errors.push(PASSWORD_MISMATCH_MESSAGE);
  }

  if (disallowCurrentPasswordReuse) {
    errors.push(PASSWORD_REUSE_MESSAGE);
  }

  errors.push(...validatePasswordStrength(password, userContext).errors);

  return Array.from(new Set(errors));
}

export function getPrimaryPasswordSubmissionError(params: PasswordSubmissionParams) {
  return getPasswordSubmissionErrors(params)[0] ?? null;
}
