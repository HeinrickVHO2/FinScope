import type { OcrResult } from "./types";

export interface OcrProvider {
  extractText(input: {
    mimeType?: string;
    url?: string;
    base64?: string;
  }): Promise<OcrResult>;
}

export class MockOcrProvider implements OcrProvider {
  async extractText(input: { mimeType?: string; url?: string; base64?: string }): Promise<OcrResult> {
    // TODO: Substituir por provider real (AWS Textract, Google Vision, Azure Vision, etc).
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

