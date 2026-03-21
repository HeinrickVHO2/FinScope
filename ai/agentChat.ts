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
import {
  buildFinancialAssistantResponse,
  buildFinancialAssistantReply,
  looksLikeFinanceAssistantQuestion,
} from "../server/modules/shared/financialAssistant";
import { storage } from "../server/storage";
import { AssistantOrchestrator } from "../server/modules/shared/assistantOrchestrator";
import { resolveModelForText } from "../server/modules/shared/modelRouter";

export interface ChatRequest {
  content: string;
  userId: string;
  user: User;
  insightFocus?: "economy" | "debt" | "investments" | null;
}

export interface ChatResponse {
  userMessage: { id: string; role: string; content: string; createdAt: string };
  assistantMessage: { id: string; role: string; content: string; createdAt: string; payload?: Record<string, unknown> | null };
  actions: AgentActionResult[];
  payload?: Record<string, unknown>;
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
  const assistantOrchestrator = new AssistantOrchestrator(storage);
  const modelSelection = resolveModelForText(content);

  const userMessageRow = await saveChatHistoryMessage(userId, "user", content);
  addConversationContext(userId, "user", content);
  updateSessionMemory(userId, { lastUserMessage: content });

  const orchestrated = await assistantOrchestrator.handleMessage({
    userId,
    text: content,
    channel: "internal_chat",
  });
  if (orchestrated.handled && orchestrated.reply) {
    updateSessionMemory(userId, {
      pendingTransactionMessage: null,
      awaitingAccountType: false,
      awaitingTransactionAmount: false,
    });
    const assistantMessageRow = await saveChatHistoryMessage(userId, "assistant", orchestrated.reply, orchestrated.payload ?? null);
    addConversationContext(userId, "assistant", orchestrated.reply);
    return {
      userMessage: mapHistoryToResponse(userMessageRow),
      assistantMessage: mapHistoryToResponse(assistantMessageRow),
      actions: [],
      payload: orchestrated.payload,
    };
  }

  if (looksLikeFinanceAssistantQuestion(content)) {
    updateSessionMemory(userId, {
      pendingTransactionMessage: null,
      awaitingAccountType: false,
      awaitingTransactionAmount: false,
    });
    const assistantResponse = await buildFinancialAssistantResponse(storage, userId, content, "internal_chat");
    const assistantReply = assistantResponse.message || await buildFinancialAssistantReply(storage, userId, content, "internal_chat");
    const fallbackPayload = {
      ...(assistantResponse.payload || {}),
      model: modelSelection,
    };
    const assistantMessageRow = await saveChatHistoryMessage(userId, "assistant", assistantReply, fallbackPayload);
    addConversationContext(userId, "assistant", assistantReply);
    return {
      userMessage: mapHistoryToResponse(userMessageRow),
      assistantMessage: mapHistoryToResponse(assistantMessageRow),
      actions: [],
      payload: fallbackPayload,
    };
  }

  let effectiveContent = content;
  const pendingBaseMessage = session.pendingTransactionMessage || session.lastUserMessage;
  const explicitAccountType = detectAccountTypeFromText(content);
  let resolvedAccountType = explicitAccountType ?? (shouldReuseLastAccountType(content) ? session.lastAccountType : null);

  if (session.awaitingTransactionAmount) {
    const inferred = explicitAccountType ?? session.lastAccountType ?? detectAccountTypeFromText(pendingBaseMessage) ?? "PF";
    const baseMessage = pendingBaseMessage || content;
    if (!hasMonetaryAmount(content)) {
      const question = "Qual foi o valor dessa transação?";
      const assistantQuestion = await saveChatHistoryMessage(userId, "assistant", question);
      addConversationContext(userId, "assistant", question);
      updateSessionMemory(userId, {
        awaitingTransactionAmount: true,
        pendingTransactionMessage: baseMessage,
        lastAccountType: inferred,
      });
      return {
        userMessage: mapHistoryToResponse(userMessageRow),
        assistantMessage: mapHistoryToResponse(assistantQuestion),
        actions: [],
        payload: {
          model: modelSelection,
        },
      };
    }

    effectiveContent = mergeTransactionMessage(baseMessage, content, inferred);
    resolvedAccountType = inferred;
    updateSessionMemory(userId, {
      awaitingTransactionAmount: false,
      pendingTransactionMessage: null,
      lastAccountType: inferred,
    });
  }

