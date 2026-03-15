import { supabase } from "../../supabase";
import { insertFirstSuccessful } from "../shared/supabaseFallback";
import type { WhatsAppInboundEvent } from "./types";

function nowIso() {
  return new Date().toISOString();
}

export interface PhoneBindingRecord {
  id: string;
  user_id: string;
  phone_e164: string;
  provider: string | null;
  is_verified: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InboundMessageRecord {
  id: string;
  providerMessageId: string;
  userId: string | null;
  fromPhone: string;
  type: string;
  status: string;
  textBody?: string | null;
  extractedPayload: Record<string, unknown> | null;
  receivedAt?: string | null;
}

export interface MediaEvidenceRecord {
  id: string;
  inbound_message_id: string;
  user_id: string | null;
  media_type: string;
  mime_type: string | null;
  storage_path: string;
  sha256: string;
  file_size_bytes: number | null;
  ocr_text: string | null;
  ocr_confidence: number | null;
  status: string;
  created_at?: string | null;
}

function mapInboundRow(data: any): InboundMessageRecord {
  return {
    id: data.id,
    providerMessageId: data.provider_message_id,
    userId: data.user_id,
    fromPhone: data.from_phone,
    type: data.message_type,
    status: data.status,
    textBody: data.text_body ?? null,
    extractedPayload: data.extracted_payload,
    receivedAt: data.received_at ?? null,
  };
}

export class WhatsAppRepository {
  async getBindingByUser(userId: string): Promise<PhoneBindingRecord | null> {
    const { data, error } = await supabase
      .from("user_phone_bindings")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as PhoneBindingRecord;
  }

  async getBindingByPhone(phone: string): Promise<PhoneBindingRecord | null> {
    const { data, error } = await supabase
      .from("user_phone_bindings")
      .select("*")
      .eq("phone_e164", phone)
      .maybeSingle();

    if (error || !data) return null;
    return data as PhoneBindingRecord;
  }

  async saveVerifiedBinding(params: {
    userId: string;
    phone: string;
    provider?: string;
  }): Promise<PhoneBindingRecord> {
    const provider = params.provider || "whatsapp_cloud_api";
    const existingByUser = await this.getBindingByUser(params.userId);
    const existingByPhone = await this.getBindingByPhone(params.phone);

    if (existingByPhone && existingByPhone.user_id !== params.userId && existingByPhone.is_verified !== false) {
      throw new Error("Esse número já está vinculado a outra conta.");
    }

    const payload = {
      user_id: params.userId,
      phone_e164: params.phone,
      provider,
      is_verified: true,
      updated_at: nowIso(),
    };

    if (existingByUser?.id) {
      const { data, error } = await supabase
        .from("user_phone_bindings")
        .update(payload)
        .eq("id", existingByUser.id)
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Erro ao atualizar vínculo do telefone");
      }

      return data as PhoneBindingRecord;
    }

    if (existingByPhone?.id) {
      const { data, error } = await supabase
        .from("user_phone_bindings")
        .update(payload)
        .eq("id", existingByPhone.id)
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Erro ao confirmar vínculo do telefone");
      }

      return data as PhoneBindingRecord;
    }

    const { data, error } = await supabase
      .from("user_phone_bindings")
      .insert({
        ...payload,
        created_at: nowIso(),
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Erro ao salvar vínculo do telefone");
    }

    return data as PhoneBindingRecord;
  }

