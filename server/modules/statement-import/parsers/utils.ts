import type { StatementDirection } from "../types";

const BRAZILIAN_AMOUNT_REGEX = /-?\d{1,3}(?:\.\d{3})*(?:,\d{2})|-?\d+(?:[.,]\d{2})?/;

export function decodeBase64ToBuffer(contentBase64: string): Buffer {
  return Buffer.from(contentBase64, "base64");
}

export function detectTextEncoding(buffer: Buffer): string {
  // Keep ASCII-safe heuristic. UTF-8 fallback is enough for initial version.
  return buffer.toString("utf8");
}

export function parseAmount(value: string | number): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
  }

  const sanitized = value.trim();
  if (!sanitized) return null;

  const onlyAmount = sanitized.match(BRAZILIAN_AMOUNT_REGEX)?.[0] ?? sanitized;
  const normalized = onlyAmount
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Number(Math.abs(parsed).toFixed(2));
}

export function parseSignedAmount(value: string | number): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
  }

  const sanitized = value.trim();
  if (!sanitized) return null;

  const normalized = sanitized
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(2));
}

export function parseDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const ymdMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]) - 1;
    const day = Number(ymdMatch[3]);
    const parsed = new Date(Date.UTC(year, month, day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]) - 1;
    const yearRaw = Number(slashMatch[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const parsed = new Date(Date.UTC(year, month, day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const iso = new Date(trimmed);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

export function inferDirection(params: {
  amount?: number | null;
  explicitType?: string | null;
}): StatementDirection {
  const explicitType = (params.explicitType || "").toLowerCase();
  if (["credit", "c", "entrada", "income", "in", "deposit", "crdt"].some((v) => explicitType.includes(v))) {
    return "credit";
  }
  if (["debit", "d", "saida", "expense", "out", "withdrawal", "dbit"].some((v) => explicitType.includes(v))) {
    return "debit";
  }

  return (params.amount ?? 0) < 0 ? "debit" : "credit";
}

export function sanitizeTextPayload(text: string): string {
  return text.replace(/\u0000/g, "").trim();
}

