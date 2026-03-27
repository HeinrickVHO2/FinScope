import type { Account } from "@shared/schema";

export type AccountScope = "PF" | "PJ";

export type AccountResolution =
  | {
      ok: true;
      account: Account;
      accountType: AccountScope;
      reason:
        | "direct_account_match"
        | "explicit_business_scope"
        | "explicit_personal_scope"
        | "default_personal_account"
        | "default_business_account";
      explicitlyRequested: boolean;
      message?: undefined;
      availableAccounts: Account[];
    }
  | {
      ok: false;
      account: null;
      accountType: AccountScope;
      reason: "missing_personal_account" | "missing_business_account";
      explicitlyRequested: boolean;
      message: string;
      availableAccounts: Account[];
    };

const SOCIAL_ONLY_TOKENS = new Set([
  "beleza",
  "blz",
  "certo",
  "entendi",
  "fechado",
  "joinha",
  "obg",
  "obrigada",
  "obrigado",
  "ok",
  "okay",
  "perfeito",
  "show",
  "suave",
  "tranquilo",
  "valeu",
]);

const TRANSACTION_VERB_PATTERN =
  /\b(recebi|ganhei|gastei|paguei|comprei|vendi|faturei|pix|entrou|saiu|transferi|depositei|saquei|boleto|conta|aluguel)\b/i;

const FUTURE_MUTATION_PATTERN =
  /\b(vou pagar|preciso pagar|tenho que pagar|tenho de pagar|vence|vencimento|todo mes|todo m[eê]s|toda semana)\b/i;

const BUSINESS_SCOPE_PATTERN =
  /\b(pj|empresa|empresarial|conta pj|conta da empresa|minha empresa|na empresa|da empresa|para empresa|foi da empresa|lanca na empresa|lancar na empresa)\b/i;

const PERSONAL_SCOPE_PATTERN =
  /\b(pf|pessoal|conta pessoal|particular|na minha conta pessoal|na conta pessoal)\b/i;

function normalizeText(text?: string | null) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeTokenizedText(text?: string | null) {
  return normalizeText(text)
    .replace(/👍/g, " joinha ")
    .replace(/[!?,.;:/\\()[\]{}"'`´~^*_+=-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasMonetaryAmount(text?: string | null) {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  return Boolean(
    /^r\$\s*\d[\d.,]*$/i.test(normalized) ||
      /^\d[\d.,]*\s*(reais?|rs|mil)$/i.test(normalized) ||
      /^\d[\d.,]*$/.test(normalized) ||
      /(?:r\$\s*)\d[\d.,]*/i.test(normalized) ||
      /\d[\d.,]*\s*(reais?|rs)\b/i.test(normalized),
  );
}

function findDirectAccountMatch(accounts: Account[], text?: string | null) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  return (
    accounts.find((account) => {
      const name = normalizeText(account.name);
      return name.length >= 3 && normalized.includes(name);
    }) || null
  );
}

function getPreferredAccount(accounts: Account[], scope: AccountScope) {
  const preferredPatterns =
    scope === "PJ"
      ? [/\bminha empresa\b/, /\bempresa\b/, /\bprincipal\b/, /\bpadrao\b/, /\bdefault\b/]
      : [/\bconta pessoal\b/, /\bpessoal\b/, /\bprincipal\b/, /\bpadrao\b/, /\bdefault\b/];

  return (
    accounts.find((account) => {
      const normalizedName = normalizeText(account.name);
      return preferredPatterns.some((pattern) => pattern.test(normalizedName));
    }) || accounts[0] || null
  );
}

export function detectExplicitAccountScope(text?: string | null): AccountScope | null {
  if (!text) return null;
  if (BUSINESS_SCOPE_PATTERN.test(text)) return "PJ";
  if (PERSONAL_SCOPE_PATTERN.test(text)) return "PF";
  return null;
}

export function looksLikeFinancialMutationMessage(text?: string | null) {
  return hasMonetaryAmount(text) || TRANSACTION_VERB_PATTERN.test(String(text || "")) || FUTURE_MUTATION_PATTERN.test(String(text || ""));
}

export function isSocialOnlyMessage(text?: string | null) {
  if (!text) return false;
  if (looksLikeFinancialMutationMessage(text)) return false;

  const normalized = normalizeTokenizedText(text);
  if (!normalized) return false;

  const tokens = normalized.split(" ").filter(Boolean);
  if (!tokens.length) return false;

  return tokens.every((token) => SOCIAL_ONLY_TOKENS.has(token));
}

export function getSocialAcknowledgementReply() {
  return "Perfeito. Quando quiser registrar outra movimentacao, e so me mandar o valor e a descricao.";
}

export function getMissingBusinessAccountMessage() {
  return "Voce ainda nao possui uma conta PJ cadastrada. Crie sua conta empresarial na area de PJ/Minha Empresa para registrar transacoes da empresa.";
}

export function getMissingPersonalAccountMessage() {
  return "Voce ainda nao possui uma conta pessoal cadastrada. Cadastre sua conta pessoal para registrar movimentacoes.";
}

export function resolveAccountForScope(accounts: Account[], scope: AccountScope, explicitlyRequested = false): AccountResolution {
  const scopedAccounts = accounts.filter((account) => String(account.type || "").toUpperCase() === scope);
  const preferredAccount = getPreferredAccount(scopedAccounts, scope);

  if (preferredAccount) {
    return {
      ok: true,
      account: preferredAccount,
      accountType: scope,
      explicitlyRequested,
      reason:
        scope === "PJ"
          ? explicitlyRequested
            ? "explicit_business_scope"
            : "default_business_account"
          : explicitlyRequested
            ? "explicit_personal_scope"
            : "default_personal_account",
      availableAccounts: scopedAccounts,
    };
  }

  return {
    ok: false,
    account: null,
    accountType: scope,
    explicitlyRequested,
    reason: scope === "PJ" ? "missing_business_account" : "missing_personal_account",
    message: scope === "PJ" ? getMissingBusinessAccountMessage() : getMissingPersonalAccountMessage(),
    availableAccounts: scopedAccounts,
  };
}

export function resolveAccountForText(accounts: Account[], text?: string | null): AccountResolution {
  const directMatch = findDirectAccountMatch(accounts, text);
  if (directMatch) {
    const accountType = String(directMatch.type || "").toUpperCase() === "PJ" ? "PJ" : "PF";
    return {
      ok: true,
      account: directMatch,
      accountType,
      explicitlyRequested: true,
      reason: "direct_account_match",
      availableAccounts: accounts.filter((account) => String(account.type || "").toUpperCase() === accountType),
    };
  }

  const explicitScope = detectExplicitAccountScope(text);
  return resolveAccountForScope(accounts, explicitScope ?? "PF", Boolean(explicitScope));
}
