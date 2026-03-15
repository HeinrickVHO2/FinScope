import type { StatementFileType } from "./types";
import type { StatementParser } from "./parsers/StatementParser";
import { CsvStatementParser } from "./parsers/CsvStatementParser";
import { OfxStatementParser } from "./parsers/OfxStatementParser";
import { PdfStatementParser } from "./parsers/PdfStatementParser";

export class StatementParserFactory {
  private readonly parsers: Record<StatementFileType, StatementParser>;

  constructor() {
    this.parsers = {
      csv: new CsvStatementParser(),
      ofx: new OfxStatementParser(),
      pdf: new PdfStatementParser(),
    };
  }

  getParser(fileType: StatementFileType): StatementParser {
    const parser = this.parsers[fileType];
    if (!parser) {
      throw new Error(`Formato de extrato não suportado: ${fileType}`);
    }

    return parser;
  }
}

