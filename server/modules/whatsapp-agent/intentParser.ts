import type { FinancialIntent } from "./types";

function parseAmount(text: string): number | null {
  const match = text.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?)/);
  if (!match) return null;

  const normalized = match[1]
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? Number(value.toFixed(2)) : null;
}

function parseType(text: string): "income" | "expense" | "unknown" {
  const normalized = text.toLowerCase();
  const incomeKeywords = ["recebi", "ganhei", "entrada", "faturamento", "caiu", "freela", "pix recebido"];
  const expenseKeywords = ["gastei", "paguei", "saida", "despesa", "comprei", "pix enviado", "boleto"];

  if (incomeKeywords.some((keyword) => normalized.includes(keyword))) return "income";
  if (expenseKeywords.some((keyword) => normalized.includes(keyword))) return "expense";
  return "unknown";
}

function parseDate(text: string): Date {
  const normalized = text.toLowerCase();
  const now = new Date();

  if (normalized.includes("ontem")) {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const explicit = normalized.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (explicit) {
    const day = Number(explicit[1]);
    const month = Number(explicit[2]) - 1;
    const yearRaw = explicit[3] ? Number(explicit[3]) : now.getFullYear();
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return now;
}

function extractMerchant(description: string): string | undefined {
  const normalized = description.toLowerCase();
  const connectors = [" com ", " no ", " na ", " em "];

  for (const connector of connectors) {
    const idx = normalized.indexOf(connector);
    if (idx >= 0) {
      const merchant = description.slice(idx + connector.length).trim();
      if (merchant.length > 2) return merchant;
    }
  }

  return undefined;
}

function suggestCategory(description: string, kind: "income" | "expense" | "unknown"): string | undefined {
  const normalized = description.toLowerCase();

  if (kind === "income") {
    if (/salario|folha|pagamento/.test(normalized)) return "Salário";
    if (/freela|cliente|faturamento/.test(normalized)) return "Freelance";
    return "Outros";
  }

  if (kind === "expense") {
    if (/gasolina|combust|uber|transporte/.test(normalized)) return "Transporte";
    if (/mercado|supermerc|padaria/.test(normalized)) return "Alimentação";
    if (/farmacia|remedio|medic/.test(normalized)) return "Saúde";
    return "Outros";
  }

  return undefined;
}

export class FinancialIntentParser {
  parse(input: { text?: string; ocrText?: string }): FinancialIntent {
    const text = [input.text, input.ocrText].filter(Boolean).join(" ").trim();
    const normalizedText = text.replace(/\s+/g, " ").trim();

    const amount = parseAmount(normalizedText);
    const kind = parseType(normalizedText);
    const transactionDate = parseDate(normalizedText);
    const description = normalizedText || "Mensagem recebida via WhatsApp";
    const merchant = extractMerchant(description);
    const categorySuggestion = suggestCategory(description, kind);

    const missingFields: string[] = [];
    if (!amount) missingFields.push("amount");
    if (kind === "unknown") missingFields.push("kind");

    let confidence = 0.3;
    if (amount) confidence += 0.35;
    if (kind !== "unknown") confidence += 0.2;
    if (description.length >= 8) confidence += 0.1;
    if (input.ocrText?.trim()) confidence += 0.05;

    confidence = Number(Math.min(0.99, confidence).toFixed(2));

    return {
      kind,
      amount,
      description,
      merchant,
      categorySuggestion,
      transactionDate,
      confidence,
      missingFields,
    };
  }
}

