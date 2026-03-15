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

export interface ParsedWhatsAppIntent {
  proposedType: "income" | "expense";
  amount: number;
  currency: string;
  description: string;
  merchantName: string | null;
  categorySuggestion: string | null;
  transactionDate: string;
  confidenceScore: number;
  evidence: Record<string, unknown>;
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

export interface WhatsAppReviewItem {
  candidateId: string;
  status: string;
  confidenceScore: number | null;
  proposedType: "income" | "expense";
  amount: number;
  currency: string;
  description: string;
  categorySuggestion: string | null;
  merchantName: string | null;
  transactionDate: string;
  persistedTransactionId: string | null;
  evidence: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
  inboundMessage: {
    id: string;
    textBody: string | null;
    fromPhone: string;
    receivedAt: string | null;
    status: string;
  } | null;
  mediaEvidence: Array<{
    id: string;
    mimeType: string | null;
    storagePath: string;
    status: string;
    ocrText: string | null;
  }>;
  transaction: {
    id: string;
    accountId: string;
    description: string;
    amount: string;
    type: string;
    category: string;
    date: string;
    accountType: string;
    source: string;
  } | null;
}
