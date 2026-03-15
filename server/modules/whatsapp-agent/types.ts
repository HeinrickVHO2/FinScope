export type WhatsAppMessageType = "text" | "image" | "document" | "audio" | "unknown";

export interface WhatsAppInboundEvent {
  provider: string;
  providerMessageId: string;
  fromPhone: string;
  toPhone?: string;
  timestamp?: string;
  type: WhatsAppMessageType;
  text?: string;
  media?: Array<{
    id: string;
    mimeType?: string;
    url?: string;
    fileName?: string;
    base64?: string;
  }>;
  rawPayload: Record<string, unknown>;
}

export interface OcrResult {
  text: string;
  confidence: number;
}

export interface FinancialIntent {
  kind: "income" | "expense" | "unknown";
  amount: number | null;
  description: string;
  merchant?: string;
  categorySuggestion?: string;
  transactionDate: Date;
  confidence: number;
  missingFields: string[];
}

