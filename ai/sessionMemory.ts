/**
 * Session Memory - Gerencia contexto e memória de cada sessão do usuário
 * Mantém:
 * - Histórico de últimas intenções
 * - Última entidade manipulada
 * - Contexto financeiro em cache
 */

export interface SessionMemory {
  userId: string;
  lastUserMessage: string;
  lastIntention: "transaction" | "future_bill" | "goal" | "question" | null;
  lastEntityType: "transaction" | "investment" | "goal" | "future_bill" | null;
  lastEntityId: string | null;
  lastEntityName: string | null;
  lastAccountType: "PF" | "PJ" | null;
  lastTransactionType: "income" | "expense" | null;
  awaitingAccountType: boolean;
  hydrated: boolean;
  conversationContext: Array<{ role: "user" | "assistant"; content: string }>;
  createdAt: number;
  updatedAt: number;
}

const sessionMemoryMap = new Map<string, SessionMemory>();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos

export function getSessionMemory(userId: string): SessionMemory {
  let session = sessionMemoryMap.get(userId);

  if (!session || Date.now() - session.updatedAt > SESSION_TIMEOUT) {
    session = {
      userId,
      lastUserMessage: "",
      lastIntention: null,
      lastEntityType: null,
      lastEntityId: null,
      lastEntityName: null,
      lastAccountType: null,
      lastTransactionType: null,
      awaitingAccountType: false,
      hydrated: false,
      conversationContext: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    sessionMemoryMap.set(userId, session);
  }

  return session;
}

export function updateSessionMemory(
  userId: string,
  updates: Partial<SessionMemory>
): SessionMemory {
  const session = getSessionMemory(userId);
  const updated = {
    ...session,
    ...updates,
    userId,
    updatedAt: Date.now(),
  };
  sessionMemoryMap.set(userId, updated);
  return updated;
}

export function clearSessionMemory(userId: string): void {
  sessionMemoryMap.delete(userId);
}

export function addConversationContext(
  userId: string,
  role: "user" | "assistant",
  content: string
): void {
  const session = getSessionMemory(userId);
  session.conversationContext.push({ role, content });
  session.hydrated = true;

  // Manter últimas 20 mensagens
  if (session.conversationContext.length > 20) {
    session.conversationContext = session.conversationContext.slice(-20);
  }

  session.updatedAt = Date.now();
}

export function getRecentContext(
  userId: string,
  limit: number = 6
): Array<{ role: "user" | "assistant"; content: string }> {
  const session = getSessionMemory(userId);
  return session.conversationContext.slice(-limit);
}

export function recordLastAction(
  userId: string,
  intention: "transaction" | "future_bill" | "goal" | "question",
  entityType: "transaction" | "investment" | "goal" | "future_bill" | null = null,
  entityId: string | null = null,
  entityName: string | null = null
): void {
  updateSessionMemory(userId, {
    lastIntention: intention,
    lastEntityType: entityType,
    lastEntityId: entityId,
    lastEntityName: entityName,
  });
}

export function shouldAskForClarification(userId: string): boolean {
  const session = getSessionMemory(userId);
  // Se não há intenção clara nas últimas mensagens, pedir clarificação
  return !session.lastIntention;
}

export function seedConversationContext(
  userId: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): void {
  const session = getSessionMemory(userId);
  if (session.hydrated) return;
  session.conversationContext = history.slice(-20);
  session.hydrated = true;
  session.updatedAt = Date.now();
  sessionMemoryMap.set(userId, session);
}
