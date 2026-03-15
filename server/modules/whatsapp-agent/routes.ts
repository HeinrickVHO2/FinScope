import { createHmac, timingSafeEqual } from "node:crypto";
import type { Express } from "express";
import { z } from "zod";
import type { IStorage } from "../../storage";
import { getWhatsAppMetaConfig } from "./config";
import { parseMetaWebhookPayload, buildMetaVerificationResponse } from "./metaWebhook";
import { normalizePhone } from "./phone";
import { WhatsAppRepository } from "./repository";
import { WhatsAppAgentService } from "./service";
import type { WhatsAppInboundEvent } from "./types";

export type Middleware = (req: any, res: any, next: any) => void | Promise<void>;

const startBindingSchema = z.object({
  phone: z.string().min(8),
});

const confirmCandidateSchema = z.object({
  accountId: z.string().min(1).optional(),
});

const reviewTransactionPatchSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.coerce.number().positive().optional(),
  category: z.string().min(1).optional(),
  date: z.coerce.date().optional(),
  type: z.enum(["entrada", "saida"]).optional(),
  accountType: z.enum(["PF", "PJ"]).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "Informe ao menos um campo para atualizar.",
});

const normalizedMockSchema = z.object({
  provider: z.string().default("mock"),
  providerMessageId: z.string().min(1).optional(),
  fromPhone: z.string().min(6).optional(),
  toPhone: z.string().optional(),
  timestamp: z.string().optional(),
  type: z.enum(["text", "image", "document", "audio", "unknown"]).default("text"),
  text: z.string().max(1500).optional(),
  media: z.array(z.object({
    id: z.string().min(1),
    mimeType: z.string().optional(),
    url: z.string().optional(),
    fileName: z.string().optional(),
    base64: z.string().optional(),
  })).max(4).optional(),
}).passthrough();

