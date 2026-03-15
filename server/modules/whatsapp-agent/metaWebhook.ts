import type { WhatsAppInboundEvent, WhatsAppInboundMedia, WhatsAppMessageType } from "./types";
import { normalizePhone } from "./phone";

type MetaWebhookPayload = Record<string, any>;

function normalizeMessageType(value: string | undefined): WhatsAppMessageType {
  if (value === "text" || value === "image" || value === "document" || value === "audio") {
    return value;
  }
  return "unknown";
}

function toIsoTimestamp(unixSeconds: string | undefined): string | undefined {
  if (!unixSeconds) return undefined;
  const value = Number(unixSeconds);
  if (!Number.isFinite(value)) return undefined;
  return new Date(value * 1000).toISOString();
}

function normalizeMedia(message: Record<string, any>, type: WhatsAppMessageType): WhatsAppInboundMedia[] {
  if (type === "image" && message.image?.id) {
    return [{
      id: message.image.id,
      mimeType: message.image.mime_type,
      fileName: message.image.caption,
      url: undefined,
    }];
  }

  if (type === "document" && message.document?.id) {
    return [{
      id: message.document.id,
      mimeType: message.document.mime_type,
      fileName: message.document.filename,
      url: undefined,
    }];
  }

  if (type === "audio" && message.audio?.id) {
    return [{
      id: message.audio.id,
      mimeType: message.audio.mime_type,
      url: undefined,
    }];
  }

  return [];
}

function normalizeText(message: Record<string, any>, type: WhatsAppMessageType): string | undefined {
  if (type === "text") {
    return message.text?.body?.toString().trim() || undefined;
  }

  if (type === "image") {
    return message.image?.caption?.toString().trim() || undefined;
  }

  return undefined;
}

export function parseMetaWebhookPayload(payload: MetaWebhookPayload): WhatsAppInboundEvent[] {
  const events: WhatsAppInboundEvent[] = [];

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value;
      const metadata = value?.metadata || {};
      const messages = Array.isArray(value?.messages) ? value.messages : [];

      for (const message of messages) {
        const type = normalizeMessageType(message?.type);
        const media = normalizeMedia(message, type);
        events.push({
          provider: "whatsapp_cloud_api",
          providerMessageId: String(message?.id || ""),
          fromPhone: normalizePhone(String(message?.from || "")),
          toPhone: metadata?.display_phone_number
            ? normalizePhone(String(metadata.display_phone_number))
            : undefined,
          timestamp: toIsoTimestamp(message?.timestamp?.toString()),
          type,
          text: normalizeText(message, type),
          media: media.length ? media : undefined,
          rawPayload: {
            object: payload.object,
            entryId: entry?.id,
            changeField: change?.field,
            metadata,
            contacts: value?.contacts || [],
            message,
          },
        });
      }
    }
  }

  return events.filter((event) => event.providerMessageId && event.fromPhone);
}

export function buildMetaVerificationResponse(params: {
  mode?: string;
  token?: string;
  challenge?: string;
  expectedToken?: string;
}) {
  const mode = params.mode || "";
  const token = params.token || "";
  const challenge = params.challenge || "";
  const expectedToken = params.expectedToken || "";

  if (mode === "subscribe" && token && expectedToken && token === expectedToken) {
    return {
      ok: true,
      challenge,
    };
  }

  return {
    ok: false,
    challenge: "",
  };
}
