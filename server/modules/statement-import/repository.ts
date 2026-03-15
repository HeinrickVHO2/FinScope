import { supabase } from "../../supabase";
import type { NormalizedStatementEntry, ReconciliationResult, ReconciliationStatus, StatementFileType, StatementImportSummary } from "./types";

export type UploadProcessingStatus = "queued" | "processing" | "completed" | "failed";
export type UploadStatus = "received" | "validated" | "rejected";

export interface StatementUploadRecord {
  id: string;
  userId: string;
  accountId: string;
  fileName: string;
  fileType: StatementFileType;
  fileSizeBytes: number;
  uploadStatus: UploadStatus;
  processingStatus: UploadProcessingStatus;
  dateToleranceDays: number;
  summary: StatementImportSummary | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StatementEntryRecord {
  id: string;
  uploadId: string;
  lineNumber: number;
  originalDescription: string;
  normalizedDescription: string;
  amount: number;
  transactionDate: string;
  direction: "credit" | "debit";
  currency: string;
  fingerprint: string;
  reconciliationStatus: ReconciliationStatus;
  matchedTransactionId: string | null;
  confidenceScore: number | null;
  reconciliationReason: string | null;
  createdTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapUploadRow(row: any): StatementUploadRecord {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSizeBytes: row.file_size_bytes,
    uploadStatus: row.upload_status,
    processingStatus: row.processing_status,
    dateToleranceDays: row.date_tolerance_days ?? 3,
    summary: row.summary ?? null,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEntryRow(row: any): StatementEntryRecord {
  return {
    id: row.id,
    uploadId: row.upload_id,
    lineNumber: row.line_number,
    originalDescription: row.original_description,
    normalizedDescription: row.normalized_description,
    amount: Number(row.amount),
    transactionDate: row.transaction_date,
    direction: row.direction,
    currency: row.currency,
    fingerprint: row.fingerprint,
    reconciliationStatus: row.reconciliation_status,
    matchedTransactionId: row.matched_transaction_id,
    confidenceScore: row.confidence_score === null ? null : Number(row.confidence_score),
    reconciliationReason: row.reconciliation_reason,
    createdTransactionId: row.created_transaction_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class StatementImportRepository {
  async createUpload(params: {
    userId: string;
    accountId: string;
    fileName: string;
    fileType: StatementFileType;
    fileSizeBytes: number;
    dateToleranceDays: number;
    uploadStatus: UploadStatus;
    processingStatus: UploadProcessingStatus;
  }): Promise<StatementUploadRecord> {
    const { data, error } = await supabase
      .from("bank_statement_uploads")
      .insert({
        user_id: params.userId,
        account_id: params.accountId,
        file_name: params.fileName,
        file_type: params.fileType,
        file_size_bytes: params.fileSizeBytes,
        date_tolerance_days: params.dateToleranceDays,
        upload_status: params.uploadStatus,
        processing_status: params.processingStatus,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Erro ao criar upload de extrato");
    }

    return mapUploadRow(data);
  }

  async getUploadById(uploadId: string): Promise<StatementUploadRecord | null> {
    const { data, error } = await supabase
      .from("bank_statement_uploads")
      .select("*")
      .eq("id", uploadId)
      .maybeSingle();

    if (error || !data) return null;
    return mapUploadRow(data);
  }

  async getUploadsByUser(userId: string, limit = 20): Promise<StatementUploadRecord[]> {
    const { data, error } = await supabase
      .from("bank_statement_uploads")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.map(mapUploadRow);
  }

  async updateUpload(uploadId: string, patch: Partial<{
    uploadStatus: UploadStatus;
    processingStatus: UploadProcessingStatus;
    summary: StatementImportSummary;
    errorMessage: string | null;
  }>): Promise<void> {
    const data: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (patch.uploadStatus !== undefined) data.upload_status = patch.uploadStatus;
    if (patch.processingStatus !== undefined) data.processing_status = patch.processingStatus;
    if (patch.summary !== undefined) data.summary = patch.summary;
    if (patch.errorMessage !== undefined) data.error_message = patch.errorMessage;

    const { error } = await supabase
      .from("bank_statement_uploads")
      .update(data)
      .eq("id", uploadId);

    if (error) {
      throw new Error(error.message || "Erro ao atualizar upload");
    }
  }

  async createEntries(uploadId: string, userId: string, entries: Array<NormalizedStatementEntry & ReconciliationResult>): Promise<void> {
    if (!entries.length) return;

    const rows = entries.map((entry) => ({
      upload_id: uploadId,
      user_id: userId,
      line_number: entry.lineNumber,
      raw_payload: entry.rawPayload ?? null,
      raw_text: entry.rawText ?? null,
      original_description: entry.originalDescription,
      normalized_description: entry.normalizedDescription,
      amount: entry.amount,
      transaction_date: entry.transactionDate.toISOString(),
      direction: entry.direction,
      currency: entry.currency,
      fingerprint: entry.fingerprint,
      reconciliation_status: entry.status,
      matched_transaction_id: entry.matchedTransactionId,
      confidence_score: entry.confidenceScore,
      reconciliation_reason: entry.reason,
    }));

    const { error } = await supabase
      .from("bank_statement_entries")
      .insert(rows);

    if (error) {
      throw new Error(error.message || "Erro ao salvar movimentações do extrato");
    }
  }

  async createReconciliationRows(uploadId: string, userId: string): Promise<void> {
    const { data, error } = await supabase
      .from("bank_statement_entries")
      .select("id, matched_transaction_id, reconciliation_status, confidence_score, reconciliation_reason")
      .eq("upload_id", uploadId)
      .eq("user_id", userId);

    if (error || !data) {
      throw new Error(error?.message || "Erro ao carregar entradas reconciliadas");
    }

    if (!data.length) return;

    const rows = data.map((entry: any) => ({
      upload_id: uploadId,
      user_id: userId,
      statement_entry_id: entry.id,
      matched_transaction_id: entry.matched_transaction_id,
      reconciliation_status: entry.reconciliation_status,
      confidence_score: entry.confidence_score,
      score_breakdown: null,
      reason: entry.reconciliation_reason,
      decided_by: "system",
    }));

    const { error: insertError } = await supabase.from("transaction_reconciliations").insert(rows);
    if (insertError) {
      throw new Error(insertError.message || "Erro ao registrar reconciliação");
    }
  }

  async getEntriesByUpload(uploadId: string, userId: string): Promise<StatementEntryRecord[]> {
    const { data, error } = await supabase
      .from("bank_statement_entries")
      .select("*")
      .eq("upload_id", uploadId)
      .eq("user_id", userId)
      .order("line_number", { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(mapEntryRow);
  }

  async getKnownFingerprints(userId: string): Promise<Set<string>> {
    const { data, error } = await supabase
      .from("bank_statement_entries")
      .select("fingerprint")
      .eq("user_id", userId)
      .in("reconciliation_status", ["matched", "imported", "duplicate"]);

    if (error || !data) {
      return new Set();
    }

    return new Set(data.map((row: any) => row.fingerprint).filter(Boolean));
  }

  async updateEntryStatus(params: {
    entryId: string;
    userId: string;
    status: ReconciliationStatus;
    reason?: string;
  }): Promise<StatementEntryRecord | null> {
    const { data, error } = await supabase
      .from("bank_statement_entries")
      .update({
        reconciliation_status: params.status,
        reconciliation_reason: params.reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.entryId)
      .eq("user_id", params.userId)
      .select("*")
      .maybeSingle();

    if (error || !data) return null;
    return mapEntryRow(data);
  }

  async markEntryImported(params: {
    entryId: string;
    userId: string;
    createdTransactionId: string;
  }): Promise<void> {
    const { error } = await supabase
      .from("bank_statement_entries")
      .update({
        reconciliation_status: "imported",
        created_transaction_id: params.createdTransactionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.entryId)
      .eq("user_id", params.userId);

    if (error) {
      throw new Error(error.message || "Erro ao marcar item como importado");
    }

    const { error: reconciliationError } = await supabase
      .from("transaction_reconciliations")
      .update({
        reconciliation_status: "imported",
        matched_transaction_id: params.createdTransactionId,
        decided_by: "user",
        updated_at: new Date().toISOString(),
      })
      .eq("statement_entry_id", params.entryId)
      .eq("user_id", params.userId);

    if (reconciliationError) {
      throw new Error(reconciliationError.message || "Erro ao atualizar vínculo de reconciliação");
    }
  }

  async appendLog(params: {
    uploadId: string;
    userId: string;
    level: "info" | "warn" | "error";
    event: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await supabase
      .from("import_processing_logs")
      .insert({
        upload_id: params.uploadId,
        user_id: params.userId,
        level: params.level,
        event: params.event,
        message: params.message,
        metadata: params.metadata ?? null,
      });

    if (error) {
      throw new Error(error.message || "Erro ao gravar log de importação");
    }
  }
}