  if (session.awaitingAccountType) {
    const answerType = detectAccountTypeFromText(content) ?? detectAccountTypeFromAnswer(content);
    const inferred = answerType || session.lastAccountType || "PF";
    resolvedAccountType = inferred;
    effectiveContent = mergeTransactionMessage(pendingBaseMessage || content, null, inferred);
    updateSessionMemory(userId, {
      awaitingAccountType: false,
      lastAccountType: inferred,
      pendingTransactionMessage: pendingBaseMessage || null,
    });

    if (looksLikeTransactionStatement(pendingBaseMessage || "") && !hasMonetaryAmount(pendingBaseMessage || "")) {
      const question = "Qual foi o valor dessa transação?";
      const assistantQuestion = await saveChatHistoryMessage(userId, "assistant", question);
      addConversationContext(userId, "assistant", question);
      updateSessionMemory(userId, {
        awaitingTransactionAmount: true,
        pendingTransactionMessage: pendingBaseMessage || null,
        lastAccountType: inferred,
      });
      return {
        userMessage: mapHistoryToResponse(userMessageRow),
        assistantMessage: mapHistoryToResponse(assistantQuestion),
        actions: [],
        payload: {
          model: modelSelection,
        },
      };
    }
  }

  if (!resolvedAccountType) {
    updateSessionMemory(userId, { awaitingAccountType: true });
    const question = "Isso é da sua conta pessoal ou da sua empresa?";
    const pendingMessage = looksLikeTransactionStatement(content) ? content : session.pendingTransactionMessage;
    updateSessionMemory(userId, {
      awaitingAccountType: true,
      pendingTransactionMessage: pendingMessage || null,
    });
    const assistantQuestion = await saveChatHistoryMessage(userId, "assistant", question);
    addConversationContext(userId, "assistant", question);
    return {
      userMessage: mapHistoryToResponse(userMessageRow),
      assistantMessage: mapHistoryToResponse(assistantQuestion),
      actions: [],
      payload: {
        model: modelSelection,
      },
    };
  }

  if (
    !session.awaitingTransactionAmount
    && looksLikeTransactionStatement(effectiveContent)
    && !hasMonetaryAmount(effectiveContent)
  ) {
    const question = "Qual foi o valor dessa transação?";
    const assistantQuestion = await saveChatHistoryMessage(userId, "assistant", question);
    addConversationContext(userId, "assistant", question);
    updateSessionMemory(userId, {
      awaitingTransactionAmount: true,
      pendingTransactionMessage: effectiveContent,
      lastAccountType: resolvedAccountType,
    });
    return {
      userMessage: mapHistoryToResponse(userMessageRow),
      assistantMessage: mapHistoryToResponse(assistantQuestion),
      actions: [],
      payload: {
        model: modelSelection,
      },
    };
  }

  updateSessionMemory(userId, {
    lastAccountType: resolvedAccountType,
    pendingTransactionMessage: null,
    awaitingTransactionAmount: false,
  });
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
      model: modelSelection.model || OPENAI_MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: conversationalPrompt },
        ...recentContext.map((msg) => ({ role: msg.role, content: msg.content })),
        { role: "user", content: effectiveContent },
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
        updateSessionMemory(userId, { lastAccountType: accountTypeFromResult, pendingTransactionMessage: null, awaitingTransactionAmount: false });
      }
      if (lastSuccess.type === "transaction" && lastSuccess.data?.type) {
        const txType = lastSuccess.data.type === "entrada" ? "income" : "expense";
        updateSessionMemory(userId, { lastTransactionType: txType as "income" | "expense", pendingTransactionMessage: null, awaitingTransactionAmount: false });
      }
    }
  }

  // 8. SALVAR RESPOSTA DO ASSISTENTE
  const llmPayload = { model: modelSelection };
  const assistantMessageRow = await saveChatHistoryMessage(userId, "assistant", assistantReply, llmPayload);

  // 9. ATUALIZAR MEMÓRIA DE SESSÃO
  addConversationContext(userId, "assistant", assistantReply);

  return {
    userMessage: mapHistoryToResponse(userMessageRow),
    assistantMessage: mapHistoryToResponse(assistantMessageRow),
    actions: actionResults,
    payload: llmPayload,
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
    payload: row.metadata ?? null,
    createdAt: row.createdAt,
  };
}

