import type {
  ParsedStatementRow,
  ReconciliationDecision,
  TransactionMatchCandidate,
} from "./types";

const dateDistanceInDays = (left: string, right: string) => {
  const leftDate = new Date(`${left}T00:00:00Z`);
  const rightDate = new Date(`${right}T00:00:00Z`);
  return Math.abs(leftDate.getTime() - rightDate.getTime()) / (1000 * 60 * 60 * 24);
};

const tokenize = (value: string) =>
  value
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

export function calculateDescriptionSimilarity(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  });

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

export function scoreTransactionMatch(entry: ParsedStatementRow, transaction: TransactionMatchCandidate) {
  const amountDiff = Math.abs(entry.amount - transaction.amount);
  const dateDiff = dateDistanceInDays(entry.transactionDate, transaction.date);
  const descriptionSimilarity = calculateDescriptionSimilarity(
    entry.normalizedDescription,
    transaction.description,
  );

  let score = 0;

  if (amountDiff <= 0.01) {
    score += 0.45;
  } else if (amountDiff <= 1) {
    score += 0.2;
  }

  if (dateDiff === 0) {
    score += 0.25;
  } else if (dateDiff <= 1) {
    score += 0.15;
  } else if (dateDiff <= 3) {
    score += 0.05;
  }

  score += Math.min(0.25, descriptionSimilarity * 0.25);

  const expectedType = entry.direction === "credit" ? "entrada" : "saida";
  if ((transaction.type || "").toLowerCase() === expectedType) {
    score += 0.05;
  }

  return Number(Math.min(1, score).toFixed(4));
}

export function reconcileStatementEntry(
  entry: ParsedStatementRow & { fingerprint: string },
  transactions: TransactionMatchCandidate[],
  knownFingerprints: Set<string>,
): ReconciliationDecision {
  if (knownFingerprints.has(entry.fingerprint)) {
    return {
      status: "duplicate",
      matchedTransactionId: null,
      confidenceScore: 1,
      reason: "Essa linha já apareceu em outro extrato importado.",
    };
  }

  const scored = transactions
    .map((transaction) => ({
      transaction,
      score: scoreTransactionMatch(entry, transaction),
    }))
    .filter((item) => item.score >= 0.45)
    .sort((left, right) => right.score - left.score);

  if (!scored.length) {
    return {
      status: "pending_review",
      matchedTransactionId: null,
      confidenceScore: 0.2,
      reason: "Não encontramos uma transação parecida o bastante. Vale revisar antes de importar.",
    };
  }

  const [best, second] = scored;
  if (best.score >= 0.86 && (!second || best.score - second.score >= 0.08)) {
    return {
      status: "matched",
      matchedTransactionId: best.transaction.id,
      confidenceScore: best.score,
      reason: "Encontramos uma transação já cadastrada com alta confiança.",
    };
  }

  if (best.score >= 0.65) {
    return {
      status: "conflict",
      matchedTransactionId: best.transaction.id,
      confidenceScore: best.score,
      reason: "Existe mais de uma possibilidade parecida. Melhor revisar antes de confirmar.",
    };
  }

  return {
    status: "pending_review",
    matchedTransactionId: best.transaction.id,
    confidenceScore: best.score,
    reason: "Há um item parecido, mas a confiança ainda não está alta.",
  };
}
