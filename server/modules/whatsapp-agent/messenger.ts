import { getWhatsAppMetaConfig, hasMetaOutboundConfig } from "./config";
import { normalizePhone } from "./phone";

export class WhatsAppMessenger {
  async sendTextMessage(phone: string, text: string) {
    const config = getWhatsAppMetaConfig();
    const normalizedPhone = normalizePhone(phone).replace(/\D+/g, "");
    const sanitizedText = String(text || "").replace(/\s+/g, " ").trim().slice(0, 1000);

    if (!normalizedPhone || !sanitizedText) {
      return false;
    }

    if (!hasMetaOutboundConfig()) {
      console.info("[WHATSAPP OUTBOUND] skipped sendTextMessage: outbound config missing", {
        normalizedPhone,
        preview: sanitizedText,
      });
      return false;
    }

    const endpoint = `https://graph.facebook.com/v22.0/${config.phoneNumberId}/messages`;
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
      });
      return false;
    }

    return true;
  }
}
