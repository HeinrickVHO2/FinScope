import { getWhatsAppMetaConfig, hasMetaOutboundConfig } from "./config";
import { normalizePhone } from "./phone";

type WhatsAppImagePayload = {
  buffer: Buffer;
  mimeType?: string;
  filename?: string;
  caption?: string;
};

export class WhatsAppMessenger {
  async sendTextMessage(phone: string, text: string) {
    const config = getWhatsAppMetaConfig();
    const normalizedPhone = normalizePhone(phone).replace(/\D+/g, "");
    const sanitizedText = String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
      .slice(0, 1000);
    const configStatus = {
      hasAccessToken: Boolean(config.accessToken),
      hasPhoneNumberId: Boolean(config.phoneNumberId),
      hasWabaId: Boolean(config.wabaId),
    };

    if (!normalizedPhone || !sanitizedText) {
      console.warn("[WHATSAPP OUTBOUND] skipped sendTextMessage: invalid payload", {
        normalizedPhone,
        hasText: Boolean(sanitizedText),
      });
      return false;
    }

    if (!hasMetaOutboundConfig()) {
      console.info("[WHATSAPP OUTBOUND] skipped sendTextMessage: outbound config missing", {
        normalizedPhone,
        preview: sanitizedText,
        configStatus,
      });
      return false;
    }

    const endpoint = `https://graph.facebook.com/v22.0/${config.phoneNumberId}/messages`;
    console.info("[WHATSAPP OUTBOUND] sendTextMessage start", {
      normalizedPhone,
      preview: sanitizedText,
      endpoint,
      configStatus,
    });
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "text",
        text: {
          preview_url: false,
          body: sanitizedText,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.warn("[WHATSAPP OUTBOUND] failed sendTextMessage", {
        status: response.status,
        body: errorBody.slice(0, 500),
        normalizedPhone,
        endpoint,
      });
      return false;
    }

    console.info("[WHATSAPP OUTBOUND] sendTextMessage success", {
      normalizedPhone,
      endpoint,
    });
    return true;
  }

  async sendImageMessage(phone: string, payload: WhatsAppImagePayload) {
    const config = getWhatsAppMetaConfig();
    const normalizedPhone = normalizePhone(phone).replace(/\D+/g, "");
    const configStatus = {
      hasAccessToken: Boolean(config.accessToken),
      hasPhoneNumberId: Boolean(config.phoneNumberId),
      hasWabaId: Boolean(config.wabaId),
    };

    if (!normalizedPhone || !payload?.buffer?.length) {
      console.warn("[WHATSAPP OUTBOUND] skipped sendImageMessage: invalid payload", {
        normalizedPhone,
        hasBuffer: Boolean(payload?.buffer?.length),
      });
      return false;
    }

    if (!hasMetaOutboundConfig()) {
      console.info("[WHATSAPP OUTBOUND] skipped sendImageMessage: outbound config missing", {
        normalizedPhone,
        configStatus,
      });
      return false;
    }

    const mimeType = payload.mimeType || "image/png";
    const filename = String(payload.filename || "finscope-chart.png").trim() || "finscope-chart.png";
    const caption = String(payload.caption || "").replace(/\s+/g, " ").trim().slice(0, 1024);
    const mediaEndpoint = `https://graph.facebook.com/v22.0/${config.phoneNumberId}/media`;
    const messageEndpoint = `https://graph.facebook.com/v22.0/${config.phoneNumberId}/messages`;
    const form = new FormData();

    form.set("messaging_product", "whatsapp");
    form.set("type", mimeType);
    form.set("file", new Blob([payload.buffer], { type: mimeType }), filename);

    console.info("[WHATSAPP OUTBOUND] sendImageMessage upload start", {
      normalizedPhone,
      mimeType,
      filename,
      mediaEndpoint,
      configStatus,
    });

    const uploadResponse = await fetch(mediaEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: form,
    });

    if (!uploadResponse.ok) {
      const errorBody = await uploadResponse.text().catch(() => "");
      console.warn("[WHATSAPP OUTBOUND] failed media upload", {
        status: uploadResponse.status,
        body: errorBody.slice(0, 500),
        normalizedPhone,
        mediaEndpoint,
      });
      return false;
    }

    const uploadJson = await uploadResponse.json().catch(() => null) as { id?: string } | null;
    const mediaId = uploadJson?.id;
    if (!mediaId) {
      console.warn("[WHATSAPP OUTBOUND] media upload did not return id", {
        normalizedPhone,
        mediaEndpoint,
      });
      return false;
    }

    console.info("[WHATSAPP OUTBOUND] sendImageMessage send start", {
      normalizedPhone,
      messageEndpoint,
      mediaId,
    });

    const messageResponse = await fetch(messageEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "image",
        image: {
          id: mediaId,
          ...(caption ? { caption } : {}),
        },
      }),
    });

    if (!messageResponse.ok) {
      const errorBody = await messageResponse.text().catch(() => "");
      console.warn("[WHATSAPP OUTBOUND] failed sendImageMessage", {
        status: messageResponse.status,
        body: errorBody.slice(0, 500),
        normalizedPhone,
        messageEndpoint,
        mediaId,
      });
      return false;
    }

    console.info("[WHATSAPP OUTBOUND] sendImageMessage success", {
      normalizedPhone,
      messageEndpoint,
      mediaId,
    });
    return true;
  }
}
