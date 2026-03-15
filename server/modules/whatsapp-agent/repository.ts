import { supabase } from "../../supabase";
import type { WhatsAppInboundEvent } from "./types";

function nowIso() {
  return new Date().toISOString();
}

export interface InboundMessageRecord {
  id: string;
  providerMessageId: string;
  userId: string | null;
  fromPhone: string;
  type: string;
  status: string;
  extractedPayload: Record<string, unknown> | null;
}

export class WhatsAppRepository {
  async bindPhone(params: { userId: string; phone: string; provider?: string }) {
    const { data, error } = await supabase
      .from("user_phone_bindings")
      .upsert(
        {
          user_id: params.userId,
          phone_e164: params.phone,
          provider: params.provider || "whatsapp_cloud_api",
          is_verified: true,
          updated_at: nowIso(),
        },
        { onConflict: "phone_e164" }
      )
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Erro ao vincular telefone");
    }

    return data;
  }

  async getBindingByUser(userId: string) {
    const { data, error } = await supabase
      .from("user_phone_bindings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return null;
    return data ?? null;
  }

  async findUserByPhone(phone: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("user_phone_bindings")
      .select("user_id")
      .eq("phone_e164", phone)
      .maybeSingle();

    if (error || !data) return null;
    return data.user_id;
  }

  async findInboundByProviderMessageId(providerMessageId: string): Promise<InboundMessageRecord | null> {
    const { data, error } = await supabase
      .from("inbound_messages")
      .select("id, provider_message_id, user_id, from_phone, message_type, status, extracted_payload")
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      providerMessageId: data.provider_message_id,
      userId: data.user_id,
      fromPhone: data.from_phone,
      type: data.message_type,
      status: data.status,
      extractedPayload: data.extracted_payload,
    };
  }

  async createInboundMessage(params: {
    event: WhatsAppInboundEvent;
    userId: string | null;
    status: string;
  }): Promise<InboundMessageRecord> {
    const { data, error } = await supabase
      .from("inbound_messages")
      .insert({
        provider: params.event.provider,
        provider_message_id: params.event.providerMessageId,
        user_id: params.userId,
        from_phone: params.event.fromPhone,
        to_phone: params.event.toPhone ?? null,
        message_type: params.event.type,
        text_body: params.event.text ?? null,
        raw_payload: params.event.rawPayload,
        status: params.status,
        received_at: params.event.timestamp ? new Date(params.event.timestamp).toISOString() : nowIso(),
      })
      .select("id, provider_message_id, user_id, from_phone, message_type, status, extracted_payload")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Erro ao salvar mensagem inbound");
    }

    return {
      id: data.id,
      providerMessageId: data.provider_message_id,
      userId: data.user_id,
      fromPhone: data.from_phone,
      type: data.message_type,
      status: data.status,
      extractedPayload: data.extracted_payload,
    };
  }

  async updateInboundMessage(params: {
    id: string;
    status: string;
    confidenceScore?: number;
    extractedPayload?: Record<string, unknown>;
    errorMessage?: string | null;
  }) {
    const payload: Record<string, unknown> = {
      status: params.status,
      processed_at: nowIso(),
      updated_at: nowIso(),
    };

    if (params.confidenceScore !== undefined) payload.confidence_score = params.confidenceScore;
    if (params.extractedPayload !== undefined) payload.extracted_payload = params.extractedPayload;
    if (params.errorMessage !== undefined) payload.error_message = params.errorMessage;

    const { error } = await supabase
      .from("inbound_messages")
      .update(payload)
      .eq("id", params.id);

    if (error) {
      throw new Error(error.message || "Erro ao atualizar mensagem inbound");
    }
  }

  async createCandidate(params: {
    userId: string;
    inboundMessageId: string;
    kind: "income" | "expense";
    amount: number;
    currency: string;
    description: string;
    merchant?: string;
    categorySuggestion?: string;
    transactionDate: Date;
    confidenceScore: number;
    status: string;
    evidence?: Record<string, unknown>;
    persistedTransactionId?: string;
  }) {
    const { data, error } = await supabase
      .from("agent_transaction_candidates")
      .insert({
        user_id: params.userId,
        inbound_message_id: params.inboundMessageId,
        proposed_type: params.kind,
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        merchant_name: params.merchant ?? null,
        category_suggestion: params.categorySuggestion ?? null,
        transaction_date: params.transactionDate.toISOString(),
        confidence_score: params.confidenceScore,
        status: params.status,
        evidence: params.evidence ?? null,
        persisted_transaction_id: params.persistedTransactionId ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Erro ao salvar candidato do agente");
    }

    return data;
  }

  async listCandidatesByUser(userId: string, status?: string) {
    let query = supabase
      .from("agent_transaction_candidates")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data;
  }

  async getCandidateById(candidateId: string, userId: string) {
    const { data, error } = await supabase
      .from("agent_transaction_candidates")
      .select("*")
      .eq("id", candidateId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  }

  async updateCandidate(params: {
    candidateId: string;
    userId: string;
    status: string;
    persistedTransactionId?: string;
  }) {
    const patch: Record<string, unknown> = {
      status: params.status,
      updated_at: nowIso(),
    };

    if (params.persistedTransactionId !== undefined) {
      patch.persisted_transaction_id = params.persistedTransactionId;
    }

    const { error } = await supabase
      .from("agent_transaction_candidates")
      .update(patch)
      .eq("id", params.candidateId)
      .eq("user_id", params.userId);

    if (error) {
      throw new Error(error.message || "Erro ao atualizar candidato");
    }
  }

  async createMediaEvidence(params: {
    inboundMessageId: string;
    userId: string | null;
    mediaType: string;
    mimeType?: string;
    storagePath: string;
    sha256: string;
    fileSizeBytes: number;
    ocrText?: string;
    ocrConfidence?: number;
    status: string;
  }) {
    const { error } = await supabase
      .from("media_evidence")
      .insert({
        inbound_message_id: params.inboundMessageId,
        user_id: params.userId,
        media_type: params.mediaType,
        mime_type: params.mimeType ?? null,
        storage_path: params.storagePath,
        sha256: params.sha256,
        file_size_bytes: params.fileSizeBytes,
        ocr_text: params.ocrText ?? null,
        ocr_confidence: params.ocrConfidence ?? null,
        status: params.status,
      });

    if (error) {
      throw new Error(error.message || "Erro ao salvar evidência de mídia");
    }
  }

  async appendProcessingLog(params: {
    inboundMessageId: string;
    userId?: string | null;
    level: "info" | "warn" | "error";
    event: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    const { error } = await supabase
      .from("whatsapp_processing_logs")
      .insert({
        inbound_message_id: params.inboundMessageId,
        user_id: params.userId ?? null,
        level: params.level,
        event: params.event,
        message: params.message,
        metadata: params.metadata ?? null,
      });

    if (error) {
      throw new Error(error.message || "Erro ao registrar log de WhatsApp");
    }
  }
}

