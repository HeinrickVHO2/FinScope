import type { ParsedWhatsAppIntent } from "./types";
import { parseMonetaryAmountFromNaturalLanguage } from "./amountParser";
import { inferExpenseCategory } from "../shared/expenseClassifier";

const removeAccents = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const normalizeText = (value: string) =>
  removeAccents(value)
    .replace(/\s+/g, " ")
    .trim();

const INCOME_KEYWORDS = ["recebi", "entrou", "ganhei", "vendi", "pix recebido", "depositaram", "pagaram"];
const EXPENSE_KEYWORDS = ["gastei", "paguei", "comprei", "uber", "mercado", "pix enviado", "boleto", "conta"];

function inferIncomeCategory(text: string) {
  const normalized = normalizeText(text);
  if (/\bsalario\b|\bprolabore\b|\bfolha\b/.test(normalized)) return "Salario";
  if (/\bcliente\b|\bvenda\b|\bpedido\b|\bnota\b/.test(normalized)) return "Vendas";
  return null;
}

export function parseAmountFromWhatsAppText(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "");
  if (!normalized) return null;

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : ".";
  let clean = normalized;

  if (decimalSeparator === ",") {
    clean = normalized.replace(/\./g, "").replace(",", ".");
  } else if (lastDot >= 0) {
    clean = normalized.replace(/,/g, "");
  } else {
    clean = normalized.replace(/,/g, ".");
  }

  const amount = Number(clean);
  return Number.isFinite(amount) ? Math.abs(Number(amount.toFixed(2))) : null;
}

export function extractAmountFromText(text: string) {
  return parseMonetaryAmountFromNaturalLanguage(text);
}

export function extractTransactionDateFromText(text: string) {
  const normalized = normalizeText(text);
  const today = new Date();

  if (normalized.includes("ontem")) {
    const value = new Date(today);
    value.setDate(today.getDate() - 1);
    return value.toISOString().slice(0, 10);
  }

  if (normalized.includes("amanha")) {
    const value = new Date(today);
    value.setDate(today.getDate() + 1);
    return value.toISOString().slice(0, 10);
  }

  const explicit = normalized.match(/(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/);
  if (explicit) {
    const year = explicit[3] ? (explicit[3].length === 2 ? `20${explicit[3]}` : explicit[3]) : String(today.getFullYear());
    return `${year}-${explicit[2].padStart(2, "0")}-${explicit[1].padStart(2, "0")}`;
  }

  return today.toISOString().slice(0, 10);
}

export function detectIntentType(text: string): "income" | "expense" | null {
  const normalized = normalizeText(text);
  if (INCOME_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "income";
  if (EXPENSE_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "expense";
  if (inferExpenseCategory(text)) return "expense";
  return null;
}

export function inferCategorySuggestion(text: string) {
  const intentType = detectIntentType(text);
  if (intentType === "expense") return inferExpenseCategory(text);
  if (intentType === "income") return inferIncomeCategory(text);
  return inferExpenseCategory(text);
}

export function extractMerchantName(text: string) {
  const normalized = text.trim();
  const patterns = [
    /(?:no|na|em)\s+([\p{L}0-9\s.&-]{3,})/iu,
    /(?:para|pro|pra)\s+([\p{L}0-9\s.&-]{3,})/iu,
    /(?:cliente|loja)\s+([\p{L}0-9\s.&-]{3,})/iu,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

export function inferDescription(text: string, merchantName: string | null, categorySuggestion: string | null) {
  const normalized = text
    .replace(/(?:r\$\s*)?-?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|-?\d+(?:[.,]\d{2})?/gi, "")
    .replace(/\b(hoje|ontem|amanh[aã])\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (merchantName) return merchantName;
  if (normalized.length >= 4) return normalized;
  return categorySuggestion || "Lancamento via WhatsApp";
}

export function parseWhatsAppTransactionIntents(text: string): ParsedWhatsAppIntent[] {
  const segments = text
    .split(/\r?\n/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const intents: ParsedWhatsAppIntent[] = [];

  segments.forEach((segment) => {
    const proposedType = detectIntentType(segment);
    const amount = extractAmountFromText(segment);
    if (!proposedType || amount === null) return;

    const merchantName = extractMerchantName(segment);
    const categorySuggestion = inferCategorySuggestion(segment);
    const description = inferDescription(segment, merchantName, categorySuggestion);
    const transactionDate = extractTransactionDateFromText(segment);

    intents.push({
      proposedType,
      amount,
      currency: "BRL",
      description,
      merchantName,
      categorySuggestion,
      transactionDate,
      confidenceScore: Number(
        Math.min(
          0.98,
          0.55 +
            (merchantName ? 0.1 : 0) +
            (categorySuggestion ? 0.1 : 0) +
            (transactionDate ? 0.08 : 0) +
            (description.length >= 6 ? 0.1 : 0),
        ).toFixed(2),
      ),
      evidence: {
        rawSegment: segment,
      },
    });
  });

  return intents;
}
