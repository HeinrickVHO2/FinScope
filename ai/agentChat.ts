/**
 * Novo Chat Agent - Versao Simplificada e Eficaz
 * Substitui a logica complicada anterior por uma arquitetura real de agente financeiro
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
import {
  detectExplicitAccountScope,
  getMissingBusinessAccountMessage,
  getSocialAcknowledgementReply,
  isSocialOnlyMessage,
  looksLikeFinancialMutationMessage,
} from "../server/modules/shared/financialMessagePolicy";
import { storage } from "../server/storage";
import { AssistantOrchestrator } from "../server/modules/shared/assistantOrchestrator";
import { resolveModelForText } from "../server/modules/shared/modelRouter";
import { canUseBusinessArea, getInternalAiMode } from "../shared/plans";

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
  const internalAiMode = getInternalAiMode(user.plan);
  const supportsBusinessArea = canUseBusinessArea(user.plan);
  let modelSelection = resolveModelForText(content);

  const userMessageRow = await saveChatHistoryMessage(userId, "user", content);
  addConversationContext(userId, "user", content);
  updateSessionMemory(userId, { lastUserMessage: content });

  let effectiveContent = content;
  const pendingBaseMessage = session.pendingTransactionMessage || session.lastUserMessage;
  const explicitAccountType = supportsBusinessArea ? detectExplicitAccountScope(content) : "PF";
  let resolvedAccountType: "PF" | "PJ" = explicitAccountType ?? "PF";

  if (!supportsBusinessArea && session.awaitingAccountType) {
    updateSessionMemory(userId, {
      awaitingAccountType: false,
      lastAccountType: "PF",
    });
  }

  if (!session.awaitingTransactionAmount && !session.awaitingAccountType && isSocialOnlyMessage(content)) {
    const reply = getSocialAcknowledgementReply();
    updateSessionMemory(userId, {
      pendingTransactionMessage: null,
      awaitingAccountType: false,
      awaitingTransactionAmount: false,
    });
    const assistantMessageRow = await saveChatHistoryMessage(userId, "assistant", reply, {
      model: modelSelection,
      mode: "social_ack",
    });
    addConversationContext(userId, "assistant", reply);
    return {
      userMessage: mapHistoryToResponse(userMessageRow),
      assistantMessage: mapHistoryToResponse(assistantMessageRow),
      actions: [],
      payload: { model: modelSelection, mode: "social_ack" },
    };
  }

  if (session.awaitingTransactionAmount) {
    const inferred = explicitAccountType ?? session.lastAccountType ?? detectExplicitAccountScope(pendingBaseMessage) ?? "PF";
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
        payload: { model: modelSelection },
      };
    }

    effectiveContent = mergeTransactionMessage(baseMessage, content, inferred);
    resolvedAccountType = inferred;
    updateSessionMemory(userId, {
      awaitingTransactionAmount: false,
      awaitingAccountType: false,
      pendingTransactionMessage: null,
      lastAccountType: inferred,
    });
  }

  if (supportsBusinessArea && session.awaitingAccountType) {
    const answerType = detectExplicitAccountScope(content) ?? detectAccountTypeFromAnswer(content) ?? "PF";
    resolvedAccountType = answerType;
    effectiveContent = mergeTransactionMessage(pendingBaseMessage || content, null, answerType);
    updateSessionMemory(userId, {
      awaitingAccountType: false,
      lastAccountType: answerType,
      pendingTransactionMessage: pendingBaseMessage || null,
    });

    if (looksLikeTransactionStatement(pendingBaseMessage || "") && !hasMonetaryAmount(pendingBaseMessage || "")) {
      const question = "Qual foi o valor dessa transação?";
      const assistantQuestion = await saveChatHistoryMessage(userId, "assistant", question);
      addConversationContext(userId, "assistant", question);
      updateSessionMemory(userId, {
        awaitingTransactionAmount: true,
        pendingTransactionMessage: pendingBaseMessage || null,
        lastAccountType: answerType,
      });
      return {
        userMessage: mapHistoryToResponse(userMessageRow),
        assistantMessage: mapHistoryToResponse(assistantQuestion),
        actions: [],
        payload: { model: modelSelection },
      };
    }
  }

  modelSelection = resolveModelForText(effectiveContent);

  if (resolvedAccountType === "PJ" && looksLikeFinancialMutationMessage(effectiveContent)) {
    const accounts = await storage.getAccountsByUserId(userId);
    const hasBusinessAccount = accounts.some((account) => String(account.type || "").toUpperCase() === "PJ");
    if (!hasBusinessAccount) {
      const reply = getMissingBusinessAccountMessage();
      updateSessionMemory(userId, {
        pendingTransactionMessage: null,
        awaitingAccountType: false,
        awaitingTransactionAmount: false,
        lastAccountType: "PF",
      });
      const assistantMessageRow = await saveChatHistoryMessage(userId, "assistant", reply, {
        model: modelSelection,
        mode: "missing_pj_account",
      });
      addConversationContext(userId, "assistant", reply);
      return {
        userMessage: mapHistoryToResponse(userMessageRow),
        assistantMessage: mapHistoryToResponse(assistantMessageRow),
        actions: [],
        payload: { model: modelSelection, mode: "missing_pj_account" },
      };
    }
  }

  const orchestrated = await assistantOrchestrator.handleMessage({
    userId,
    text: effectiveContent,
    channel: "internal_chat",
    plan: user.plan,
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

  if (looksLikeFinanceAssistantQuestion(effectiveContent)) {
    updateSessionMemory(userId, {
      pendingTransactionMessage: null,
      awaitingAccountType: false,
      awaitingTransactionAmount: false,
    });
    const assistantResponse = await buildFinancialAssistantResponse(storage, userId, effectiveContent, "internal_chat", user.plan);
    const assistantReply = assistantResponse.message || await buildFinancialAssistantReply(storage, userId, effectiveContent, "internal_chat", user.plan);
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

  if (looksLikeTransactionStatement(effectiveContent) && !hasMonetaryAmount(effectiveContent)) {
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
      payload: { model: modelSelection },
    };
  }

  updateSessionMemory(userId, {
    lastAccountType: resolvedAccountType,
    pendingTransactionMessage: null,
    awaitingAccountType: false,
    awaitingTransactionAmount: false,
  });
  const financialContext = await buildFinancialContext(
    userId,
    looksLikeFinancialMutationMessage(effectiveContent) ? resolvedAccountType : "ALL",
  );

  const conversationalPrompt = buildConversationalPrompt("", financialContext?.asPrompt || "", insightFocus ?? null, internalAiMode);

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

  let aiResponse: any = {};
  try {
    aiResponse = JSON.parse(aiResponseText);
  } catch {
    aiResponse = {
      status: "success",
      conversationalMessage: aiResponseText,
    };
  }

  const assistantReply = aiResponse.conversationalMessage || aiResponseText;

  let actionResults: AgentActionResult[] = [];
  if (aiResponse.actions && Array.isArray(aiResponse.actions) && aiResponse.status !== "clarify") {
    const sanitizedActions = applyStructuredActionScope(aiResponse.actions, resolvedAccountType);
    const safeActions = looksLikeFinancialMutationMessage(effectiveContent)
      ? sanitizedActions
      : sanitizedActions.filter((action) => action.type !== "transaction" && action.type !== "future_bill");
    actionResults = await executeAgentActions(user, safeActions, financialContext);
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

  const llmPayload = { model: modelSelection };
  const assistantMessageRow = await saveChatHistoryMessage(userId, "assistant", assistantReply, llmPayload);

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

function detectAccountTypeFromAnswer(text: string): "PF" | "PJ" | null {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return null;
  if (normalized.includes("empresa") || normalized.includes("pj") || normalized.includes("negocio")) {
    return "PJ";
  }
  if (normalized.includes("pessoal") || normalized.includes("pf") || normalized.includes("vida")) {
    return "PF";
  }
  return null;
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

function applyStructuredActionScope(actions: Array<{ type: string; data?: Record<string, any> }>, accountType: "PF" | "PJ") {
  return actions.map((action) => {
    if ((action.type === "transaction" || action.type === "future_bill") && action.data) {
      return {
        ...action,
        data: {
          ...action.data,
          account_type: accountType,
        },
      };
    }
    return action;
  });
}
