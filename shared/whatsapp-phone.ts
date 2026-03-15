function digitsOnly(phone: string): string {
  return String(phone || "").replace(/\D+/g, "");
}

function stripInternationalPrefix(digits: string): string {
  if (digits.startsWith("00")) {
    return digits.slice(2);
  }

  return digits;
}

export function normalizePhone(phone: string): string {
  const rawPhone = String(phone || "").trim();
  if (!rawPhone) return "";

  const digits = stripInternationalPrefix(digitsOnly(rawPhone));
  if (!digits) return "";

  if (digits.startsWith("55")) {
    return `+${digits}`;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("0")) {
    return `+55${digits.slice(1)}`;
  }

  if (rawPhone.startsWith("+")) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export function buildWhatsAppConversationUrl(
  phone: string | null | undefined,
  text?: string,
  debugContext?: string,
): string | null {
  const rawPhone = phone ?? "";
  const normalizedPhone = rawPhone ? normalizePhone(rawPhone) : "";
  const digits = normalizedPhone.replace(/\D+/g, "");
  const suffix = text ? `?text=${encodeURIComponent(text)}` : "";
  const finalLink = digits ? `https://wa.me/${digits}${suffix}` : null;

  if (debugContext) {
    console.info("[WHATSAPP PHONE]", {
      context: debugContext,
      rawPhone,
      normalizedPhone: normalizedPhone || null,
      finalLink,
    });
  }

  return finalLink;
}