function detectAccountTypeFromText(text: string | undefined | null): "PF" | "PJ" | null {
  if (!text) return null;
  const normalized = text.toLowerCase();
  const pjKeywords = ["empresa", "pj", "cnpj", "cliente", "nota fiscal", "emiti", "fornecedor", "contrato", "mei", "negócio", "negocio", "faturamento", "fatura"];
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
  if (normalized.includes("empresa") || normalized.includes("pj") || normalized.includes("negócio") || normalized.includes("negocio")) {
    return "PJ";
  }
  if (normalized.includes("pessoal") || normalized.includes("pf") || normalized.includes("vida")) {
    return "PF";
  }
  return null;
}

function shouldReuseLastAccountType(text: string | undefined | null) {
  if (!text) return false;
  const normalized = text.toLowerCase().trim();
  if (!normalized) return false;

  return !/\b(recebi|ganhei|gastei|paguei|comprei|vendi|faturei|pix|entrou|saiu|transferi|depositei|saquei)\b/.test(normalized);
}

function looksLikeTransactionStatement(text: string | undefined | null) {
  if (!text) return false;
  return /\b(recebi|ganhei|gastei|paguei|comprei|vendi|faturei|pix|entrou|saiu|transferi|depositei|saquei)\b/i.test(text);
}

function hasMonetaryAmount(text: string | undefined | null) {
  if (!text) return false;
  const normalized = text.trim().toLowerCase();
  return Boolean(
    /^r\$\s*\d[\d.,]*$/i.test(normalized)
    || /^\d[\d.,]*\s*(reais?|rs|mil)$/i.test(normalized)
    || /^\d[\d.,]*$/.test(normalized)
    || /(?:r\$\s*)\d[\d.,]*/i.test(normalized)
    || /\d[\d.,]*\s*(reais?|rs)\b/i.test(normalized)
    || /\b(recebi|ganhei|gastei|paguei|faturei|pix|entrou|saiu|transferi|depositei|saquei)\b[^.!?\n]{0,16}\b\d[\d.,]*\b/i.test(normalized)
    || /\b(comprei|vendi)\s+\d[\d.,]*\b/i.test(normalized)
    || /\b(comprei|vendi)\b[^.!?\n]{0,24}\bpor\s+\d[\d.,]*\b/i.test(normalized),
  );
}

function mergeTransactionMessage(
  baseMessage: string,
  amountReply: string | null,
  accountType: "PF" | "PJ",
) {
  const accountSuffix = accountType === "PJ" ? "na minha empresa" : "na minha conta pessoal";
  const normalizedBase = stripAccountHint(baseMessage.trim());
  if (amountReply && hasMonetaryAmount(amountReply)) {
    return `${normalizedBase} por ${amountReply.trim()} ${accountSuffix}`.trim();
  }
  return `${normalizedBase} ${accountSuffix}`.trim();
}

function stripAccountHint(text: string) {
  return text
    .replace(/\s+na minha conta pessoal\b/gi, "")
    .replace(/\s+na sua conta pessoal\b/gi, "")
    .replace(/\s+na minha empresa\b/gi, "")
    .replace(/\s+na sua empresa\b/gi, "")
    .trim();
}

function extractAccountTypeFromResult(result: AgentActionResult): "PF" | "PJ" | null {
  const data = result.data;
  if (!data) return null;
  const accountType = data.accountType || data.account_type;
  if (!accountType) return null;
  return String(accountType).toUpperCase() === "PJ" ? "PJ" : "PF";
}
