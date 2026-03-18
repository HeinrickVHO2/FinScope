export const MIN_PASSWORD_LENGTH = 8;
export const RECOMMENDED_PASSWORD_LENGTH = 12;

export type PasswordStrengthLabel = "weak" | "fair" | "good" | "strong";

export type PasswordUserContext = {
  email?: string | null;
  fullName?: string | null;
};

export type PasswordRequirementKey =
  | "minLength"
  | "recommendedLength"
  | "uppercase"
  | "lowercase"
  | "number"
  | "special";

export type PasswordRequirement = {
  key: PasswordRequirementKey;
  label: string;
  met: boolean;
  required: boolean;
};

export type PasswordValidationResult = {
  isValid: boolean;
  score: number;
  label: PasswordStrengthLabel;
  errors: string[];
  requirements: PasswordRequirement[];
};

const COMMON_PASSWORDS = new Set([
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "admin",
  "admin123",
  "abc123",
  "abcdef",
  "abcdef12",
  "azerty",
  "iloveyou",
  "letmein",
  "password",
  "password123",
  "qwerty",
  "qwerty123",
  "senha",
  "senha123",
  "welcome",
  "welcome123",
]);

const KEYBOARD_PATTERNS = [
  "qwerty",
  "asdfgh",
  "zxcvbn",
  "123qwe",
  "qweasd",
  "1q2w3e",
];

const SEQUENCES = [
  "0123456789",
  "9876543210",
  "abcdefghijklmnopqrstuvwxyz",
  "zyxwvutsrqponmlkjihgfedcba",
];

const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /\d/;
const SPECIAL_REGEX = /[^A-Za-z0-9\s]/;

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeComparable(value: string) {
  return stripAccents(value).toLowerCase().replace(/\s+/g, "");
}

function normalizeAlphanumeric(value: string) {
  return normalizeComparable(value).replace(/[^a-z0-9]/g, "");
}

function hasSequentialPattern(password: string) {
  const comparable = normalizeAlphanumeric(password);

  return SEQUENCES.some((sequence) => {
    for (let start = 0; start <= sequence.length - 4; start += 1) {
      const fragment = sequence.slice(start, start + 4);
      if (comparable.includes(fragment)) {
        return true;
      }
    }
    return false;
  });
}

function hasKeyboardPattern(password: string) {
  const comparable = normalizeAlphanumeric(password);
  return KEYBOARD_PATTERNS.some((pattern) => comparable.includes(pattern));
}

function hasExcessiveRepetition(password: string) {
  const comparable = normalizeAlphanumeric(password);

  if (!comparable) {
    return false;
  }

  if (/(.)\1{3,}/.test(comparable)) {
    return true;
  }

  const uniqueCharacters = new Set(comparable).size;
  return comparable.length >= MIN_PASSWORD_LENGTH && uniqueCharacters <= 2;
}

function isCommonPassword(password: string) {
  const comparable = normalizeAlphanumeric(password);
  return COMMON_PASSWORDS.has(comparable);
}

function buildContextTokens(userContext?: PasswordUserContext) {
  const tokens = new Set<string>();

  if (userContext?.email) {
    const rawEmail = userContext.email.trim();
    const emailComparable = normalizeAlphanumeric(rawEmail);
    const emailLocalPart = rawEmail.split("@")[0] ?? "";

    if (emailComparable.length >= 4) {
      tokens.add(emailComparable);
    }

    const normalizedLocalPart = normalizeAlphanumeric(emailLocalPart);
    if (normalizedLocalPart.length >= 3) {
      tokens.add(normalizedLocalPart);
    }

    emailLocalPart
      .split(/[._+-]+/)
      .map(normalizeAlphanumeric)
      .filter((part) => part.length >= 3)
      .forEach((part) => tokens.add(part));
  }

  if (userContext?.fullName) {
    const fullNameComparable = normalizeAlphanumeric(userContext.fullName);
    if (fullNameComparable.length >= 4) {
      tokens.add(fullNameComparable);
    }

    userContext.fullName
      .split(/\s+/)
      .map(normalizeAlphanumeric)
      .filter((part) => part.length >= 3)
      .forEach((part) => tokens.add(part));
  }

  return Array.from(tokens);
}

function containsPersonalData(password: string, userContext?: PasswordUserContext) {
  const comparable = normalizeAlphanumeric(password);
  if (!comparable) {
    return false;
  }

  return buildContextTokens(userContext).some((token) => comparable.includes(token));
}

