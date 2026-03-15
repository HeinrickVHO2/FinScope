import { createHash, randomInt } from "node:crypto";
import type { IStorage } from "../../storage";
import { normalizeDescriptionForMatching } from "../statement-import/normalizer";
import { getWhatsAppMetaConfig } from "./config";
import { FinancialIntentParser } from "./intentParser";
import { MockOcrProvider } from "./ocr";
import { buildWhatsAppConversationUrl, normalizePhone } from "./phone";
import type { WhatsAppRepository } from "./repository";
import type {
  PendingPhoneBinding,
  WhatsAppInboundEvent,
  WhatsAppSessionState,
} from "./types";

const BINDING_TTL_MS = 15 * 60 * 1000;

function categoryFromIntent(kind: "income" | "expense", suggestion?: string): string {
  if (suggestion) return suggestion;
  return kind === "income" ? "Outros" : "Outros";
}

function generateBindingCode() {
  const value = randomInt(100000, 999999);
  return String(value);
}

function buildConversationUrl(phone: string | null, text?: string) {
  return buildWhatsAppConversationUrl(
    phone,
    text,
    text ? "server_binding_start_conversation_link" : "server_session_conversation_link",
  );
}

export class WhatsAppAgentService {
  private readonly parser: FinancialIntentParser;
  private readonly ocrProvider: MockOcrProvider;
  private readonly pendingBindingsByCode = new Map<string, PendingPhoneBinding>();
  private readonly pendingBindingsByUser = new Map<string, PendingPhoneBinding>();

  constructor(
    private readonly repository: WhatsAppRepository,
    private readonly storage: IStorage,
  ) {
    this.parser = new FinancialIntentParser();
    this.ocrProvider = new MockOcrProvider();
  }

  async getSession(userId: string): Promise<WhatsAppSessionState> {
    this.cleanupExpiredBindings();

    const user = await this.storage.getUser(userId);
    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    const binding = await this.repository.getBindingByUser(userId);
    const pendingBinding = this.pendingBindingsByUser.get(userId) || null;
    const eligible = user.billingStatus === "active";
    const businessPhone = this.getBusinessPhone();

    const instructions = eligible
      ? [
          "Informe seu número.",
          "Copie o código gerado.",
          "Envie esse código para o WhatsApp do FinScope.",
          "Depois disso, suas mensagens podem virar sugestões de transação.",
        ]
      : [
          "Este recurso fica disponível para assinantes ativos.",
          "Ative sua assinatura para conectar o WhatsApp e enviar gastos e recebimentos por mensagem.",
        ];

    return {
      eligible,
      billingStatus: user.billingStatus,
      plan: user.plan,
      instructions,
      businessPhone,
      conversationUrl: binding?.phone_e164 ? buildConversationUrl(businessPhone) : null,
      binding: {
        isLinked: Boolean(binding?.phone_e164),
        phone: binding?.phone_e164 ?? null,
        provider: binding?.provider ?? null,
        verified: binding?.is_verified ?? false,
      },
      pendingBinding,
    };
  }

  async startBinding(userId: string, phoneRaw: string) {
    await this.assertActiveSubscriber(userId);

    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      throw new Error("Informe um número válido com DDD.");
    }

    const existingBinding = await this.repository.getBindingByPhone(phone);
    if (existingBinding && existingBinding.user_id !== userId && existingBinding.is_verified !== false) {
      throw new Error("Esse número já está conectado a outra conta.");
    }

