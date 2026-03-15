import type { RawStatementEntry } from "../types";
import { parseAmount, parseDate, parseSignedAmount, inferDirection, detectTextEncoding, sanitizeTextPayload } from "./utils";
import type { StatementParser } from "./StatementParser";

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["data", "date", "dt", "transaction_date"],
  description: ["descricao", "descrição", "description", "historico", "histórico", "memo"],
  amount: ["valor", "amount", "valor_total"],
  debit: ["debito", "débito", "debit", "saida", "saída"],
  credit: ["credito", "crédito", "credit", "entrada"],
  type: ["tipo", "type", "movimento"],
  currency: ["moeda", "currency"],
};

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function findHeaderIndex(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = headers.findIndex((header) => header === alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  out.push(current.trim());
  return out;
}

export class CsvStatementParser implements StatementParser {
  readonly fileType = "csv" as const;

  async parse(content: Buffer): Promise<RawStatementEntry[]> {
    const text = sanitizeTextPayload(detectTextEncoding(content));
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new Error("CSV inválido: nenhuma linha de movimentação encontrada");
    }

    const delimiter = lines[0].includes(";") ? ";" : ",";
    const rawHeaders = splitCsvLine(lines[0], delimiter).map(normalizeHeader);

    const indices = {
      date: findHeaderIndex(rawHeaders, HEADER_ALIASES.date),
      description: findHeaderIndex(rawHeaders, HEADER_ALIASES.description),
      amount: findHeaderIndex(rawHeaders, HEADER_ALIASES.amount),
      debit: findHeaderIndex(rawHeaders, HEADER_ALIASES.debit),
      credit: findHeaderIndex(rawHeaders, HEADER_ALIASES.credit),
      type: findHeaderIndex(rawHeaders, HEADER_ALIASES.type),
      currency: findHeaderIndex(rawHeaders, HEADER_ALIASES.currency),
    };

    if (indices.date < 0 || indices.description < 0 || (indices.amount < 0 && indices.debit < 0 && indices.credit < 0)) {
      throw new Error("CSV inválido: cabeçalho não contém colunas mínimas (data, descrição e valor)");
    }

    const entries: RawStatementEntry[] = [];

    for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
      const rawLine = lines[lineIndex];
      const values = splitCsvLine(rawLine, delimiter);
      const date = parseDate(values[indices.date] || "");
      if (!date) continue;

      const description = (values[indices.description] || "").trim();
      if (!description) continue;

      let parsedAmount: number | null = null;
      let directionType: string | null = null;

      if (indices.amount >= 0) {
        parsedAmount = parseSignedAmount(values[indices.amount] || "");
      }

      if (parsedAmount === null && indices.debit >= 0) {
        const debitAmount = parseAmount(values[indices.debit] || "");
        if (debitAmount !== null && debitAmount > 0) {
          parsedAmount = -debitAmount;
          directionType = "debit";
        }
      }

      if (parsedAmount === null && indices.credit >= 0) {
        const creditAmount = parseAmount(values[indices.credit] || "");
        if (creditAmount !== null && creditAmount > 0) {
          parsedAmount = creditAmount;
          directionType = "credit";
        }
      }

      if (parsedAmount === null) continue;

      const explicitType = indices.type >= 0 ? values[indices.type] : directionType;
      const direction = inferDirection({ amount: parsedAmount, explicitType });

      entries.push({
        lineNumber: lineIndex + 1,
        transactionDate: date,
        amount: Number(Math.abs(parsedAmount).toFixed(2)),
        direction,
        description,
        currency: indices.currency >= 0 ? values[indices.currency] || undefined : "BRL",
        rawPayload: {
          values,
          delimiter,
        },
        rawText: rawLine,
      });
    }

    if (!entries.length) {
      throw new Error("CSV processado, mas nenhuma movimentação válida foi identificada");
    }

    return entries;
  }
}