function signatureIsValid(req: any, secret: string): boolean {
  if (!secret) return true;

  const header = String(req.headers["x-hub-signature-256"] || "");
  if (!header.startsWith("sha256=")) {
    return false;
  }

  const signature = header.slice("sha256=".length);
  const raw = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : Buffer.from(JSON.stringify(req.body || {}), "utf8");

  const computed = createHmac("sha256", secret).update(raw).digest("hex");
  const expected = Buffer.from(signature, "utf8");
  const actual = Buffer.from(computed, "utf8");
  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

function mapCandidate(candidate: any) {
  return {
    id: candidate.id,
    inboundMessageId: candidate.inbound_message_id,
    proposedType: candidate.proposed_type,
    amount: Number(candidate.amount),
    currency: candidate.currency,
    description: candidate.description,
    merchantName: candidate.merchant_name,
    categorySuggestion: candidate.category_suggestion,
    transactionDate: candidate.transaction_date,
    confidenceScore: candidate.confidence_score === null ? null : Number(candidate.confidence_score),
    status: candidate.status,
    persistedTransactionId: candidate.persisted_transaction_id,
    evidence: candidate.evidence ?? null,
    createdAt: candidate.created_at,
  };
}

function toInboundEvent(payload: z.infer<typeof normalizedMockSchema>): WhatsAppInboundEvent {
  return {
    provider: payload.provider,
    providerMessageId: payload.providerMessageId || `mock-${Date.now()}`,
    fromPhone: normalizePhone(payload.fromPhone || ""),
    toPhone: payload.toPhone ? normalizePhone(payload.toPhone) : undefined,
    timestamp: payload.timestamp,
    type: payload.type,
    text: payload.text,
    media: payload.media,
    rawPayload: payload,
  };
}

export function registerWhatsAppAgentRoutes(params: {
  app: Express;
  storage: IStorage;
  requireAuth: Middleware;
  requireActiveBilling: Middleware;
}) {
  const { app, storage, requireAuth } = params;
  const repository = new WhatsAppRepository();
  const service = new WhatsAppAgentService(repository, storage);

  app.get("/api/whatsapp/session", requireAuth, async (req: any, res) => {
    try {
      const session = await service.getSession(req.session.userId);
      return res.json(session);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível carregar o WhatsApp agora.",
      });
    }
  });

  app.post("/api/whatsapp/binding/start", requireAuth, async (req: any, res) => {
    try {
      const payload = startBindingSchema.parse(req.body);
      const result = await service.startBinding(req.session.userId, payload.phone);
      return res.json(result);
    } catch (error) {
      const message = error instanceof z.ZodError
        ? "Informe um número válido."
        : error instanceof Error
          ? error.message
          : "Não foi possível gerar o código agora.";
      const status = message === "Disponível para assinantes ativos." ? 403 : 400;
      return res.status(status).json({ error: message });
    }
  });

  app.delete("/api/whatsapp/binding", requireAuth, async (req: any, res) => {
    try {
      const result = await service.disconnectPhone(req.session.userId);
      return res.json(result);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível remover o vínculo.",
      });
    }
  });

  app.get("/api/whatsapp/candidates", requireAuth, async (req: any, res) => {
    try {
      const candidates = await service.listPendingCandidates(req.session.userId);
      return res.json(candidates.map(mapCandidate));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível carregar as sugestões.";
      const status = message === "Disponível para assinantes ativos." ? 403 : 400;
      return res.status(status).json({ error: message });
    }
  });

  app.get("/api/whatsapp/review-items", requireAuth, async (req: any, res) => {
    try {
      const items = await service.listReviewItems(req.session.userId);
      return res.json(items);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel carregar os lancamentos do WhatsApp.";
      const status = message === "Disponivel para assinantes ativos." ? 403 : 400;
      return res.status(status).json({ error: message });
    }
  });

  app.post("/api/whatsapp/candidates/:candidateId/confirm", requireAuth, async (req: any, res) => {
    try {
      const payload = confirmCandidateSchema.parse(req.body || {});
      const result = await service.confirmCandidate({
        userId: req.session.userId,
        candidateId: req.params.candidateId,
        accountId: payload.accountId,
      });
      return res.json({
        transactionId: result.transactionId,
        message: "Transação confirmada.",
      });
    } catch (error) {
      const message = error instanceof z.ZodError
        ? "Escolha uma conta válida."
        : error instanceof Error
          ? error.message
          : "Não foi possível confirmar essa sugestão.";
      return res.status(400).json({ error: message });
    }
  });

  app.post("/api/whatsapp/candidates/:candidateId/ignore", requireAuth, async (req: any, res) => {
    try {
      await service.ignoreCandidate({
        userId: req.session.userId,
        candidateId: req.params.candidateId,
      });
      return res.json({
        ignored: true,
        message: "Sugestão ignorada.",
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível ignorar essa sugestão.",
      });
    }
  });

  app.post("/api/whatsapp/review-items/:candidateId/approve", requireAuth, async (req: any, res) => {
    try {
      const result = await service.approveReviewItem({
        userId: req.session.userId,
        candidateId: req.params.candidateId,
      });
      return res.json(result);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Nao foi possivel aprovar esse lancamento.",
      });
    }
  });

  app.patch("/api/whatsapp/review-items/:candidateId/transaction", requireAuth, async (req: any, res) => {
    try {
      const patch = reviewTransactionPatchSchema.parse(req.body || {});
      const result = await service.updateReviewTransaction({
        userId: req.session.userId,
        candidateId: req.params.candidateId,
        patch,
      });
      return res.json(result);
    } catch (error) {
      const message = error instanceof z.ZodError
        ? "Dados invalidos para atualizar o lancamento."
        : error instanceof Error
          ? error.message
          : "Nao foi possivel atualizar o lancamento.";
      return res.status(400).json({ error: message });
    }
  });

  app.delete("/api/whatsapp/review-items/:candidateId/transaction", requireAuth, async (req: any, res) => {
    try {
      const result = await service.removeReviewTransaction({
        userId: req.session.userId,
        candidateId: req.params.candidateId,
      });
      return res.json(result);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Nao foi possivel remover o lancamento.",
      });
    }
  });

  app.post("/api/whatsapp/review-items/:candidateId/ignore-similar", requireAuth, async (req: any, res) => {
    try {
      const result = await service.suppressSimilarSuggestions({
        userId: req.session.userId,
        candidateId: req.params.candidateId,
      });
      return res.json(result);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Nao foi possivel ignorar sugestoes parecidas.",
      });
    }
  });

  app.get("/api/whatsapp/webhook/meta", (req: any, res) => {
    console.log("[WHATSAPP] iniciando validacao do webhook Meta");
    const metaConfig = getWhatsAppMetaConfig();

    const verification = buildMetaVerificationResponse({
      mode: req.query["hub.mode"]?.toString(),
      token: req.query["hub.verify_token"]?.toString(),
      challenge: req.query["hub.challenge"]?.toString(),
      expectedToken: metaConfig.verifyToken,
    });

    if (!verification.ok) {
      console.warn("[WHATSAPP] falha na validacao do webhook Meta");
      return res.status(403).send("verification_failed");
    }

    console.log("[WHATSAPP] webhook Meta validado");
    return res.status(200).send(verification.challenge);
  });

  app.post("/api/whatsapp/webhook/meta", async (req: any, res) => {
    console.log("[WHATSAPP] evento Meta recebido");

    try {
      const metaConfig = getWhatsAppMetaConfig();
      const appSecret = metaConfig.appSecret;
      if (appSecret && !signatureIsValid(req, appSecret)) {
        console.warn("[WHATSAPP] assinatura Meta invalida");
        return res.status(401).json({ error: "Assinatura inválida" });
      }

      const events = parseMetaWebhookPayload(req.body || {});
      if (events.length > 20) {
        return res.status(413).json({ error: "Quantidade de eventos acima do limite permitido." });
      }
      console.log("[WHATSAPP] eventos normalizados", { count: events.length });

      for (const event of events) {
        await service.processInboundEvent(event);
      }

      return res.json({ received: true, count: events.length });
    } catch (error) {
      console.error("[WHATSAPP] erro ao processar webhook Meta", error);
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível processar a mensagem.",
      });
    }
  });

  app.post("/api/integrations/whatsapp/webhook", async (req: any, res) => {
    try {
      const events = parseMetaWebhookPayload(req.body || {});
      for (const event of events) {
        await service.processInboundEvent(event);
      }
      return res.json({ received: true, count: events.length });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível processar a mensagem.",
      });
    }
  });

  app.post("/api/whatsapp/mock-event", requireAuth, async (req: any, res) => {
    try {
      const payload = normalizedMockSchema.parse(req.body);
      const session = await service.getSession(req.session.userId);
      const event = toInboundEvent({
        ...payload,
        provider: "mock",
        fromPhone: payload.fromPhone || session.binding.phone || payload.fromPhone,
      });

      if (!event.fromPhone) {
        return res.status(400).json({
          error: "Conecte um número antes de simular mensagens.",
        });
      }

      const result = await service.processInboundEvent(event);
      return res.json({
        received: true,
        status: result.status,
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível simular a mensagem.",
      });
    }
  });
}