  async deleteBindingByUser(userId: string): Promise<void> {
    const { error } = await supabase
      .from("user_phone_bindings")
      .delete()
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message || "Erro ao remover vínculo do telefone");
    }
  }

  async findUserByPhone(phone: string): Promise<string | null> {
    const binding = await this.getBindingByPhone(phone);
    if (!binding || binding.is_verified === false) return null;
    return binding.user_id;
  }

  async findInboundByProviderMessageId(providerMessageId: string): Promise<InboundMessageRecord | null> {
    const { data, error } = await supabase
      .from("inbound_messages")
      .select("id, provider_message_id, user_id, from_phone, message_type, status, text_body, extracted_payload, received_at")
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();

    if (error || !data) return null;
    return mapInboundRow(data);
  }

  async createInboundMessage(params: {
    event: WhatsAppInboundEvent;
    userId: string | null;
    status: string;
    extractedPayload?: Record<string, unknown> | null;
    confidenceScore?: number | null;
    errorMessage?: string | null;
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
        confidence_score: params.confidenceScore ?? null,
        extracted_payload: params.extractedPayload ?? null,
        error_message: params.errorMessage ?? null,
        received_at: params.event.timestamp ? new Date(params.event.timestamp).toISOString() : nowIso(),
      })
      .select("id, provider_message_id, user_id, from_phone, message_type, status, text_body, extracted_payload, received_at")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Erro ao salvar mensagem recebida");
    }

    return mapInboundRow(data);
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
      throw new Error(error.message || "Erro ao atualizar mensagem recebida");
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
      throw new Error(error?.message || "Erro ao salvar candidato do WhatsApp");
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

  async listCandidatesByStatuses(userId: string, statuses: string[]) {
    let query = supabase
      .from("agent_transaction_candidates")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (statuses.length) {
      query = query.in("status", statuses);
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
    status?: string;
    persistedTransactionId?: string | null;
    evidence?: Record<string, unknown> | null;
    categorySuggestion?: string | null;
    description?: string;
    amount?: number;
    merchantName?: string | null;
    transactionDate?: Date;
    confidenceScore?: number;
  }) {
    const patch: Record<string, unknown> = { updated_at: nowIso() };

    if (params.status !== undefined) {
      patch.status = params.status;
    }

    if (params.persistedTransactionId !== undefined) {
      patch.persisted_transaction_id = params.persistedTransactionId;
    }
    if (params.evidence !== undefined) patch.evidence = params.evidence;
    if (params.categorySuggestion !== undefined) patch.category_suggestion = params.categorySuggestion;
    if (params.description !== undefined) patch.description = params.description;
    if (params.amount !== undefined) patch.amount = params.amount;
    if (params.merchantName !== undefined) patch.merchant_name = params.merchantName;
    if (params.transactionDate !== undefined) patch.transaction_date = params.transactionDate.toISOString();
    if (params.confidenceScore !== undefined) patch.confidence_score = params.confidenceScore;

    const { error } = await supabase
      .from("agent_transaction_candidates")
      .update(patch)
      .eq("id", params.candidateId)
      .eq("user_id", params.userId);

    if (error) {
      throw new Error(error.message || "Erro ao atualizar candidato");
    }
  }

  async getLatestCandidateByUser(userId: string, statuses: string[]) {
    let query = supabase
      .from("agent_transaction_candidates")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (statuses.length) {
      query = query.in("status", statuses);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return data;
  }

  async getInboundMessagesByIds(ids: string[]) {
    if (!ids.length) return [];

    const { data, error } = await supabase
      .from("inbound_messages")
      .select("id, provider_message_id, user_id, from_phone, message_type, status, text_body, extracted_payload, received_at")
      .in("id", ids);

    if (error || !data) return [];
    return data.map(mapInboundRow);
  }

  async listMediaEvidenceByInboundIds(ids: string[]): Promise<MediaEvidenceRecord[]> {
    if (!ids.length) return [];

    const { data, error } = await supabase
      .from("media_evidence")
      .select("*")
      .in("inbound_message_id", ids)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as MediaEvidenceRecord[];
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
    try {
      await insertFirstSuccessful(
        "media_evidence",
        [
          {
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
          },
          {
            inbound_message_id: params.inboundMessageId,
            user_id: params.userId,
            media_type: params.mediaType,
            mime_type: params.mimeType ?? null,
            storage_path: params.storagePath,
            sha256: params.sha256,
            status: params.status,
          },
        ],
        { select: false, single: false },
      );
    } catch (error) {
      console.warn("[WHATSAPP] media_evidence insert skipped:", error);
    }
  }

  async appendProcessingLog(params: {
    inboundMessageId?: string | null;
    userId?: string | null;
    level: "info" | "warn" | "error";
    event: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!params.inboundMessageId) {
      console.info("[WHATSAPP] persisted processing log skipped: missing inbound_message_id", {
        event: params.event,
        userId: params.userId ?? null,
      });
      return false;
    }

    try {
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
        throw error;
      }

      return true;
    } catch (error) {
      console.warn("[WHATSAPP] whatsapp_processing_logs insert skipped:", error);
      return false;
    }
  }
}
