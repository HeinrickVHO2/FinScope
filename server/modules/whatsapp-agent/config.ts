import { normalizePhone } from "./phone";

export function getWhatsAppMetaConfig() {
  return {
    accessToken: process.env.WHATSAPP_META_ACCESS_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_META_PHONE_NUMBER_ID || "",
    wabaId: process.env.WHATSAPP_META_WABA_ID || "",
    verifyToken: process.env.WHATSAPP_META_VERIFY_TOKEN || "",
    appSecret: process.env.WHATSAPP_META_APP_SECRET || "",
    publicPhone: (() => {
      const raw = process.env.WHATSAPP_META_PUBLIC_PHONE
        || process.env.WHATSAPP_BUSINESS_PHONE
        || process.env.WHATSAPP_META_PHONE_NUMBER;
      return raw ? normalizePhone(raw) : null;
    })(),
  };
}

export function hasMetaWebhookConfig() {
  const config = getWhatsAppMetaConfig();
  return Boolean(config.verifyToken && config.appSecret);
}

export function hasMetaOutboundConfig() {
  const config = getWhatsAppMetaConfig();
  return Boolean(config.accessToken && config.phoneNumberId && config.wabaId);
}
