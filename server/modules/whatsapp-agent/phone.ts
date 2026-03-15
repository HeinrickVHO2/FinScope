export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return `+${digits}`;
  if (digits.length >= 10) return `+55${digits}`;
  return `+${digits}`;
}

