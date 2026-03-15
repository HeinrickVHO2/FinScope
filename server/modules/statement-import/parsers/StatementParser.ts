import type { RawStatementEntry, StatementFileType } from "../types";

export interface StatementParser {
  readonly fileType: StatementFileType;
  parse(content: Buffer): Promise<RawStatementEntry[]>;
}

