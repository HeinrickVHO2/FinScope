import type { RawStatementEntry } from "../types";
import { parseAmount, parseDate, detectTextEncoding, sanitizeTextPayload } from "./utils";
import type { StatementParser } from "./StatementParser";

const DATE_PATTERN = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
const AMOUNT_PATTERN = /(-?\d{1,3}(?:\.\d{3})*(?:,\d{2})|-?\d+(?:[.,]\d{2}))/g;

function extractReadableText(rawPdfText: string): string {
  const literalTextMatches = rawPdfText.match(/\(([^()]{2,260})\)/g) || [];
  if (!literalTextMatches.length) {
    return rawPdfText;
  }

  return literalTextMatches
    .map((segment) => segment.slice(1, -1))
    .join("\n");
}

export class PdfStatementParser implements StatementParser {
  readonly fileType = "pdf" as const;

  async parse(content: Buffer): Promise<RawStatementEntry[]> {
    const fallbackText = sanitizeTextPayload(detectTextEncoding(content));
    const text = extractReadableText(fallbackText);

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.length > 5);

    const entries: RawStatementEntry[] = [];

    lines.forEach((line, idx) => {
      const dateMatch = line.match(DATE_PATTERN);
      if (!dateMatch) return;

      const amounts = [...line.matchAll(AMOUNT_PATTERN)].map((match) => match[1]);
      if (!amounts.length) return;

      const transactionDate = parseDate(dateMatch[1]);
      const rawAmount = amounts[amounts.length - 1];
      const amount = parseAmount(rawAmount);
      if (!transactionDate || amount === null) return;

      const normalizedLine = line.replace(dateMatch[1], "").replace(rawAmount, "").trim();
      const description = normalizedLine.length > 3 ? normalizedLine : `Movimentação PDF #${idx + 1}`;
      const isDebit = /debito|débito|saida|saída|pagamento|compra/i.test(line);

      entries.push({
        lineNumber: idx + 1,
        transactionDate,
        amount,
        direction: isDebit ? "debit" : "credit",
        description,
        currency: "BRL",
        rawPayload: {
          line,
          date: dateMatch[1],
          amount: rawAmount,
        },
        rawText: line,
      });
    });

    if (!entries.length) {
      throw new Error(
        "Não foi possível extrair movimentações do PDF com segurança. Faça revisão manual ou use CSV/OFX."
      );
    }

    return entries;
  }
}