    const code = generateBindingCode();
    const pending: PendingPhoneBinding = {
      userId,
      phone,
      code,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + BINDING_TTL_MS).toISOString(),
    };

    const previous = this.pendingBindingsByUser.get(userId);
    if (previous) {
      this.pendingBindingsByCode.delete(previous.code);
    }

    this.pendingBindingsByUser.set(userId, pending);
    this.pendingBindingsByCode.set(code, pending);

    this.logInternal("info", "binding_code_generated", "Codigo de vinculo gerado", {
      userId,
      phone,
      expiresAt: pending.expiresAt,
      message: "Código de vínculo gerado",
    });

    return {
      phone,
      code,
      expiresAt: pending.expiresAt,
      businessPhone: this.getBusinessPhone(),
      conversationUrl: buildConversationUrl(this.getBusinessPhone(), code),
    };
  }

  async disconnectPhone(userId: string) {
    const binding = await this.repository.getBindingByUser(userId);
    if (!binding) {
      return { removed: false };
    }

    await this.repository.deleteBindingByUser(userId);
    const pending = this.pendingBindingsByUser.get(userId);
    if (pending) {
      this.pendingBindingsByCode.delete(pending.code);
      this.pendingBindingsByUser.delete(userId);
    }

    this.logInternal("info", "binding_removed", "WhatsApp binding removed", {
      userId,
      phone: binding.phone_e164,
      event: "binding_removed",
      message: "Vínculo do WhatsApp removido",
      metadata: {
        phone: binding.phone_e164,
      },
    });

    return { removed: true };
  }

  async listPendingCandidates(userId: string) {
    await this.assertActiveSubscriber(userId);
    return this.repository.listCandidatesByUser(userId, "pending_review");
  }

  async confirmCandidate(params: { userId: string; candidateId: string; accountId?: string }) {
    await this.assertActiveSubscriber(params.userId);

    const candidate = await this.repository.getCandidateById(params.candidateId, params.userId);
    if (!candidate) {
      throw new Error("Sugestão não encontrada.");
    }

    if (candidate.status === "ignored") {
      throw new Error("Essa sugestão foi ignorada.");
    }

    if (candidate.status === "confirmed") {
      return { transactionId: candidate.persisted_transaction_id };
    }

    const amount = Number(candidate.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Ainda faltam dados para confirmar essa sugestão.");
    }

    const candidateKind = candidate.proposed_type === "income" ? "income" : "expense";
    const account = await this.getAccountForConfirmation(params.userId, params.accountId);
    const transaction = await this.storage.createTransaction({
      userId: params.userId,
      accountId: account.id,
      description: candidate.description,
      type: candidateKind === "income" ? "entrada" : "saida",
      amount,
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

    await this.appendInboundProcessingLog({
      inboundMessageId: candidate.inbound_message_id,
      userId: params.userId,
      level: "info",
      event: "candidate_confirmed",
      message: "Sugestão confirmada e salva como transação",
      metadata: {
        candidateId: params.candidateId,
        transactionId: transaction.id,
        accountId: account.id,
      },
    });

    return { transactionId: transaction.id };
  }

  async ignoreCandidate(params: { userId: string; candidateId: string }) {
    await this.assertActiveSubscriber(params.userId);

    const candidate = await this.repository.getCandidateById(params.candidateId, params.userId);
    if (!candidate) {
      throw new Error("Sugestão não encontrada.");
    }

    await this.repository.updateCandidate({
      candidateId: params.candidateId,
      userId: params.userId,
      status: "ignored",
      persistedTransactionId: null,
    });

    await this.appendInboundProcessingLog({
      inboundMessageId: candidate.inbound_message_id,
      userId: params.userId,
      level: "info",
      event: "candidate_ignored",
      message: "Sugestão ignorada pelo usuário",
      metadata: {
        candidateId: params.candidateId,
      },
    });

    return { ignored: true };
  }

  async processInboundEvent(event: WhatsAppInboundEvent): Promise<{ status: string }> {
    this.cleanupExpiredBindings();

    const existing = await this.repository.findInboundByProviderMessageId(event.providerMessageId);
    if (existing) {
      return { status: "already_processed" };
    }

    const fromPhone = normalizePhone(event.fromPhone);
    if (!fromPhone) {
      throw new Error("Telefone de origem inválido.");
    }

    const bindingMatch = this.findPendingBindingByMessage(fromPhone, event.text);
    if (bindingMatch) {
      return this.confirmPhoneBinding(bindingMatch, {
        ...event,
        fromPhone,
      });
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

    await this.appendInboundProcessingLog({
      inboundMessageId: inbound.id,
      userId,
      level: "info",
      event: "message_received",
      message: "Mensagem recebida pelo agente do WhatsApp",
      metadata: {
        providerMessageId: event.providerMessageId,
        type: event.type,
        fromPhone,
      },
    });

    if (!userId) {
      await this.appendInboundProcessingLog({
        inboundMessageId: inbound.id,
        level: "warn",
        event: "binding_not_found",
        message: "Mensagem recebida sem vínculo de número",
        metadata: { fromPhone },
      });
      return { status: "pending_user_link" };
    }

    const user = await this.storage.getUser(userId);
    if (!user || user.billingStatus !== "active") {
      await this.repository.updateInboundMessage({
        id: inbound.id,
        status: "blocked_inactive_subscription",
        errorMessage: "Assinatura inativa para processamento do WhatsApp.",
      });
      await this.appendInboundProcessingLog({
        inboundMessageId: inbound.id,
        userId,
        level: "warn",
        event: "inactive_subscription_block",
        message: "Mensagem bloqueada por assinatura inativa",
        metadata: {
          billingStatus: user?.billingStatus ?? "missing_user",
        },
      });
      return { status: "blocked_inactive_subscription" };
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
          storagePath: media.url || `meta://whatsapp/${media.id}`,
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

    await this.appendInboundProcessingLog({
      inboundMessageId: inbound.id,
      userId,
      level: "info",
      event: "intent_parsing_started",
      message: "Análise da mensagem iniciada",
      metadata: {
        hasText: Boolean(event.text),
        mediaCount: event.media?.length ?? 0,
      },
    });

    const intent = this.parser.parse({
      text: event.text,
      ocrText: ocrTexts.join(" "),
    });

    const extractedPayload = {
      kind: intent.kind,
      amount: intent.amount,
      description: intent.description,
      merchant: intent.merchant,
      categorySuggestion: intent.categorySuggestion,
      transactionDate: intent.transactionDate.toISOString(),
      missingFields: intent.missingFields,
    };

    if (intent.kind === "unknown" || intent.amount === null) {
      await this.repository.updateInboundMessage({
        id: inbound.id,
        status: "needs_clarification",
        confidenceScore: intent.confidence,
        extractedPayload,
      });
      await this.appendInboundProcessingLog({
        inboundMessageId: inbound.id,
        userId,
        level: "warn",
        event: "intent_incomplete",
        message: "Ainda faltam dados para criar uma sugestão de transação",
        metadata: {
          confidence: intent.confidence,
          missingFields: intent.missingFields,
        },
      });
      return { status: "needs_clarification" };
    }

    await this.repository.createCandidate({
      userId,
      inboundMessageId: inbound.id,
      kind: intent.kind,
      amount: intent.amount,
      currency: "BRL",
      description: intent.description,
      merchant: intent.merchant,
      categorySuggestion: intent.categorySuggestion,
      transactionDate: intent.transactionDate,
      confidenceScore: intent.confidence,
      status: "pending_review",
      evidence: {
        missingFields: intent.missingFields,
        normalizedDescription: normalizeDescriptionForMatching(intent.description),
      },
    });

    await this.repository.updateInboundMessage({
      id: inbound.id,
      status: "pending_review",
      confidenceScore: intent.confidence,
      extractedPayload,
    });

    await this.appendInboundProcessingLog({
      inboundMessageId: inbound.id,
      userId,
      level: "info",
      event: "candidate_created",
      message: "Sugestão de transação criada para revisão",
      metadata: {
        confidence: intent.confidence,
        kind: intent.kind,
        amount: intent.amount,
      },
    });

    return { status: "pending_review" };
  }

  private async confirmPhoneBinding(
    pending: PendingPhoneBinding,
    event: WhatsAppInboundEvent,
  ): Promise<{ status: string }> {
    const user = await this.storage.getUser(pending.userId);
    const inbound = await this.repository.createInboundMessage({
      event,
      userId: pending.userId,
      status: user?.billingStatus === "active" ? "binding_confirmed" : "blocked_inactive_subscription",
      extractedPayload: {
        bindingCode: pending.code,
        requestedPhone: pending.phone,
      },
      confidenceScore: 1,
      errorMessage: user?.billingStatus === "active" ? null : "Assinatura inativa para concluir o vínculo.",
    });

    if (!user || user.billingStatus !== "active") {
      await this.appendInboundProcessingLog({
        inboundMessageId: inbound.id,
        userId: pending.userId,
        level: "warn",
        event: "binding_blocked_inactive_subscription",
        message: "Tentativa de vínculo bloqueada por assinatura inativa",
        metadata: {
          billingStatus: user?.billingStatus ?? "missing_user",
        },
      });
      this.clearPendingBinding(pending.userId, pending.code);
      return { status: "blocked_inactive_subscription" };
    }

    const binding = await this.repository.saveVerifiedBinding({
      userId: pending.userId,
      phone: event.fromPhone,
      provider: event.provider,
    });

    await this.repository.updateInboundMessage({
      id: inbound.id,
      status: "binding_confirmed",
      confidenceScore: 1,
      extractedPayload: {
        bindingCode: pending.code,
        linkedPhone: binding.phone_e164,
      },
    });

    await this.appendInboundProcessingLog({
      inboundMessageId: inbound.id,
      userId: pending.userId,
      level: "info",
      event: "binding_confirmed",
      message: "Número confirmado pelo WhatsApp",
      metadata: {
        phone: binding.phone_e164,
      },
    });

    this.clearPendingBinding(pending.userId, pending.code);
    return { status: "binding_confirmed" };
  }

  private findPendingBindingByMessage(phone: string, messageText?: string) {
    const code = String(messageText || "").replace(/\D+/g, "");
    if (!code) return null;

    const pending = this.pendingBindingsByCode.get(code);
    if (!pending) return null;
    if (pending.phone !== phone) return null;
    if (new Date(pending.expiresAt).getTime() <= Date.now()) {
      this.clearPendingBinding(pending.userId, pending.code);
      return null;
    }

    return pending;
  }

  private clearPendingBinding(userId: string, code: string) {
    this.pendingBindingsByUser.delete(userId);
    this.pendingBindingsByCode.delete(code);
  }

  private cleanupExpiredBindings() {
    const now = Date.now();
    for (const pending of this.pendingBindingsByCode.values()) {
      if (new Date(pending.expiresAt).getTime() <= now) {
        this.clearPendingBinding(pending.userId, pending.code);
      }
    }
  }

  private async assertActiveSubscriber(userId: string) {
    const user = await this.storage.getUser(userId);
    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    if (user.billingStatus !== "active") {
      throw new Error("Disponível para assinantes ativos.");
    }

    return user;
  }

  private async getAccountForConfirmation(userId: string, accountId?: string) {
    if (accountId) {
      const account = await this.storage.getAccount(accountId);
      if (!account || account.userId !== userId) {
        throw new Error("Escolha uma conta válida.");
      }
      return account;
    }

    const accounts = await this.storage.getAccountsByUserId(userId);
    if (!accounts.length) {
      throw new Error("Cadastre uma conta antes de confirmar a transação.");
    }

    const pfAccount = accounts.find((account) => account.type.toLowerCase() === "pf");
    return pfAccount || accounts[0];
  }

  private async appendInboundProcessingLog(params: {
    inboundMessageId?: string | null;
    userId?: string | null;
    level: "info" | "warn" | "error";
    event: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!params.inboundMessageId) {
      this.logInternal("warn", "processing_log_skipped_missing_inbound", "Persisted log skipped without inbound_message_id", {
        event: params.event,
        userId: params.userId ?? null,
      });
      return false;
    }

    return this.repository.appendProcessingLog(params);
  }

  private logInternal(
    level: "info" | "warn" | "error",
    event: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    const payload = metadata ? { event, message, metadata } : { event, message };

    if (level === "error") {
      console.error("[WHATSAPP]", payload);
      return;
    }

    if (level === "warn") {
      console.warn("[WHATSAPP]", payload);
      return;
    }

    console.info("[WHATSAPP]", payload);
  }

  private getBusinessPhone() {
    return getWhatsAppMetaConfig().publicPhone;
  }
}
