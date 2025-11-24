/**
 * Novo Chat Agent - Versão Simplificada e Eficaz
 * Substitui a lógica complicada anterior por uma arquitetura real de agente financeiro
 */

import { supabase } from "../server/supabase";
import { buildFinancialContext } from "./buildFinancialContext";
import { getSessionMemory, addConversationContext, getRecentContext, recordLastAction } from "./sessionMemory";
import { buildNewAgentPrompt } from "./newPrompt";
import type { User } from "@shared/schema";

export interface ChatRequest {
  content: string;
  userId: string;
  user: User;
}

export interface ChatResponse {
  userMessage: { id: string; role: string; content: string; createdAt: string };
  assistantMessage: { id: string; role: string; content: string; createdAt: string };
}

export async function processAgentChat(req: ChatRequest): Promise<ChatResponse> {
  const { content, userId, user } = req;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

  // 1. SALVAR MENSAGEM DO USUÁRIO
  const { data: userMessage, error: userError } = await supabase
    .from("ai_messages")
    .insert({ user_id: userId, role: "user", content })
    .select()
    .single();

  if (userError || !userMessage) {
    throw new Error("Falha ao salvar mensagem do usuário");
  }

  // 2. ATUALIZAR MEMÓRIA DE SESSÃO
  addConversationContext(userId, "user", content);
  const recentContext = getRecentContext(userId, 6);

  // 3. CARREGAR CONTEXTO FINANCEIRO REAL
  const financialContext = await buildFinancialContext(userId, "ALL");

  // 4. CONSTRUIR PROMPT COM NOVO AGENTE
  const systemPrompt = buildNewAgentPrompt(
    financialContext?.asPrompt || "Sem histórico financeiro",
    recentContext
  );

  // 5. CHAMAR OPENAI COM CONTEXTO REAL
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        ...recentContext.map((msg) => ({ role: msg.role, content: msg.content })),
        { role: "user", content },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("Falha ao chamar OpenAI");
  }

  const completion = (await response.json()) as any;
  const aiResponseText = completion?.choices?.[0]?.message?.content?.trim();

  if (!aiResponseText) {
    throw new Error("Resposta vazia da IA");
  }

  // 6. PARSEAR RESPOSTA (JSON format)
  let aiResponse: any = {};
  try {
    aiResponse = JSON.parse(aiResponseText);
  } catch {
    // Se falhar, usar como mensagem simples
    aiResponse = {
      status: "success",
      conversationalMessage: aiResponseText,
    };
  }

  const assistantReply = aiResponse.conversationalMessage || aiResponseText;

  // 7. PROCESSAR AÇÕES (se houver)
  if (aiResponse.actions && Array.isArray(aiResponse.actions)) {
    for (const action of aiResponse.actions) {
      try {
        if (action.type === "transaction" && action.data) {
          // Executar ação de transação...
          recordLastAction(userId, "transaction", "transaction", null, action.data.description);
        } else if (action.type === "future_bill" && action.data) {
          recordLastAction(userId, "future_bill", "future_bill", null, action.data.description);
        } else if (action.type === "goal" && action.data) {
          recordLastAction(userId, "goal", "goal", null, action.data.title);
        }
      } catch (err) {
        console.error("[AI AGENT] Erro ao processar ação:", err);
      }
    }
  }

  // 8. SALVAR RESPOSTA DO ASSISTENTE
  const { data: assistantMessage, error: assistantError } = await supabase
    .from("ai_messages")
    .insert({
      user_id: userId,
      role: "assistant",
      content: assistantReply,
    })
    .select()
    .single();

  if (assistantError || !assistantMessage) {
    throw new Error("Falha ao salvar resposta do assistente");
  }

  // 9. ATUALIZAR MEMÓRIA DE SESSÃO
  addConversationContext(userId, "assistant", assistantReply);

  return {
    userMessage: {
      id: userMessage.id,
      role: "user",
      content: userMessage.content,
      createdAt: userMessage.created_at,
    },
    assistantMessage: {
      id: assistantMessage.id,
      role: "assistant",
      content: assistantMessage.content,
      createdAt: assistantMessage.created_at,
    },
  };
}
