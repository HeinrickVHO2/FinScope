export type WhatsAppMessageType = "text" | "image" | "document" | "audio" | "unknown";

export interface WhatsAppInboundMedia {
  id: string;
  mimeType?: string;
  url?: string;
  fileName?: string;
  base64?: string;
}

export interface WhatsAppInboundEvent {
  provider: string;
  providerMessageId: string;
  fromPhone: string;
  toPhone?: string;
  timestamp?: string;
  type: WhatsAppMessageType;
  text?: string;
  media?: WhatsAppInboundMedia[];
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

export interface PendingPhoneBinding {
  userId: string;
  phone: string;
  code: string;
  expiresAt: string;
  createdAt: string;
}

export interface WhatsAppSessionState {
  eligible: boolean;
  billingStatus: string;
  plan: string;
  instructions: string[];
  businessPhone: string | null;
  conversationUrl: string | null;
  binding: {
    isLinked: boolean;
    phone: string | null;
    provider: string | null;
    verified: boolean;
  };
  pendingBinding: PendingPhoneBinding | null;
}