function getRequirementState(password: string): PasswordRequirement[] {
  return [
    {
      key: "minLength",
      label: `Pelo menos ${MIN_PASSWORD_LENGTH} caracteres`,
      met: password.length >= MIN_PASSWORD_LENGTH,
      required: true,
    },
    {
      key: "recommendedLength",
      label: `Idealmente ${RECOMMENDED_PASSWORD_LENGTH}+ caracteres`,
      met: password.length >= RECOMMENDED_PASSWORD_LENGTH,
      required: false,
    },
    {
      key: "uppercase",
      label: "Uma letra maiúscula",
      met: UPPERCASE_REGEX.test(password),
      required: true,
    },
    {
      key: "lowercase",
      label: "Uma letra minúscula",
      met: LOWERCASE_REGEX.test(password),
      required: true,
    },
    {
      key: "number",
      label: "Um número",
      met: NUMBER_REGEX.test(password),
      required: true,
    },
    {
      key: "special",
      label: "Um caractere especial",
      met: SPECIAL_REGEX.test(password),
      required: true,
    },
  ];
}

function getStrengthScore(
  password: string,
  requirements: PasswordRequirement[],
  penalties: { common: boolean; sequence: boolean; repeated: boolean; personalData: boolean },
) {
  if (!password) {
    return 0;
  }

  let score = 0;

  const metRequiredCount = requirements.filter((item) => item.required && item.met).length;
  score += metRequiredCount;

  if (password.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (password.length >= RECOMMENDED_PASSWORD_LENGTH) score += 1;
  if (password.length >= 16) score += 1;
  if (new Set(password).size >= 10) score += 1;

  if (penalties.common) score -= 3;
  if (penalties.sequence) score -= 2;
  if (penalties.repeated) score -= 2;
  if (penalties.personalData) score -= 2;

  return Math.max(0, Math.min(6, score));
}

function getStrengthLabel(score: number): PasswordStrengthLabel {
  if (score <= 1) return "weak";
  if (score <= 3) return "fair";
  if (score <= 4) return "good";
  return "strong";
}

export function validatePasswordStrength(
  password: string,
  userContext?: PasswordUserContext,
): PasswordValidationResult {
  const safePassword = password ?? "";
  const requirements = getRequirementState(safePassword);

  const hasMinimumLength = requirements.find((item) => item.key === "minLength")?.met ?? false;
  const hasUppercase = requirements.find((item) => item.key === "uppercase")?.met ?? false;
  const hasLowercase = requirements.find((item) => item.key === "lowercase")?.met ?? false;
  const hasNumber = requirements.find((item) => item.key === "number")?.met ?? false;
  const hasSpecial = requirements.find((item) => item.key === "special")?.met ?? false;

  const penalties = {
    common: isCommonPassword(safePassword),
    sequence: hasSequentialPattern(safePassword) || hasKeyboardPattern(safePassword),
    repeated: hasExcessiveRepetition(safePassword),
    personalData: containsPersonalData(safePassword, userContext),
  };

  const errors: string[] = [];

  if (!hasMinimumLength) {
    errors.push(`Sua senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  if (!hasUppercase) {
    errors.push("Adicione pelo menos uma letra maiúscula.");
  }

  if (!hasLowercase) {
    errors.push("Adicione pelo menos uma letra minúscula.");
  }

  if (!hasNumber) {
    errors.push("Adicione pelo menos um número.");
  }

  if (!hasSpecial) {
    errors.push("Adicione pelo menos um caractere especial.");
  }

  if (penalties.common) {
    errors.push("Essa senha é muito comum e fácil de adivinhar.");
  }

  if (penalties.sequence) {
    errors.push("Evite sequências simples ou combinações óbvias do teclado.");
  }

  if (penalties.repeated) {
    errors.push("Evite repetição excessiva de caracteres.");
  }

  if (penalties.personalData) {
    errors.push("Evite usar seu nome ou e-mail na senha.");
  }

  const score = getStrengthScore(safePassword, requirements, penalties);

  return {
    isValid: errors.length === 0,
    score,
    label: getStrengthLabel(score),
    errors,
    requirements,
  };
}

export function getPasswordValidationErrors(password: string, userContext?: PasswordUserContext) {
  return validatePasswordStrength(password, userContext).errors;
}

export function getPasswordStrengthLabel(password: string, userContext?: PasswordUserContext) {
  return validatePasswordStrength(password, userContext).label;
}
