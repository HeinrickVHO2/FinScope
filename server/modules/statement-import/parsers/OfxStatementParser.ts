import type { RawStatementEntry } from "../types";
import { parseDate, parseSignedAmount, inferDirection, detectTextEncoding, sanitizeTextPayload } from "./utils";
import type { StatementParser } from "./StatementParser";

function extractTagValue(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^\r\n<]+)`, "i");
  const match = block.match(regex);
  return (match?.[1] || "").trim();
}

export class OfxStatementParser implements StatementParser {
  readonly fileType = "ofx" as const;

  async parse(content: Buffer): Promise<RawStatementEntry[]> {
    const text = sanitizeTextPayload(detectTextEncoding(content));
    const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];

    if (!blocks.length) {
      throw new Error("OFX inválido: nenhum bloco STMTTRN encontrado");
    }

    const entries: RawStatementEntry[] = [];

    blocks.forEach((block, index) => {
      const dateText = extractTagValue(block, "DTPOSTED");
      const description = extractTagValue(block, "MEMO") || extractTagValue(block, "NAME") || "Movimentação OFX";
      const amountText = extractTagValue(block, "TRNAMT");
      const trnType = extractTagValue(block, "TRNTYPE");
      const currency = extractTagValue(block, "CURDEF") || "BRL";

      const date = parseDate(dateText);
      const signedAmount = parseSignedAmount(amountText);

      if (!date || signedAmount === null) return;

      entries.push({
        lineNumber: index + 1,
        transactionDate: date,
        amount: Number(Math.abs(signedAmount).toFixed(2)),
        direction: inferDirection({ amount: signedAmount, explicitType: trnType }),
        description,
        currency,
        rawPayload: {
          trnType,
          dateText,
          amountText,
        },
        rawText: block,
      });
    });

    if (!entries.length) {
      throw new Error("OFX processado, mas nenhuma movimentação válida foi identificada");
    }

    return entries;
  }
}

