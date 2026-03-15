import type { IStorage } from "../../storage";
import { StatementParserFactory } from "./parserFactory";
import { normalizeDescriptionForMatching, normalizeEntry } from "./normalizer";
import { ReconciliationEngine } from "./reconciliationEngine";
import { StatementImportRepository } from "./repository";
import type {
  NormalizedStatementEntry,
  ReconciliationResult,
  ReconciliationStatus,
  StatementImportSummary,
  StatementUploadRequest,
} from "./types";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(["csv", "ofx", "pdf"]);

function detectMaliciousPayload(content: Buffer): boolean {
  if (!content.length) return true;

  const sample = content.subarray(0, Math.min(content.length, 250_000)).toString("utf8").toLowerCase();
  const nullChars = [...content.subarray(0, Math.min(content.length, 10_000))].filter((b) => b === 0).length;
  const nullRatio = nullChars / Math.min(content.length, 10_000);

  if (nullRatio > 0.2) return true;
  if (sample.includes("<script") || sample.includes("<?php") || sample.includes("powershell") || sample.includes("cmd.exe")) {
    return true;
  }

  return false;
}

function summarize(entries: Array<{ reconciliationStatus: ReconciliationStatus }>): StatementImportSummary {
  const initial: StatementImportSummary = {
    totalFound: entries.length,
    newItems: 0,
    reconciled: 0,
    duplicated: 0,
    conflicts: 0,
  };

  entries.forEach((entry) => {
    if (entry.reconciliationStatus === "matched") initial.reconciled += 1;
    if (entry.reconciliationStatus === "pending_review") initial.newItems += 1;
    if (entry.reconciliationStatus === "duplicate") initial.duplicated += 1;
    if (entry.reconciliationStatus === "conflict") initial.conflicts += 1;
  });

  return initial;
}

function categoryFromDescription(description: string): string {
  const normalized = normalizeDescriptionForMatching(description);

  const rules: Array<{ category: string; keywords: string[] }> = [
    { category: "Mercado", keywords: ["mercado", "supermerc", "atac"] },
    { category: "Transporte", keywords: ["uber", "gasolina", "combust", "estacion"] },
    { category: "Saúde", keywords: ["farmacia", "hospital", "consulta"] },
    { category: "Moradia", keywords: ["aluguel", "condominio", "energia", "agua"] },
    { category: "Salário", keywords: ["salario", "folha", "pagamento"] },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.category;
    }
  }

  return "Outros";
}

export class StatementImportService {
  private readonly parserFactory: StatementParserFactory;
  private readonly reconciliationEngine: ReconciliationEngine;
  private readonly pendingContents: Map<string, Buffer>;

  constructor(
    private readonly repository: StatementImportRepository,
    private readonly storage: IStorage,
  ) {
    this.parserFactory = new StatementParserFactory();
    this.reconciliationEngine = new ReconciliationEngine();
    this.pendingContents = new Map();
  }

  async enqueueUploadJob(request: StatementUploadRequest): Promise<{ uploadId: string }> {
    const fileType = request.fileType.toLowerCase();
    if (!ALLOWED_FILE_TYPES.has(fileType)) {
      throw new Error("Esse tipo de arquivo não é aceito. Use PDF, CSV ou OFX.");
    }

    const account = await this.storage.getAccount(request.accountId);
    if (!account || account.userId !== request.userId) {
      throw new Error("Escolha uma conta válida para importar o extrato.");
    }

    const content = Buffer.from(request.contentBase64, "base64");
    if (!content.length) {
      throw new Error("Não conseguimos ler esse arquivo.");
    }
    if (content.length > MAX_UPLOAD_BYTES) {
      throw new Error("O arquivo passou do limite de 8 MB.");
    }
    if (detectMaliciousPayload(content)) {
      throw new Error("Esse arquivo foi bloqueado por segurança.");
    }

    const upload = await this.repository.createUpload({
      userId: request.userId,
      accountId: request.accountId,
      fileName: request.fileName,
      fileType: fileType as "csv" | "ofx" | "pdf",
      fileSizeBytes: content.length,
      dateToleranceDays: request.dateToleranceDays ?? 3,
      uploadStatus: "validated",
      processingStatus: "queued",
    });

    await this.repository.appendLog({
      uploadId: upload.id,
      userId: request.userId,
      level: "info",
      event: "upload_queued",
      message: "Upload recebido e enfileirado para processamento",
      metadata: {
        fileName: request.fileName,
        fileType,
        bytes: content.length,
      },
    });

    this.pendingContents.set(upload.id, content);
    setImmediate(() => {
      this.processUpload(upload.id).catch((error) => {
        console.error("[STATEMENT_IMPORT] processing failed:", error);
      });
    });

    return { uploadId: upload.id };
  }

  async listUploads(userId: string) {
    return this.repository.getUploadsByUser(userId);
  }

  async getUploadDetails(userId: string, uploadId: string) {
    const upload = await this.repository.getUploadById(uploadId);
    if (!upload || upload.userId !== userId) {
      return null;
    }

    const entries = await this.repository.getEntriesByUpload(uploadId, userId);

    return {
      upload,
      entries,
      summary: upload.summary ?? summarize(entries),
    };
  }

  async updateEntryStatus(params: {
    userId: string;
    uploadId: string;
    entryId: string;
    status: ReconciliationStatus;
    reason?: string;
  }) {
    const upload = await this.repository.getUploadById(params.uploadId);
    if (!upload || upload.userId !== params.userId) {
      throw new Error("Não encontramos essa importação.");
    }

    if (!["ignored", "pending_review", "conflict"].includes(params.status)) {
      throw new Error("Não foi possível atualizar esse item.");
    }

    const updated = await this.repository.updateEntryStatus({
      entryId: params.entryId,
      userId: params.userId,
      status: params.status,
      reason: params.reason,
    });

    if (!updated) {
      throw new Error("Não encontramos essa movimentação do extrato.");
    }

    await this.repository.appendLog({
      uploadId: params.uploadId,
      userId: params.userId,
      level: "info",
      event: "entry_status_updated",
      message: "Status da entrada alterado manualmente",
      metadata: {
        entryId: params.entryId,
        status: params.status,
      },
    });

    return updated;
  }

