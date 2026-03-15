import type {
  DiscardedStatementRow,
  ParsedStatementCsv,
  ParsedStatementRow,
  StatementDirection,
} from "./types";

const HEADER_ALIASES: Record<string, string[]> = {
  transaction_date: [
    "data",
    "data lancamento",
    "data movimentacao",
    "movimentacao",
    "lancamento",
    "postedat",
    "date",
  ],
  description: [
    "descricao",
    "historico",
    "memo",
    "detalhes",
    "favorecido",
    "estabelecimento",
    "descricao lancamento",
  ],
  amount: ["valor", "amount", "valor final", "quantia", "total"],
  debit: ["debito", "saida", "withdrawal", "debit"],
  credit: ["credito", "entrada", "deposit", "credit"],
  currency: ["moeda", "currency"],
  direction: ["tipo", "natureza", "operacao"],
};

const removeAccents = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const normalizeHeaderKey = (value: string) =>
  removeAccents(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function detectDelimiter(text: string): "," | ";" {
  const sample = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0);

  if (!sample) {
    return ",";
  }

  const commas = (sample.match(/,/g) || []).length;
  const semicolons = (sample.match(/;/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

function parseCsvRecords(text: string, delimiter: "," | ";"): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  const normalized = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      row.push(current.trim());
      current = "";
      if (row.some((cell) => cell.length > 0)) {
        records.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) {
      records.push(row);
    }
  }

  return records;
}

function mapHeaderIndexes(headers: string[]) {
  const normalized = headers.map(normalizeHeaderKey);
  const result: Record<string, number> = {};

  Object.entries(HEADER_ALIASES).forEach(([canonical, aliases]) => {
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index >= 0) {
      result[canonical] = index;
    }
  });

  return result;
}

export function normalizeStatementDescription(description: string) {
  return removeAccents(description)
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseStatementAmount(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }

  const negative = trimmed.includes("-") || /^\(.*\)$/.test(trimmed);
  const clean = trimmed.replace(/[^\d,.-]/g, "").replace(/[()]/g, "");
  if (!clean) {
    return null;
  }

  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : ".";

  let normalized = clean;
  if (decimalSeparator === ",") {
    normalized = clean.replace(/\./g, "").replace(",", ".");
  } else if (lastDot >= 0) {
    normalized = clean.replace(/,/g, "");
  } else {
    normalized = clean.replace(/,/g, ".");
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) {
    return null;
  }

  const absolute = Math.abs(amount);
  return negative ? -absolute : absolute;
}

export function parseStatementDate(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const br = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    const month = br[2].padStart(2, "0");
    const day = br[1].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inferDirectionFromType(value: string): StatementDirection | null {
  const normalized = normalizeHeaderKey(value);
  if (["credito", "credit", "entrada", "deposit"].includes(normalized)) {
    return "credit";
  }
  if (["debito", "debit", "saida", "withdrawal"].includes(normalized)) {
    return "debit";
  }
  return null;
}

function buildRawPayload(headers: string[], row: string[]) {
  return headers.reduce<Record<string, string>>((accumulator, header, index) => {
    accumulator[header] = row[index] ?? "";
    return accumulator;
  }, {});
}

function toParsedRow(
  headers: string[],
  row: string[],
  lineNumber: number,
  indexes: Record<string, number>,
): ParsedStatementRow | DiscardedStatementRow {
  const rawPayload = buildRawPayload(headers, row);
  const rawText = row.join(" | ");

  const originalDescription = row[indexes.description] || "";
  const normalizedDescription = normalizeStatementDescription(originalDescription);
  const transactionDate = parseStatementDate(row[indexes.transaction_date] || "");
  const currency = (row[indexes.currency] || "BRL").trim().toUpperCase() || "BRL";

  const amountValue = indexes.amount >= 0 ? parseStatementAmount(row[indexes.amount] || "") : null;
  const creditValue = indexes.credit >= 0 ? parseStatementAmount(row[indexes.credit] || "") : null;
  const debitValue = indexes.debit >= 0 ? parseStatementAmount(row[indexes.debit] || "") : null;
  const explicitDirection = indexes.direction >= 0 ? inferDirectionFromType(row[indexes.direction] || "") : null;

  let direction: StatementDirection | null = explicitDirection;
  let amount = amountValue;

  if (amount === null && creditValue !== null) {
    amount = Math.abs(creditValue);
    direction = "credit";
  }

  if (amount === null && debitValue !== null) {
    amount = Math.abs(debitValue);
    direction = "debit";
  }

  if (amount !== null && direction === null) {
    direction = amount < 0 ? "debit" : "credit";
    amount = Math.abs(amount);
  }

  if (!transactionDate) {
    return {
      lineNumber,
      reason: "Data inválida ou ausente",
      rawPayload,
      rawText,
    };
  }

  if (!originalDescription || !normalizedDescription) {
    return {
      lineNumber,
      reason: "Descrição inválida ou ausente",
      rawPayload,
      rawText,
    };
  }

  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    return {
      lineNumber,
      reason: "Valor inválido ou ausente",
      rawPayload,
      rawText,
    };
  }

  if (!direction) {
    return {
      lineNumber,
      reason: "Não foi possível identificar se é entrada ou saída",
      rawPayload,
      rawText,
    };
  }

  return {
    lineNumber,
    rawPayload,
    rawText,
    originalDescription,
    normalizedDescription,
    amount: Number(amount.toFixed(2)),
    transactionDate,
    direction,
    currency,
  };
}

export function parseBankStatementCsv(csvText: string): ParsedStatementCsv {
  if (!csvText || !csvText.trim()) {
    throw new Error("O arquivo CSV está vazio.");
  }

  const delimiter = detectDelimiter(csvText);
  const records = parseCsvRecords(csvText, delimiter);
  if (!records.length) {
    throw new Error("Não foi possível ler o conteúdo do CSV.");
  }

  const headers = records[0];
  const indexes = mapHeaderIndexes(headers);
  if (indexes.transaction_date === undefined || indexes.description === undefined) {
    throw new Error("O arquivo precisa ter colunas de data e descrição.");
  }

  if (
    indexes.amount === undefined &&
    indexes.credit === undefined &&
    indexes.debit === undefined
  ) {
    throw new Error("O arquivo precisa ter coluna de valor, crédito ou débito.");
  }

  const parsedRows: ParsedStatementRow[] = [];
  const discardedRows: DiscardedStatementRow[] = [];

  records.slice(1).forEach((row, rowIndex) => {
    const result = toParsedRow(headers, row, rowIndex + 2, indexes);
    if ("reason" in result) {
      discardedRows.push(result);
      return;
    }
    parsedRows.push(result);
  });

  return {
    delimiter,
    headers,
    parsedRows,
    discardedRows,
    totalRows: Math.max(0, records.length - 1),
  };
}
