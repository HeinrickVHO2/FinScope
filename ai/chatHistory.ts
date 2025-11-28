import { supabase } from "../server/supabase";

export type ChatRole = "user" | "assistant";

export interface ChatHistoryRow {
  id: string;
  userId: string;
  role: ChatRole;
  message: string;
  createdAt: string;
}

export async function saveChatHistoryMessage(userId: string, role: ChatRole, message: string): Promise<ChatHistoryRow> {
  const { data, error } = await supabase
    .from("ai_chat_history")
    .insert({
      user_id: userId,
      role,
      message,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Não foi possível salvar o histórico do chat");
  }

  return {
    id: data.id,
    userId: data.user_id,
    role: data.role === "assistant" ? "assistant" : "user",
    message: data.message,
    createdAt: data.created_at,
  };
}

export async function fetchChatHistory(userId: string, limit = 20): Promise<Array<{ role: ChatRole; content: string }>> {
  const { data, error } = await supabase
    .from("ai_chat_history")
    .select("role, message")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data) {
    if (error) {
      console.warn("[AI CHAT] Falha ao buscar histórico:", error);
    }
    return [];
  }

  return data.map((row) => ({
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.message || "",
  }));
}
