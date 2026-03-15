export interface ParsedInvoiceItem {
  description: string;
  quantity?: number | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
}

export interface ParsedInvoice {
  merchant: string | null;
  total: number | null;
  date: string | null;
  items: ParsedInvoiceItem[];
  confidence: number;
}

function parseBrazilianAmount(raw: string) {
  const normalized = raw.replace(/[^\d,.-]/g, "");
  if (!normalized) return null;

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : ".";

  let clean = normalized;
  if (decimalSeparator === ",") {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else {
    clean = clean.replace(/,/g, "");
  }

  const value = Number(clean);
  return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

function extractAmountTokens(line: string) {
  return Array.from(line.matchAll(/\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2}/g)).map((match) => match[0]);
}

function extractLastAmountFromLine(line: string) {
  const tokens = extractAmountTokens(line);
  if (!tokens.length) return null;
  return parseBrazilianAmount(tokens[tokens.length - 1]);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function looksLikeMerchant(line: string) {
  if (line.length < 4) return false;
  if (/\d{5,}/.test(line)) return false;
  if (/http|www\.|qrcode|qr code|protocolo|consumidor|chave de acesso|consulta via/i.test(line)) return false;
  return /[A-Za-zÀ-ÿ]/.test(line);
}

function parseItemLine(line: string): ParsedInvoiceItem | null {
  const trimmed = line.trim().replace(/\s+/g, " ");
  const normalized = trimmed.replace(/^\d{5,}\s+/, "");

  const totalMatch = normalized.match(/(.+?)\s+(\d+[.,]?\d*)\s*x\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{2})$/i);
  if (totalMatch) {
    return {
      description: totalMatch[1].trim(),
      quantity: parseBrazilianAmount(totalMatch[2]),
      unitPrice: parseBrazilianAmount(totalMatch[3]),
      totalPrice: parseBrazilianAmount(totalMatch[4]),
    };
  }

  const receiptStyleMatch = normalized.match(/(.+?)\s+(\d+[.,]?\d*)\s+(un|und|kg|g|lt|l)\s+(\d+[.,]\d{2})\s+(\d+[.,]\d{2})$/i);
  if (receiptStyleMatch) {
    return {
      description: receiptStyleMatch[1].trim(),
      quantity: parseBrazilianAmount(receiptStyleMatch[2]),
      unitPrice: parseBrazilianAmount(receiptStyleMatch[4]),
      totalPrice: parseBrazilianAmount(receiptStyleMatch[5]),
    };
  }

  const amounts = extractAmountTokens(normalized);
  if (amounts.length >= 2 && /[A-Za-zÀ-ÿ]/.test(normalized)) {
    const totalToken = amounts[amounts.length - 1];
    const unitToken = amounts[amounts.length - 2];
    const description = normalized
      .replace(new RegExp(`${escapeRegex(unitToken)}\\s+${escapeRegex(totalToken)}$`), "")
      .replace(/\b\d+[.,]?\d*\s*(un|und|kg|g|lt|l)\b/i, "")
      .trim();

    if (description.length >= 3) {
      return {
        description,
        unitPrice: parseBrazilianAmount(unitToken),
        totalPrice: parseBrazilianAmount(totalToken),
      };
    }
  }

  const looseMatch = normalized.match(/(.+?)\s+(\d+[.,]\d{2})$/);
  if (!looseMatch || looseMatch[1].trim().length < 3) {
    return null;
  }

  return {
    description: looseMatch[1].trim(),
    totalPrice: parseBrazilianAmount(looseMatch[2]),
  };
}

export function parseInvoiceText(text: string): ParsedInvoice | null {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 120);

  if (!lines.length) {
    return null;
  }

  const merchant = lines.slice(0, 8).find(looksLikeMerchant) ?? lines.find(looksLikeMerchant) ?? null;
  const dateMatch = lines.join(" ").match(/\b(\d{2}\/\d{2}\/\d{2,4})\b/);
  const prioritizedTotalLine = lines.find((line) => /valor pago|valor a pagar|vlr total|v\.?\s*total|valor total|total da nota|total r\$|^total$/i.test(line));
  const secondaryTotalLine = lines.find((line) => /subtotal|totais|total/i.test(line));
  const detectedTotal = prioritizedTotalLine
    ? extractLastAmountFromLine(prioritizedTotalLine)
    : secondaryTotalLine
      ? extractLastAmountFromLine(secondaryTotalLine)
      : lines
        .slice()
        .reverse()
        .map(extractLastAmountFromLine)
        .find((value) => value !== null) ?? null;

  const items = lines
    .map(parseItemLine)
    .filter((item): item is ParsedInvoiceItem => Boolean(item))
    .slice(0, 12);

  const confidence = Number(
    Math.min(
      0.96,
      0.34 +
        (merchant ? 0.12 : 0) +
        (detectedTotal !== null ? 0.3 : 0) +
        (dateMatch ? 0.08 : 0) +
        Math.min(0.28, items.length * 0.06),
    ).toFixed(2),
  );

  if (!merchant && detectedTotal === null && !items.length) {
    return null;
  }

  return {
    merchant,
    total: detectedTotal,
    date: dateMatch?.[1] ?? null,
    items,
    confidence,
  };
}

export function formatInvoiceReplySummary(invoice: ParsedInvoice) {
  const mainItems = invoice.items.slice(0, 3).map((item) => item.description).filter(Boolean);
  const parts = [];

  if (invoice.items.length) {
    parts.push(`encontrei ${invoice.items.length} item${invoice.items.length > 1 ? "s" : ""}`);
  }
  if (invoice.total !== null) {
    parts.push(`total de R$ ${invoice.total.toFixed(2).replace(".", ",")}`);
  }
  if (invoice.merchant) {
    parts.push(`estabelecimento ${invoice.merchant}`);
  }
  if (mainItems.length) {
    parts.push(`itens principais: ${mainItems.join(", ")}`);
  }

  return parts.join(", ");
}
