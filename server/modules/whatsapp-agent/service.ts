import { createHash } from "node:crypto";
import type { IStorage } from "../../storage";
import { normalizeDescriptionForMatching } from "../statement-import/normalizer";
import { FinancialIntentParser } from "./intentParser";
import { MockOcrProvider } from "./ocr";
import { normalizePhone } from "./phone";
import { WhatsAppRepository } from "./repository";
import type { WhatsAppInboundEvent } from "./types";

const AUTO_CONFIRM_THRESHOLD = 0.85;

function categoryFromIntent(kind: "income" | "expense", suggestion?: string): string {
  if (suggestion) return suggestion;
  return kind === "income" ? "Outros" : "Outros";
}

export class WhatsAppAgentService {
  private readonly parser: FinancialIntentParser;
  private readonly ocrProvider: MockOcrProvider;

  constructor(
    private readonly repository: WhatsAppRepository,
    private readonly storage: IStorage,
  ) {
    this.parser = new FinancialIntentParser();
    this.ocrProvider = new MockOcrProvider();
  }

  async bindPhone(userId: string, phoneRaw: string) {
    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      throw new Error("Telefone inválido");
    }

    return this.repository.bindPhone({
      userId,
      phone,
      provider: "whatsapp_cloud_api",
    });
  }

  async getBinding(userId: string) {
    return this.repository.getBindingByUser(userId);
  }

  async listPendingCandidates(userId: string) {
    return this.repository.listCandidatesByUser(userId, "pending_review");
  }

  async confirmCandidate(params: { userId: string; candidateId: string }) {
    const candidate = await this.repository.getCandidateById(params.candidateId, params.userId);
    if (!candidate) {
      throw new Error("Candidato não encontrado");
    }

    if (candidate.status === "confirmed") {
      return { transactionId: candidate.persisted_transaction_id };
    }

    const candidateKind = candidate.proposed_type === "income" ? "income" : "expense";
    const account = await this.getDefaultAccount(params.userId);
    const transaction = await this.storage.createTransaction({
      userId: params.userId,
      accountId: account.id,
      description: candidate.description,
      type: candidateKind === "income" ? "entrada" : "saida",
      amount: Number(candidate.amount),
      category: candidate.category_suggestion || categoryFromIntent(candidateKind),
      date: new Date(candidate.transaction_date),
      accountType: account.type.toLowerCase() === "pj" ? "PJ" : "PF",
      source: "whatsapp_agent",
    });

    await this.repository.updateCandidate({
      candidateId: params.candidateId,
      userId: params.userId,
      status: "confirmed",
      persistedTransactionId: transaction.id,
    });

    return { transactionId: transaction.id };
  }

  async processInboundEvent(event: WhatsAppInboundEvent): Promise<{ status: string }> {
    const existing = await this.repository.findInboundByProviderMessageId(event.providerMessageId);
    if (existing) {
      return { status: "already_processed" };
    }

    const fromPhone = normalizePhone(event.fromPhone);
    if (!fromPhone) {
      throw new Error("Telefone de origem inválido");
    }

    const userId = await this.repository.findUserByPhone(fromPhone);
    const inbound = await this.repository.createInboundMessage({
      event: {
        ...event,
        fromPhone,
      },
      userId,
      status: userId ? "received" : "pending_user_link",
    });

    if (!userId) {
      await this.repository.appendProcessingLog({
        inboundMessageId: inbound.id,
        level: "warn",
        event: "phone_not_linked",
        message: "Mensagem recebida sem usuário vinculado ao telefone",
        metadata: { fromPhone },
      });
      return { status: "pending_user_link" };
    }

    const ocrTexts: string[] = [];

    if (event.media?.length) {
      for (const media of event.media) {
        const ocrResult = await this.ocrProvider.extractText({
          mimeType: media.mimeType,
          url: media.url,
          base64: media.base64,
        });

        const base = media.base64 || media.url || media.id;
        const hash = createHash("sha256").update(base).digest("hex");

        await this.repository.createMediaEvidence({
          inboundMessageId: inbound.id,
          userId,
          mediaType: event.type,
          mimeType: media.mimeType,
          storagePath: media.url || `mock://whatsapp/${media.id}`,
          sha256: hash,
          fileSizeBytes: media.base64 ? Buffer.from(media.base64, "base64").byteLength : 0,
          ocrText: ocrResult.text,
          ocrConfidence: ocrResult.confidence,
          status: "processed",
        });

        if (ocrResult.text) {
          ocrTexts.push(ocrResult.text);
        }
      }
    }

    const intent = this.parser.parse({
      text: event.text,
      ocrText: ocrTexts.join(" "),
    });

    const normalizedDescription = normalizeDescriptionForMatching(intent.description);
    const isAutoConfirmable =
      intent.kind !== "unknown" &&
      intent.amount !== null &&
      intent.confidence >= AUTO_CONFIRM_THRESHOLD;

    let persistedTransactionId: string | undefined;
    const intentKind = intent.kind === "income" ? "income" : "expense";
    if (isAutoConfirmable) {
      const account = await this.getDefaultAccount(userId);
      const transaction = await this.storage.createTransaction({
        userId,
        accountId: account.id,
        description: intent.description,
        type: intentKind === "income" ? "entrada" : "saida",
        amount: intent.amount!,
        category: categoryFromIntent(intentKind, intent.categorySuggestion),
        date: intent.transactionDate,
        accountType: account.type.toLowerCase() === "pj" ? "PJ" : "PF",
        source: "whatsapp_agent",
      });

      persistedTransactionId = transaction.id;
    }

    await this.repository.createCandidate({
      userId,
      inboundMessageId: inbound.id,
      kind: intentKind,
      amount: intent.amount ?? 0,
      currency: "BRL",
      description: intent.description,
      merchant: intent.merchant,
      categorySuggestion: intent.categorySuggestion,
      transactionDate: intent.transactionDate,
      confidenceScore: intent.confidence,
      status: isAutoConfirmable ? "confirmed" : "pending_review",
      evidence: {
        missingFields: intent.missingFields,
        normalizedDescription,
      },
      persistedTransactionId,
    });

    await this.repository.updateInboundMessage({
      id: inbound.id,
      status: isAutoConfirmable ? "auto_confirmed" : "pending_review",
      confidenceScore: intent.confidence,
      extractedPayload: {
        kind: intent.kind,
        amount: intent.amount,
        description: intent.description,
        merchant: intent.merchant,
        categorySuggestion: intent.categorySuggestion,
        transactionDate: intent.transactionDate.toISOString(),
        missingFields: intent.missingFields,
      },
    });

    await this.repository.appendProcessingLog({
      inboundMessageId: inbound.id,
      userId,
      level: "info",
      event: "inbound_processed",
      message: isAutoConfirmable
        ? "Transação criada automaticamente pelo agente"
        : "Mensagem processada e marcada para revisão manual",
      metadata: {
        confidence: intent.confidence,
        autoConfirmed: isAutoConfirmable,
        persistedTransactionId,
      },
    });

    return { status: isAutoConfirmable ? "auto_confirmed" : "pending_review" };
  }

  private async getDefaultAccount(userId: string) {
    const accounts = await this.storage.getAccountsByUserId(userId);
    if (!accounts.length) {
      throw new Error("Usuário sem conta financeira configurada");
    }

    const pfAccount = accounts.find((account) => account.type.toLowerCase() === "pf");
    return pfAccount || accounts[0];
  }
}

