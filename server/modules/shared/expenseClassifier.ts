import type { Rule, Transaction } from "@shared/schema";

type CategoryProfile = {
  category: string;
  keywords: string[];
};

export type ExpenseCategorySuggestion = {
  category: string;
  confidence: number;
  reason: string;
  usedFallback: boolean;
};

type ClassifierInput = {
  description: string;
  currentCategory?: string | null;
  history?: Array<Pick<Transaction, "description" | "category" | "type">>;
  rules?: Rule[];
};

const FALLBACK_CATEGORY = "Outros";

const GENERIC_CATEGORIES = new Set([
  "",
  "outros",
  "outras",
  "sem categoria",
  "uncategorized",
]);

const CATEGORY_PROFILES: CategoryProfile[] = [
  { category: "Mercado", keywords: ["mercado", "supermercado", "super mercado", "carrefour", "assai", "atacadao", "feira", "hortifruti"] },
  { category: "Delivery", keywords: ["ifood", "rappi", "99food", "delivery", "entrega"] },
  { category: "Alimentacao", keywords: ["restaurante", "almoco", "lanche", "padaria", "cafeteria", "comida", "coxinha", "pastel"] },
  { category: "Jantar fora", keywords: ["jantar", "pizzaria", "hamburgueria", "bar", "happy hour", "sushi"] },
  { category: "Transporte", keywords: ["uber", "99", "taxi", "gasolina", "combustivel", "posto", "estacionamento", "pedagio", "metro", "onibus"] },
  { category: "Lazer", keywords: ["cinema", "show", "ingresso", "teatro", "parque", "game", "jogo"] },
  { category: "Compras", keywords: ["amazon", "magalu", "mercado livre", "shopping", "presente", "compra", "mochila"] },
  { category: "Roupas", keywords: ["camisa", "camiseta", "calca", "vestido", "tenis", "roupa", "sapato", "renner", "cea", "zara"] },
  { category: "Saude", keywords: ["farmacia", "drogaria", "medico", "consulta", "exame", "clinica", "hospital", "remedio"] },
  { category: "Educacao", keywords: ["curso", "faculdade", "escola", "livro", "aula", "mensalidade", "udemy", "alura"] },
  { category: "Contas Fixas", keywords: ["boleto", "internet", "telefone", "celular", "plano", "seguro", "fatura", "mensalidade"] },
  { category: "Moradia", keywords: ["aluguel", "condominio", "energia", "agua", "luz", "gas", "reforma", "manutencao"] },
  { category: "Assinaturas", keywords: ["netflix", "spotify", "youtube premium", "prime video", "assinatura", "recorrencia", "streaming"] },
  { category: "Viagem", keywords: ["hotel", "passagem", "latam", "gol", "airbnb", "viagem", "booking"] },
];

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  alimentacao: "Alimentacao",
  saude: "Saude",
  educacao: "Educacao",
  vestuario: "Roupas",
  streaming: "Assinaturas",
  "luz agua": "Contas Fixas",
  aluguel: "Moradia",
};

function normalize(text: string | null | undefined) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string) {
  return normalize(text).split(" ").filter(Boolean);
}

