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

function looksLikeMerchant(line: string) {
  if (line.length < 4) return false;
  if (/\d{5,}/.test(line)) return false;
  return /[A-Za-zÀ-ÿ]/.test(line);
}

function parseItemLine(line: string): ParsedInvoiceItem | null {
  const trimmed = line.trim().replace(/\s+/g, " ");
  const totalMatch = trimmed.match(/(.+?)\s+(\d+[.,]?\d*)\s*x\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{2})$/i);
  if (totalMatch) {
    return {
      description: totalMatch[1].trim(),
      quantity: parseBrazilianAmount(totalMatch[2]),
      unitPrice: parseBrazilianAmount(totalMatch[3]),
      totalPrice: parseBrazilianAmount(totalMatch[4]),
    };
  }

  const looseMatch = trimmed.match(/(.+?)\s+(\d+[.,]\d{2})$/);
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

  const merchant = lines.find(looksLikeMerchant) ?? null;
  const dateMatch = lines.join(" ").match(/\b(\d{2}\/\d{2}\/\d{2,4})\b/);
  const totalLine = lines.find((line) => /total|valor total|vl total|subtotal/i.test(line));
  const detectedTotal = totalLine
    ? parseBrazilianAmount(totalLine)
    : parseBrazilianAmount(lines.slice().reverse().find((line) => /\d+[.,]\d{2}/.test(line)) || "");

  const items = lines
    .map(parseItemLine)
    .filter((item): item is ParsedInvoiceItem => Boolean(item))
    .slice(0, 12);

  const confidence = Number(
    Math.min(
      0.94,
      0.35 +
        (merchant ? 0.1 : 0) +
        (detectedTotal !== null ? 0.28 : 0) +
        (dateMatch ? 0.08 : 0) +
        Math.min(0.25, items.length * 0.06),
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
