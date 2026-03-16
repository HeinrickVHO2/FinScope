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

type InvoiceDateCandidate = {
  value: string;
  score: number;
  index: number;
};

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

function normalizeInvoiceDateToken(raw: string) {
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (!match) return null;

  const day = match[1];
  const month = match[2];
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${day}/${month}/${year}`;
}

function scoreInvoiceDateLine(line: string) {
  if (/data de emiss[aã]o|emiss[aã]o|emitid[ao]/i.test(line)) return 120;
  if (/data da compra|data compra|data da venda|data venda/i.test(line)) return 115;
  if (/data\/hora|data hora|data:/i.test(line)) return 105;
  if (/autoriza[cç][aã]o|protocolo|consulta via|chave de acesso/i.test(line)) return 40;
  return 80;
}

export function extractInvoiceDate(text: string) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 120);

  const candidates: InvoiceDateCandidate[] = [];

  lines.forEach((line, index) => {
    const matches = Array.from(line.matchAll(/\b(\d{2}\/\d{2}\/\d{2,4})\b/g));
    matches.forEach((match) => {
      const normalized = normalizeInvoiceDateToken(match[1]);
      if (!normalized) return;
      candidates.push({
        value: normalized,
        score: scoreInvoiceDateLine(line),
        index,
      });
    });
  });

  if (!candidates.length) return null;

  candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.index - right.index;
  });

  return candidates[0]?.value ?? null;
}

export function parseInvoiceCalendarDate(value: string) {
  const normalized = normalizeInvoiceDateToken(value);
  if (!normalized) return null;

  const [day, month, year] = normalized.split("/");
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  const detectedDate = extractInvoiceDate(lines.join("\n"));
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
        (detectedDate ? 0.08 : 0) +
        Math.min(0.28, items.length * 0.06),
    ).toFixed(2),
  );

  if (!merchant && detectedTotal === null && !items.length) {
    return null;
  }

  return {
    merchant,
    total: detectedTotal,
    date: detectedDate,
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
