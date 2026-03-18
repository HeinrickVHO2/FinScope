import { supabase } from "../server/supabase";

export type ChatRole = "user" | "assistant";

export interface ChatHistoryRow {
  id: string;
  userId: string;
  role: ChatRole;
  message: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

type ChatHistoryRecord = {
  id: string;
  user_id: string;
  role: string;
  message: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

type ChatHistoryListRow = {
  role: string;
  message: string;
  metadata?: Record<string, unknown> | null;
};

const MISSING_METADATA_PATTERNS = [
  "could not find the 'metadata' column",
  "column ai_chat_history.metadata does not exist",
  "column \"metadata\" does not exist",
];

function isMissingMetadataColumnError(message?: string | null): boolean {
  const normalized = String(message || "").toLowerCase();
  return MISSING_METADATA_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function mapChatHistoryRow(data: ChatHistoryRecord): ChatHistoryRow {
  return {
    id: data.id,
    userId: data.user_id,
    role: data.role === "assistant" ? "assistant" : "user",
    message: data.message,
    metadata: data.metadata ?? null,
    createdAt: data.created_at,
  };
}

export async function saveChatHistoryMessage(
  userId: string,
  role: ChatRole,
  message: string,
  metadata?: Record<string, unknown> | null,
): Promise<ChatHistoryRow> {
  let { data, error } = await supabase
    .from("ai_chat_history")
    .insert({
      user_id: userId,
      role,
      message,
      metadata: metadata ?? null,
    })
    .select()
    .single();

  if (error && isMissingMetadataColumnError(error.message)) {
    ({ data, error } = await supabase
      .from("ai_chat_history")
      .insert({
        user_id: userId,
        role,
        message,
      })
      .select()
      .single());
  }

  if (error || !data) {
    throw new Error(error?.message || "Nao foi possivel salvar o historico do chat");
  }

  return mapChatHistoryRow(data as ChatHistoryRecord);
}

export async function fetchChatHistory(
  userId: string,
  limit = 20,
): Promise<Array<{ role: ChatRole; content: string; metadata?: Record<string, unknown> | null }>> {
  let data: ChatHistoryListRow[] | null = null;
  let error: { message: string } | null = null;

  {
    const result = await supabase
      .from("ai_chat_history")
      .select("role, message, metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(limit);

    data = (result.data as ChatHistoryListRow[] | null) ?? null;
    error = result.error ? { message: result.error.message } : null;
  }

  if (error && isMissingMetadataColumnError(error.message)) {
    const fallbackResult = await supabase
      .from("ai_chat_history")
      .select("role, message")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(limit);

    data = (fallbackResult.data as ChatHistoryListRow[] | null) ?? null;
    error = fallbackResult.error ? { message: fallbackResult.error.message } : null;
  }

  if (error || !data) {
    if (error) {
      console.warn("[AI CHAT] Falha ao buscar historico:", error);
    }
    return [];
  }

  return data.map((row) => ({
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.message || "",
    metadata: row.metadata ?? null,
  }));
}