function similarity(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (!leftTokens.size || !rightTokens.size) return 0;

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function canonicalCategory(category?: string | null) {
  const normalized = normalize(category);
  if (!normalized) return null;

  if (normalized in LEGACY_CATEGORY_MAP) {
    return LEGACY_CATEGORY_MAP[normalized];
  }

  const directProfile = CATEGORY_PROFILES.find((profile) => normalize(profile.category) === normalized);
  if (directProfile) return directProfile.category;
  if (normalized === "outros") return FALLBACK_CATEGORY;
  return category?.trim() || null;
}

function isGenericCategory(category?: string | null) {
  return GENERIC_CATEGORIES.has(normalize(category));
}

function buildFallback(reason: string, confidence: number): ExpenseCategorySuggestion {
  return {
    category: FALLBACK_CATEGORY,
    confidence: Number(confidence.toFixed(2)),
    reason,
    usedFallback: true,
  };
}

function scoreByRules(description: string, rules: Rule[] = []) {
  const normalizedDescription = normalize(description);
  for (const rule of rules) {
    if (!rule.isActive) continue;
    const contains = normalize(rule.contains);
    if (!contains) continue;
    if (normalizedDescription.includes(contains)) {
      return {
        category: canonicalCategory(rule.categoryResult) || rule.categoryResult,
        confidence: 0.99,
        reason: `regra personalizada: ${rule.ruleName}`,
        usedFallback: false,
      } satisfies ExpenseCategorySuggestion;
    }
  }

  return null;
}

export function classifyExpenseCategory(input: ClassifierInput): ExpenseCategorySuggestion {
  const description = String(input.description || "").trim();
  if (!description) {
    return buildFallback("descricao vazia", 0.1);
  }

  const currentCategory = canonicalCategory(input.currentCategory);
  if (currentCategory && !isGenericCategory(currentCategory)) {
    return {
      category: currentCategory,
      confidence: 0.99,
      reason: "categoria informada explicitamente",
      usedFallback: false,
    };
  }

  const ruleMatch = scoreByRules(description, input.rules);
  if (ruleMatch) return ruleMatch;

  const normalizedDescription = normalize(description);
  const scores = new Map<string, { score: number; reasons: string[] }>();

  const addScore = (category: string, score: number, reason: string) => {
    const current = scores.get(category) || { score: 0, reasons: [] };
    current.score += score;
    current.reasons.push(reason);
    scores.set(category, current);
  };

  for (const profile of CATEGORY_PROFILES) {
    for (const keyword of profile.keywords) {
      const normalizedKeyword = normalize(keyword);
      if (!normalizedKeyword) continue;
      if (normalizedDescription === normalizedKeyword) {
        addScore(profile.category, 0.95, `palavra-chave exata: ${keyword}`);
        continue;
      }
      if (normalizedDescription.includes(normalizedKeyword)) {
        addScore(profile.category, 0.62, `palavra-chave: ${keyword}`);
      }
    }
  }

  for (const transaction of input.history || []) {
    if (transaction.type !== "saida") continue;
    const historyCategory = canonicalCategory(transaction.category);
    if (!historyCategory || isGenericCategory(historyCategory)) continue;

    const normalizedHistory = normalize(transaction.description);
    if (!normalizedHistory) continue;

    if (normalizedHistory === normalizedDescription) {
      addScore(historyCategory, 1, "mesma descricao do historico");
      continue;
    }

    const distance = similarity(normalizedDescription, normalizedHistory);
    if (distance >= 0.8) {
      addScore(historyCategory, 0.75, "historico muito parecido");
      continue;
    }
    if (distance >= 0.5) {
      addScore(historyCategory, 0.45, "historico semelhante");
    }

    const merchantHint = tokenize(normalizedHistory).find((token) => token.length >= 4 && normalizedDescription.includes(token));
    if (merchantHint) {
      addScore(historyCategory, 0.2, `merchant do historico: ${merchantHint}`);
    }
  }

  const ranked = Array.from(scores.entries())
    .map(([category, value]) => ({ category, score: value.score, reasons: value.reasons }))
    .sort((left, right) => right.score - left.score);

  const winner = ranked[0];
  if (!winner) {
    return buildFallback("sem sinais suficientes", 0.2);
  }

  const confidence = Number(Math.min(0.99, winner.score).toFixed(2));
  if (confidence < 0.45) {
    return buildFallback(winner.reasons[0] || "sem sinais suficientes", confidence);
  }

  return {
    category: winner.category,
    confidence,
    reason: winner.reasons[0] || "heuristica semantica",
    usedFallback: false,
  };
}

export function inferExpenseCategory(description: string, input: Omit<ClassifierInput, "description"> = {}) {
  const result = classifyExpenseCategory({ description, ...input });
  return result.usedFallback ? null : result.category;
}

export function shouldAutoClassifyExpense(category?: string | null) {
  return isGenericCategory(canonicalCategory(category));
}

export function isFallbackCategory(category?: string | null) {
  return isGenericCategory(category);
}
