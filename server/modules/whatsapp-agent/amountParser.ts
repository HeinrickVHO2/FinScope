const NUMBER_WORD_VALUES: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
  duzentos: 200,
  trezentos: 300,
  quatrocentos: 400,
  quinhentos: 500,
  seiscentos: 600,
  setecentos: 700,
  oitocentos: 800,
  novecentos: 900,
};

const SCALE_WORDS: Record<string, number> = {
  mil: 1_000,
  milhao: 1_000_000,
  milhoes: 1_000_000,
};

const CONNECTOR_WORDS = new Set(["e", "de"]);
const CURRENCY_WORDS = new Set(["real", "reais"]);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parseLocalizedNumber(raw: string) {
  const normalized = raw.trim().replace(/\s+/g, "");
  if (!normalized) return null;

  if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(normalized)) {
    const englishStyleValue = Number(normalized.replace(/,/g, ""));
    return Number.isFinite(englishStyleValue) ? englishStyleValue : null;
  }

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : ".";

  let clean = normalized;
  if (decimalSeparator === "," && lastComma >= 0) {
    clean = normalized.replace(/\./g, "").replace(",", ".");
  } else if (lastDot >= 0 && /\.\d{1,2}$/.test(normalized)) {
    clean = normalized.replace(/,/g, "");
  } else {
    clean = normalized.replace(/[.,](?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  }

  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}

function parseWordNumberPhrase(phrase: string) {
  const tokens = normalizeText(phrase)
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (!tokens.length) return null;

  let total = 0;
  let current = 0;
  let consumedNumberWord = false;

  for (const token of tokens) {
    if (CONNECTOR_WORDS.has(token) || CURRENCY_WORDS.has(token)) {
      continue;
    }

    if (token in NUMBER_WORD_VALUES) {
      current += NUMBER_WORD_VALUES[token];
      consumedNumberWord = true;
      continue;
    }

    if (token in SCALE_WORDS) {
      const scale = SCALE_WORDS[token];
      const base = current || 1;
      total += base * scale;
      current = 0;
      consumedNumberWord = true;
      continue;
    }

    return null;
  }

  if (!consumedNumberWord) return null;

  const value = total + current;
  return value > 0 ? value : null;
}

function extractScaledNumericAmount(text: string) {
  const normalized = normalizeText(text);
  const regex = /(\d+(?:[.,]\d+)?)\s*(k|mil|milhao|milhoes)\b(?:\s+reais?)?/g;
  const matches = Array.from(normalized.matchAll(regex));
  if (!matches.length) return null;

  const match = matches[matches.length - 1];
  const numericValue = parseLocalizedNumber(match[1]);
  if (numericValue === null) return null;

  const multiplier = match[2] === "k" || match[2] === "mil"
    ? 1_000
    : 1_000_000;

  const amount = numericValue * multiplier;
  return Number.isFinite(amount) && amount > 0 ? Number(amount.toFixed(2)) : null;
}

function extractPlainNumericAmount(text: string) {
  const regex = /(?:r\$\s*)?(-?\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|-?\d+(?:[.,]\d{1,2})?)/gi;
  const matches = Array.from(text.matchAll(regex));

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    const raw = match[0];
    const offset = match.index ?? 0;
    const before = text[offset - 1] ?? "";
    const after = text[offset + raw.length] ?? "";

    if (before === "/" || after === "/" || before === ":" || after === ":") {
      continue;
    }

    const value = parseLocalizedNumber(match[1]);
    if (value === null) continue;
    if (value <= 0) continue;
    return Number(value.toFixed(2));
  }

  return null;
}

function extractWordBasedAmount(text: string) {
  const tokens = normalizeText(text)
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  let best: { value: number; length: number } | null = null;

  for (let start = 0; start < tokens.length; start += 1) {
    const token = tokens[start];
    if (!(token in NUMBER_WORD_VALUES) && !(token in SCALE_WORDS)) {
      continue;
    }

    const collected: string[] = [];
    for (let end = start; end < tokens.length; end += 1) {
      const current = tokens[end];
      const isAllowed = current in NUMBER_WORD_VALUES
        || current in SCALE_WORDS
        || CONNECTOR_WORDS.has(current)
        || CURRENCY_WORDS.has(current);

      if (!isAllowed) break;
      collected.push(current);
    }

    const phrase = collected.join(" ");
    const hasScaleWord = collected.some((item) => item in SCALE_WORDS);
    const hasCurrencyWord = collected.some((item) => CURRENCY_WORDS.has(item));
    const numericWordCount = collected.filter((item) => item in NUMBER_WORD_VALUES || item in SCALE_WORDS).length;
    if (!hasScaleWord && !hasCurrencyWord && numericWordCount < 2) {
      continue;
    }

    const value = parseWordNumberPhrase(phrase);
    if (value === null) continue;

    if (!best || collected.length > best.length) {
      best = { value, length: collected.length };
    }
  }

  return best ? Number(best.value.toFixed(2)) : null;
}

export function parseMonetaryAmountFromNaturalLanguage(text: string) {
  const scaledNumeric = extractScaledNumericAmount(text);
  if (scaledNumeric !== null) return scaledNumeric;

  const plainNumeric = extractPlainNumericAmount(text);
  if (plainNumeric !== null) return plainNumeric;

  return extractWordBasedAmount(text);
}
