export type StatementFileType = "csv" | "ofx" | "pdf";
export type StatementDirection = "credit" | "debit";

export type ReconciliationStatus =
  | "pending_review"
  | "matched"
  | "imported"
  | "duplicate"
  | "conflict"
  | "ignored";

export interface RawStatementEntry {
  lineNumber: number;
  transactionDate: Date;
  amount: number;
  direction?: StatementDirection;
  description: string;
  currency?: string;
  rawPayload?: Record<string, unknown>;
  rawText?: string;
}

export interface NormalizedStatementEntry {
  lineNumber: number;
  transactionDate: Date;
  amount: number;
  direction: StatementDirection;
  currency: string;
  originalDescription: string;
  normalizedDescription: string;
  fingerprint: string;
  rawPayload?: Record<string, unknown>;
  rawText?: string;
}

export interface ReconciliationCandidate {
  transactionId: string;
  amount: number;
  type: "entrada" | "saida";
  date: Date;
  description: string;
  normalizedDescription: string;
}

export interface ReconciliationScoreBreakdown {
  amount: number;
  date: number;
  description: number;
  direction: number;
}

export interface ReconciliationResult {
  status: ReconciliationStatus;
  confidenceScore: number;
  matchedTransactionId: string | null;
  scoreBreakdown: ReconciliationScoreBreakdown;
  reason: string;
}

export interface ReconciliationConfig {
  dateToleranceDays: number;
}

export interface StatementImportSummary {
  totalFound: number;
  newItems: number;
  reconciled: number;
  duplicated: number;
  conflicts: number;
}

export interface StatementUploadRequest {
  userId: string;
  accountId: string;
  fileName: string;
  fileType: StatementFileType;
  contentBase64: string;
  dateToleranceDays?: number;
}

