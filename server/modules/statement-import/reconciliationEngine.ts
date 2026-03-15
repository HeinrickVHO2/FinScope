import type {
  NormalizedStatementEntry,
  ReconciliationCandidate,
  ReconciliationConfig,
  ReconciliationResult,
  ReconciliationScoreBreakdown,
} from "./types";
import { normalizeDescriptionForMatching } from "./normalizer";

function tokenSet(text: string): Set<string> {
  return new Set(text.split(" ").filter((token) => token.length > 2));
}

function descriptionSimilarity(left: string, right: string): number {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  if (!leftTokens.size || !rightTokens.size) return 0;

  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1;
  });

  const union = leftTokens.size + rightTokens.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function dayDifference(left: Date, right: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const leftDay = Date.UTC(left.getUTCFullYear(), left.getUTCMonth(), left.getUTCDate());
  const rightDay = Date.UTC(right.getUTCFullYear(), right.getUTCMonth(), right.getUTCDate());
  return Math.abs(Math.round((leftDay - rightDay) / msPerDay));
}

function buildScoreBreakdown(params: {
  entry: NormalizedStatementEntry;
  candidate: ReconciliationCandidate;
  config: ReconciliationConfig;
}): ReconciliationScoreBreakdown {
  const { entry, candidate, config } = params;

  const amountDiff = Math.abs(entry.amount - candidate.amount);
  const amountScore = amountDiff < 0.01 ? 1 : amountDiff <= 1 ? 0.5 : 0;

  const dateDiff = dayDifference(entry.transactionDate, candidate.date);
  const dateScore = dateDiff <= config.dateToleranceDays
    ? Math.max(0, 1 - dateDiff / (config.dateToleranceDays + 1))
    : 0;

  const descriptionScore = descriptionSimilarity(entry.normalizedDescription, candidate.normalizedDescription);

  const expectedType = entry.direction === "credit" ? "entrada" : "saida";
  const directionScore = candidate.type === expectedType ? 1 : 0;

  return {
    amount: amountScore,
    date: dateScore,
    description: descriptionScore,
    direction: directionScore,
  };
}

function totalScore(breakdown: ReconciliationScoreBreakdown): number {
  return Number(
    (
      breakdown.amount * 0.45 +
      breakdown.date * 0.25 +
      breakdown.description * 0.2 +
      breakdown.direction * 0.1
    ).toFixed(4)
  );
}

export class ReconciliationEngine {
  private readonly config: ReconciliationConfig;

  constructor(config?: Partial<ReconciliationConfig>) {
    this.config = {
      dateToleranceDays: config?.dateToleranceDays ?? 3,
    };
  }

  reconcile(params: {
    entry: NormalizedStatementEntry;
    existingTransactions: ReconciliationCandidate[];
    knownFingerprints: Set<string>;
  }): ReconciliationResult {
    const { entry, existingTransactions, knownFingerprints } = params;

    if (knownFingerprints.has(entry.fingerprint)) {
      return {
        status: "duplicate",
        confidenceScore: 1,
        matchedTransactionId: null,
        scoreBreakdown: { amount: 1, date: 1, description: 1, direction: 1 },
        reason: "Fingerprint já importado anteriormente",
      };
    }

    let bestCandidate: ReconciliationCandidate | null = null;
    let bestBreakdown: ReconciliationScoreBreakdown = { amount: 0, date: 0, description: 0, direction: 0 };
    let bestScore = 0;

    for (const candidate of existingTransactions) {
      const candidateForScore: ReconciliationCandidate = {
        ...candidate,
        normalizedDescription: normalizeDescriptionForMatching(candidate.description),
      };
      const breakdown = buildScoreBreakdown({ entry, candidate: candidateForScore, config: this.config });
      const score = totalScore(breakdown);

      if (score > bestScore) {
        bestScore = score;
        bestBreakdown = breakdown;
        bestCandidate = candidate;
      }
    }

    if (bestCandidate && bestScore >= 0.82) {
      return {
        status: "matched",
        confidenceScore: bestScore,
        matchedTransactionId: bestCandidate.transactionId,
        scoreBreakdown: bestBreakdown,
        reason: "Correspondência forte com transação existente",
      };
    }

    if (
      bestCandidate &&
      bestBreakdown.amount >= 0.5 &&
      bestBreakdown.date > 0 &&
      bestBreakdown.description >= 0.3
    ) {
      return {
        status: "duplicate",
        confidenceScore: bestScore,
        matchedTransactionId: bestCandidate.transactionId,
        scoreBreakdown: bestBreakdown,
        reason: "Possível duplicidade com transação já cadastrada",
      };
    }

    if (
      bestCandidate &&
      bestBreakdown.description >= 0.75 &&
      bestBreakdown.date > 0 &&
      bestBreakdown.amount < 0.5
    ) {
      return {
        status: "conflict",
        confidenceScore: bestScore,
        matchedTransactionId: bestCandidate.transactionId,
        scoreBreakdown: bestBreakdown,
        reason: "Possível conflito de valor/data para descrição semelhante",
      };
    }

    return {
      status: "pending_review",
      confidenceScore: bestScore,
      matchedTransactionId: bestCandidate?.transactionId ?? null,
      scoreBreakdown: bestBreakdown,
      reason: "Novo item sugerido para criação",
    };
  }
}

