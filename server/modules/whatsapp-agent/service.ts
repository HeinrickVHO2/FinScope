import { createHash, randomInt } from "node:crypto";
import type { Account, Transaction, User } from "@shared/schema";
import type { IStorage } from "../../storage";
import { normalizeDescriptionForMatching } from "../statement-import/normalizer";
import { buildFinanceAssistantReply, looksLikeFinanceAssistantQuestion } from "./assistant";
import {
  WHATSAPP_AUTO_CREATE_THRESHOLD,
  WHATSAPP_CANDIDATE_STATUS,
  WHATSAPP_CONFIRMATION_THRESHOLD,
  WHATSAPP_MAX_MEDIA_ITEMS,
  WHATSAPP_OPEN_CANDIDATE_STATUSES,
  WHATSAPP_REVIEW_QUEUE_STATUSES,
  sanitizeIncomingText,
} from "./decision";
import { getWhatsAppMetaConfig } from "./config";
import { parseInvoiceText, formatInvoiceReplySummary } from "./invoiceParser";
import { FinancialIntentParser } from "./intentParser";
import { WhatsAppMediaService } from "./media";
import { WhatsAppMessenger } from "./messenger";
import { MockOcrProvider } from "./ocr";
import { buildWhatsAppConversationUrl, normalizePhone } from "./phone";
import type { InboundMessageRecord, WhatsAppRepository } from "./repository";
import type {
  PendingPhoneBinding,
  WhatsAppInboundEvent,
  WhatsAppReviewItem,
  WhatsAppSessionState,
} from "./types";

const BINDING_TTL_MS = 15 * 60 * 1000;

type CandidateRecord = any;

type AccountResolution = {
  selectedAccount: Account | null;
  accountOptions: Account[];
  selectionReason: string | null;
};