  async confirmImport(params: {
    userId: string;
    uploadId: string;
    includePendingReview?: boolean;
  }): Promise<{ importedCount: number }> {
    const upload = await this.repository.getUploadById(params.uploadId);
    if (!upload || upload.userId !== params.userId) {
      throw new Error("Não encontramos essa importação.");
    }

    if (upload.processingStatus !== "completed") {
      throw new Error("Essa importação ainda está sendo analisada.");
    }

    const account = await this.storage.getAccount(upload.accountId);
    if (!account || account.userId !== params.userId) {
      throw new Error("A conta escolhida para essa importação não está disponível.");
    }

    const entries = await this.repository.getEntriesByUpload(upload.id, params.userId);
    const importable = entries.filter((entry) => {
      if (entry.reconciliationStatus === "ignored") return false;
      if (entry.reconciliationStatus === "imported") return false;
      if (entry.reconciliationStatus === "pending_review") return true;
      return Boolean(params.includePendingReview) && entry.reconciliationStatus === "conflict";
    });

    let importedCount = 0;
    const accountType = account.type?.toLowerCase() === "pj" ? "PJ" : "PF";

    for (const entry of importable) {
      const type = entry.direction === "credit" ? "entrada" : "saida";
      const transaction = await this.storage.createTransaction({
        userId: params.userId,
        accountId: upload.accountId,
        description: entry.originalDescription,
        type,
        amount: entry.amount,
        category: categoryFromDescription(entry.originalDescription),
        date: new Date(entry.transactionDate),
        accountType,
        source: "statement_import",
      });

      await this.repository.markEntryImported({
        entryId: entry.id,
        userId: params.userId,
        createdTransactionId: transaction.id,
      });

      importedCount += 1;
    }

    const refreshedEntries = await this.repository.getEntriesByUpload(upload.id, params.userId);
    const summary = summarize(refreshedEntries);

    await this.repository.updateUpload(upload.id, {
      summary,
    });

    await this.repository.appendLog({
      uploadId: upload.id,
      userId: params.userId,
      level: "info",
      event: "import_confirmed",
      message: "Importação confirmada e transações persistidas",
      metadata: {
        importedCount,
      },
    });

    return { importedCount };
  }

  private async processUpload(uploadId: string): Promise<void> {
    const upload = await this.repository.getUploadById(uploadId);
    if (!upload) return;

    const content = this.pendingContents.get(uploadId);
    if (!content) {
      await this.repository.updateUpload(uploadId, {
        processingStatus: "failed",
        errorMessage: "Não encontramos o arquivo para concluir a importação.",
      });
      return;
    }

    try {
      await this.repository.updateUpload(uploadId, {
        processingStatus: "processing",
      });

      await this.repository.appendLog({
        uploadId,
        userId: upload.userId,
        level: "info",
        event: "processing_started",
        message: "Processamento de extrato iniciado",
      });

      const parser = this.parserFactory.getParser(upload.fileType);
      const rawEntries = await parser.parse(content);
      const normalizedEntries = rawEntries.map((entry) => normalizeEntry(upload.userId, entry));

      const existingTransactions = await this.storage.getTransactionsByUserId(upload.userId, "ALL");
      const existingCandidates = existingTransactions.map((transaction) => ({
        transactionId: transaction.id,
        amount: Number(transaction.amount),
        type: transaction.type === "entrada" ? ("entrada" as const) : ("saida" as const),
        date: new Date(transaction.date),
        description: transaction.description,
        normalizedDescription: normalizeDescriptionForMatching(transaction.description),
      }));
      const knownFingerprints = await this.repository.getKnownFingerprints(upload.userId);

      const reconciledEntries: Array<NormalizedStatementEntry & ReconciliationResult> = normalizedEntries.map((entry) => {
        const result = this.reconciliationEngine.reconcile({
          entry,
          existingTransactions: existingCandidates,
          knownFingerprints,
        });

        // Prevent duplicate creation within the same upload run.
        if (result.status !== "conflict" && result.status !== "pending_review") {
          knownFingerprints.add(entry.fingerprint);
        }

        return {
          ...entry,
          ...result,
        };
      });

      await this.repository.createEntries(uploadId, upload.userId, reconciledEntries);
      await this.repository.createReconciliationRows(uploadId, upload.userId);

      const summary = summarize(
        reconciledEntries.map((entry) => ({ reconciliationStatus: entry.status }))
      );

      await this.repository.updateUpload(uploadId, {
        processingStatus: "completed",
        summary,
        errorMessage: null,
      });

      await this.repository.appendLog({
        uploadId,
        userId: upload.userId,
        level: "info",
        event: "processing_completed",
        message: "Processamento de extrato concluído",
        metadata: {
          total: summary.totalFound,
          newItems: summary.newItems,
          reconciled: summary.reconciled,
          duplicates: summary.duplicated,
          conflicts: summary.conflicts,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível concluir a importação deste arquivo.";
      await this.repository.updateUpload(uploadId, {
        processingStatus: "failed",
        errorMessage: message,
      });
      await this.repository.appendLog({
        uploadId,
        userId: upload.userId,
        level: "error",
        event: "processing_failed",
        message,
      });
    } finally {
      this.pendingContents.delete(uploadId);
    }
  }
}

