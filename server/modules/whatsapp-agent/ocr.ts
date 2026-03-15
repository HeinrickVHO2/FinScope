import fetch from "node-fetch";
import type { OcrResult } from "./types";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_OCR_MODEL = process.env.WHATSAPP_OCR_OPENAI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

export interface OcrProvider {
  extractText(input: {
    mimeType?: string;
    url?: string;
    base64?: string;
  }): Promise<OcrResult>;
}

function sanitizeJson(payload: string) {
  if (!payload) return "";
  const trimmed = payload.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return trimmed;
  }
  return trimmed.slice(start, end + 1);
}

function normalizeConfidence(value: unknown, fallback: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, Number(numeric.toFixed(2))));
}

function normalizeNullableNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : null;
}

function sanitizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildStructuredReceiptText(structuredReceipt: OcrResult["structuredReceipt"]) {
  if (!structuredReceipt) return "";

  const lines: string[] = [];
  if (structuredReceipt.merchant) lines.push(String(structuredReceipt.merchant));
  if (structuredReceipt.date) lines.push(String(structuredReceipt.date));

  for (const item of structuredReceipt.items || []) {
    if (!item?.description) continue;
    const quantity = item.quantity != null ? String(item.quantity) : "1";
    const unitPrice = item.unitPrice != null ? item.unitPrice.toFixed(2).replace(".", ",") : null;
    const totalPrice = item.totalPrice != null ? item.totalPrice.toFixed(2).replace(".", ",") : null;

    if (unitPrice && totalPrice) {
      lines.push(`${item.description} ${quantity} x ${unitPrice} ${totalPrice}`);
      continue;
    }

    if (totalPrice) {
      lines.push(`${item.description} ${totalPrice}`);
      continue;
    }

    lines.push(item.description);
  }

  if (structuredReceipt.total != null) {
    lines.push(`Valor pago ${structuredReceipt.total.toFixed(2).replace(".", ",")}`);
  }

  return lines.join("\n").trim();
}

export class MockOcrProvider implements OcrProvider {
  async extractText(input: { mimeType?: string; url?: string; base64?: string }): Promise<OcrResult> {
    const hasImage = (input.mimeType || "").startsWith("image/") || Boolean(input.base64) || Boolean(input.url);
    if (!hasImage) {
      return { text: "", confidence: 0, receiptDetected: false, structuredReceipt: null };
    }

    return {
      text: "",
      confidence: 0.2,
      receiptDetected: false,
      structuredReceipt: null,
    };
  }
}

export class OpenAiVisionOcrProvider implements OcrProvider {
  async extractText(input: { mimeType?: string; url?: string; base64?: string }): Promise<OcrResult> {
    const mimeType = input.mimeType || "image/jpeg";
    if (!OPENAI_API_KEY || !mimeType.startsWith("image/") || !input.base64) {
      return { text: "", confidence: 0, receiptDetected: false, structuredReceipt: null };
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_OCR_MODEL,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Voce analisa imagens de cupons e notas fiscais brasileiras. Responda apenas JSON com: receiptDetected (boolean), confidence (0 a 1), text (string), merchant (string|null), total (number|null), date (string|null), items (array). So marque receiptDetected=true se a imagem realmente parecer um cupom ou nota. Se a imagem estiver vazia, desfocada, muito distante ou nao for nota, retorne receiptDetected=false e nao invente valores.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Analise esta imagem. Se for uma nota/cupom fiscal brasileiro, extraia texto limpo em linhas, estabelecimento, data, total e itens principais. Se nao for confiavel, diga isso no JSON e deixe os campos vazios.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${input.base64}`,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        return { text: "", confidence: 0, receiptDetected: false, structuredReceipt: null };
      }

      const completion = await response.json();
      const content = completion?.choices?.[0]?.message?.content || "";
      const sanitized = sanitizeJson(content);
      const parsed = JSON.parse(sanitized);

      const structuredReceipt = parsed?.receiptDetected
        ? {
            merchant: sanitizeText(parsed?.merchant) || null,
            total: normalizeNullableNumber(parsed?.total),
            date: sanitizeText(parsed?.date) || null,
            items: Array.isArray(parsed?.items)
              ? parsed.items
                .map((item: any) => ({
                  description: sanitizeText(item?.description),
                  quantity: normalizeNullableNumber(item?.quantity),
                  unitPrice: normalizeNullableNumber(item?.unitPrice),
                  totalPrice: normalizeNullableNumber(item?.totalPrice),
                }))
                .filter((item: any) => item.description)
              : [],
          }
        : null;

      const explicitText = sanitizeText(parsed?.text);
      const structuredText = buildStructuredReceiptText(structuredReceipt);

      return {
        text: explicitText || structuredText,
        confidence: normalizeConfidence(parsed?.confidence, structuredReceipt ? 0.78 : 0.2),
        receiptDetected: Boolean(parsed?.receiptDetected),
        structuredReceipt,
      };
    } catch {
      return { text: "", confidence: 0, receiptDetected: false, structuredReceipt: null };
    }
  }
}

export function createDefaultOcrProvider(): OcrProvider {
  if (OPENAI_API_KEY) {
    return new OpenAiVisionOcrProvider();
  }
  return new MockOcrProvider();
}
