/**
 * Novo Chat Agent - Versão Simplificada e Eficaz
 * Substitui a lógica complicada anterior por uma arquitetura real de agente financeiro
 */

import { buildFinancialContext } from "./buildFinancialContext";
import {
  addConversationContext,
  getRecentContext,
  recordLastAction,
  getSessionMemory,
  seedConversationContext,
  updateSessionMemory,
} from "./sessionMemory";
import { buildConversationalPrompt } from "./conversationalPrompt";
import type { User } from "@shared/schema";
import fetch from "node-fetch";
import { executeAgentActions, type AgentActionResult } from "./agentActionsHandler";
import { fetchChatHistory, saveChatHistoryMessage, type ChatHistoryRow } from "./chatHistory";

export interface ChatRequest {
  content: string;
  userId: string;
  user: User;
  insightFocus?: "economy" | "debt" | "investments" | null;
}

export interface ChatResponse {
  userMessage: { id: string; role: string; content: string; createdAt: string };
  assistantMessage: { id: string; role: string; content: string; createdAt: string };
  actions: AgentActionResult[];
}

export async function processAgentChat(req: ChatRequest): Promise<ChatResponse> {
  const { content, userId, user, insightFocus } = req;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada");
  }

  const session = getSessionMemory(userId);
  if (!session.hydrated) {
    const history = await fetchChatHistory(userId, 20);
    if (history.length) {
      seedConversationContext(userId, history);
    } else {
      updateSessionMemory(userId, { hydrated: true });
    }
  }

  const recentContext = getRecentContext(userId, 6);

  const userMessageRow = await saveChatHistoryMessage(userId, "user", content);
  addConversationContext(userId, "user", content);

  let resolvedAccountType = detectAccountTypeFromText(content) ?? session.lastAccountType;

  if (session.awaitingAccountType) {
    const answerType = detectAccountTypeFromText(content) ?? detectAccountTypeFromAnswer(content);
    const inferred = answerType || session.lastAccountType || "PF";
    resolvedAccountType = inferred;
    updateSessionMemory(userId, {
      awaitingAccountType: false,
      lastAccountType: inferred,
    });
  }

  if (!resolvedAccountType) {
    updateSessionMemory(userId, { awaitingAccountType: true });
    const question = "Isso é da sua conta pessoal ou da sua conta da empresa (PJ)?";
    const assistantQuestion = await saveChatHistoryMessage(userId, "assistant", question);
    addConversationContext(userId, "assistant", question);
    return {
      userMessage: mapHistoryToResponse(userMessageRow),
      assistantMessage: mapHistoryToResponse(assistantQuestion),
      actions: [],
    };
  }

  updateSessionMemory(userId, { lastAccountType: resolvedAccountType });
  const financialContext = await buildFinancialContext(userId, resolvedAccountType);

  // 4. CONSTRUIR PROMPT - Usar prompt conversacional existente
  const conversationalPrompt = buildConversationalPrompt("", financialContext?.asPrompt || "", insightFocus ?? null);

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
        { role: "system", content: conversationalPrompt },
        ...recentContext.map((msg) => ({ role: msg.role, content: msg.content })),
        { role: "user", content },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[AI AGENT] OpenAI erro:", response.status, errorText);
    throw new Error(`Falha ao chamar OpenAI: ${response.status}`);
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

  let actionResults: AgentActionResult[] = [];
  if (aiResponse.actions && Array.isArray(aiResponse.actions) && aiResponse.status !== "clarify") {
    actionResults = await executeAgentActions(user, aiResponse.actions, financialContext);
    const lastSuccess = actionResults.find((result) => result.success);
    if (lastSuccess) {
      const intention = mapResultTypeToIntention(lastSuccess.type);
      recordLastAction(userId, intention, lastSuccess.type, lastSuccess.entityId, lastSuccess.entityName);
      const accountTypeFromResult = extractAccountTypeFromResult(lastSuccess);
      if (accountTypeFromResult) {
        updateSessionMemory(userId, { lastAccountType: accountTypeFromResult });
      }
      if (lastSuccess.type === "transaction" && lastSuccess.data?.type) {
        const txType = lastSuccess.data.type === "entrada" ? "income" : "expense";
        updateSessionMemory(userId, { lastTransactionType: txType as "income" | "expense" });
      }
    }
  }

  // 8. SALVAR RESPOSTA DO ASSISTENTE
  const assistantMessageRow = await saveChatHistoryMessage(userId, "assistant", assistantReply);

  // 9. ATUALIZAR MEMÓRIA DE SESSÃO
  addConversationContext(userId, "assistant", assistantReply);

  return {
    userMessage: mapHistoryToResponse(userMessageRow),
    assistantMessage: mapHistoryToResponse(assistantMessageRow),
    actions: actionResults,
  };
}

function mapResultTypeToIntention(type: "transaction" | "future_bill" | "goal"): "transaction" | "future_bill" | "goal" | "question" {
  if (type === "transaction") return "transaction";
  if (type === "future_bill") return "future_bill";
  if (type === "goal") return "goal";
  return "question";
}

function mapHistoryToResponse(row: ChatHistoryRow) {
  return {
    id: row.id,
    role: row.role,
    content: row.message,
    createdAt: row.createdAt,
  };
}

function detectAccountTypeFromText(text: string | undefined | null): "PF" | "PJ" | null {
  if (!text) return null;
  const normalized = text.toLowerCase();
  const pjKeywords = ["empresa", "pj", "cnpj", "cliente", "nota", "emiti", "fornecedor", "contrato", "mei", "negócio", "negocio", "serviço", "servico", "projeto", "fatura"];
  const pfKeywords = ["pessoal", "casa", "família", "familia", "cartão", "cartao", "mercado", "aluguel", "minha vida", "salário", "salario"];

  if (pjKeywords.some((kw) => normalized.includes(kw))) {
    return "PJ";
  }
  if (pfKeywords.some((kw) => normalized.includes(kw))) {
    return "PF";
  }
  return null;
}

function detectAccountTypeFromAnswer(text: string): "PF" | "PJ" | null {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return null;
  if (normalized.includes("pessoal") || normalized.includes("pf") || normalized.includes("minha") || normalized.includes("vida")) {
    return "PF";
  }
  if (normalized.includes("empresa") || normalized.includes("pj") || normalized.includes("negócio") || normalized.includes("negocio")) {
    return "PJ";
  }
  return null;
}

function extractAccountTypeFromResult(result: AgentActionResult): "PF" | "PJ" | null {
  const data = result.data;
  if (!data) return null;
  const accountType = data.accountType || data.account_type;
  if (!accountType) return null;
  return String(accountType).toUpperCase() === "PJ" ? "PJ" : "PF";
}
