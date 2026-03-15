import { createHmac, timingSafeEqual } from "node:crypto";
import type { Express } from "express";
import { z } from "zod";
import type { IStorage } from "../../storage";
import { normalizePhone } from "./phone";
import { WhatsAppRepository } from "./repository";
import { WhatsAppAgentService } from "./service";
import type { WhatsAppInboundEvent } from "./types";

export type Middleware = (req: any, res: any, next: any) => void | Promise<void>;

const bindPhoneSchema = z.object({
  phone: z.string().min(8),
});

const webhookMediaSchema = z.object({
  id: z.string().min(1),
  mimeType: z.string().optional(),
  url: z.string().optional(),
  fileName: z.string().optional(),
  base64: z.string().optional(),
});

const webhookSchema = z.object({
  provider: z.string().default("whatsapp_cloud_api"),
  providerMessageId: z.string().min(1),
  fromPhone: z.string().min(6),
  toPhone: z.string().optional(),
  timestamp: z.string().optional(),
  type: z.enum(["text", "image", "document", "audio", "unknown"]).default("text"),
  text: z.string().optional(),
  media: z.array(webhookMediaSchema).optional(),
}).passthrough();

function signatureIsValid(req: any, secret: string): boolean {
  if (!secret) return true;

  const signature = String(req.headers["x-finscope-signature"] || req.headers["x-whatsapp-signature"] || "");
  if (!signature) return false;

  const raw = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : Buffer.from(JSON.stringify(req.body || {}), "utf8");

  const computed = createHmac("sha256", secret).update(raw).digest("hex");

  const sigBuffer = Buffer.from(signature);
  const cmpBuffer = Buffer.from(computed);
  if (sigBuffer.length !== cmpBuffer.length) return false;

  return timingSafeEqual(sigBuffer, cmpBuffer);
}

function toInboundEvent(payload: z.infer<typeof webhookSchema>): WhatsAppInboundEvent {
  return {
    provider: payload.provider,
    providerMessageId: payload.providerMessageId,
    fromPhone: normalizePhone(payload.fromPhone),
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
  const { app, storage, requireAuth, requireActiveBilling } = params;
  const repository = new WhatsAppRepository();
  const service = new WhatsAppAgentService(repository, storage);

  app.get("/api/whatsapp/phone-binding", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const binding = await service.getBinding(req.session.userId);
      return res.json(binding);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Falha ao consultar vínculo de telefone",
      });
    }
  });

  app.post("/api/whatsapp/phone-binding", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const payload = bindPhoneSchema.parse(req.body);
      const binding = await service.bindPhone(req.session.userId, payload.phone);
      return res.json({
        id: binding.id,
        phone: binding.phone_e164,
        provider: binding.provider,
        isVerified: binding.is_verified,
      });
    } catch (error) {
      const message = error instanceof z.ZodError
        ? "Telefone inválido"
        : error instanceof Error
          ? error.message
          : "Falha ao vincular telefone";
      return res.status(400).json({ error: message });
    }
  });

  app.get("/api/whatsapp/candidates", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const candidates = await service.listPendingCandidates(req.session.userId);
      return res.json(candidates);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Falha ao listar pendências",
      });
    }
  });

  app.post("/api/whatsapp/candidates/:candidateId/confirm", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const result = await service.confirmCandidate({
        userId: req.session.userId,
        candidateId: req.params.candidateId,
      });
      return res.json({
        transactionId: result.transactionId,
        message: "Transação confirmada",
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Falha ao confirmar candidato",
      });
    }
  });

  app.post("/api/integrations/whatsapp/webhook", async (req: any, res) => {
    try {
      const secret = process.env.WHATSAPP_WEBHOOK_SECRET || "";
      if (!signatureIsValid(req, secret)) {
        return res.status(401).json({ error: "Assinatura inválida" });
      }

      const payload = webhookSchema.parse(req.body);
      const event = toInboundEvent(payload);

      const result = await service.processInboundEvent(event);
      return res.json({ received: true, status: result.status });
    } catch (error) {
      const message = error instanceof z.ZodError
        ? "Payload de webhook inválido"
        : error instanceof Error
          ? error.message
          : "Falha ao processar webhook";
      return res.status(400).json({ error: message });
    }
  });

  app.post("/api/whatsapp/mock-event", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const payload = webhookSchema.parse({
        ...req.body,
        provider: "mock",
      });

      const binding = await service.getBinding(req.session.userId);
      if (!binding) {
        return res.status(400).json({
          error: "Vincule um telefone antes de simular eventos do WhatsApp",
        });
      }

      const event = toInboundEvent({
        ...payload,
        fromPhone: binding.phone_e164,
        providerMessageId: payload.providerMessageId || `mock-${Date.now()}`,
      });

      const result = await service.processInboundEvent(event);
      return res.json({
        received: true,
        status: result.status,
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Falha ao simular evento",
      });
    }
  });
}

