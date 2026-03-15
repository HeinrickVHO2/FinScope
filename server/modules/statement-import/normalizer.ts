import { createHash } from "node:crypto";
import type { NormalizedStatementEntry, RawStatementEntry, StatementDirection } from "./types";

function normalizeDescription(description: string): string {
  return description
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(?:sa|s a|ltda|me|eireli|pix|ted|doc|cartao|cartão)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCurrency(currency?: string): string {
  const normalized = (currency || "BRL").trim().toUpperCase();
  return normalized.length === 3 ? normalized : "BRL";
}

function generateFingerprint(params: {
  userId: string;
  amount: number;
  transactionDate: Date;
  normalizedDescription: string;
  direction: StatementDirection;
  currency: string;
}): string {
  const dateIso = params.transactionDate.toISOString().slice(0, 10);
  const base = [
    params.userId,
    params.amount.toFixed(2),
    dateIso,
    params.normalizedDescription,
    params.direction,
    params.currency,
  ].join("|");

  return createHash("sha256").update(base).digest("hex");
}

export function normalizeEntry(userId: string, entry: RawStatementEntry): NormalizedStatementEntry {
  const normalizedDescription = normalizeDescription(entry.description);
  const direction = entry.direction ?? (entry.amount >= 0 ? "credit" : "debit");
  const amount = Number(Math.abs(entry.amount).toFixed(2));
  const currency = normalizeCurrency(entry.currency);
  const transactionDate = new Date(entry.transactionDate);

  return {
    lineNumber: entry.lineNumber,
    transactionDate,
    amount,
    direction,
    currency,
    originalDescription: entry.description.trim(),
    normalizedDescription,
    fingerprint: generateFingerprint({
      userId,
      amount,
      transactionDate,
      normalizedDescription,
      direction,
      currency,
    }),
    rawPayload: entry.rawPayload,
    rawText: entry.rawText,
  };
}

export function normalizeDescriptionForMatching(description: string): string {
  return normalizeDescription(description);
}

