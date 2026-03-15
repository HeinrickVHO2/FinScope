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

export class MockOcrProvider implements OcrProvider {
  async extractText(input: { mimeType?: string; url?: string; base64?: string }): Promise<OcrResult> {
    const hasImage = (input.mimeType || "").startsWith("image/") || Boolean(input.base64) || Boolean(input.url);
    if (!hasImage) {
      return { text: "", confidence: 0 };
    }

    return {
      text: "",
      confidence: 0.2,
    };
  }
}

export class OpenAiVisionOcrProvider implements OcrProvider {
  async extractText(input: { mimeType?: string; url?: string; base64?: string }): Promise<OcrResult> {
    const mimeType = input.mimeType || "image/jpeg";
    if (!OPENAI_API_KEY || !mimeType.startsWith("image/") || !input.base64) {
      return { text: "", confidence: 0 };
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
                "Voce extrai texto de notas fiscais e cupons brasileiros. Responda apenas em JSON com as chaves text e confidence. Preserve valores, datas, CNPJ, itens e totais. Nao invente campos ausentes.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Extraia o texto legivel desta imagem de nota fiscal brasileira. Organize em linhas simples, preserve o total e os itens quando existirem, e retorne JSON: {\"text\":\"...\",\"confidence\":0.0}.",
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
        return { text: "", confidence: 0 };
      }

      const completion = await response.json();
      const content = completion?.choices?.[0]?.message?.content || "";
      const sanitized = sanitizeJson(content);
      const parsed = JSON.parse(sanitized);

      return {
        text: typeof parsed?.text === "string" ? parsed.text.trim() : "",
        confidence: normalizeConfidence(parsed?.confidence, 0.7),
      };
    } catch {
      return { text: "", confidence: 0 };
    }
  }
}

export function createDefaultOcrProvider(): OcrProvider {
  if (OPENAI_API_KEY) {
    return new OpenAiVisionOcrProvider();
  }
  return new MockOcrProvider();
}