function formatCurrencyBRL(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function categoryFromIntent(kind: "income" | "expense", suggestion?: string | null): string {
  if (suggestion) return suggestion;
  return "Outros";
}

function generateBindingCode() {
  return String(randomInt(100000, 999999));
}

function buildConversationUrl(phone: string | null, text?: string) {
  return buildWhatsAppConversationUrl(
    phone,
    text,
    text ? "server_binding_start_conversation_link" : "server_session_conversation_link",
  );
}

function normalizeText(text?: string) {
  return sanitizeIncomingText(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectConfirmationIntent(text?: string): "confirm" | "cancel" | null {
  const normalized = normalizeText(text)
    .replace(/[!?.]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  const confirms = ["sim", "ok", "confirmo", "pode confirmar", "pode registrar", "salva", "registrar", "registre", "registra", "confirma"];
  const cancels = ["nao", "não", "cancela", "cancelar", "desconsidera", "descarta"];

  if (confirms.some((item) => normalized === item || normalized.includes(item))) return "confirm";
  if (cancels.some((item) => normalized === item || normalized.includes(item))) return "cancel";
  return null;
}

function detectResetIntent(text?: string) {
  return /reset|reinicia|do zero/.test(normalizeText(text));
}

function looksLikeGreeting(text?: string) {
  return /^(oi|ola|olá|bom dia|boa tarde|boa noite)\b/.test(normalizeText(text));
}

function detectAccountScopeHint(text?: string): "PF" | "PJ" | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  if (/\bpj\b|empresa|empresarial|negocio|cnpj/.test(normalized)) return "PJ";
  if (/\bpf\b|pessoal|particular/.test(normalized)) return "PF";
  return null;
}

function accountLabel(account: Account) {
  const name = String(account.name || "").trim();
  const type = account.type.toUpperCase();
  if (normalizeText(name).endsWith(` ${type.toLowerCase()}`)) {
    return name;
  }
  return `${name} ${type}`;
}

function isPreferredDefaultAccount(account: Account) {
  return /\b(principal|main|default|padrao)\b/.test(normalizeText(account.name));
}

function sanitizeEvent(event: WhatsAppInboundEvent): WhatsAppInboundEvent {
  return {
    ...event,
    text: sanitizeIncomingText(event.text) || undefined,
    media: Array.isArray(event.media) ? event.media.slice(0, WHATSAPP_MAX_MEDIA_ITEMS) : undefined,
  };
}

function textPreview(text?: string) {
  if (!text) return null;
  return sanitizeIncomingText(text).slice(0, 120);
}

export class WhatsAppAgentService {
  private readonly parser: FinancialIntentParser;
  private readonly ocrProvider: MockOcrProvider;
  private readonly messenger: WhatsAppMessenger;
  private readonly mediaService: WhatsAppMediaService;
  private readonly pendingBindingsByCode = new Map<string, PendingPhoneBinding>();
  private readonly pendingBindingsByUser = new Map<string, PendingPhoneBinding>();

  constructor(
    private readonly repository: WhatsAppRepository,
    private readonly storage: IStorage,
    deps: {
      parser?: FinancialIntentParser;
      ocrProvider?: MockOcrProvider;
      messenger?: WhatsAppMessenger;
      mediaService?: WhatsAppMediaService;
    } = {},
  ) {
    this.parser = deps.parser ?? new FinancialIntentParser();
    this.ocrProvider = deps.ocrProvider ?? new MockOcrProvider();
    this.messenger = deps.messenger ?? new WhatsAppMessenger();
    this.mediaService = deps.mediaService ?? new WhatsAppMediaService();
  }

  async getSession(userId: string): Promise<WhatsAppSessionState> {
    this.cleanupExpiredBindings();

    const user = await this.storage.getUser(userId);
    if (!user) {
      throw new Error("Usuario nao encontrado");
    }

    const binding = await this.repository.getBindingByUser(userId);
    const pendingBinding = this.pendingBindingsByUser.get(userId) || null;
    const businessPhone = this.getBusinessPhone();

    return {
      eligible: user.billingStatus === "active",
      billingStatus: user.billingStatus,
      plan: user.plan,
      instructions: user.billingStatus === "active"
        ? [
            "Informe seu numero.",
            "Copie o codigo gerado.",
            "Envie esse codigo para o WhatsApp do FinScope.",
            "Depois disso, o assistente passa a responder e registrar lancamentos.",
          ]
        : [
            "Este recurso fica disponivel para assinantes ativos.",
            "Ative sua assinatura para conectar o WhatsApp e usar o assistente.",
          ],
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
    if (!phone) throw new Error("Informe um numero valido com DDD.");

    const existingBinding = await this.repository.getBindingByPhone(phone);
    if (existingBinding && existingBinding.user_id !== userId && existingBinding.is_verified !== false) {
      throw new Error("Esse numero ja esta conectado a outra conta.");
    }

    const pending: PendingPhoneBinding = {
      userId,
      phone,
      code: generateBindingCode(),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + BINDING_TTL_MS).toISOString(),
    };

    const previous = this.pendingBindingsByUser.get(userId);
    if (previous) this.pendingBindingsByCode.delete(previous.code);

    this.pendingBindingsByUser.set(userId, pending);
    this.pendingBindingsByCode.set(pending.code, pending);
    this.logInternal("info", "binding_code_generated", "Codigo de vinculo gerado", {
      userId,
      phone,
      expiresAt: pending.expiresAt,
    });

    return {
      phone,
      code: pending.code,
      expiresAt: pending.expiresAt,
      businessPhone: this.getBusinessPhone(),
      conversationUrl: buildConversationUrl(this.getBusinessPhone(), pending.code),
    };
  }

  async disconnectPhone(userId: string) {
    const binding = await this.repository.getBindingByUser(userId);
    if (!binding) return { removed: false };

    await this.repository.deleteBindingByUser(userId);
    const pending = this.pendingBindingsByUser.get(userId);
    if (pending) {
      this.pendingBindingsByCode.delete(pending.code);
      this.pendingBindingsByUser.delete(userId);
    }

    this.logInternal("info", "binding_removed", "Vinculo do WhatsApp removido", {
      userId,
      phone: binding.phone_e164,
    });

    return { removed: true };
  }

  async listPendingCandidates(userId: string) {
    await this.assertActiveSubscriber(userId);
    return this.repository.listCandidatesByStatuses(userId, [
      WHATSAPP_CANDIDATE_STATUS.AWAITING_USER_CONFIRMATION,
      WHATSAPP_CANDIDATE_STATUS.AWAITING_ACCOUNT_SELECTION,
      WHATSAPP_CANDIDATE_STATUS.NEEDS_CLARIFICATION,
    ]);
  }

  async listReviewItems(userId: string): Promise<WhatsAppReviewItem[]> {
    await this.assertActiveSubscriber(userId);

    const candidates = await this.repository.listCandidatesByStatuses(userId, WHATSAPP_REVIEW_QUEUE_STATUSES);
    const inboundIds = candidates.map((candidate) => candidate.inbound_message_id).filter(Boolean);
    const [inbounds, mediaEvidence, transactions] = await Promise.all([
      this.repository.getInboundMessagesByIds(inboundIds),
      this.repository.listMediaEvidenceByInboundIds(inboundIds),
      this.storage.getTransactionsByUserId(userId, "ALL"),
    ]);

    const inboundById = new Map(inbounds.map((item) => [item.id, item]));
    const transactionById = new Map(transactions.map((item) => [item.id, item]));
    const mediaByInbound = mediaEvidence.reduce<Map<string, typeof mediaEvidence>>((acc, item) => {
      const current = acc.get(item.inbound_message_id) || [];
      current.push(item);
      acc.set(item.inbound_message_id, current);
      return acc;
    }, new Map());

    return candidates.map((candidate) => {
      const inbound = inboundById.get(candidate.inbound_message_id);
      const transaction = candidate.persisted_transaction_id ? transactionById.get(candidate.persisted_transaction_id) : null;
      const media = mediaByInbound.get(candidate.inbound_message_id) || [];

      return {
        candidateId: candidate.id,
        status: candidate.status,
        confidenceScore: candidate.confidence_score === null ? null : Number(candidate.confidence_score),
        proposedType: candidate.proposed_type === "income" ? "income" : "expense",
        amount: Number(candidate.amount),
        currency: candidate.currency || "BRL",
        description: candidate.description,
        categorySuggestion: candidate.category_suggestion,
        merchantName: candidate.merchant_name,
        transactionDate: candidate.transaction_date,
        persistedTransactionId: candidate.persisted_transaction_id,
        evidence: candidate.evidence ?? null,
        createdAt: candidate.created_at ?? null,
        updatedAt: candidate.updated_at ?? null,
        inboundMessage: inbound ? {
          id: inbound.id,
          textBody: inbound.textBody ?? null,
          fromPhone: inbound.fromPhone,
          receivedAt: inbound.receivedAt ?? null,
          status: inbound.status,
        } : null,
        mediaEvidence: media.map((item) => ({
          id: item.id,
          mimeType: item.mime_type,
          storagePath: item.storage_path,
          status: item.status,
          ocrText: item.ocr_text,
        })),
        transaction: transaction ? this.mapTransactionForReview(transaction) : null,
      };
    });
  }

  async confirmCandidate(params: { userId: string; candidateId: string; accountId?: string }) {
    await this.assertActiveSubscriber(params.userId);
    const candidate = await this.repository.getCandidateById(params.candidateId, params.userId);
    if (!candidate) throw new Error("Sugestao nao encontrada.");

    const transaction = await this.ensureTransactionForCandidate(candidate, params.userId, params.accountId, {
      finalStatus: WHATSAPP_CANDIDATE_STATUS.REVIEWED_CONFIRMED,
      inboundStatus: "reviewed_confirmed",
      reviewNote: "confirmed_from_web",
    });

    return { transactionId: transaction.id };
  }

  async ignoreCandidate(params: { userId: string; candidateId: string }) {
    await this.assertActiveSubscriber(params.userId);
    const candidate = await this.repository.getCandidateById(params.candidateId, params.userId);
    if (!candidate) throw new Error("Sugestao nao encontrada.");

    await this.repository.updateCandidate({
      candidateId: params.candidateId,
      userId: params.userId,
      status: WHATSAPP_CANDIDATE_STATUS.IGNORED,
      persistedTransactionId: null,
      evidence: this.mergeCandidateEvidence(candidate, {
        reviewStatus: WHATSAPP_CANDIDATE_STATUS.IGNORED,
        ignoredAt: new Date().toISOString(),
      }),
    });

    return { ignored: true };
  }

  async approveReviewItem(params: { userId: string; candidateId: string }) {
    await this.assertActiveSubscriber(params.userId);
    const candidate = await this.repository.getCandidateById(params.candidateId, params.userId);
    if (!candidate) throw new Error("Lancamento do WhatsApp nao encontrado.");

    if (candidate.persisted_transaction_id) {
      if (candidate.inbound_message_id) {
        await this.repository.updateInboundMessage({
          id: candidate.inbound_message_id,
          status: "reviewed_confirmed",
        });
      }
      await this.repository.updateCandidate({
        candidateId: params.candidateId,
        userId: params.userId,
        status: WHATSAPP_CANDIDATE_STATUS.REVIEWED_CONFIRMED,
        evidence: this.mergeCandidateEvidence(candidate, {
          reviewStatus: WHATSAPP_CANDIDATE_STATUS.REVIEWED_CONFIRMED,
          reviewedAt: new Date().toISOString(),
        }),
      });
      await this.appendInboundProcessingLog({
        inboundMessageId: candidate.inbound_message_id,
        userId: params.userId,
        level: "info",
        event: "review_item_approved",
        message: "Lancamento automatico aprovado na revisao web.",
        metadata: {
          candidateId: candidate.id,
          transactionId: candidate.persisted_transaction_id,
        },
      });
      return { reviewed: true, transactionId: candidate.persisted_transaction_id };
    }

    return this.confirmCandidate({ userId: params.userId, candidateId: params.candidateId });
  }

  async updateReviewTransaction(params: {
    userId: string;
    candidateId: string;
    patch: { description?: string; amount?: number; category?: string; date?: Date; type?: "entrada" | "saida"; accountType?: "PF" | "PJ" };
  }) {
    await this.assertActiveSubscriber(params.userId);
    const candidate = await this.repository.getCandidateById(params.candidateId, params.userId);
    if (!candidate || !candidate.persisted_transaction_id) throw new Error("Lancamento automatico nao encontrado.");

    const updated = await this.storage.updateTransaction(candidate.persisted_transaction_id, params.patch);
    if (!updated) throw new Error("Nao foi possivel atualizar a transacao.");

    if (candidate.inbound_message_id) {
      await this.repository.updateInboundMessage({
        id: candidate.inbound_message_id,
        status: "reviewed_corrected",
      });
    }
    await this.repository.updateCandidate({
      candidateId: params.candidateId,
      userId: params.userId,
      status: WHATSAPP_CANDIDATE_STATUS.REVIEWED_CORRECTED,
      evidence: this.mergeCandidateEvidence(candidate, {
        reviewStatus: WHATSAPP_CANDIDATE_STATUS.REVIEWED_CORRECTED,
        correctedAt: new Date().toISOString(),
      }),
    });
    await this.appendInboundProcessingLog({
      inboundMessageId: candidate.inbound_message_id,
      userId: params.userId,
      level: "info",
      event: "review_item_corrected",
      message: "Lancamento automatico corrigido na revisao web.",
      metadata: {
        candidateId: candidate.id,
        transactionId: candidate.persisted_transaction_id,
      },
    });

    return { transaction: updated };
  }

  async removeReviewTransaction(params: { userId: string; candidateId: string }) {
    await this.assertActiveSubscriber(params.userId);
    const candidate = await this.repository.getCandidateById(params.candidateId, params.userId);
    if (!candidate || !candidate.persisted_transaction_id) throw new Error("Lancamento automatico nao encontrado.");

    const removed = await this.storage.deleteTransaction(candidate.persisted_transaction_id);
    if (!removed) throw new Error("Nao foi possivel remover a transacao.");

    if (candidate.inbound_message_id) {
      await this.repository.updateInboundMessage({
        id: candidate.inbound_message_id,
        status: "reviewed_removed",
      });
    }
    await this.repository.updateCandidate({
      candidateId: params.candidateId,
      userId: params.userId,
      status: WHATSAPP_CANDIDATE_STATUS.REVIEWED_REMOVED,
      persistedTransactionId: null,
      evidence: this.mergeCandidateEvidence(candidate, {
        reviewStatus: WHATSAPP_CANDIDATE_STATUS.REVIEWED_REMOVED,
        removedAt: new Date().toISOString(),
      }),
    });
    await this.appendInboundProcessingLog({
      inboundMessageId: candidate.inbound_message_id,
      userId: params.userId,
      level: "warn",
      event: "review_item_removed",
      message: "Lancamento automatico removido na revisao web.",
      metadata: {
        candidateId: candidate.id,
      },
    });

    return { removed: true };
  }

  async suppressSimilarSuggestions(params: { userId: string; candidateId: string }) {
    await this.assertActiveSubscriber(params.userId);
    const candidate = await this.repository.getCandidateById(params.candidateId, params.userId);
    if (!candidate) throw new Error("Lancamento do WhatsApp nao encontrado.");

    await this.repository.updateCandidate({
      candidateId: params.candidateId,
      userId: params.userId,
      status: WHATSAPP_CANDIDATE_STATUS.IGNORED_PATTERN,
      evidence: this.mergeCandidateEvidence(candidate, {
        reviewStatus: WHATSAPP_CANDIDATE_STATUS.IGNORED_PATTERN,
        ignoreFutureSimilar: true,
        ignoredPatternAt: new Date().toISOString(),
      }),
    });
    await this.appendInboundProcessingLog({
      inboundMessageId: candidate.inbound_message_id,
      userId: params.userId,
      level: "info",
      event: "review_item_ignore_similar",
      message: "Usuario pediu para ignorar sugestoes semelhantes.",
      metadata: {
        candidateId: candidate.id,
      },
    });

    return { ignoredSimilar: true };
  }

  async processInboundEvent(event: WhatsAppInboundEvent): Promise<{ status: string }> {
    this.cleanupExpiredBindings();

    const sanitizedEvent = sanitizeEvent(event);
    this.logInternal("info", "process_inbound_start", "Iniciando processamento do evento do WhatsApp.", {
      providerMessageId: sanitizedEvent.providerMessageId,
      fromPhone: sanitizedEvent.fromPhone,
      type: sanitizedEvent.type,
      textPreview: textPreview(sanitizedEvent.text),
      mediaCount: sanitizedEvent.media?.length ?? 0,
    });

    try {
      const existing = await this.repository.findInboundByProviderMessageId(sanitizedEvent.providerMessageId);
      if (existing) {
        this.logInternal("info", "process_inbound_duplicate", "Evento duplicado detectado; ignorando reprocessamento.", {
          providerMessageId: sanitizedEvent.providerMessageId,
          existingInboundMessageId: existing.id,
        });
        return { status: "already_processed" };
      }

      const fromPhone = normalizePhone(sanitizedEvent.fromPhone);
      if (!fromPhone) {
        this.logInternal("warn", "process_inbound_invalid_phone", "Evento descartado por telefone de origem invalido.", {
          providerMessageId: sanitizedEvent.providerMessageId,
          rawFromPhone: sanitizedEvent.fromPhone,
        });
        throw new Error("Telefone de origem invalido.");
      }

      const bindingMatch = this.findPendingBindingByMessage(fromPhone, sanitizedEvent.text);
      if (bindingMatch) {
        this.logInternal("info", "binding_match_found", "Codigo de vinculacao reconhecido no chat.", {
          providerMessageId: sanitizedEvent.providerMessageId,
          userId: bindingMatch.userId,
          phone: fromPhone,
        });
        return this.confirmPhoneBinding(bindingMatch, { ...sanitizedEvent, fromPhone });
      }

      const userId = await this.repository.findUserByPhone(fromPhone);
      this.logInternal(userId ? "info" : "warn", "binding_lookup_completed", userId
        ? "Vinculo de telefone localizado para a mensagem recebida."
        : "Nenhum vinculo localizado para o telefone recebido.", {
        providerMessageId: sanitizedEvent.providerMessageId,
        fromPhone,
        userId,
      });

      const inbound = await this.repository.createInboundMessage({
        event: { ...sanitizedEvent, fromPhone },
        userId,
        status: userId ? "received" : "pending_user_link",
      });
      this.logInternal("info", "inbound_created", "Inbound message criado com sucesso.", {
        inboundMessageId: inbound.id,
        providerMessageId: sanitizedEvent.providerMessageId,
        userId,
        initialStatus: userId ? "received" : "pending_user_link",
      });
      await this.appendInboundProcessingLog({
        inboundMessageId: inbound.id,
        userId,
        level: "info",
        event: "inbound_received",
        message: "Mensagem recebida do WhatsApp.",
        metadata: {
          provider: sanitizedEvent.provider,
          type: sanitizedEvent.type,
          hasMedia: Boolean(sanitizedEvent.media?.length),
        },
      });

      if (!userId) {
        this.logInternal("warn", "process_inbound_pending_link", "Processamento encerrado porque o telefone ainda nao esta vinculado.", {
          inboundMessageId: inbound.id,
          fromPhone,
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
          event: "subscription_blocked",
          message: "Mensagem bloqueada por assinatura inativa.",
        });
        this.logInternal("warn", "process_inbound_inactive_subscription", "Processamento encerrado por assinatura inativa.", {
          inboundMessageId: inbound.id,
          userId,
          billingStatus: user?.billingStatus ?? null,
        });
        await this.sendReplyToInbound(inbound, "Seu numero esta vinculado, mas o assistente so funciona com assinatura ativa.");
        return { status: "blocked_inactive_subscription" };
      }

      const openCandidate = sanitizedEvent.media?.length
        ? null
        : await this.repository.getLatestCandidateByUser(userId, WHATSAPP_OPEN_CANDIDATE_STATUSES);

      if (openCandidate && sanitizedEvent.text) {
        const shouldHandleAsReply = this.shouldHandleAsReplyToOpenCandidate(openCandidate, sanitizedEvent.text);
        this.logInternal("info", "open_candidate_evaluated", "Mensagem recebida com candidate pendente aberto.", {
          inboundMessageId: inbound.id,
          openCandidateId: openCandidate.id,
          openCandidateStatus: openCandidate.status,
          shouldHandleAsReply,
          textPreview: textPreview(sanitizedEvent.text),
        });

        if (shouldHandleAsReply) {
          const result = await this.handleOpenCandidateReply(openCandidate, inbound, user, sanitizedEvent.text);
          if (result) return result;
        } else {
          await this.repository.updateCandidate({
            candidateId: openCandidate.id,
            userId: user.id,
            status: WHATSAPP_CANDIDATE_STATUS.IGNORED,
            evidence: this.mergeCandidateEvidence(openCandidate, {
              reviewStatus: WHATSAPP_CANDIDATE_STATUS.IGNORED,
              supersededAt: new Date().toISOString(),
              supersededByMessage: sanitizedEvent.text,
              supersededReason: "new_standalone_message",
            }),
          });
          await this.appendInboundProcessingLog({
            inboundMessageId: openCandidate.inbound_message_id,
            userId: user.id,
            level: "info",
            event: "candidate_superseded",
            message: "Candidate pendente foi descartado porque o usuario enviou uma nova solicitacao independente.",
            metadata: {
              candidateId: openCandidate.id,
              supersededByMessageId: inbound.id,
            },
          });
        }
      }

      if (sanitizedEvent.media?.length) {
        this.logInternal("info", "branch_media_message", "Mensagem encaminhada para o fluxo de midia/nota fiscal.", {
          inboundMessageId: inbound.id,
          mediaCount: sanitizedEvent.media.length,
        });
        return this.handleMediaMessage(inbound, user, sanitizedEvent);
      }

      if (looksLikeGreeting(sanitizedEvent.text || "")) {
        this.logInternal("info", "branch_greeting_message", "Mensagem classificada como saudacao.", {
          inboundMessageId: inbound.id,
          textPreview: textPreview(sanitizedEvent.text),
        });
        await this.repository.updateInboundMessage({
          id: inbound.id,
          status: "assistant_answered",
          extractedPayload: { mode: "greeting" },
        });
        await this.appendInboundProcessingLog({
          inboundMessageId: inbound.id,
          userId: user.id,
          level: "info",
          event: "greeting_answered",
          message: "Saudacao respondida no chat.",
        });
        await this.sendReplyToInbound(
          inbound,
          "Oi. Posso registrar gastos, recebimentos, notas e tambem responder duvidas simples sobre seu financeiro. Se quiser, me mande algo como 'paguei 50 de gasolina'.",
        );
        return { status: "assistant_answered" };
      }

      if (looksLikeFinanceAssistantQuestion(sanitizedEvent.text || "")) {
        this.logInternal("info", "branch_assistant_message", "Mensagem classificada como pergunta financeira.", {
          inboundMessageId: inbound.id,
          textPreview: textPreview(sanitizedEvent.text),
        });
        return this.handleFinanceAssistantMessage(inbound, user, sanitizedEvent.text || "");
      }

      this.logInternal("info", "branch_transaction_message", "Mensagem encaminhada para o fluxo transacional.", {
        inboundMessageId: inbound.id,
        textPreview: textPreview(sanitizedEvent.text),
      });
      return this.handleTransactionMessage(inbound, user, sanitizedEvent);
    } catch (error) {
      this.logInternal("error", "process_inbound_failed", "Erro durante o processamento do evento do WhatsApp.", {
        providerMessageId: sanitizedEvent.providerMessageId,
        fromPhone: sanitizedEvent.fromPhone,
        type: sanitizedEvent.type,
        textPreview: textPreview(sanitizedEvent.text),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private async handleFinanceAssistantMessage(inbound: InboundMessageRecord, user: User, text: string) {
    this.logInternal("info", "assistant_message_started", "Gerando resposta para pergunta financeira.", {
      inboundMessageId: inbound.id,
      userId: user.id,
      textPreview: textPreview(text),
    });
    const reply = await buildFinanceAssistantReply(this.storage, user.id, text);
    await this.repository.updateInboundMessage({
      id: inbound.id,
      status: "assistant_answered",
      extractedPayload: { mode: "assistant" },
    });
    await this.appendInboundProcessingLog({
      inboundMessageId: inbound.id,
      userId: user.id,
      level: "info",
      event: "assistant_answered",
      message: "Pergunta financeira respondida no chat.",
    });
    await this.sendReplyToInbound(inbound, reply);
    return { status: "assistant_answered" };
  }

  private async handleMediaMessage(inbound: InboundMessageRecord, user: User, event: WhatsAppInboundEvent) {
    const preparedTexts: string[] = [];
    const mediaSummary: Array<Record<string, unknown>> = [];

    this.logInternal("info", "media_processing_started", "Iniciando processamento de midia recebida.", {
      inboundMessageId: inbound.id,
      userId: user.id,
      mediaCount: event.media?.length ?? 0,
      textPreview: textPreview(event.text),
    });

    for (const media of event.media || []) {
      const prepared = await this.mediaService.prepareMedia(media);
      const hash = createHash("sha256").update(prepared?.base64 || media.url || media.id).digest("hex");

      if (!prepared) {
        this.logInternal("warn", "media_skipped", "Midia recebida foi descartada por validacao ou download.", {
          inboundMessageId: inbound.id,
          mediaId: media.id,
          mimeType: media.mimeType ?? null,
        });
        continue;
      }

      const ocr = await this.ocrProvider.extractText({
        mimeType: prepared.mimeType,
        base64: prepared.base64,
        url: prepared.storagePath,
      });

      const combinedText = [prepared.textHint, ocr.text].filter(Boolean).join("\n").trim();
      if (combinedText) preparedTexts.push(combinedText);

      await this.repository.createMediaEvidence({
        inboundMessageId: inbound.id,
        userId: user.id,
        mediaType: event.type,
        mimeType: prepared.mimeType,
        storagePath: prepared.storagePath,
        sha256: hash,
        fileSizeBytes: prepared.fileSizeBytes,
        ocrText: combinedText || undefined,
        ocrConfidence: ocr.confidence,
        status: combinedText ? "processed" : "received",
      });

      mediaSummary.push({
        mediaId: media.id,
        mimeType: prepared.mimeType ?? null,
        storagePath: prepared.storagePath,
        fileSizeBytes: prepared.fileSizeBytes,
      });
    }

    const invoice = parseInvoiceText([event.text, preparedTexts.join("\n")].filter(Boolean).join("\n"));
    this.logInternal("info", "invoice_parsed", "Parser de nota fiscal executado.", {
      inboundMessageId: inbound.id,
      foundInvoice: Boolean(invoice),
      total: invoice?.total ?? null,
      confidence: invoice?.confidence ?? null,
      itemCount: invoice?.items.length ?? 0,
    });
    if (!invoice || invoice.total === null) {
      await this.repository.updateInboundMessage({
        id: inbound.id,
        status: "needs_clarification",
        extractedPayload: { mode: "invoice", mediaSummary },
      });
      await this.appendInboundProcessingLog({
        inboundMessageId: inbound.id,
        userId: user.id,
        level: "warn",
        event: "invoice_not_understood",
        message: "Nao foi possivel interpretar a nota fiscal com seguranca.",
        metadata: { mediaItems: mediaSummary.length },
      });
      await this.sendReplyToInbound(inbound, "Recebi sua nota, mas nao consegui interpretar tudo com seguranca. Se quiser, me mande o valor total em texto.");
      return { status: "needs_clarification" };
    }

    if (invoice.confidence < WHATSAPP_CONFIRMATION_THRESHOLD) {
      await this.repository.updateInboundMessage({
        id: inbound.id,
        status: "needs_clarification",
        confidenceScore: invoice.confidence,
        extractedPayload: { mode: "invoice", invoice, mediaSummary },
      });
      await this.appendInboundProcessingLog({
        inboundMessageId: inbound.id,
        userId: user.id,
        level: "warn",
        event: "invoice_low_confidence",
        message: "Nota fiscal reconhecida com baixa confianca.",
        metadata: {
          confidence: invoice.confidence,
          total: invoice.total,
        },
      });
      await this.sendReplyToInbound(
        inbound,
        `Recebi sua nota e identifiquei um total de ${formatCurrencyBRL(invoice.total)}, mas ainda sem seguranca suficiente. Quer me mandar o valor total em texto ou confirmar o estabelecimento?`,
      );
      return { status: "needs_clarification" };
    }

    const resolution = await this.resolveAccountForMessage(user.id, [event.text, invoice.merchant].filter(Boolean).join(" "));
    const candidate = await this.repository.createCandidate({
      userId: user.id,
      inboundMessageId: inbound.id,
      kind: "expense",
      amount: invoice.total,
      currency: "BRL",
      description: invoice.merchant ? `Compra em ${invoice.merchant}` : "Compra via nota fiscal",
      merchant: invoice.merchant ?? undefined,
      categorySuggestion: this.pickInvoiceCategory(invoice),
      transactionDate: invoice.date ? this.parseInvoiceDate(invoice.date) : new Date(),
      confidenceScore: invoice.confidence,
      status: resolution.selectedAccount
        ? WHATSAPP_CANDIDATE_STATUS.AWAITING_USER_CONFIRMATION
        : WHATSAPP_CANDIDATE_STATUS.AWAITING_ACCOUNT_SELECTION,
      evidence: {
        mode: "invoice",
        invoice,
        mediaSummary,
        selectedAccountId: resolution.selectedAccount?.id ?? null,
        accountSelectionReason: resolution.selectionReason,
        accountOptions: resolution.accountOptions.map((account) => ({
          id: account.id,
          name: account.name,
          type: account.type.toUpperCase(),
        })),
      },
    });

    await this.repository.updateInboundMessage({
      id: inbound.id,
      status: resolution.selectedAccount ? "awaiting_user_confirmation" : "awaiting_account_selection",
      confidenceScore: invoice.confidence,
      extractedPayload: { mode: "invoice", candidateId: candidate.id, invoice },
    });
    await this.appendInboundProcessingLog({
      inboundMessageId: inbound.id,
      userId: user.id,
      level: "info",
      event: "invoice_candidate_created",
      message: "Nota fiscal convertida em sugestao para confirmacao.",
      metadata: {
        candidateId: candidate.id,
        confidence: invoice.confidence,
        selectedAccountId: resolution.selectedAccount?.id ?? null,
        accountSelectionReason: resolution.selectionReason,
      },
    });

    const summary = formatInvoiceReplySummary(invoice);
    await this.sendReplyToInbound(
      inbound,
      resolution.selectedAccount
        ? `Recebi sua nota e ${summary}. Posso lancar isso na conta ${accountLabel(resolution.selectedAccount)}?`
        : `Recebi sua nota e ${summary}. Antes de salvar, me diga em qual conta devo lancar: ${this.formatAccountOptions(resolution.accountOptions)}.`,
    );

    return { status: resolution.selectedAccount ? "awaiting_user_confirmation" : "awaiting_account_selection" };
  }

  private async handleTransactionMessage(inbound: InboundMessageRecord, user: User, event: WhatsAppInboundEvent) {
    const intent = this.parser.parse({ text: event.text });
    this.logInternal("info", "intent_classified", "Mensagem classificada pelo parser financeiro.", {
      inboundMessageId: inbound.id,
      userId: user.id,
      kind: intent.kind,
      amount: intent.amount,
      confidence: intent.confidence,
      missingFields: intent.missingFields,
      description: intent.description,
      merchant: intent.merchant ?? null,
      categorySuggestion: intent.categorySuggestion ?? null,
    });
    if (intent.kind === "unknown" || intent.amount === null) {
      await this.repository.updateInboundMessage({
        id: inbound.id,
        status: "needs_clarification",
        confidenceScore: intent.confidence,
        extractedPayload: { mode: "transaction", missingFields: intent.missingFields },
      });
      await this.appendInboundProcessingLog({
        inboundMessageId: inbound.id,
        userId: user.id,
        level: "warn",
        event: "transaction_needs_clarification",
        message: "Mensagem nao trouxe dados suficientes para criar lancamento.",
        metadata: {
          missingFields: intent.missingFields,
          confidence: intent.confidence,
        },
      });
      await this.sendReplyToInbound(inbound, "Nao consegui identificar o valor e o tipo com seguranca. Pode me mandar algo como 'paguei 10 no lanche'?");
      return { status: "needs_clarification" };
    }

    const normalizedDescription = normalizeDescriptionForMatching(intent.description);
    const suppressed = await this.isSuppressedPattern(user.id, normalizedDescription);
    const resolution = await this.resolveAccountForMessage(user.id, event.text || "");
    const needsClarification = intent.confidence < WHATSAPP_CONFIRMATION_THRESHOLD;
    this.logInternal("info", "transaction_decision_context", "Contexto de decisao do fluxo transacional calculado.", {
      inboundMessageId: inbound.id,
      confidence: intent.confidence,
      needsClarification,
      selectedAccountId: resolution.selectedAccount?.id ?? null,
      accountOptions: resolution.accountOptions.map((account) => account.id),
      accountSelectionReason: resolution.selectionReason,
      suppressed,
      autoCreateThreshold: WHATSAPP_AUTO_CREATE_THRESHOLD,
      confirmationThreshold: WHATSAPP_CONFIRMATION_THRESHOLD,
    });
    const candidate = await this.repository.createCandidate({
      userId: user.id,
      inboundMessageId: inbound.id,
      kind: intent.kind,
      amount: intent.amount,
      currency: "BRL",
      description: intent.description,
      merchant: intent.merchant,
      categorySuggestion: intent.categorySuggestion,
      transactionDate: intent.transactionDate,
      confidenceScore: intent.confidence,
      status: needsClarification
        ? WHATSAPP_CANDIDATE_STATUS.NEEDS_CLARIFICATION
        : resolution.selectedAccount
          ? WHATSAPP_CANDIDATE_STATUS.AWAITING_USER_CONFIRMATION
          : WHATSAPP_CANDIDATE_STATUS.AWAITING_ACCOUNT_SELECTION,
      evidence: {
        mode: "transaction",
        rawMessage: event.text || "",
        normalizedDescription,
        selectedAccountId: resolution.selectedAccount?.id ?? null,
        accountSelectionReason: resolution.selectionReason,
        accountOptions: resolution.accountOptions.map((account) => ({
          id: account.id,
          name: account.name,
          type: account.type.toUpperCase(),
        })),
        suppressedByPattern: suppressed,
      },
    });
    this.logInternal("info", "candidate_created", "Candidate criado a partir da mensagem do WhatsApp.", {
      inboundMessageId: inbound.id,
      candidateId: candidate.id,
      status: candidate.status,
      confidence: intent.confidence,
      kind: intent.kind,
      amount: intent.amount,
    });

    if (needsClarification) {
      await this.repository.updateInboundMessage({
        id: inbound.id,
        status: "needs_clarification",
        confidenceScore: intent.confidence,
        extractedPayload: { candidateId: candidate.id, mode: "transaction", missingFields: intent.missingFields },
      });
      await this.appendInboundProcessingLog({
        inboundMessageId: inbound.id,
        userId: user.id,
        level: "warn",
        event: "transaction_low_confidence",
        message: "Mensagem entendida com baixa confianca; aguardando detalhes adicionais.",
        metadata: {
          candidateId: candidate.id,
          confidence: intent.confidence,
          accountSelectionReason: resolution.selectionReason,
        },
      });
      await this.sendReplyToInbound(
        inbound,
        `${this.describeIntent(intent)}, mas ainda preciso de um pouco mais de contexto para nao errar. Pode confirmar o valor, a categoria ou em qual conta foi?`,
      );
      return { status: "needs_clarification" };
    }

    if (!resolution.selectedAccount) {
      await this.repository.updateInboundMessage({
        id: inbound.id,
        status: "awaiting_account_selection",
        confidenceScore: intent.confidence,
        extractedPayload: { candidateId: candidate.id, mode: "transaction" },
      });
      await this.appendInboundProcessingLog({
        inboundMessageId: inbound.id,
        userId: user.id,
        level: "info",
        event: "candidate_awaiting_account_selection",
        message: "Lancamento aguardando definicao da conta pelo usuario.",
        metadata: {
          candidateId: candidate.id,
          confidence: intent.confidence,
        },
      });
      await this.sendReplyToInbound(
        inbound,
        `${this.describeIntent(intent)}. Antes de registrar, me diga em qual conta devo lancar: ${this.formatAccountOptions(resolution.accountOptions)}.`,
      );
      return { status: "awaiting_account_selection" };
    }

    if (intent.confidence >= WHATSAPP_AUTO_CREATE_THRESHOLD && !suppressed) {
      const autoCreateResult = await this.tryPersistCandidateTransaction({
        candidate,
        inbound,
        userId: user.id,
        accountId: resolution.selectedAccount.id,
        finalStatus: WHATSAPP_CANDIDATE_STATUS.AUTO_CREATED_PENDING_REVIEW,
        inboundStatus: "auto_created_pending_review",
        reviewNote: "auto_created",
        successReply: `Registrei ${this.describeIntent(intent)} na conta ${accountLabel(resolution.selectedAccount)}. Voce pode revisar depois em Lancamentos do WhatsApp.`,
        fallbackReply: `Entendi ${this.describeIntent(intent)}, mas nao consegui registrar automaticamente agora. Posso deixar isso pendente para sua confirmacao na conta ${accountLabel(resolution.selectedAccount)}.`,
      });
      if (autoCreateResult) {
        return { status: "auto_created_pending_review" };
      }
      return { status: "awaiting_user_confirmation" };
    }

    await this.repository.updateCandidate({
      candidateId: candidate.id,
      userId: user.id,
      status: WHATSAPP_CANDIDATE_STATUS.AWAITING_USER_CONFIRMATION,
      evidence: this.mergeCandidateEvidence(candidate, {
        selectedAccountId: resolution.selectedAccount.id,
        accountSelectionReason: resolution.selectionReason,
        selectedAccountLabel: accountLabel(resolution.selectedAccount),
      }),
    });
    await this.repository.updateInboundMessage({
      id: inbound.id,
      status: "awaiting_user_confirmation",
      confidenceScore: intent.confidence,
      extractedPayload: { candidateId: candidate.id, mode: "transaction" },
    });
    await this.appendInboundProcessingLog({
      inboundMessageId: inbound.id,
      userId: user.id,
      level: "info",
      event: "candidate_awaiting_confirmation",
      message: "Lancamento aguardando confirmacao do usuario no chat.",
      metadata: {
        candidateId: candidate.id,
        confidence: intent.confidence,
        selectedAccountId: resolution.selectedAccount.id,
        accountSelectionReason: resolution.selectionReason,
      },
    });

    const extra = suppressed ? " Voce pediu para eu nao automatizar lancamentos parecidos, entao vou esperar sua confirmacao." : "";
    await this.sendReplyToInbound(
      inbound,
      `${this.describeIntent(intent)} na conta ${accountLabel(resolution.selectedAccount)}. Posso confirmar?${extra}`,
    );
    return { status: "awaiting_user_confirmation" };
  }

  private async handleOpenCandidateReply(candidate: CandidateRecord, inbound: InboundMessageRecord, user: User, text: string) {
    this.logInternal("info", "open_candidate_reply_started", "Processando mensagem como resposta a candidate pendente.", {
      inboundMessageId: inbound.id,
      candidateId: candidate.id,
      candidateStatus: candidate.status,
      textPreview: textPreview(text),
    });

    if (detectResetIntent(text)) {
      await this.repository.updateCandidate({
        candidateId: candidate.id,
        userId: user.id,
        status: WHATSAPP_CANDIDATE_STATUS.IGNORED,
      });
      await this.sendReplyToInbound(inbound, "Tudo certo. Descartei o contexto anterior. Pode me mandar de novo como quer registrar.");
      return { status: "ignored" };
    }

    if (candidate.status === WHATSAPP_CANDIDATE_STATUS.AWAITING_ACCOUNT_SELECTION) {
      const selectedAccount = await this.matchAccountFromReply(user.id, text, candidate);
      if (!selectedAccount) {
        await this.sendReplyToInbound(inbound, `Ainda nao identifiquei a conta. Opcoes: ${this.formatAccountOptionsFromEvidence(candidate)}.`);
        return { status: "awaiting_account_selection" };
      }

      await this.repository.updateCandidate({
        candidateId: candidate.id,
        userId: user.id,
        status: WHATSAPP_CANDIDATE_STATUS.AWAITING_USER_CONFIRMATION,
        evidence: this.mergeCandidateEvidence(candidate, {
          selectedAccountId: selectedAccount.id,
          selectedAccountLabel: accountLabel(selectedAccount),
        }),
      });

      await this.sendReplyToInbound(inbound, `Perfeito. Vou usar a conta ${accountLabel(selectedAccount)}. Posso confirmar ${this.describeCandidate(candidate)}?`);
      return { status: "awaiting_user_confirmation" };
    }

    if (candidate.status === WHATSAPP_CANDIDATE_STATUS.AWAITING_USER_CONFIRMATION) {
      const confirmation = detectConfirmationIntent(text);
      if (confirmation === "cancel") {
        await this.repository.updateCandidate({
          candidateId: candidate.id,
          userId: user.id,
          status: WHATSAPP_CANDIDATE_STATUS.IGNORED,
        });
        await this.sendReplyToInbound(inbound, "Certo. Nao vou registrar esse lancamento.");
        return { status: "ignored" };
      }

      if (confirmation === "confirm") {
        const confirmed = await this.tryPersistCandidateTransaction({
          candidate,
          inbound,
          userId: user.id,
          finalStatus: WHATSAPP_CANDIDATE_STATUS.CONFIRMED,
          inboundStatus: "confirmed_via_whatsapp",
          reviewNote: "confirmed_in_chat",
          successReply: `Confirmado. Registrei ${this.describeCandidate(candidate)} com origem WhatsApp.`,
          fallbackReply: "Entendi a confirmacao, mas nao consegui concluir o registro agora. Vou manter esse lancamento pendente para revisar sem perder o contexto.",
        });
        return { status: confirmed ? "confirmed_via_whatsapp" : "awaiting_user_confirmation" };
      }

      await this.sendReplyToInbound(inbound, "Se estiver certo, responda 'sim'. Se quiser cancelar, responda 'nao'.");
      return { status: "awaiting_user_confirmation" };
    }

    if (candidate.status === WHATSAPP_CANDIDATE_STATUS.NEEDS_CLARIFICATION) {
      const intent = this.parser.parse({ text: `${candidate.evidence?.rawMessage || candidate.description || ""} ${text}`.trim() });
      if (intent.kind === "unknown" || intent.amount === null || intent.confidence < WHATSAPP_CONFIRMATION_THRESHOLD) {
        await this.repository.updateCandidate({
          candidateId: candidate.id,
          userId: user.id,
          evidence: this.mergeCandidateEvidence(candidate, {
            rawMessage: `${candidate.evidence?.rawMessage || candidate.description || ""} ${text}`.trim(),
            lastClarificationAt: new Date().toISOString(),
          }),
        });
        await this.sendReplyToInbound(inbound, "Ainda faltou contexto. Tente algo como 'paguei 10 reais no lanche'.");
        return { status: "needs_clarification" };
      }

      const resolution = await this.resolveAccountForMessage(user.id, `${candidate.evidence?.rawMessage || candidate.description || ""} ${text}`.trim());

      await this.repository.updateCandidate({
        candidateId: candidate.id,
        userId: user.id,
        status: resolution.selectedAccount
          ? WHATSAPP_CANDIDATE_STATUS.AWAITING_USER_CONFIRMATION
          : WHATSAPP_CANDIDATE_STATUS.AWAITING_ACCOUNT_SELECTION,
        description: intent.description,
        amount: intent.amount,
        categorySuggestion: intent.categorySuggestion ?? null,
        merchantName: intent.merchant ?? null,
        transactionDate: intent.transactionDate,
        confidenceScore: intent.confidence,
        evidence: this.mergeCandidateEvidence(candidate, {
          rawMessage: `${candidate.evidence?.rawMessage || candidate.description || ""} ${text}`.trim(),
          selectedAccountId: resolution.selectedAccount?.id ?? null,
          accountSelectionReason: resolution.selectionReason,
          selectedAccountLabel: resolution.selectedAccount ? accountLabel(resolution.selectedAccount) : null,
          accountOptions: resolution.accountOptions.map((account) => ({
            id: account.id,
            name: account.name,
            type: account.type.toUpperCase(),
          })),
        }),
      });
      await this.repository.updateInboundMessage({
        id: inbound.id,
        status: resolution.selectedAccount ? "awaiting_user_confirmation" : "awaiting_account_selection",
        confidenceScore: intent.confidence,
        extractedPayload: { candidateId: candidate.id, mode: "transaction" },
      });
      await this.sendReplyToInbound(
        inbound,
        resolution.selectedAccount
          ? `${this.describeIntent(intent)} na conta ${accountLabel(resolution.selectedAccount)}. Posso confirmar agora?`
          : `${this.describeIntent(intent)}. Agora so preciso saber em qual conta devo lancar: ${this.formatAccountOptions(resolution.accountOptions)}.`,
      );
      return { status: resolution.selectedAccount ? "awaiting_user_confirmation" : "awaiting_account_selection" };
    }

    return null;
  }

  private async ensureTransactionForCandidate(
    candidate: CandidateRecord,
    userId: string,
    accountId: string | undefined,
    options: { finalStatus: string; inboundStatus: string; reviewNote: string },
  ) {
    if (candidate.persisted_transaction_id) {
      const existing = await this.storage.getTransaction(candidate.persisted_transaction_id);
      if (existing) return existing;
    }

    const selectedAccount = await this.resolveAccountByCandidate(userId, candidate, accountId);
    this.logInternal("info", "transaction_create_start", "Iniciando criacao de transacao a partir do candidate.", {
      candidateId: candidate.id,
      inboundMessageId: candidate.inbound_message_id,
      userId,
      selectedAccountId: selectedAccount.id,
      selectedAccountType: selectedAccount.type,
      amount: candidate.amount,
      proposedType: candidate.proposed_type,
      source: "whatsapp_agent",
    });
    let transaction: Transaction;
    try {
      transaction = await this.storage.createTransaction({
        userId,
        accountId: selectedAccount.id,
        description: candidate.description,
        type: candidate.proposed_type === "income" ? "entrada" : "saida",
        amount: Number(candidate.amount),
        category: candidate.category_suggestion || categoryFromIntent(candidate.proposed_type === "income" ? "income" : "expense", candidate.category_suggestion),
        date: new Date(candidate.transaction_date),
        accountType: selectedAccount.type.toUpperCase() === "PJ" ? "PJ" : "PF",
        source: "whatsapp_agent",
      });
    } catch (error) {
      this.logInternal("error", "transaction_create_failed", "Falha ao criar transacao a partir do candidate.", {
        candidateId: candidate.id,
        inboundMessageId: candidate.inbound_message_id,
        userId,
        selectedAccountId: selectedAccount.id,
        amount: candidate.amount,
        proposedType: candidate.proposed_type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
    this.logInternal("info", "transaction_create_success", "Transacao criada com sucesso a partir do candidate.", {
      candidateId: candidate.id,
      inboundMessageId: candidate.inbound_message_id,
      userId,
      transactionId: transaction.id,
      selectedAccountId: selectedAccount.id,
      source: transaction.source,
    });

    await this.repository.updateCandidate({
      candidateId: candidate.id,
      userId,
      status: options.finalStatus,
      persistedTransactionId: transaction.id,
      evidence: this.mergeCandidateEvidence(candidate, {
        reviewStatus: options.finalStatus,
        reviewNote: options.reviewNote,
        selectedAccountId: selectedAccount.id,
        selectedAccountLabel: accountLabel(selectedAccount),
        transactionId: transaction.id,
      }),
    });
    await this.appendInboundProcessingLog({
      inboundMessageId: candidate.inbound_message_id,
      userId,
      level: "info",
      event: "transaction_created",
      message: "Transacao criada a partir do WhatsApp.",
      metadata: {
        candidateId: candidate.id,
        transactionId: transaction.id,
        finalStatus: options.finalStatus,
        source: "whatsapp_agent",
      },
    });

    if (candidate.inbound_message_id) {
      await this.repository.updateInboundMessage({
        id: candidate.inbound_message_id,
        status: options.inboundStatus,
        extractedPayload: {
          ...(candidate.evidence || {}),
          selectedAccountId: selectedAccount.id,
          selectedAccountLabel: accountLabel(selectedAccount),
          transactionId: transaction.id,
        },
      });
    }

    return transaction;
  }

  private async tryPersistCandidateTransaction(params: {
    candidate: CandidateRecord;
    inbound: InboundMessageRecord;
    userId: string;
    accountId?: string;
    finalStatus: string;
    inboundStatus: string;
    reviewNote: string;
    successReply: string;
    fallbackReply: string;
  }) {
    try {
      await this.ensureTransactionForCandidate(params.candidate, params.userId, params.accountId, {
        finalStatus: params.finalStatus,
        inboundStatus: params.inboundStatus,
        reviewNote: params.reviewNote,
      });
      await this.sendReplyToInbound(params.inbound, params.successReply);
      return true;
    } catch (error) {
      await this.repository.updateCandidate({
        candidateId: params.candidate.id,
        userId: params.userId,
        status: WHATSAPP_CANDIDATE_STATUS.AWAITING_USER_CONFIRMATION,
        evidence: this.mergeCandidateEvidence(params.candidate, {
          reviewStatus: WHATSAPP_CANDIDATE_STATUS.AWAITING_USER_CONFIRMATION,
          autoCreateFailedAt: new Date().toISOString(),
          autoCreateFailure: error instanceof Error ? error.message : String(error),
        }),
      });
      if (params.candidate.inbound_message_id) {
        await this.repository.updateInboundMessage({
          id: params.candidate.inbound_message_id,
          status: "awaiting_user_confirmation",
          errorMessage: error instanceof Error ? error.message : String(error),
          extractedPayload: {
            ...(params.candidate.evidence || {}),
            candidateId: params.candidate.id,
            autoCreateFailure: error instanceof Error ? error.message : String(error),
          },
        });
      }
      await this.appendInboundProcessingLog({
        inboundMessageId: params.candidate.inbound_message_id,
        userId: params.userId,
        level: "error",
        event: "transaction_persist_fallback",
        message: "Falha na persistencia automatica; candidate mantido para confirmacao/revisao.",
        metadata: {
          candidateId: params.candidate.id,
          finalStatus: params.finalStatus,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      await this.sendReplyToInbound(params.inbound, params.fallbackReply);
      return false;
    }
  }

  private async resolveAccountForMessage(userId: string, text: string): Promise<AccountResolution> {
    const accounts = await this.storage.getAccountsByUserId(userId);
    if (!accounts.length) throw new Error("Cadastre uma conta antes de usar o WhatsApp.");

    const normalized = normalizeText(text);
    const scopeHint = detectAccountScopeHint(text);
    const scoped = scopeHint ? accounts.filter((account) => account.type.toUpperCase() === scopeHint) : accounts;
    const directMatch = scoped.find((account) => normalized.includes(normalizeText(account.name)));

    if (directMatch) {
      return { selectedAccount: directMatch, accountOptions: scoped, selectionReason: "direct_name_match" };
    }
    if (scoped.length === 1) {
      return { selectedAccount: scoped[0], accountOptions: scoped, selectionReason: "single_account_after_scope" };
    }

    const preferredDefaults = scoped.filter((account) => isPreferredDefaultAccount(account));
    if (preferredDefaults.length === 1) {
      return {
        selectedAccount: preferredDefaults[0],
        accountOptions: scoped,
        selectionReason: "principal_name_hint",
      };
    }

    const transactions = await this.storage.getTransactionsByUserId(userId, "ALL");
    const recentTransactions = transactions
      .filter((transaction) => scoped.some((account) => account.id === transaction.accountId))
      .sort((left, right) => right.date.getTime() - left.date.getTime());

    const recentPreferredAccount = recentTransactions
      .map((transaction) => scoped.find((account) => account.id === transaction.accountId) || null)
      .find((account): account is Account => Boolean(account));

    if (recentPreferredAccount) {
      return {
        selectedAccount: recentPreferredAccount,
        accountOptions: scoped,
        selectionReason: scopeHint ? "recent_history_in_scope" : "recent_history_default",
      };
    }

    return { selectedAccount: null, accountOptions: scoped, selectionReason: "ambiguous_account_selection" };
  }

  private async resolveAccountByCandidate(userId: string, candidate: CandidateRecord, accountId?: string) {
    if (accountId) {
      const explicit = await this.storage.getAccount(accountId);
      if (!explicit || explicit.userId !== userId) throw new Error("Escolha uma conta valida.");
      return explicit;
    }

    const selectedAccountId = candidate.evidence?.selectedAccountId;
    if (selectedAccountId) {
      const account = await this.storage.getAccount(selectedAccountId);
      if (account && account.userId === userId) return account;
    }

    const resolution = await this.resolveAccountForMessage(userId, candidate.description || "");
    if (!resolution.selectedAccount) throw new Error("Nao consegui definir a conta. Escolha uma conta para continuar.");
    return resolution.selectedAccount;
  }

  private async matchAccountFromReply(userId: string, text: string, candidate: CandidateRecord) {
    const accounts = await this.storage.getAccountsByUserId(userId);
    const options = (candidate.evidence?.accountOptions || []) as Array<{ id: string; name: string; type: string }>;
    const normalized = normalizeText(text);
    const indexMatch = normalized.match(/\b(\d+)\b/);

    if (indexMatch) {
      const option = options[Number(indexMatch[1]) - 1];
      if (option) return accounts.find((account) => account.id === option.id) || null;
    }

    const scopeHint = detectAccountScopeHint(text);
    if (scopeHint) {
      const scoped = accounts.filter((account) => account.type.toUpperCase() === scopeHint);
      if (scoped.length === 1) return scoped[0];
    }

    return accounts.find((account) => normalized.includes(normalizeText(account.name))) || null;
  }

  private async isSuppressedPattern(userId: string, normalizedDescription: string) {
    const ignored = await this.repository.listCandidatesByStatuses(userId, [WHATSAPP_CANDIDATE_STATUS.IGNORED_PATTERN]);
    return ignored.some((candidate) => candidate.evidence?.ignoreFutureSimilar && candidate.evidence?.normalizedDescription === normalizedDescription);
  }

  private shouldHandleAsReplyToOpenCandidate(candidate: CandidateRecord, text: string) {
    if (!text.trim()) return true;
    if (detectResetIntent(text) || detectConfirmationIntent(text) || detectAccountScopeHint(text)) return true;

    const normalized = normalizeText(text);
    if (/^\d+$/.test(normalized)) return true;

    if (candidate.status === WHATSAPP_CANDIDATE_STATUS.AWAITING_ACCOUNT_SELECTION) {
      const optionNames = ((candidate.evidence?.accountOptions || []) as Array<{ name?: string }>).map((item) => normalizeText(item.name || ""));
      if (optionNames.some((name) => name && normalized.includes(name))) return true;
    }

    if (looksLikeGreeting(text) || looksLikeFinanceAssistantQuestion(text)) return false;

    if (/\b(paguei|gastei|comprei|recebi|ganhei|pix|boleto|faturamento|entrada|saida)\b/.test(normalized)) {
      return false;
    }

    const parsed = this.parser.parse({ text });
    if (parsed.amount !== null && parsed.kind !== "unknown" && parsed.confidence >= WHATSAPP_CONFIRMATION_THRESHOLD) {
      return false;
    }

    return true;
  }

  private describeIntent(intent: { kind: "income" | "expense" | "unknown"; amount: number | null; categorySuggestion?: string }) {
    const action = intent.kind === "income" ? "uma entrada" : "um gasto";
    const amount = intent.amount === null ? 0 : intent.amount;
    const kind = intent.kind === "income" ? "income" : "expense";
    return `${action} de ${formatCurrencyBRL(amount)} em ${categoryFromIntent(kind, intent.categorySuggestion)}`;
  }

  private describeCandidate(candidate: CandidateRecord) {
    const action = candidate.proposed_type === "income" ? "uma entrada" : "um gasto";
    return `${action} de ${formatCurrencyBRL(Number(candidate.amount))}`;
  }

  private formatAccountOptions(accounts: Account[]) {
    return accounts.map((account, index) => `${index + 1}) ${accountLabel(account)}`).join(", ");
  }

  private formatAccountOptionsFromEvidence(candidate: CandidateRecord) {
    const options = (candidate.evidence?.accountOptions || []) as Array<{ name: string; type: string }>;
    return options.map((item, index) => `${index + 1}) ${item.name} ${item.type}`).join(", ");
  }

  private parseInvoiceDate(value: string) {
    const [day, month, yearRaw] = value.split("/");
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private pickInvoiceCategory(invoice: ReturnType<typeof parseInvoiceText>) {
    if (!invoice) return "Outros";
    const haystack = [invoice.merchant, ...invoice.items.map((item) => item.description)].join(" ").toLowerCase();
    if (/mercado|supermerc|padaria|hortifruti/.test(haystack)) return "Alimentação";
    if (/farmacia|drogaria/.test(haystack)) return "Saúde";
    return "Outros";
  }

  private mergeCandidateEvidence(candidate: CandidateRecord, patch: Record<string, unknown>) {
    return { ...(candidate.evidence || {}), ...patch };
  }

  private mapTransactionForReview(transaction: Transaction) {
    return {
      id: transaction.id,
      accountId: transaction.accountId,
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      date: transaction.date.toISOString(),
      accountType: transaction.accountType,
      source: transaction.source,
    };
  }

  private async sendReplyToInbound(inbound: InboundMessageRecord, text: string) {
    this.logInternal("info", "outbound_reply_attempt", "Tentando enviar resposta outbound pelo WhatsApp.", {
      inboundMessageId: inbound.id,
      fromPhone: inbound.fromPhone,
      textPreview: textPreview(text),
    });
    try {
      const sent = await this.messenger.sendTextMessage(inbound.fromPhone, text);
      if (!sent) {
        this.logInternal("warn", "outbound_reply_skipped", "Nao foi possivel enviar resposta no chat.", {
          inboundMessageId: inbound.id,
          fromPhone: inbound.fromPhone,
        });
      } else {
        this.logInternal("info", "outbound_reply_success", "Resposta outbound enviada com sucesso.", {
          inboundMessageId: inbound.id,
          fromPhone: inbound.fromPhone,
        });
      }
    } catch (error) {
      this.logInternal("warn", "outbound_reply_failed", "Falha secundaria ao enviar resposta pelo WhatsApp.", {
        inboundMessageId: inbound.id,
        fromPhone: inbound.fromPhone,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async confirmPhoneBinding(pending: PendingPhoneBinding, event: WhatsAppInboundEvent): Promise<{ status: string }> {
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
      errorMessage: user?.billingStatus === "active" ? null : "Assinatura inativa para concluir o vinculo.",
    });

    if (!user || user.billingStatus !== "active") {
      this.clearPendingBinding(pending.userId, pending.code);
      await this.sendReplyToInbound(inbound, "Seu numero foi identificado, mas a assinatura precisa estar ativa para concluir o vinculo.");
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
      message: "Numero confirmado com sucesso pelo codigo de vinculacao.",
      metadata: {
        linkedPhone: binding.phone_e164,
      },
    });

    await this.sendReplyToInbound(inbound, "Numero confirmado. Agora voce ja pode mandar gastos, recebimentos, notas e perguntas pelo WhatsApp.");
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
    if (!user) throw new Error("Usuario nao encontrado.");
    if (user.billingStatus !== "active") throw new Error("Disponivel para assinantes ativos.");
    return user;
  }

  private logInternal(level: "info" | "warn" | "error", event: string, message: string, metadata?: Record<string, unknown>) {
    const payload = metadata ? { event, message, metadata } : { event, message };
    if (level === "error") return console.error("[WHATSAPP]", payload);
    if (level === "warn") return console.warn("[WHATSAPP]", payload);
    return console.info("[WHATSAPP]", payload);
  }

  private getBusinessPhone() {
    return getWhatsAppMetaConfig().publicPhone;
  }

  private async appendInboundProcessingLog(params: {
    inboundMessageId?: string | null;
    userId?: string | null;
    level: "info" | "warn" | "error";
    event: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!params.inboundMessageId) return false;

    const appendProcessingLog = (this.repository as { appendProcessingLog?: (payload: typeof params) => Promise<boolean> }).appendProcessingLog;
    if (typeof appendProcessingLog !== "function") return false;

    try {
      return await appendProcessingLog.call(this.repository, params);
    } catch (error) {
      this.logInternal("warn", "processing_log_failed", "Falha secundaria ao persistir log do WhatsApp.", {
        inboundMessageId: params.inboundMessageId,
        event: params.event,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
